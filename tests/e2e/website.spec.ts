import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const releasesFixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/releases.json'), 'utf8')) as unknown;

async function stubReleaseCatalog(page: import('@playwright/test').Page) {
  await page.route('**/api/releases', (route) => route.fulfill({ json: releasesFixture }));
}

test('keeps the public website independent of the workbench and opens /app', async ({ page }) => {
  await stubReleaseCatalog(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('让创造，在任何地方发生。');
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('todex.web.')))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: '打开网页版', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('textbox', { name: '消息输入' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: '消息输入' })).toBeVisible();
});

test.describe('live workbench demo', () => {
  test('embeds the real workbench with sample data and leaves saved workbench state alone', async ({ page }) => {
    await stubReleaseCatalog(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('img', { name: /TodeX 工作台实时演示/ }).scrollIntoViewIfNeeded();
    const demo = page.frameLocator('.preview-stage iframe');
    // The desktop's demo fixtures: the Lumen team's checkout conversation.
    await expect(demo.getByText('顺便把错误提示文案改成中文，并保持和设计规范一致的颜色。')).toBeVisible({ timeout: 15_000 });
    await expect(demo.getByText('错误提示已统一为中文', { exact: false })).toBeVisible();
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('todex.web.')))).toEqual([]);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test('autoplays a new conversation from prompt to streamed answer on the landing demo', async ({ page }, testInfo) => {
  // Desktop and phone take different paths (inline sidebar vs. drawer); tablet adds nothing new.
  test.skip(testInfo.project.name === 'tablet', 'Covered by the desktop and mobile layouts.');
  test.setTimeout(60_000);
  await page.goto('/demo?autoplay&lang=en');
  const prompt = 'Add an order summary card to the checkout page: items, discounts, and the total due.';
  await expect(page.getByRole('textbox', { name: 'Message input' })).toHaveText(prompt, { timeout: 20_000 });
  await expect(page.getByText('Bash · pnpm test checkout')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('The order summary card is in place:')).toBeVisible({ timeout: 20_000 });
});

test('keeps the demo in memory, away from the workbench storage on the same origin', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByText('顺便把错误提示文案改成中文，并保持和设计规范一致的颜色。')).toBeVisible({ timeout: 15_000 });
  await page.goto('/demo-isolation-check');
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('todex.')))).toEqual([]);
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name))).not.toContain('todex.web.keys');
});

test('offers Desktop packages per platform and a one-line Backend installer', async ({ page }) => {
  await stubReleaseCatalog(page);
  await page.goto('/#downloads');
  const desktop = page.getByRole('article', { name: 'Desktop 下载' });
  const backend = page.getByRole('article', { name: 'Backend 下载' });
  const installCommand = 'curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash';
  await expect(backend.getByText(installCommand)).toBeVisible();
  await expect(backend.getByRole('link', { name: /^下载 Backend/ })).toHaveCount(0);
  await expect(backend.getByRole('link', { name: '查看安装脚本' })).toHaveAttribute('href', 'https://github.com/youtonghy/TodeX_backend/blob/main/install.sh');
  await page.getByRole('button', { name: 'Windows', exact: true }).click();
  await expect(desktop.getByRole('link', { name: '下载 Desktop v2.0.0 windows ARM64', exact: true })).toHaveAttribute('href', 'https://github.com/youtonghy/TodeX_desktop/releases/download/v2.0.0/TodeX-v2.0.0-windows-arm64.exe');
  await expect(backend.getByText('Windows 请在 WSL 终端中运行此命令。')).toBeVisible();
  await expect(backend.getByRole('link', { name: '或下载原生 Windows 版本' })).toHaveAttribute('href', 'https://github.com/youtonghy/TodeX_backend/releases/latest');
  await page.getByRole('button', { name: 'Linux', exact: true }).click();
  await expect(desktop.getByRole('link', { name: '下载 Desktop v2.0.0 linux x64' })).toHaveAttribute('href', /TodeX-v2\.0\.0-linux-x86_64\.AppImage$/);
  await expect(backend.getByText('Windows 请在 WSL 终端中运行此命令。')).toHaveCount(0);
  await page.getByRole('button', { name: 'macOS', exact: true }).click();
  await expect(desktop.getByRole('link', { name: '下载 Desktop v2.0.0 macos ARM64' })).toHaveAttribute('href', /TodeX-v2\.0\.0-macos-arm64\.dmg$/);
  await expect(page.getByText('暂缓发布 / COMING LATER')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('copies the Backend install command', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await stubReleaseCatalog(page);
  await page.goto('/#downloads');
  const backend = page.getByRole('article', { name: 'Backend 下载' });
  await backend.getByRole('button', { name: '复制安装命令' }).click();
  await expect(backend.getByRole('status')).toHaveText('已复制');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash');
});

test('shows a retryable error panel when the release catalog is unavailable', async ({ page }) => {
  await page.route('**/api/releases', (route) => route.fulfill({ status: 503, json: { code: 'RELEASES_UNAVAILABLE', message: 'GitHub unreachable' } }));
  await page.goto('/#downloads');
  await expect(page.getByText('无法获取 Desktop 版本信息，请检查到 GitHub 的网络连接。')).toBeVisible();
  // The Backend installer does not depend on the release catalog.
  await expect(page.getByRole('article', { name: 'Backend 下载' }).getByRole('button', { name: '复制安装命令' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重试', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('supports navigation at every viewport', async ({ page }) => {
  await stubReleaseCatalog(page);
  await page.goto('/');
  if ((page.viewportSize()?.width ?? 0) <= 600) {
    await page.getByRole('button', { name: '打开导航菜单' }).click();
    const menu = page.getByRole('navigation', { name: '移动导航', exact: true });
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: '下载', exact: true }).click();
    await expect(menu).toHaveCount(0);
  } else {
    await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '下载', exact: true }).click();
  }
  await expect(page).toHaveURL(/#downloads$/);
  await expect(page.getByRole('heading', { name: '准备好，让创造发生。' })).toBeInViewport();
});

test('loads the workbench at nested /app URLs without treating similarly named pages as app routes', async ({ page }) => {
  await stubReleaseCatalog(page);
  await page.goto('/app/conversation/example');
  await expect(page.getByRole('textbox', { name: '消息输入' })).toBeVisible();
  await page.goto('/application');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('让创造，在任何地方发生。');
});

test.describe('serves Simplified Chinese for every Chinese locale', () => {
  test.use({ locale: 'zh-TW' });
  test('renders the zh-CN hero for zh-TW visitors', async ({ page }) => {
    await stubReleaseCatalog(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('让创造，在任何地方发生。');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('zh-CN');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('falls back to English for unsupported locales', () => {
  test.use({ locale: 'fr-FR' });
  test('renders the English hero for fr-FR visitors', async ({ page }) => {
    await stubReleaseCatalog(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Let creation happen, anywhere.');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('serves Japanese for ja-JP visitors', () => {
  test.use({ locale: 'ja-JP' });
  test('renders the Japanese hero', async ({ page }) => {
    await stubReleaseCatalog(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('創造を、どこでも起こそう。');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('ja');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('language switcher', () => {
  test('switches to Korean, persists the choice, and keeps it after reload', async ({ page }) => {
    await stubReleaseCatalog(page);
    await page.goto('/');
    await page.getByRole('button', { name: '语言' }).click();
    await page.getByRole('option', { name: '한국어' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('창작을, 어디서든 일어나게 하세요.');
    expect(await page.evaluate(() => localStorage.getItem('todex.locale'))).toBe('ko');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('창작을, 어디서든 일어나게 하세요.');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('ko');
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('todex.web.')))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
