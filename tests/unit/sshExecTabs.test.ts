import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement, useCallback, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SshExecRun } from '@todex/protocol/ssh';
import type { ConversationRuntime } from '@todex/protocol/conversationRuntime';
import { WorkbenchPanel } from '../../src/renderer/screens/WorkbenchPanel';
import { SETTINGS_STORAGE_KEY } from '../../src/renderer/session/helpers';
import {
  countLines,
  createSshExecWatch,
  formatSshExecTime,
  isSshExecFailed,
  sshExecTranscript,
  stripAnsi,
  takeNewSshExecs,
  visibleSshExecs,
} from '../../src/renderer/session/sshExecTabs';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';
import type { WorkbenchItem, WorkbenchRequest, WorkbenchTab } from '../../src/renderer/lib/panels';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  HTMLElement.prototype.scrollIntoView ??= () => {};
  Element.prototype.getAnimations ??= () => [];
});

const run = (id: string, patch: Partial<SshExecRun> = {}): SshExecRun => ({
  id, host: 'prod', command: `echo ${id}`, status: 'completed', exitCode: 0, output: [], ...patch,
});
const runtime = (appliedSequence: number, sshExecs: SshExecRun[]) => ({ appliedSequence, sshExecs });
const at = (minute: number, second = 0) => new Date(2026, 9, 5, 10, minute, second).toISOString();

describe('takeNewSshExecs', () => {
  it('only reports calls that start after the conversation became the viewed one', () => {
    const watch = createSshExecWatch();
    // Not loaded yet, then the first (history) runtime only seeds.
    expect(takeNewSshExecs(watch, 'c1', undefined, false)).toEqual([]);
    expect(takeNewSshExecs(watch, 'c1', runtime(10, [run('a')]), false)).toEqual([]);
    // A live call advances the applied sequence.
    expect(takeNewSshExecs(watch, 'c1', runtime(12, [run('a'), run('b')]), false).map(item => item.id)).toEqual(['b']);
    // The same id is never reported twice.
    expect(takeNewSshExecs(watch, 'c1', runtime(13, [run('a'), run('b', { status: 'running' })]), false)).toEqual([]);
  });

  it('ignores history paged in below the window and recovery batches', () => {
    const watch = createSshExecWatch();
    takeNewSshExecs(watch, 'c1', runtime(10, []), false);
    // Earlier page: new ids but the applied sequence did not move.
    expect(takeNewSshExecs(watch, 'c1', runtime(10, [run('old')]), false)).toEqual([]);
    // Recovery replay.
    expect(takeNewSshExecs(watch, 'c1', runtime(40, [run('old'), run('gap')]), true)).toEqual([]);
    expect(takeNewSshExecs(watch, 'c1', runtime(41, [run('old'), run('gap'), run('live')]), false).map(item => item.id)).toEqual(['live']);
  });

  it('reseeds when another conversation becomes the viewed one', () => {
    const watch = createSshExecWatch();
    takeNewSshExecs(watch, 'c1', runtime(1, []), false);
    // c2's past calls never open the log, even though they are unseen.
    expect(takeNewSshExecs(watch, 'c2', runtime(50, [run('x'), run('y')]), false)).toEqual([]);
    expect(takeNewSshExecs(watch, 'c2', runtime(51, [run('x'), run('y'), run('z')]), false).map(item => item.id)).toEqual(['z']);
    // Back to c1: calls made there meanwhile are history too.
    expect(takeNewSshExecs(watch, 'c1', runtime(9, [run('meanwhile')]), false)).toEqual([]);
  });
});

describe('SSH exec log helpers', () => {
  it('strips ANSI colour, OSC and a trailing partial escape', () => {
    expect(stripAnsi('\x1b[1;32mok\x1b[0m \x1b]0;title\x07done\r\n\x1b[3')).toBe('ok done\n');
  });

  it('counts lines, classifies failures and builds a transcript', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a\nb\n')).toBe(2);
    expect(countLines('a\nb')).toBe(2);
    expect(isSshExecFailed(run('a'))).toBe(false);
    expect(isSshExecFailed(run('a', { exitCode: 2 }))).toBe(true);
    expect(isSshExecFailed(run('a', { status: 'cancelled', exitCode: undefined }))).toBe(true);
    expect(isSshExecFailed(run('a', { status: 'failed', exitCode: undefined, failure: 'timedOut' }))).toBe(true);
    expect(sshExecTranscript([
      run('a', { output: [{ stream: 'stdout', data: '\x1b[31mhi\x1b[0m\n' }] }),
      run('b'),
    ])).toBe('$ echo a\nhi\n\n$ echo b');
  });

  it('hides calls known at "clear view" and older ones paged in later', () => {
    const clear = { ids: new Set(['a', 'b']), before: Date.parse(at(2)) };
    const runs = [run('older', { startedAt: at(0) }), run('a', { startedAt: at(1) }), run('b'), run('new', { startedAt: at(3) })];
    expect(visibleSshExecs(runs, clear).map(item => item.id)).toEqual(['new']);
  });
});

describe('Agent SSH log tab', () => {
  let root: Root;
  let container: HTMLDivElement;
  let pushRequest: (request: WorkbenchRequest) => void;
  let runs: SshExecRun[] = [];
  let scopeKey = '';
  let conversationId = '';
  let scopeIndex = 0;
  let requestId = 0;
  const disk = new Map<string, unknown>();
  const tabChanges = vi.fn();
  const storageKey = () => `${SETTINGS_STORAGE_KEY}.workbenchTabs.v1:${scopeKey}`;

  function Harness() {
    const [tab, setTab] = useState<WorkbenchTab>('terminal');
    const [requests, setRequests] = useState<WorkbenchRequest[]>([]);
    pushRequest = (request) => setRequests(current => [...current, request]);
    const onHandled = useCallback((lastId: number) => setRequests(current => current.filter(request => request.id > lastId)), []);
    const onTabChange = useCallback((next: WorkbenchTab) => { tabChanges(next); setTab(next); }, []);
    const session = {
      activeConversation: { id: conversationId }, activeWorkspace: { id: 'w', path: '/w', tenantId: 'local' },
      settings: { serverUrl: 'https://backend.test', deviceSecret: 'test-secret', tenantId: 'local' }, terminalById: {},
      connectionState: 'closed', connectionHealth: { latencyMs: null }, requestTerminalStatus: vi.fn(),
      startTerminalSession: vi.fn(), stopTerminalSession: vi.fn(), resizeTerminalSession: vi.fn(), sendTerminalInput: vi.fn(),
      conversationRuntimeById: { [conversationId]: { sshExecs: runs } as unknown as ConversationRuntime },
    } as unknown as TodeXSession;
    return createElement(WorkbenchPanel, { key: scopeKey, scopeKey, session, tab, onTabChange, requests, onRequestsHandled: onHandled });
  }
  const render = async () => { await act(async () => { root.render(createElement(Harness)); }); };
  const remount = async () => {
    act(() => root.unmount());
    root = createRoot(container);
    await render();
  };
  /** New calls arrive: the runtime grows and App queues one log request. */
  const newCall = async (...added: SshExecRun[]) => {
    runs = [...runs, ...added];
    await render();
    await act(async () => { pushRequest({ id: requestId += 1, kind: 'ssh-exec', conversationId }); });
  };
  const logTabs = () => container.querySelectorAll('button[aria-pressed][aria-label="Agent SSH"]');
  const cards = () => Array.from(container.querySelectorAll<HTMLElement>('[data-ssh-exec]'));
  const cardIds = () => cards().map(card => card.dataset.sshExec);
  const press = async (element: Element | null | undefined) => {
    expect(element).toBeTruthy();
    await act(async () => { (element as HTMLElement).click(); });
  };
  const buttonWithText = (text: string) => Array.from(container.querySelectorAll('button')).find(button => button.textContent?.trim() === text);

  beforeAll(() => { Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); });
  beforeEach(() => {
    disk.clear();
    runs = [];
    // The session-only tab and clear-view state are module state; give every
    // test its own scope and conversation.
    scopeIndex += 1;
    conversationId = `c-${scopeIndex}`;
    scopeKey = JSON.stringify(['conversation', 'backend', 'w', conversationId]);
    Object.assign(window, { todexWeb: { store: {
      get: vi.fn(async (key: string) => disk.get(key)),
      set: vi.fn(async (key: string, value: unknown) => { disk.set(key, JSON.parse(JSON.stringify(value))); }),
    } } });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('keeps every call in one activated tab with a count badge', async () => {
    disk.set(storageKey(), { items: [{ id: 'terminal-1', type: 'terminal', title: '终端 1' }], activeId: 'terminal-1' });
    await render();
    await newCall(run('e1'));
    await newCall(run('e2'));
    await newCall(run('e3', { status: 'running', exitCode: undefined }));
    expect(tabChanges).toHaveBeenLastCalledWith('ssh-exec');
    expect(logTabs()).toHaveLength(1);
    expect(logTabs()[0].getAttribute('aria-pressed')).toBe('true');
    expect(logTabs()[0].textContent).toBe('3');
    expect(cardIds()).toEqual(['e1', 'e2', 'e3']);
    expect(container.textContent).toContain('3 次调用 · 0 次失败');
    expect(container.textContent).toContain('运行中');
  });

  it('re-creates and activates the log after the user closed it', async () => {
    await render();
    await newCall(run('e1'));
    await press(container.querySelector('[aria-label="关闭Agent SSH"]'));
    expect(logTabs()).toHaveLength(0);
    // The runtime updating without a request (history, replay) opens nothing.
    runs = [run('old'), ...runs];
    await render();
    expect(logTabs()).toHaveLength(0);
    await newCall(run('e2'));
    expect(logTabs()).toHaveLength(1);
    expect(logTabs()[0].getAttribute('aria-pressed')).toBe('true');
    expect(cardIds()).toEqual(['old', 'e1', 'e2']);
  });

  it('separates turns and filters by host and failures', async () => {
    await render();
    await newCall(
      run('a', { turnId: 't1', startedAt: at(41, 52) }),
      run('b', { host: 'edge', turnId: 't1', startedAt: at(42), exitCode: 1 }),
      run('c', { startedAt: at(43) }),
      run('d', { turnId: 't2', host: 'edge', startedAt: at(44), status: 'failed', exitCode: undefined, failure: 'hostKeyUnverified' }),
    );
    const separators = Array.from(container.querySelectorAll('[role="separator"]'), node => node.textContent);
    expect(separators).toEqual([`第 1 轮 · ${formatSshExecTime(at(41), false)}`, `第 2 轮 · ${formatSshExecTime(at(44), false)}`]);
    // Turn 2's separator sits right before d; c (no turn) adds none.
    expect(cards()[3].previousElementSibling?.getAttribute('role')).toBe('separator');
    expect(cards()[2].previousElementSibling?.getAttribute('role')).not.toBe('separator');
    expect(cards()[0].textContent).toContain(formatSshExecTime(at(41, 52), true));
    expect(container.textContent).toContain('4 次调用 · 2 次失败');
    expect(cards()[1].textContent).toContain('退出码 1');
    expect(cards()[3].textContent).toContain('主机密钥尚未确认');
    expect(cards()[3].textContent).toContain('请先在终端中连接一次以确认主机密钥。');

    await press(buttonWithText('edge'));
    expect(cardIds()).toEqual(['b', 'd']);
    await press(buttonWithText('全部主机'));
    expect(cardIds()).toEqual(['a', 'b', 'c', 'd']);
    await press(buttonWithText('只看失败'));
    expect(cardIds()).toEqual(['b', 'd']);
    await press(buttonWithText('prod'));
    expect(cardIds()).toEqual([]);
    expect(container.textContent).toContain('没有符合筛选条件的调用。');
  });

  it('clear view hides earlier calls but shows new ones', async () => {
    await render();
    await newCall(run('a', { startedAt: at(1) }), run('b', { startedAt: at(2) }));
    await press(container.querySelector('[aria-label="清空视图"]'));
    expect(cardIds()).toEqual([]);
    expect(logTabs()[0].textContent).toBe('');
    await newCall(run('c', { startedAt: at(3) }));
    expect(cardIds()).toEqual(['c']);
    expect(container.textContent).toContain('1 次调用 · 0 次失败');
  });

  it('shows output unwrapped, stderr styled, ANSI stripped and long output collapsed', async () => {
    const table = `${'col | '.repeat(40)}\n${'-'.repeat(240)}`;
    const long = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join('\n');
    await render();
    await newCall(
      run('wide', { cwd: '/srv', output: [{ stream: 'stdout', data: `\x1b[1m${table}\x1b[0m\n` }, { stream: 'stderr', data: 'boom\n' }] }),
      run('long', { output: [{ stream: 'stdout', data: long }], outputTruncated: true }),
      run('empty'),
    );
    const [wide, longCard, empty] = cards();
    const pre = wide.querySelector('pre')!;
    expect(pre.className.split(' ')).toContain('whitespace-pre');
    expect(pre.className).not.toMatch(/whitespace-pre-wrap|break-all|break-words/);
    expect(pre.className).toContain('overflow-x-auto');
    expect(pre.querySelector('[data-stream="stdout"]')?.textContent).toBe(`${table}\n`);
    expect(pre.querySelector('[data-stream="stderr"]')?.className).toContain('text-danger');
    expect(wide.textContent).toContain('目录');
    expect(wide.querySelector('code')?.textContent).toBe('/srv');

    const longPre = longCard.querySelector('pre')!;
    expect(longPre.style.maxHeight).toContain('18.6em'); // 12 lines × 1.55
    expect(longCard.textContent).toContain('64 KiB');
    await press(buttonWithText('展开全部 · 20 行'));
    expect(longPre.style.maxHeight).toBe('');
    await press(buttonWithText('收起'));
    expect(longPre.style.maxHeight).toContain('18.6em'); // 12 lines × 1.55

    expect(empty.querySelector('pre')).toBeNull();
    expect(empty.textContent).toContain('无输出');
    expect(Array.from(empty.querySelectorAll('button'), button => button.textContent)).not.toContain('复制输出');
  });

  it('keeps the log tab out of the tab store but restores it within the session', async () => {
    await render();
    await newCall(run('e1'));
    const stored = disk.get(storageKey()) as { items: WorkbenchItem[] };
    expect(stored.items).toEqual([]);
    // Switching conversations away and back remounts the Workbench.
    await remount();
    expect(logTabs()).toHaveLength(1);
    // A stored log tab (e.g. written by an older build) is dropped on restore.
    act(() => root.unmount());
    scopeKey = JSON.stringify(['conversation', 'backend', 'w', 'restart']);
    disk.set(storageKey(), { items: [{ id: 'x', type: 'ssh-exec', title: 'Agent SSH', sshExec: { conversationId } }], activeId: 'x' });
    root = createRoot(container);
    await render();
    expect(logTabs()).toHaveLength(0);
  });
});
