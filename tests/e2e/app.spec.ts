import { expect, test } from '@playwright/test';

test('renders the responsive three-pane workbench without horizontal overflow', async ({ page }, testInfo) => {
  await page.goto('/app');
  await expect(page).toHaveTitle(/TodeX/);
  // A fresh browser opens the default conversation of the None workspace.
  await expect(page.getByRole('textbox', { name: '消息输入' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const viewport = page.viewportSize();
  if (viewport && viewport.width <= 768) {
    // Phones keep the sidebar in a drawer the header button slides open.
    await page.getByRole('button', { name: '打开导航侧栏' }).click();
    await expect(page.getByRole('button', { name: 'TodeX 菜单' })).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'TodeX 菜单' })).not.toBeInViewport();
  }
  await expect(page.getByRole('button', { name: '打开右侧面板' })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}.png`), fullPage: true });
});

test('keeps local state isolated between browser contexts', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  try {
    const firstPage = await first.newPage();
    const secondPage = await second.newPage();
    await Promise.all([firstPage.goto('/app'), secondPage.goto('/app')]);
    // /app is loaded independently of the public site; wait for hydration.
    await Promise.all([firstPage, secondPage].map((page) =>
      expect.poll(() => page.evaluate(() => localStorage.getItem('todex.web.backendConnections.v1'))).not.toBeNull(),
    ));
    await firstPage.evaluate(() => localStorage.setItem('todex.web.backendConnections.v1', JSON.stringify([{ id: 'first' }])));
    const secondStored = await secondPage.evaluate(() =>
      localStorage.getItem('todex.web.backendConnections.v1'),
    );
    expect(secondStored).not.toContain('"id":"first"');
    expect(JSON.parse(secondStored ?? '[]')[0]?.id).toBe('default-backend');
  } finally {
    await Promise.all([first.close(), second.close()]);
  }
});
