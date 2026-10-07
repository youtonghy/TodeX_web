import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Runs only against a throwaway backend started by
// `scripts/e2e-transport-backend.py start ...` (see that script): it listens on
// 0.0.0.0 with ml-kem-768, and the browser reaches it through the LAN address,
// so every API call must use transport v2.
const fixturePath = process.env.TODEX_E2E_TRANSPORT_FIXTURE;
const script = fileURLToPath(new URL('../../scripts/e2e-transport-backend.py', import.meta.url));

test.skip(!fixturePath, 'set TODEX_E2E_TRANSPORT_FIXTURE to a fixture.json from scripts/e2e-transport-backend.py');

type Fixture = { root: string; lanUrl: string; workspace: string; pairing: Record<string, unknown> };

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

test('pairs with v3, chats and reads history over transport v2 only', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough');
  test.setTimeout(180_000);
  const fixture = JSON.parse(readFileSync(fixturePath!, 'utf8')) as Fixture;
  const traffic = recordBackendTraffic(page, fixture.lanUrl);
  const frames: { sent: (string | Buffer)[]; received: (string | Buffer)[] } = { sent: [], received: [] };
  page.on('websocket', (socket) => {
    socket.on('framesent', (frame) => frames.sent.push(frame.payload));
    socket.on('framereceived', (frame) => frames.received.push(frame.payload));
  });

  await page.addInitScript(({ serverUrl }) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('todex.locale', 'zh-CN');
    localStorage.setItem('todex.web.settings.v1', JSON.stringify({ serverUrl, encryptionProtocol: 'none' }));
  }, { serverUrl: fixture.lanUrl });
  await page.goto('/app');

  // 1. Without a pinned key the remote backend is refused with pairing guidance.
  await page.waitForTimeout(3_000);
  // Only the unauthenticated health poll may reach it.
  expect(traffic.http.filter(({ path }) => path !== '/health')).toEqual([]);
  expect(traffic.sockets).toEqual([]);

  // 2. Import the pairing link (pins the ml-kem-768 key); pairing v3 starts on its own.
  await page.getByText('TodeX', { exact: true }).last().click();
  await page.getByRole('menuitem', { name: '设置' }).click();
  await page.getByRole('textbox', { name: '配对内容' }).fill(JSON.stringify(fixture.pairing));
  await page.getByRole('button', { name: '导入粘贴内容' }).click();
  const code = page.getByText(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
  await expect(code).toBeVisible({ timeout: 20_000 });
  const summary = JSON.parse(execFileSync('python3', [script, 'approve', '--fixture', fixture.root], { encoding: 'utf8' })) as { verificationCode: string };
  expect(await code.textContent()).toBe(summary.verificationCode);
  await page.screenshot({ path: testInfo.outputPath('paired.png') });
  await expect.poll(() => traffic.sockets.length, { timeout: 30_000 }).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // 3. Workspace and conversation (REST through the tunnel), then a prompt over the v2 socket.
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

  // 4. Reload: the history comes back over REST (sealed) and the socket reconnects with tv=2.
  const before = traffic.http.length;
  await page.reload();
  await openReply();
  expect(traffic.http.slice(before).some(({ path }) => path === '/v2/sealed')).toBe(true);

  // 5. Nothing but the allow-listed routes, the tunnel and tv=2 sockets left the browser,
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
