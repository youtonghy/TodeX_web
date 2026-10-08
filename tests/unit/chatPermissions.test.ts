import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '@heroui/react';
import { ChatPanel } from '../../src/renderer/screens/ChatPanel';
import { ConversationPermissionActions, PermissionRequestCard } from '../../src/renderer/components/ConversationRunStatus';
import { deviceIdentityFromSecret } from '@todex/protocol/deviceAuth';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';
vi.hoisted(() => { window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null }); });
let root: Root;
let container: HTMLDivElement;
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React });
  window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  globalThis.CSS ??= { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`) } as typeof CSS;
  HTMLElement.prototype.scrollIntoView ??= () => {};
  Element.prototype.scrollTo ??= () => {};
});
afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.useRealTimers(); });
function render(provider = 'codex', readonly = false, missingCapabilities = false) {
  const session = {
    activeConversation: { id: 'c', workspaceId: 'w', provider, title: 'Test', mode: 'implement' },
    activeWorkspace: { id: 'w', path: '/tmp', ...(readonly ? { sandboxMode: 'read-only' } : {}) },
    connectionState: 'open', recoveringConversations: {}, openStatusByConversation: {}, settings: {}, timeline: [], pendingRequests: [], conversations: [], usageRecords: [], modelCatalog: [],
    v2Providers: [{ id: provider, available: true, profiles: [], models: [], capabilities: { permissionConfig: { modes: provider === 'pi' ? ['full-access'] : ['ask', 'auto', 'full-access'], defaultMode: provider === 'pi' ? 'full-access' : 'ask', supportsPlan: provider === 'codex' } } }],
    applyConversationPermissionMode: vi.fn(async () => true), applyConversationWorkMode: vi.fn(async () => true),
    chatDrafts: {}, composerSelections: {}, composerAttachments: {}, getProviderCommandCatalog: vi.fn(), refreshProviderCommands: vi.fn(), pendingPluginDrafts: {}, stoppingProviderRuntimes: {}, thinkingConversations: {}, submissionStatusByConversation: {}, conversationRuntimeById: {}, compactionByConversation: {}, providerModels: {}, providerImageInput: {}, contextUsageByConversation: {}, selectedSkills: {}, controlStatusByConversation: {}, turnIds: {},
  } as unknown as TodeXSession;
  if (missingCapabilities) delete session.v2Providers[0].capabilities.permissionConfig;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  act(() => root.render(createElement(React.StrictMode, null, createElement(ChatPanel, { session }))));
  return session;
}
it('Pi shows fixed full access without a plan control', () => {
  render('pi');
  expect(container.textContent).toContain('完全访问');
  expect(container.textContent).not.toContain('选择工作模式');
  const triggers = [...container.querySelectorAll('button')];
  expect(triggers.find(button => button.textContent?.includes('完全访问'))?.disabled).toBe(true);
});
it('old read-only permits choosing the sole Pi mode explicitly', () => {
  render('pi', true);
  const trigger = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('请选择权限'));
  expect(trigger).toBeDefined(); expect(trigger?.disabled).toBe(false);
});
it('Codex permission and plan selectors call the session configuration API', async () => {
  const session = render();
  const trigger = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('请求审批'))!;
  await act(async () => { trigger.click(); });
  const options = [...document.querySelectorAll('[role="option"]')];
  expect(options.map(option => option.textContent)).toEqual(['请求审批', '自动审批', '完全访问']);
  await act(async () => { (options.find(option => option.textContent === '自动审批') as HTMLElement).click(); });
  expect(session.applyConversationPermissionMode).toHaveBeenCalledWith('c', 'auto');
  const planTrigger = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('执行'))!;
  await act(async () => { planTrigger.click(); });
  const plan = [...document.querySelectorAll('[role="option"]')].find(option => option.textContent === '计划') as HTMLElement;
  await act(async () => { plan.click(); });
  expect(session.applyConversationWorkMode).toHaveBeenCalledWith('c', 'plan');
});

it('shows missing permission capability once as a toast and clears it when resolved', () => {
  vi.useFakeTimers();
  const warning = vi.spyOn(toast, 'warning').mockReturnValue('permission-notice');
  const close = vi.spyOn(toast, 'close').mockImplementation(() => {});
  const session = render('codex', false, true);
  const rerender = () => act(() => root.render(createElement(React.StrictMode, null, createElement(ChatPanel, { session }))));
  const message = '当前后端尚未提供权限模式能力，请升级或检查 Agent 配置。';
  act(() => vi.advanceTimersByTime(0));
  expect(warning).toHaveBeenCalledExactlyOnceWith(message, expect.objectContaining({ timeout: 6000 }));
  expect(container.textContent).not.toContain(message);
  expect(container.textContent).toContain('权限不可配置');
  session.chatDrafts = { c: 'typing should not repeat the notice' };
  rerender();
  act(() => vi.advanceTimersByTime(0));
  expect(warning).toHaveBeenCalledOnce();
  session.v2Providers[0].capabilities.permissionConfig = { modes: ['ask'], defaultMode: 'ask', supportsPlan: false };
  rerender();
  expect(close).toHaveBeenCalledWith('permission-notice');
  delete session.v2Providers[0].capabilities.permissionConfig;
  rerender();
  act(() => vi.advanceTimersByTime(0));
  expect(warning).toHaveBeenCalledTimes(2);
});

it('requests naming their answering devices show buttons only on those devices', () => {
  const secret = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
  const deviceId = deviceIdentityFromSecret(secret)!.deviceId;
  const onSelect = vi.fn();
  const request = {
    requestId: 'p', requestType: 'permission', title: 'Use the desktop browser?', event: {} as never,
    data: {
      kind: 'desktop_browser', allowedDeviceIds: [deviceId],
      details: { executors: [{ deviceId, deviceName: 'Studio Mac' }] },
      options: [{ optionId: 'allow', name: '允许', kind: 'allow_always' }, { optionId: 'reject', name: '拒绝', kind: 'reject_once' }],
    },
  };
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  act(() => root.render(createElement(ConversationPermissionActions, { request, deviceSecret: undefined, onSelect })));
  expect(container.textContent).toContain('请在 Studio Mac 上确认');
  expect(container.querySelector('button')).toBeNull();
  act(() => root.render(createElement(ConversationPermissionActions, { request, deviceSecret: secret, onSelect })));
  expect([...container.querySelectorAll('button')].map(button => button.textContent)).toEqual(['允许', '拒绝']);
});

it('localizes the backend desktop browser approvals: titles from details, option names from the shared set', () => {
  const grant = {
    requestId: 'g', requestType: 'permission', title: 'Allow the agent to use a browser on Studio Mac?', event: {} as never,
    data: {
      kind: 'desktop_browser', details: { host: 'Studio Mac' },
      options: [
        { optionId: 'allow', name: 'Allow for this conversation', kind: 'allow_always' },
        { optionId: 'reject', name: 'Deny', kind: 'reject_once' },
      ],
    },
  };
  const action = {
    requestId: 'a', requestType: 'permission', title: 'Allow the agent to click "Pay" in the browser?', event: {} as never,
    data: {
      kind: 'desktop_browser_action', details: { tool: 'browser_act', action: 'click "Pay"', reason: 'payment' },
      options: [
        { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
        { optionId: 'reject', name: 'Deny', kind: 'reject_once' },
      ],
    },
  };
  const tool = {
    requestId: 't', requestType: 'permission', title: 'Allow x?', event: {} as never,
    data: { kind: 'tool', details: { tool: 'x' }, options: [{ optionId: 'allow_always', name: 'Always allow in this conversation', kind: 'allow_always' }] },
  };
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const show = (request: typeof grant | typeof action | typeof tool) => act(() => root.render(createElement(PermissionRequestCard, { request, fallbackTitle: 'fallback', onSelect: vi.fn() })));
  show(grant);
  expect(container.querySelector('p')?.textContent).toBe('允许 Agent 使用 Studio Mac 上的浏览器？');
  expect([...container.querySelectorAll('button')].map(button => button.textContent)).toEqual(['本对话内允许', '拒绝']);
  show(action);
  expect(container.querySelector('p')?.textContent).toBe('允许 Agent 在浏览器中click "Pay"？');
  expect([...container.querySelectorAll('button')].map(button => button.textContent)).toEqual(['允许本次', '拒绝']);
  show(tool);
  expect(container.querySelector('p')?.textContent).toBe('fallback');
  expect([...container.querySelectorAll('button')].map(button => button.textContent)).toEqual(['本对话内允许']);
});
