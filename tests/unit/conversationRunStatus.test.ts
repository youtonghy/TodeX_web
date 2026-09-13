import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { classifyPendingRequest } from '@todex/protocol/todex';
import { toast } from '@heroui/react';
import { createConversationRuntime } from '@todex/protocol/conversationRuntime';
import { PromptInput } from '@heroui-pro/react/prompt-input';
import { ConversationPermissionActions, ConversationPromptInput, ConversationRunStatus, TurnUsageSummary } from '../../src/renderer/components/ConversationRunStatus';

let root: Root | undefined;
let container: HTMLDivElement | undefined;
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
});
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function render(element: ReturnType<typeof createElement>) {
  if (!container) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  }
  act(() => root!.render(element));
  return container;
}
const base = {
  runtime: { ...createConversationRuntime('c', 'w'), activeTurnId: 't', status: 'running' as const, lastProgressAt: '2026-09-06T00:00:00Z' },
  onRecover: async () => {},
};

describe('conversation run status rendering', () => {
  it('shows unknown execution recovery and invokes the actual HeroUI button', async () => {
    vi.useFakeTimers();
    const warning = vi.spyOn(toast, 'warning').mockReturnValue('unknown');
    const close = vi.spyOn(toast, 'close').mockImplementation(() => {});
    const recover = vi.fn(async () => {});
    const dom = render(createElement(ConversationRunStatus, { ...base, submissionStatus: 'unknown', onRecover: recover }));
    act(() => vi.advanceTimersByTime(0));
    expect(warning).toHaveBeenCalledWith('执行状态待确认', expect.objectContaining({ timeout: 6000 }));
    expect(dom.textContent).not.toContain('执行状态待确认');
    expect(dom.textContent).not.toContain('暂未收到进展');
    const button = [...dom.querySelectorAll('button')].find(item => item.textContent?.includes('核对记录'))!;
    await act(async () => button.click());
    expect(recover).toHaveBeenCalledOnce();
    render(createElement(ConversationRunStatus, { ...base, submissionStatus: 'running', onRecover: recover }));
    expect(close).toHaveBeenCalledWith('unknown');
  });

  it('blocks clicking send and Enter at the real composer boundary while unknown', () => {
    const submit = vi.fn();
    const dom = render(createElement(ConversationPromptInput, { submissionStatus: 'unknown', value: 'Do work', onSubmit: submit, status: 'ready' },
      createElement(PromptInput.Shell, {},
        createElement(PromptInput.TextArea, { 'aria-label': '消息' }),
        createElement(PromptInput.Send, { 'aria-label': '发送' }))));
    const button = dom.querySelector('button')!;
    expect(button.disabled).toBe(true);
    act(() => {
      button.click();
      dom.querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps compaction running visible when capacity also recommends compaction', () => {
    const dom = render(createElement(ConversationRunStatus, { ...base,
      compaction: { status: 'running', recommended: true, updatedAt: '2026-09-06T00:00:00Z' } }));
    expect(dom.textContent).toContain('正在压缩上下文');
    expect(dom.textContent).not.toContain('建议压缩上下文');
    expect(dom.querySelector('button')).toBeNull();
  });

  it('uses one transient toast after locally observed quiet time, never an inline alert', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-06T01:00:00Z'));
    const notify = vi.spyOn(toast, 'info').mockReturnValue('quiet');
    const close = vi.spyOn(toast, 'close').mockImplementation(() => {});
    const dom = render(createElement(ConversationRunStatus, base));
    // Replayed progress from an hour ago does not trigger a warning on mount.
    expect(notify).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(120_000));
    expect(notify).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith('暂未收到新的运行状态', expect.objectContaining({ timeout: 6000 }));
    expect(dom.textContent).not.toContain('暂未收到');
    act(() => vi.advanceTimersByTime(120_000));
    expect(notify).toHaveBeenCalledOnce();
    render(createElement(ConversationRunStatus, { ...base,
      runtime: { ...base.runtime, lastProgressAt: new Date().toISOString() } }));
    expect(close).toHaveBeenCalledWith('quiet');
    act(() => vi.advanceTimersByTime(119_000));
    expect(notify).toHaveBeenCalledOnce();
  });

  it('does not notify while tools run, then starts a fresh wait after completion', () => {
    vi.useFakeTimers();
    const notify = vi.spyOn(toast, 'info').mockReturnValue('quiet');
    vi.spyOn(toast, 'close').mockImplementation(() => {});
    const tool = { id: 'tool', kind: 'system' as const, title: '工具调用', subtitle: 'test', raw: '',
      at: Date.now(), turnId: 't', category: 'tool' as const, phase: 'started' as const };
    render(createElement(ConversationRunStatus, { ...base, runtime: { ...base.runtime, timeline: [tool] } }));
    act(() => vi.advanceTimersByTime(10 * 60_000));
    expect(notify).not.toHaveBeenCalled();
    render(createElement(ConversationRunStatus, { ...base, runtime: { ...base.runtime,
      timeline: [{ ...tool, phase: 'completed' }] } }));
    act(() => vi.advanceTimersByTime(120_000));
    expect(notify).toHaveBeenCalledOnce();
  });

  it.each(['permission', 'unknown', 'recovery', 'disconnected', 'completed'] as const)(
    'does not count quiet time during %s', (mode) => {
      vi.useFakeTimers();
      const notify = vi.spyOn(toast, 'info').mockReturnValue('quiet');
      vi.spyOn(toast, 'close').mockImplementation(() => {});
      const props = { ...base, isRecovering: mode === 'recovery', isConnected: mode !== 'disconnected',
        submissionStatus: mode === 'unknown' ? 'unknown' as const : undefined,
        runtime: { ...base.runtime, status: mode === 'permission' ? 'waitingPermission' as const
          : mode === 'completed' ? 'completed' as const : 'running' as const } };
      render(createElement(ConversationRunStatus, props));
      act(() => vi.advanceTimersByTime(10 * 60_000));
      expect(notify).not.toHaveBeenCalled();
    },
  );

  it('closes an old conversation toast and restarts observation when switching conversations', () => {
    vi.useFakeTimers();
    const notify = vi.spyOn(toast, 'info').mockReturnValue('old');
    const close = vi.spyOn(toast, 'close').mockImplementation(() => {});
    render(createElement(ConversationRunStatus, base));
    act(() => vi.advanceTimersByTime(120_000));
    render(createElement(ConversationRunStatus, { ...base, runtime: { ...base.runtime, conversationId: 'other' } }));
    expect(close).toHaveBeenCalledWith('old');
    act(() => vi.advanceTimersByTime(119_000));
    expect(notify).toHaveBeenCalledOnce();
  });

  it('renders missing usage without invented token counts or TPS', () => {
    const dom = render(createElement(TurnUsageSummary, { records: [] }));
    expect(dom.textContent).toContain('暂无可归属本轮的用量数据');
    expect(dom.textContent).not.toContain('TPS');
    expect(dom.textContent).not.toContain('0 tokens');
  });

  it('does not add cached input twice in rendered turn usage', () => {
    const dom = render(createElement(TurnUsageSummary, { records: [{ id: 'usage', conversationId: 'c', turnId: 't',
      provider: 'codex', model: 'model', inputTokens: 40, outputTokens: 10, cachedInputTokens: 20,
      cacheWriteTokens: 0, cacheSemantics: 'included', totalTokens: 50, updatedAt: 1 }] }));
    expect(dom.textContent).toContain('总计 50 tokens');
    expect(dom.textContent).not.toContain('TPS');
  });
});


describe('permission decision rendering', () => {
  it('shows reject-and-stop only for advertised options and sends the exact option', async () => {
    const reject = { optionId: 'reject_once', name: '拒绝', kind: 'reject_once' };
    const abort = { optionId: 'abort_turn', name: 'Abort', kind: 'abort_turn' };
    const request = (options: unknown[]) => classifyPendingRequest({ type: 'conversation.permission.request',
      payload: { requestId: 'p', permissionId: 'p', options } })!;
    const select = vi.fn();
    let dom = render(createElement(ConversationPermissionActions, { request: request([reject]), onSelect: select }));
    expect(dom.textContent).not.toContain('拒绝并停止本轮');
    dom = render(createElement(ConversationPermissionActions, { request: request([reject, abort]), onSelect: select }));
    const button = [...dom.querySelectorAll('button')].find(item => item.textContent === '拒绝并停止本轮')!;
    await act(async () => button.click());
    expect(select).toHaveBeenCalledWith(abort);
  });
});
