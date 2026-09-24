import { expect, test, type Page } from '@playwright/test';

// The element picker must stay attached to whatever page the browser tab is
// showing, including pages that load (or reload) after it was switched on.
const backend = 'http://127.0.0.1:43120';
const pageUrl = 'http://127.0.0.1:5199/';
const provider = { id: 'codex', displayName: 'Codex', available: true, profiles: ['default'], models: [],
  capabilities: { nativeResume: true, cancel: true, permissions: false, toolEvents: true, nativeSkills: false,
    nativeMcp: false, managedMcp: false, modelSelection: false, permissionConfig: { modes: ['full-access'] } } };
const manifest = { schemaVersion: 1, id: 'browser-inspect', provider: 'codex', ownerId: 'test', workspace: '/tmp/browser-inspect',
  workspaceId: 'workspace-browser', title: '元素选择', status: 'idle', lastSequence: 0,
  createdAt: '2026-09-24T00:00:00Z', updatedAt: '2026-09-24T00:00:00Z' };

async function openBrowserTab(page: Page) {
  const fetches: string[] = [];
  await page.route(`${backend}/**`, async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = {};
    if (url.pathname === '/v2/transport-policy') body = { requiredProtocol: 'none' };
    else if (url.pathname === '/v2/version') body = { name: 'todex-agentd', version: 'test' };
    else if (url.pathname === '/health') body = { status: 'ok' };
    else if (url.pathname.endsWith('/trust')) body = { workspacePath: manifest.workspace, trusted: true };
    else if (url.pathname === '/v2/providers') body = { providers: [provider] };
    else if (url.pathname === '/v2/providers/models') body = { models: [] };
    else if (url.pathname === '/v2/providers/commands') body = { provider: 'codex', commands: [], source: 'none' };
    else if (url.pathname.startsWith('/v2/catalog/')) body = { skills: [], servers: [], tools: [], plugins: [] };
    else if (url.pathname === '/v2/conversations') body = { conversations: [manifest] };
    else if (url.pathname.endsWith('/events')) body = { conversationId: manifest.id, fromSequence: 0, nextSequence: 0, hasMore: false, events: [] };
    else if (url.pathname === '/v2/workspaces') body = { workspaces: [{ id: manifest.workspaceId, path: manifest.workspace, name: 'Browser', trusted: true }] };
    else if (url.pathname === '/v2/browser/fetch') {
      fetches.push(route.request().postData() ?? '');
      body = { url: pageUrl, status: 200, contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><html><body><main><h1 id="title">Weather</h1><button type="button">Refresh forecast</button></main></body></html>' };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.routeWebSocket(`${backend.replace('http', 'ws')}/**`, (ws) => {
    ws.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      ws.send(JSON.stringify({ id: message.id, type: 'server.result', payload: { accepted: true } }));
    });
  });
  await page.addInitScript(({ backend, manifest }) => {
    localStorage.setItem('todex.web.settings.v1', JSON.stringify({ serverUrl: backend, encryptionProtocol: 'none', defaultWorkspacePath: manifest.workspace }));
    localStorage.setItem('todex.web.workspaces.v1', JSON.stringify([{ id: manifest.workspaceId, name: 'Browser', path: manifest.workspace,
      backendConnectionId: 'default-backend', trusted: true, model: '', sessionId: 'workspace-session', permissionMode: 'full-access' }]));
    localStorage.setItem('todex.web.conversations.v1', JSON.stringify([{ ...manifest, v2ConversationId: manifest.id,
      backendConnectionId: 'default-backend', sessionId: 'v2_browser-inspect', mode: 'implement', permissionMode: 'full-access' }]));
    localStorage.setItem('todex.web.activeSelection.v1', JSON.stringify({ workspaceId: manifest.workspaceId, conversationId: manifest.id }));
  }, { backend, manifest });
  page.on('pageerror', (error) => console.log('pageerror', error.message));
  await page.goto('/app');
  await page.getByRole('button', { name: '打开右侧面板' }).click();
  await page.getByRole('button', { name: '新建工作台标签' }).click();
  await page.getByRole('menuitem', { name: '浏览器' }).click();
  await page.getByRole('textbox', { name: '地址' }).fill(pageUrl);
  return fetches;
}

async function pickHeading(page: Page) {
  const frame = page.frameLocator('iframe[title="网页预览"]');
  await frame.getByRole('heading', { name: 'Weather' }).click();
  await expect(page.getByRole('textbox', { name: '消息输入' })).toContainText('[网页元素 h1#title: Weather]');
}

test.describe('browser element picker', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) <= 1024, 'The workbench aside is a sheet on small screens; desktop covers the picker.');

  test('selects an element after the page has loaded', async ({ page }) => {
    const fetches = await openBrowserTab(page);
    await page.getByRole('textbox', { name: '地址' }).press('Enter');
    await expect(page.frameLocator('iframe[title="网页预览"]').getByRole('heading', { name: 'Weather' })).toBeVisible();
    // Reporting the loaded URL back to the tab must not fetch the page again.
    await page.waitForTimeout(300);
    expect(fetches).toHaveLength(1);
    await page.getByRole('button', { name: '选择元素' }).click();
    await pickHeading(page);
  });

  test('stays attached when switched on before the page loads', async ({ page }) => {
    await openBrowserTab(page);
    await page.getByRole('button', { name: '选择元素' }).click();
    await page.getByRole('textbox', { name: '地址' }).press('Enter');
    await pickHeading(page);
  });

  test('stays attached across a refresh', async ({ page }) => {
    await openBrowserTab(page);
    await page.getByRole('textbox', { name: '地址' }).press('Enter');
    await page.getByRole('button', { name: '选择元素' }).click();
    await page.getByRole('button', { name: '刷新网页' }).click();
    await expect(page.frameLocator('iframe[title="网页预览"]').getByRole('heading', { name: 'Weather' })).toBeVisible();
    await pickHeading(page);
  });
});
