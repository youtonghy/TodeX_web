import { expect, test } from '@playwright/test';

test('the Web workbench checks Claude quota each time and preserves the composer', async ({ page, viewport }) => {
  await page.goto('/demo?claude-region=quota');
  await expect(page.getByRole('button', { name: '自定义布局' })).toBeVisible();
  if (viewport && viewport.width <= 768) {
    await page.getByRole('button', { name: '打开导航侧栏' }).click();
  }
  await page.getByRole('grid', { name: '对话' }).getByRole('row', { name: '重构结账页表单校验' }).click();
  const composer = page.getByRole('textbox', { name: '消息输入' });
  await composer.fill('保留这条草稿');
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: /^上下文(?:已使用|用量等待)/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Claude Code 暂不可用' });
    await expect(dialog).toContainText('后端无法确认');
    await dialog.getByRole('button', { name: '关闭' }).click();
  }
  await expect(composer).toHaveText('保留这条草稿');
});
