import { expect, type Page } from '@playwright/test';

/** The workbench starts on its home page; waits until it is up. */
export async function expectHome(page: Page, timeout?: number): Promise<void> {
  await expect(page.getByRole('button', { name: '自定义布局' })).toBeVisible({ timeout });
}

/** From the home page, opens a conversation of the sidebar's list (the first
 * one, or the one called `name`), through the drawer on phones. */
export async function openConversation(page: Page, name?: string): Promise<void> {
  const rows = page.getByRole('grid', { name: '对话' }).getByRole('row', name ? { name } : undefined);
  const drawer = page.getByRole('button', { name: '打开导航侧栏' });
  // Hydrated, so the drawer button is there when the layout has one.
  await expectHome(page);
  if (await drawer.isVisible()) await drawer.click();
  await rows.first().click();
  // The drawer may stay open after the pick; Escape slides it shut.
  if (await drawer.isVisible()) await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: '消息输入' })).toBeVisible();
}
