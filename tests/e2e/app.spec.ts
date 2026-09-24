import { expect, test } from '@playwright/test';

test('renders the responsive three-pane workbench without horizontal overflow', async ({ page }, testInfo) => {
  await page.goto('/app');
  await expect(page).toHaveTitle(/TodeX/);
  await expect(page.getByText('选择一个对话', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const viewport = page.viewportSize();
  if (viewport && viewport.width <= 768) {
    await page.getByRole('button', { name: '打开导航侧栏' }).click();
    await expect(page.getByRole('dialog').getByText('TodeX', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  }
  // Without a workspace there is no workbench scope, so the aside toggle stays disabled.
  await expect(page.getByRole('button', { name: '打开右侧面板' })).toBeDisabled();

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
