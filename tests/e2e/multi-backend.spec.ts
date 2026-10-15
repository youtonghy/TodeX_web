import { existsSync, openSync, closeSync, readdirSync, readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

// Runs only against two throwaway loopback backends. Set
// TODEX_E2E_MULTI_BACKEND to a JSON file:
//   { "backends": [{ "url": "http://127.0.0.1:7391", "dataDir": "...", "workspace": "..." }, { ... }] }
// Each backend runs `todex-agentd daemon-run` on its own port with its own
// temporary data dir and workspace root, fresh for every run (never the
// user's :7345 daemon). The spec pairs this browser with both, keeps both
// connected at once, and gives each its own workspace.
const fixturePath = process.env.TODEX_E2E_MULTI_BACKEND;

test.skip(!fixturePath, 'set TODEX_E2E_MULTI_BACKEND to a fixture JSON with two loopback backends');

type Backend = { url: string; dataDir: string; workspace: string };

/** Approves the backend's pending device pairing request, as its TUI would. */
async function approvePairing(backend: Backend) {
  const directory = join(backend.dataDir, 'device-pairing');
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const requests = existsSync(directory) ? readdirSync(directory).filter((name) => /^request-.*\.json$/.test(name)) : [];
    const pending = requests.find((name) => !existsSync(join(directory, name.replace('request-', 'decision-'))));
    if (pending) {
      const { requestId } = JSON.parse(readFileSync(join(directory, pending), 'utf8')) as { requestId: string };
      const fd = openSync(join(directory, `decision-${requestId}.json`), 'wx', 0o600);
      writeSync(fd, JSON.stringify({ requestId, approved: true }));
      closeSync(fd);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`no pending pairing request on ${backend.url}`);
}

async function pairOnPage(settings: Locator, backend: Backend) {
  await settings.getByRole('button', { name: '设备验证', exact: true }).click();
  await expect(settings.getByText(/^[0-9A-F]{5}-[0-9A-F]{5}$/)).toBeVisible({ timeout: 20_000 });
  await approvePairing(backend);
  await expect(settings.getByText(/· 已连接$/)).toBeVisible({ timeout: 30_000 });
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const settings = page.getByRole('tabpanel', { name: '后端连接' });
  await page.getByRole('tab', { name: '后端连接' }).click();
  return settings;
}

test('keeps several backends connected at once, each with its own workspaces', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough');
  test.setTimeout(180_000);
  const { backends } = JSON.parse(readFileSync(fixturePath!, 'utf8')) as { backends: [Backend, Backend] };
  const [first, second] = backends;
  const sockets: URL[] = [];
  page.on('websocket', (socket) => sockets.push(new URL(socket.url())));

  await page.addInitScript((url) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('todex.locale', 'zh-CN');
    localStorage.setItem('todex.web.settings.v1', JSON.stringify({ serverUrl: url }));
  }, first.url);
  await page.goto('/app');

  // 1. The first backend: open its page from the list and pair.
  const settings = await openSettings(page);
  await settings.locator('[data-backend-id]').first().click();
  await expect(settings.getByRole('textbox', { name: '后端地址' })).toHaveValue(first.url);
  await pairOnPage(settings, first);

  // 2. A second backend: added from the list, it opens on its own page.
  await settings.getByRole('button', { name: '返回设置' }).click();
  await settings.getByRole('button', { name: '添加后端' }).click();
  await settings.getByRole('textbox', { name: '后端地址' }).fill(second.url);
  await pairOnPage(settings, second);

  // 3. The list shows both, both connected, and which one serves None.
  await settings.getByRole('button', { name: '返回设置' }).click();
  const entries = settings.locator('[data-backend-id]');
  await expect(entries).toHaveCount(2);
  for (const entry of await entries.all()) await expect(entry).toContainText('已连接');
  await expect(entries.first()).toContainText('None 工作区');
  await settings.getByRole('button', { name: '无工作区对话的后端' }).click();
  await page.getByRole('option', { name: '新后端' }).click();
  await expect(entries.nth(1)).toContainText('None 工作区');
  await page.screenshot({ path: testInfo.outputPath('backends.png') });
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // 4. One workspace on each backend, picked in the workspace dialog.
  const createWorkspace = async (name: string, backendName: string, path: string) => {
    await page.getByRole('button', { name: '新建工作区' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: '名称' }).fill(name);
    await dialog.getByRole('button', { name: /连接后端/ }).click();
    await page.getByRole('option', { name: new RegExp(`^${backendName}`) }).click();
    await dialog.getByRole('textbox', { name: '目录' }).fill(path);
    await dialog.getByRole('button', { name: '创建' }).click();
    await expect(dialog).toHaveCount(0);
  };
  await createWorkspace('ws-first', '默认后端', first.workspace);
  await createWorkspace('ws-second', '新后端', second.workspace);
  const socketsBefore = sockets.length;
  await page.getByRole('row', { name: 'ws-first' }).click();
  await page.getByRole('row', { name: 'ws-second' }).click();
  await page.getByRole('row', { name: 'ws-first' }).click();
  // Switching between backends only moves the focus: no socket is reopened.
  await page.waitForTimeout(1_000);
  expect(sockets.length).toBe(socketsBefore);
  expect(new Set(sockets.map((url) => url.host))).toEqual(new Set([new URL(first.url).host, new URL(second.url).host]));

  // 5. Each backend stores only its own workspace.
  // The backend may report the resolved path (/private/tmp on macOS).
  const stored = async () => (JSON.parse(await page.evaluate(() => localStorage.getItem('todex.web.workspaces.v1') ?? '[]')) as Array<{ name: string; backendConnectionId?: string | null }>);
  const ownerOf = async (name: string) => (await stored()).find((item) => item.name === name)?.backendConnectionId;
  await expect.poll(() => ownerOf('ws-second')).toBeTruthy();
  expect(await ownerOf('ws-first')).toBeTruthy();
  expect(await ownerOf('ws-first')).not.toBe(await ownerOf('ws-second'));
  await page.screenshot({ path: testInfo.outputPath('workspaces.png') });
});
