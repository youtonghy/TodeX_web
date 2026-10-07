import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Runs only against a throwaway backend started by
// `scripts/e2e-transport-backend.py start ...` (see that script): it listens on
// 0.0.0.0 with ml-kem-768, and the browser reaches it through the LAN address,
// so every API call must use transport v2. The user only enters that address:
// device pairing delivers the transport key and the verification code
// authenticates it, so nothing is imported by hand.
const fixturePath = process.env.TODEX_E2E_TRANSPORT_FIXTURE;
const script = fileURLToPath(new URL('../../scripts/e2e-transport-backend.py', import.meta.url));

test.skip(!fixturePath, 'set TODEX_E2E_TRANSPORT_FIXTURE to a fixture.json from scripts/e2e-transport-backend.py');

type Fixture = { root: string; lanUrl: string; workspace: string; transportPublicKey: string };

/** Every backend request the page makes, with WebSocket upgrades. */
function recordBackendTraffic(page: Page, origin: string) {
  const http: { method: string; path: string; query: string }[] = [];
  const sockets: URL[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === origin && request.method() !== 'OPTIONS') http.push({ method: request.method(), path: url.pathname, query: url.search });
  });
  page.on('websocket', (socket) => {
    const url = new URL(socket.url());
    if (`http://${url.host}` === origin) sockets.push(url);
  });
  return { http, sockets };
}

test('pairs with only the server URL, pins the verified key, chats and reads history over transport v2 only', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough');
  test.setTimeout(180_000);
  const fixture = JSON.parse(readFileSync(fixturePath!, 'utf8')) as Fixture;
  const traffic = recordBackendTraffic(page, fixture.lanUrl);
  const frames: { sent: (string | Buffer)[]; received: (string | Buffer)[] } = { sent: [], received: [] };
  page.on('websocket', (socket) => {
    socket.on('framesent', (frame) => frames.sent.push(frame.payload));
    socket.on('framereceived', (frame) => frames.received.push(frame.payload));
  });

  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('todex.locale', 'zh-CN');
    // An unused loopback port, so the default address never reaches a real daemon on :7345.
    localStorage.setItem('todex.web.settings.v1', JSON.stringify({ serverUrl: 'http://127.0.0.1:9' }));
  });
  await page.goto('/app');

  // 1. Settings has no protocol, key or pairing-import inputs: only the address.
  await page.getByText('TodeX', { exact: true }).last().click();
  await page.getByRole('menuitem', { name: '设置' }).click();
  const settings = page.getByRole('dialog');
  await expect(settings.getByRole('textbox', { name: '后端地址' })).toBeVisible();
  await expect(settings.getByRole('textbox', { name: '加密公钥' })).toHaveCount(0);
  await expect(settings.getByRole('textbox', { name: '配对内容' })).toHaveCount(0);
  await expect(settings.getByRole('button', { name: /^加密/ })).toHaveCount(0);
  await expect(settings.getByText('导入粘贴内容')).toHaveCount(0);
  await expect(settings.locator('input[type="file"], textarea')).toHaveCount(0);
  await settings.getByRole('textbox', { name: '后端地址' }).fill(fixture.lanUrl);

  // 2. Without a verified key the remote backend is refused before any request.
  // The seeded unused address already failed once, so the button may read 重试.
  await settings.getByRole('button', { name: /^(连接|重试)$/ }).click();
  await page.waitForTimeout(2_000);
  // Only the unauthenticated health poll may reach it.
  expect(traffic.http.filter(({ path }) => path !== '/health')).toEqual([]);
  expect(traffic.sockets).toEqual([]);

  // 3. Device pairing: the code and the key fingerprint match the backend TUI;
  // approval pins the ml-kem-768 key and connects on its own.
  await settings.getByRole('button', { name: '设备验证', exact: true }).click();
  const code = page.getByText(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
  await expect(code).toBeVisible({ timeout: 20_000 });
  const summary = JSON.parse(execFileSync('python3', [script, 'approve', '--fixture', fixture.root], { encoding: 'utf8' })) as { verificationCode: string; transportFingerprint: string };
  expect(await code.textContent()).toBe(summary.verificationCode);
  expect(summary.transportFingerprint).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
  await expect(settings.getByText(summary.transportFingerprint).first()).toBeVisible();
  await expect.poll(() => traffic.sockets.length, { timeout: 30_000 }).toBeGreaterThan(0);
  const status = settings.getByLabel('传输加密状态');
  await expect(status).toContainText('ml-kem-768');
  await expect(status).toContainText(summary.transportFingerprint);
  await expect(status).toContainText('已通过设备配对验证');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('todex.web.settings.v1') ?? '{}')))
    .toMatchObject({ serverUrl: fixture.lanUrl, encryptionProtocol: 'ml-kem-768', encryptionPublicKey: fixture.transportPublicKey, transportVerified: true });
  await page.screenshot({ path: testInfo.outputPath('paired.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // 4. Workspace and conversation (REST through the tunnel), then a prompt over the v2 socket.
  await page.keyboard.press('Alt+Shift+N');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').first().fill('transport-v2');
  await dialog.getByText(fixture.workspace, { exact: true }).click();
  await dialog.getByRole('button', { name: '创建' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: '增加对话' }).click();
  const prompt = `${Date.now()} transport v2 e2e`;
  // The new conversation is titled after the first 18 characters of the prompt.
  const conversationRow = page.getByRole('row', { name: prompt.slice(0, 18) });
  const reply = page.getByText(`Fixture Codex: ${prompt}`);
  const openReply = () => expect(async () => {
    await conversationRow.click({ timeout: 5_000 });
    await expect(reply).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
  // Wait until the provider catalog (read through the tunnel) reached the composer.
  await expect(page.getByText('fixture-model').first()).toBeVisible({ timeout: 30_000 });
  const composer = page.getByRole('textbox').last();
  await composer.fill(prompt);
  await composer.press('Enter');
  // The selection can move to the backend's default conversation once the
  // workspace syncs; open the prompted conversation explicitly.
  await openReply();
  await page.screenshot({ path: testInfo.outputPath('reply.png') });

  // 5. Reload: the history comes back over REST (sealed) and the socket reconnects with tv=2.
  const before = traffic.http.length;
  await page.reload();
  await openReply();
  expect(traffic.http.slice(before).some(({ path }) => path === '/v2/sealed')).toBe(true);

  // 6. Nothing but the allow-listed routes, the tunnel and tv=2 sockets left the browser,
  // and no frame carried the prompt in clear text.
  const allowed = (path: string) => path === '/health' || path === '/v2/transport-policy'
    || path === '/v2/sealed' || path.startsWith('/v2/device-pairing/');
  expect(traffic.http.filter(({ path }) => !allowed(path))).toEqual([]);
  expect(traffic.http.filter(({ path }) => path.startsWith('/v2/device-pairing/')).map(({ path }) => path).slice(0, 2))
    .toEqual(['/v2/device-pairing/create', '/v2/device-pairing/reveal']);
  expect(traffic.sockets.length).toBeGreaterThanOrEqual(2);
  for (const url of traffic.sockets) {
    expect(url.pathname).toBe('/v2/ws');
    expect(url.searchParams.get('tv')).toBe('2');
    expect(url.searchParams.get('enc')).toBe('ml-kem-768');
  }
  const textFrames = [...frames.sent, ...frames.received].filter((payload) => typeof payload === 'string') as string[];
  expect(textFrames.every((text) => JSON.parse(text).type === 'todex.transport.hello')).toBe(true);
  const binary = [...frames.sent, ...frames.received].filter((payload) => typeof payload !== 'string') as Buffer[];
  expect(binary.length).toBeGreaterThan(4);
  expect(binary.some((payload) => payload.includes(prompt))).toBe(false);

  console.log('backend traffic:', JSON.stringify(Object.entries(traffic.http.reduce<Record<string, number>>((counts, { method, path }) => {
    counts[`${method} ${path}`] = (counts[`${method} ${path}`] ?? 0) + 1;
    return counts;
  }, {}))), 'sockets:', traffic.sockets.length, 'binary frames:', binary.length);
  await testInfo.attach('traffic', { body: JSON.stringify({ http: traffic.http, sockets: traffic.sockets.map(String) }, null, 2), contentType: 'application/json' });
});
