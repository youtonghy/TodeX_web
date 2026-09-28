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

  const answerOption = { optionId: 'answer', name: 'Answer', kind: 'answer' };
  const questionRequest = (questions: unknown[], options: unknown[] = [answerOption]) => classifyPendingRequest({
    type: 'conversation.permission.request',
    payload: { requestId: 'p', permissionId: 'p', kind: 'user_input', options, details: { questions } },
  })!;
  const typeInto = async (input: HTMLInputElement | HTMLTextAreaElement, text: string) => act(async () => {
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const buttonNamed = (dom: HTMLElement, name: string) => [...dom.querySelectorAll('button')].find(item => item.textContent === name)!;
  // Exiting cards stay mounted while they animate out; always read the current one.
  const card = (dom: HTMLElement, index: number) => dom.querySelector<HTMLElement>(`[data-question-index="${index}"]`)!;

  it('answers multi-select questions with every picked label', async () => {
    const select = vi.fn();
    const dom = render(createElement(ConversationPermissionActions, { request: questionRequest([{ id: 'q0', question: 'Which steps?', multiSelect: true,
      options: [{ label: 'commit', description: 'Create a commit' }, { label: 'push' }, { label: 'tag' }] }]), onSelect: select }));
    const boxes = [...dom.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(boxes).toHaveLength(3);
    expect(dom.textContent).toContain('Create a commit');
    // A single question needs no step list or paging.
    expect(dom.querySelector('nav')).toBeNull();
    expect(buttonNamed(dom, '上一题')).toBeUndefined();
    await act(async () => boxes[2].click());
    await act(async () => boxes[0].click());
    await act(async () => buttonNamed(dom, '提交回答').click());
    expect(select).toHaveBeenCalledWith(answerOption, { answers: { q0: { answers: ['commit', 'tag'] } } });
  });

  it('accepts a free-text answer in place of the options when the question allows it', async () => {
    const select = vi.fn();
    const dom = render(createElement(ConversationPermissionActions, { request: questionRequest([
      { id: 'q0', question: 'Which file?', isOther: true, options: [{ label: 'web' }, { label: 'desktop' }] }]), onSelect: select }));
    expect(dom.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    expect(buttonNamed(dom, '提交回答').disabled).toBe(true);
    await typeInto(dom.querySelector<HTMLInputElement>('input[type="text"]')!, 'both files');
    await act(async () => buttonNamed(dom, '提交回答').click());
    expect(select).toHaveBeenCalledWith(answerOption, { answers: { q0: { answers: ['both files'] } } });
  });

  it('keeps the custom answer and a single pick mutually exclusive', async () => {
    const select = vi.fn();
    const dom = render(createElement(ConversationPermissionActions, { request: questionRequest([
      { id: 'q0', question: 'Where?', isOther: true, options: [{ label: 'SQLite' }, { label: 'Postgres' }] }]), onSelect: select }));
    const [sqlite] = dom.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    const other = dom.querySelector<HTMLInputElement>('input[type="text"]')!;
    await act(async () => sqlite.click());
    await typeInto(other, 'Redis');
    expect(sqlite.checked).toBe(false);
    expect(other.closest('label')!.hasAttribute('data-selected')).toBe(true);
    await act(async () => sqlite.click());
    expect(other.closest('label')!.hasAttribute('data-selected')).toBe(false);
    await act(async () => buttonNamed(dom, '提交回答').click());
    expect(select).toHaveBeenCalledWith(answerOption, { answers: { q0: { answers: ['SQLite'] } } });
  });

  it('shows one question at a time and keeps answers while paging back and forth', async () => {
    const select = vi.fn();
    const dom = render(createElement(ConversationPermissionActions, { request: questionRequest([
      { id: 'storage', header: '存储', question: 'Where?', options: [{ label: 'SQLite' }, { label: 'Postgres' }] },
      { id: 'platforms', header: '平台', question: 'Which clients?', multiSelect: true, isOther: true, options: [{ label: 'Web' }, { label: 'iOS' }] },
      { id: 'naming', question: 'What name?' },
    ]), onSelect: select }));
    expect(dom.textContent).toContain('Where?');
    expect(dom.textContent).not.toContain('Which clients?');
    expect(dom.textContent).toContain('1 / 3');
    expect([...dom.querySelectorAll('nav button')].map(item => item.textContent)).toEqual(['存储', '平台', '问题 3']);
    expect(buttonNamed(dom, '上一题').disabled).toBe(true);
    const next = () => [...dom.querySelectorAll('button')].find(item => item.textContent?.startsWith('下一题'))!;
    expect(next().disabled).toBe(true);

    await act(async () => card(dom, 0).querySelectorAll<HTMLInputElement>('input')[1].click());
    await act(async () => next().click());
    expect(card(dom, 1).textContent).toContain('Which clients?');
    await act(async () => card(dom, 1).querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    await typeInto(card(dom, 1).querySelector<HTMLInputElement>('input[type="text"]')!, 'Android');

    await act(async () => buttonNamed(dom, '上一题').click());
    expect(card(dom, 0).querySelectorAll<HTMLInputElement>('input')[1].checked).toBe(true);
    // The step list jumps straight to any question.
    await act(async () => [...dom.querySelectorAll<HTMLButtonElement>('nav button')][2].click());
    expect(buttonNamed(dom, '提交回答').disabled).toBe(true);
    await typeInto(card(dom, 2).querySelector('textarea')!, 'Retention days');
    await act(async () => buttonNamed(dom, '提交回答').click());
    expect(select).toHaveBeenCalledWith(answerOption, { answers: {
      storage: { answers: ['Postgres'] },
      platforms: { answers: ['Web', 'Android'] },
      naming: { answers: ['Retention days'] },
    } });
  });

  it('picks options with number keys and advances with Enter', async () => {
    const select = vi.fn();
    const dom = render(createElement(ConversationPermissionActions, { request: questionRequest([
      { id: 'a', question: 'First?', options: [{ label: 'x' }, { label: 'y' }] },
      { id: 'b', question: 'Second?', options: [{ label: 'z' }] },
    ]), onSelect: select }));
    const press = (target: Element, key: string) => act(async () => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    });
    const first = card(dom, 0).querySelector('input')!;
    await press(first, 'Enter');
    expect(card(dom, 1)).toBeNull();
    await press(first, '2');
    expect(card(dom, 0).querySelectorAll<HTMLInputElement>('input')[1].checked).toBe(true);
    await press(first, 'Enter');
    expect(card(dom, 1).textContent).toContain('Second?');
    // Number keys keep working after focus moves to the step list.
    await press(dom.querySelector('nav button')!, '1');
    await press(card(dom, 1).querySelector('input')!, 'Enter');
    expect(select).toHaveBeenCalledWith(answerOption, { answers: { a: { answers: ['y'] }, b: { answers: ['z'] } } });
  });

  it('still offers the advertised reject options next to the questions', async () => {
    const abort = { optionId: 'abort_turn', name: 'Abort', kind: 'abort_turn' };
    const select = vi.fn();
    const dom = render(createElement(ConversationPermissionActions, { request: questionRequest([
      { id: 'q0', question: 'Which?', options: [{ label: 'a' }] }], [answerOption, abort]), onSelect: select }));
    await act(async () => buttonNamed(dom, '拒绝并停止本轮').click());
    expect(select).toHaveBeenCalledWith(abort);
  });
});
