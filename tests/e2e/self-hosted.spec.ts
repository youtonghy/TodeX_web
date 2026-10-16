import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// Runs only against a throwaway backend from `scripts/e2e-transport-backend.py
// start ...`, with the web server started as a self-hosted deployment of it:
//
//   TODEX_BACKENDS="E2E=<fixture lanUrl>" TODEX_E2E_SELFHOST_FIXTURE=<fixture.json> pnpm test:e2e self-hosted
//
// The browser must reach the backend only through this site's /backend/e2e/
// proxy, and still has to pass device pairing.
const fixturePath = process.env.TODEX_E2E_SELFHOST_FIXTURE;
const script = fileURLToPath(new URL('../../scripts/e2e-transport-backend.py', import.meta.url));

test.skip(!fixturePath, 'set TODEX_E2E_SELFHOST_FIXTURE (and TODEX_BACKENDS for the web server)');

type Fixture = { root: string; lanUrl: string; transportPublicKey: string };

test('a self-hosted deployment pins its backend, proxies every call and still requires device pairing', async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough');
  test.setTimeout(120_000);
  const fixture = JSON.parse(readFileSync(fixturePath!, 'utf8')) as Fixture;
  const site = new URL(baseURL!).origin;
  const backendOrigin = new URL(fixture.lanUrl).origin;
  const direct: string[] = [];
  const proxied: string[] = [];
  const sockets: URL[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === backendOrigin) direct.push(url.pathname);
    if (url.origin === site && url.pathname.startsWith('/backend/')) proxied.push(url.pathname);
  });
  page.on('websocket', (socket) => sockets.push(new URL(socket.url())));

  expect(await (await page.request.get('/api/config')).json()).toEqual({ managed: true, backends: [{ id: 'e2e', name: 'E2E' }] });
  await page.addInitScript(() => localStorage.setItem('todex.locale', 'zh-CN'));
  await page.goto('/');
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole('button', { name: '设置', exact: true }).click();
  const settings = page.getByRole('dialog');
  await settings.getByRole('tab', { name: '后端连接' }).click();
  await expect(settings.locator('[data-backend-id]')).toHaveCount(1);
  await expect(settings.getByRole('button', { name: '添加后端' })).toHaveCount(0);
  await settings.locator('[data-backend-id="deploy-e2e"]').click();
  await expect(settings.getByRole('textbox', { name: '后端地址' })).toHaveCount(0);
  await expect(settings.getByText(`${site}/backend/e2e`).first()).toBeVisible();
  await expect(settings.getByRole('button', { name: '删除后端' })).toHaveCount(0);

  // Unpaired: no authenticated traffic yet.
  expect(sockets).toEqual([]);

  await settings.getByRole('button', { name: '设备验证', exact: true }).click();
  const code = page.getByText(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
  await expect(code).toBeVisible({ timeout: 20_000 });
  const summary = JSON.parse(execFileSync('python3', [script, 'approve', '--fixture', fixture.root], { encoding: 'utf8' })) as { verificationCode: string };
  expect(await code.textContent()).toBe(summary.verificationCode);
  const status = settings.getByLabel('传输加密状态');
  await expect(status).toContainText('ml-kem-768', { timeout: 30_000 });
  await expect(status).toContainText('已通过设备配对验证');
  await expect.poll(() => sockets.length, { timeout: 30_000 }).toBeGreaterThan(0);
  await expect(settings.getByText('已连接').first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath('self-hosted-paired.png') });

  expect(direct).toEqual([]);
  expect(proxied).toContain('/backend/e2e/v2/device-pairing/create');
  expect(proxied).toContain('/backend/e2e/v2/sealed');
  for (const url of sockets.filter((item) => item.pathname !== '/')) {
    expect(url.origin.replace(/^ws/, 'http')).toBe(site);
    expect(url.pathname).toBe('/backend/e2e/v2/ws');
    expect(url.searchParams.get('tv')).toBe('2');
  }
});
