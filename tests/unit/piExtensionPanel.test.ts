import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PiExtensionPanel, type PiExtensionPanelProps } from '../../src/renderer/components/PiExtensionPanel';
import { piExtensionPlainText } from '../../src/renderer/components/piExtensionPresentation';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
});

let root: Root;
let container: HTMLDivElement;
const meta = { runtimeId: 'runtime-a', eventId: 'event-a', sequence: 1 };

function props(overrides: Partial<PiExtensionPanelProps> = {}): PiExtensionPanelProps {
  return {
    placement: 'aboveEditor',
    extensionUi: { runtimeId: 'runtime-a', statuses: {}, widgets: {}, notices: [] },
    providerRuntime: { provider: 'pi', runtimeId: 'runtime-a', status: 'ready' },
    ...overrides,
  };
}
async function render(input: PiExtensionPanelProps) {
  await act(async () => root.render(createElement(PiExtensionPanel, input)));
}
function button(text: string): HTMLButtonElement {
  const result = [...container.querySelectorAll('button')].find(item => item.textContent?.includes(text));
  if (!result) throw new Error(`Missing button: ${text}`);
  return result;
}
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React });
  HTMLElement.prototype.scrollIntoView ??= () => {};
});
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it('shows each text widget at its requested placement and renders plugin text without HTML or terminal commands', async () => {
  const state = props();
  state.extensionUi.title = '<img src=x onerror=alert(1)>插件';
  state.extensionUi.statuses.mcp = { ...meta, key: 'mcp', text: '\u001b[32m已连接\u001b[0m' };
  state.extensionUi.widgets.top = { ...meta, key: 'top', placement: 'aboveEditor', lines: ['输入框上方', '<script>danger()</script>'] };
  state.extensionUi.widgets.bottom = { ...meta, key: 'bottom', placement: 'belowEditor', lines: ['输入框下方'] };
  await render(state);
  expect(container.textContent).toContain('已连接');
  expect(container.textContent).toContain('输入框上方');
  expect(container.textContent).toContain('<script>danger()</script>');
  expect(container.textContent).not.toContain('输入框下方');
  expect(container.querySelector('img,script')).toBeNull();
  expect(container.textContent).not.toContain('\u001b');
  await render({ ...state, placement: 'belowEditor' });
  expect(container.textContent).toContain('输入框下方');
  expect(container.textContent).not.toContain('已连接');
  expect(container.textContent).not.toContain('停止后台运行');
});

it('keeps a pending draft actionable when details are collapsed and only replaces it on explicit action', async () => {
  const pendingEditorRequest = { ...meta, text: '一行\n二行' };
  const onReplaceEditor = vi.fn();
  const onDismissEditor = vi.fn();
  await render(props({ pendingEditorRequest, onReplaceEditor, onDismissEditor }));
  expect(onReplaceEditor).not.toHaveBeenCalled();
  await act(async () => button('Pi 插件').click());
  expect(button('Pi 插件').getAttribute('aria-expanded')).toBe('false');
  expect(button('替换草稿').closest('[hidden]')).toBeNull();
  await act(async () => button('替换草稿').click());
  expect(onReplaceEditor).toHaveBeenCalledExactlyOnceWith(pendingEditorRequest);
  await act(async () => button('取消').click());
  expect(onDismissEditor).toHaveBeenCalledExactlyOnceWith(pendingEditorRequest);
});

it('keeps notifications available for review without an automatic live announcement', async () => {
  const state = props();
  state.extensionUi.notices = [
    { ...meta, message: '导出成功', level: 'info', time: '2026-09-11T00:00:00Z', scope: 'session' },
    { ...meta, eventId: 'event-b', sequence: 2, message: '设置需 Pi 终端', level: 'warning', time: '2026-09-11T00:00:01Z', scope: 'turn' },
  ];
  await render(state);
  expect(button('查看通知记录').getAttribute('aria-expanded')).toBe('false');
  await act(async () => button('查看通知记录').click());
  const history = container.querySelector('ol[aria-label="插件通知记录"]');
  expect(history?.textContent).toContain('导出成功');
  expect(history?.textContent).toContain('设置需 Pi 终端');
  expect(history?.closest('[aria-live]')).toBeNull();
});

it('exposes a separate runtime stop action and disables it when disconnected', async () => {
  const onStopRuntime = vi.fn();
  await render(props({ onStopRuntime }));
  expect(button('停止后台运行').getAttribute('aria-label')).toContain('保留聊天历史');
  await act(async () => button('停止后台运行').click());
  expect(onStopRuntime).toHaveBeenCalledTimes(1);
  await render(props({ onStopRuntime, isConnected: false }));
  expect(button('停止后台运行').disabled).toBe(true);
  expect(container.textContent).toContain('运行状态待确认');
  await render(props({ providerRuntime: { provider: 'pi', runtimeId: 'runtime-a', status: 'stopped', reason: 'user_closed' }, onStopRuntime }));
  expect(container.textContent).toContain('后台已停止');
  expect(container.querySelector('button[aria-label="停止 Pi 后台运行，保留聊天历史"]')).toBeNull();
  expect(container.textContent).toContain('你已停止 Pi 后台运行。');
  expect(container.textContent).not.toContain('user_closed');
  await render(props({ providerRuntime: { provider: 'pi', runtimeId: 'runtime-a', status: 'stopped', reason: '\u001b[31m插件自行结束\u001b[0m' } }));
  expect(container.textContent).toContain('插件自行结束');
  expect(container.textContent).not.toContain('\u001b');
});

it('removes OSC hyperlinks and terminal controls while preserving readable lines and emoji', () => {
  expect(piExtensionPlainText('\u001b]8;;https://example.test\u0007链接\u001b]8;;\u0007\r\n\t完成 ✅\u0000'))
    .toBe('链接\n\t完成 ✅');
  expect(piExtensionPlainText('文本\u001b]0;hidden terminal title')).toBe('文本');
});
