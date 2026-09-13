import { expect, test, type WebSocketRoute } from '@playwright/test';

test('renders Pi plugin state, protects drafts, routes commands and stops the runtime', async ({ page }, testInfo) => {
  const backend = 'http://127.0.0.1:43119';
  const manifest = { schemaVersion: 1, id: 'pi-browser', provider: 'pi', ownerId: 'test', workspace: '/tmp/pi-browser',
    workspaceId: 'workspace-pi', title: 'Pi 插件验证', status: 'idle', lastSequence: 0,
    createdAt: '2026-09-11T00:00:00Z', updatedAt: '2026-09-11T00:00:00Z' };
  const provider = { id: 'pi', displayName: 'Pi', available: true, profiles: ['default'], models: [],
    capabilities: { nativeResume: true, cancel: true, permissions: false, toolEvents: true, nativeSkills: true,
      nativeMcp: false, managedMcp: false, modelSelection: true, runtimeStop: true, sessionCommands: true,
      controlActions: ['compact'], permissionConfig: { modes: ['full-access'] } } };
  const commands = [
    { name: 'compact', description: '原生插件压缩入口', invocation: 'prompt', source: 'extension' },
    { name: 'usage', description: '用量面板', invocation: 'prompt', source: 'extension',
      packageName: '@tmustier/pi-usage-extension', packageVersion: '0.9.4' },
  ];
  const journal: Record<string, unknown>[] = [];
  const requests: { type: string; payload: Record<string, unknown> }[] = [];
  let socket: WebSocketRoute | undefined;
  const publish = (type: string, payload: Record<string, unknown>, delivery = 'live') => {
    const event = { schemaVersion: 1, eventId: `event-${journal.length + 1}`, conversationId: manifest.id,
      sequence: journal.length + 1, time: new Date().toISOString(), type, payload };
    journal.push(event);
    socket?.send(JSON.stringify({ type: 'conversation.event', delivery, payload: event }));
  };
  await page.route(`${backend}/**`, async route => {
    const url = new URL(route.request().url());
    let body: unknown = {};
    if (url.pathname === '/v2/transport-policy') body = { requiredProtocol: 'none' };
    else if (url.pathname === '/v2/version') body = { name: 'todex-agentd', version: 'test' };
    else if (url.pathname === '/health') body = { status: 'ok' };
    else if (url.pathname.endsWith('/trust')) body = { workspacePath: manifest.workspace, trusted: true };
    else if (url.pathname === '/v2/providers') body = { providers: [provider] };
    else if (url.pathname === '/v2/providers/commands') body = { provider: 'pi', commands, source: 'pi-rpc', catalogSource: 'session', runtimeId: 'runtime-browser' };
    else if (url.pathname === '/v2/providers/models') body = { models: [] };
    else if (url.pathname === '/v2/conversations') body = { conversations: [manifest] };
    else if (url.pathname.endsWith('/events')) {
      const after = Number(url.searchParams.get('afterSequence') || 0);
      body = { conversationId: manifest.id, fromSequence: after, nextSequence: journal.length, hasMore: false,
        events: journal.filter(item => Number(item.sequence) > after) };
    } else if (url.pathname.startsWith('/v2/catalog/')) body = { skills: [], servers: [], tools: [], plugins: [] };
    else if (url.pathname === '/v2/workspaces') body = { workspaces: [{ id: 'workspace-pi', path: manifest.workspace, name: 'Pi smoke', trusted: true }] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body),
      headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.routeWebSocket('ws://127.0.0.1:43119/**', ws => {
    socket = ws;
    ws.onMessage(raw => {
      const message = JSON.parse(String(raw)); requests.push(message);
      ws.send(JSON.stringify({ id: message.id, type: 'server.result', payload: { accepted: true } }));
      if (message.type === 'conversation.runtime.stop') publish('provider.runtime', { provider: 'pi', runtimeId: 'runtime-browser', status: 'stopped', reason: '用户停止，聊天历史已保留' });
      if (message.type === 'conversation.permission.respond') publish('permission.resolved', { permissionId: message.payload.permissionId, scope: 'session', runtimeId: 'runtime-browser' });
      if (message.type === 'conversation.prompt') {
        publish('turn.started', { turnId: 'turn-native', clientRequestId: message.id });
        publish('turn.completed', { turnId: 'turn-native' });
      }
    });
  });
  await page.addInitScript(({ backend, manifest }) => {
    localStorage.setItem('todex.web.settings.v1', JSON.stringify({ serverUrl: backend, encryptionProtocol: 'none', defaultWorkspacePath: manifest.workspace }));
    localStorage.setItem('todex.web.workspaces.v1', JSON.stringify([{ id: 'workspace-pi', name: 'Pi smoke', path: manifest.workspace,
      backendConnectionId: 'default-backend', trusted: true, model: '', sessionId: 'workspace-session', permissionMode: 'full-access' }]));
    localStorage.setItem('todex.web.conversations.v1', JSON.stringify([{ ...manifest, workspaceId: 'workspace-pi', v2ConversationId: manifest.id,
      backendConnectionId: 'default-backend', sessionId: 'v2_pi-browser', mode: 'implement', permissionMode: 'full-access' }]));
    localStorage.setItem('todex.web.activeSelection.v1', JSON.stringify({ workspaceId: 'workspace-pi', conversationId: manifest.id }));
  }, { backend, manifest });
  await page.goto('/app');
  const composer = page.getByPlaceholder('发送消息，或粘贴 / 拖入文本文件');
  await expect(composer).toBeVisible();
  await expect.poll(() => requests.some(item => item.type === 'session.resume')).toBe(true);
  publish('provider.runtime', { provider: 'pi', runtimeId: 'runtime-browser', status: 'ready' });
  const ui = (method: string, values: Record<string, unknown>, delivery = 'live') => publish('extension.ui', { provider: 'pi', runtimeId: 'runtime-browser', scope: 'session', method, ...values }, delivery);
  ui('setTitle', { title: '插件后台' });
  ui('setStatus', { statusKey: 'MCP', statusText: '已连接' });
  ui('setWidget', { widgetKey: 'summary', widgetLines: ['任务准备完成', '等待下一步'], widgetPlacement: 'aboveEditor' });
  ui('setWidget', { widgetKey: 'footer', widgetLines: ['插件补充说明'], widgetPlacement: 'belowEditor' });
  ui('set_editor_text', { text: '历史建议' }, 'replay');
  await expect(composer).toHaveValue('');
  ui('set_editor_text', { text: '新建议' });
  await expect(composer).toHaveValue('新建议');
  await composer.fill('用户未发送的草稿');
  ui('set_editor_text', { text: '替换后的草稿' });
  await expect(page.getByRole('button', { name: '替换草稿', exact: true })).toBeVisible();
  await expect(composer).toHaveValue('用户未发送的草稿');
  await page.getByRole('button', { name: '替换草稿', exact: true }).click();
  await expect(composer).toHaveValue('替换后的草稿');
  publish('extension.message', { provider: 'pi', runtimeId: 'runtime-browser', scope: 'session', messageId: 'custom-visible',
    message: { role: 'custom', customType: 'smoke', content: '插件的 **自定义消息**', display: true } });
  ui('notify', { message: '后台任务完成', notifyType: 'info' });
  await expect(page.getByTestId('pi-extension-aboveEditor').getByText('已连接', { exact: true })).toBeVisible();
  await expect(page.getByTestId('pi-extension-belowEditor').getByText('插件补充说明')).toBeVisible();
  await expect(page.getByText('Pi 插件 · smoke')).toBeVisible();
  await composer.fill('/usage ');
  await composer.press('Enter');
  await expect(composer).toHaveValue('/usage ');
  await expect(page.getByText('此入口依赖 Pi 终端界面，当前 RPC 无法显示。请在 Pi 终端使用此功能。', { exact: true })).toBeVisible();
  expect(requests.some(item => item.type === 'conversation.prompt')).toBe(false);
  await composer.fill('/compact');
  await expect(page.getByRole('option', { name: /原生插件压缩入口/ })).toBeVisible();
  await composer.press('Enter');
  await expect(composer).toHaveValue('/compact ');
  expect(requests.some(item => item.type === 'conversation.compact')).toBe(false);
  await composer.press('Enter');
  await expect.poll(() => requests.some(item => item.type === 'conversation.prompt' && item.payload.text === '/compact')).toBe(true);
  await expect(composer).toHaveValue('');
  for (const method of ['select', 'confirm', 'input', 'editor']) {
    const permissionId = `permission-${method}`;
    publish('permission.requested', { permissionId, kind: 'extension_ui', title: `后台 ${method}`, scope: 'session', runtimeId: 'runtime-browser',
      details: { method, title: `后台 ${method}`, options: ['A', 'B'], prefill: '预填第一行\n预填第二行', scope: 'session', runtimeId: 'runtime-browser' },
      options: [{ optionId: 'answer', name: 'Respond', kind: 'answer' }, { optionId: 'reject_once', name: 'Cancel', kind: 'reject_once' }] });
    const field = page.getByLabel(`后台 ${method}`, { exact: false });
    await expect(field).toBeVisible();
    if (method === 'select' || method === 'confirm') await field.selectOption(method === 'select' ? '1' : 'false');
    else {
      if (method === 'editor') await expect(field).toHaveValue('预填第一行\n预填第二行');
      await field.fill(method === 'editor' ? '回答第一行\n回答第二行' : '后台输入');
    }
    await page.getByRole('button', { name: '提交回答', exact: true }).click();
    await expect(field).toHaveCount(0);
    const expected = method === 'select' ? { value: 'B' } : method === 'confirm' ? { confirmed: false }
      : { value: method === 'editor' ? '回答第一行\n回答第二行' : '后台输入' };
    expect(requests.find(item => item.type === 'conversation.permission.respond' && item.payload.permissionId === permissionId))
      .toMatchObject({ payload: { decision: { data: expected } } });
    await expect(page.getByRole('button', { name: '停止', exact: true })).toHaveCount(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`pi-${testInfo.project.name}.png`), fullPage: true });
  await page.getByRole('button', { name: '停止 Pi 后台运行，保留聊天历史' }).click();
  await expect(page.getByText('后台已停止', { exact: true })).toBeVisible();
  await expect(page.getByText('Pi 插件 · smoke')).toBeVisible();
  expect(requests.some(item => item.type === 'conversation.stop')).toBe(false);
});
