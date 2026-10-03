import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement, useCallback, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SshExecRun } from '@todex/protocol/ssh';
import type { ConversationRuntime } from '@todex/protocol/conversationRuntime';
import { WorkbenchPanel } from '../../src/renderer/screens/WorkbenchPanel';
import { SETTINGS_STORAGE_KEY } from '../../src/renderer/session/helpers';
import { SSH_EXEC_TAB_LIMIT, capSshExecTabs, createSshExecWatch, sshExecTabTitle, takeNewSshExecs } from '../../src/renderer/session/sshExecTabs';
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

describe('takeNewSshExecs', () => {
  it('only reports calls that start after the conversation became the viewed one', () => {
    const watch = createSshExecWatch();
    // Not loaded yet, then the first (history) runtime only seeds.
    expect(takeNewSshExecs(watch, 'c1', undefined, false)).toEqual([]);
    expect(takeNewSshExecs(watch, 'c1', runtime(10, [run('a')]), false)).toEqual([]);
    // A live call advances the applied sequence.
    expect(takeNewSshExecs(watch, 'c1', runtime(12, [run('a'), run('b')]), false).map(item => item.id)).toEqual(['b']);
    // The same id is never reported twice, even after the tab was closed.
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
    // c2's past calls never open tabs, even though they are unseen.
    expect(takeNewSshExecs(watch, 'c2', runtime(50, [run('x'), run('y')]), false)).toEqual([]);
    expect(takeNewSshExecs(watch, 'c2', runtime(51, [run('x'), run('y'), run('z')]), false).map(item => item.id)).toEqual(['z']);
    // Back to c1: calls made there meanwhile are history too.
    expect(takeNewSshExecs(watch, 'c1', runtime(9, [run('meanwhile')]), false)).toEqual([]);
  });

  it('titles tabs with the host and the start of the command', () => {
    expect(sshExecTabTitle({ host: 'prod', command: 'journalctl  -u nginx --since today --no-pager' })).toBe('prod · journalctl -u nginx --si…');
    expect(sshExecTabTitle({ host: 'prod', command: '' })).toBe('prod');
  });

  it('evicts the oldest finished exec tabs beyond the limit, never running ones', () => {
    const tabs = Array.from({ length: SSH_EXEC_TAB_LIMIT + 2 }, (_, index): WorkbenchItem => ({ id: `t${index}`, type: 'ssh-exec', title: '' }));
    const terminal: WorkbenchItem = { id: 'term', type: 'terminal', title: 'Terminal 1' };
    const capped = capSshExecTabs([terminal, ...tabs], item => item.id === 't0', new Set(['t21']));
    expect(capped.map(item => item.id)).toEqual(['term', 't0', ...tabs.slice(3).map(item => item.id)]);
    const allRunning = capSshExecTabs(tabs, () => true, new Set());
    expect(allRunning).toBe(tabs);
  });
});

describe('SSH exec workbench tabs', () => {
  let root: Root;
  let container: HTMLDivElement;
  let pushRequest: (request: WorkbenchRequest) => void;
  let runs: SshExecRun[] = [];
  let scopeKey = '';
  let scopeIndex = 0;
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
      activeConversation: { id: 'c' }, activeWorkspace: { id: 'w', path: '/w', tenantId: 'local' },
      settings: { serverUrl: 'https://backend.test', deviceSecret: 'test-secret', tenantId: 'local' }, terminalById: {},
      connectionState: 'closed', connectionHealth: { latencyMs: null }, requestTerminalStatus: vi.fn(),
      startTerminalSession: vi.fn(), stopTerminalSession: vi.fn(), resizeTerminalSession: vi.fn(), sendTerminalInput: vi.fn(),
      conversationRuntimeById: { c: { sshExecs: runs } as unknown as ConversationRuntime },
    } as unknown as TodeXSession;
    return createElement(WorkbenchPanel, { key: scopeKey, scopeKey, session, tab, onTabChange, requests, onRequestsHandled: onHandled });
  }
  const render = async () => { await act(async () => { root.render(createElement(Harness)); }); };
  const remount = async () => {
    act(() => root.unmount());
    root = createRoot(container);
    await render();
  };
  const execRequest = (id: number, execId: string): WorkbenchRequest => ({ id, kind: 'ssh-exec', conversationId: 'c', execId, title: `prod · ${execId}` });
  const execTabs = () => container.querySelectorAll('[aria-label^="Agent SSH 命令"]');

  beforeAll(() => { Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); });
  beforeEach(() => {
    disk.clear();
    runs = [];
    // The session-only tab cache is module state; give every test its own scope.
    scopeKey = JSON.stringify(['conversation', 'backend', 'w', `c-${scopeIndex += 1}`]);
    Object.assign(window, { todexWeb: { store: {
      get: vi.fn(async (key: string) => disk.get(key)),
      set: vi.fn(async (key: string, value: unknown) => { disk.set(key, JSON.parse(JSON.stringify(value))); }),
    } } });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('opens and activates a read-only tab with the call status and output', async () => {
    disk.set(storageKey(), { items: [{ id: 'terminal-1', type: 'terminal', title: '终端 1' }], activeId: 'terminal-1' });
    runs = [run('e1', { cwd: '/srv', exitCode: 1, durationMs: 1500, output: [{ stream: 'stdout', data: 'hello\n' }, { stream: 'stderr', data: 'boom\n' }] })];
    await render();
    await act(async () => { pushRequest(execRequest(1, 'e1')); });
    expect(tabChanges).toHaveBeenLastCalledWith('ssh-exec');
    expect(execTabs()).toHaveLength(1);
    expect(execTabs()[0].getAttribute('aria-pressed')).toBe('true');
    const log = container.querySelector('[role="log"]')!;
    expect(log.querySelector('[data-stream="stdout"]')?.textContent).toBe('hello\n');
    expect(log.querySelector('[data-stream="stderr"]')?.textContent).toBe('boom\n');
    expect(container.textContent).toContain('退出码 1');
    expect(container.textContent).toContain('1.5 s');
    expect(container.textContent).toContain('目录：/srv');
    expect(container.querySelector('code')?.getAttribute('title')).toBe('echo e1');
  });

  it('shows running, failure hints, truncation and a missing call', async () => {
    runs = [
      run('r', { status: 'running', exitCode: undefined }),
      run('f', { status: 'failed', exitCode: undefined, failure: 'authenticationFailed', outputTruncated: true }),
    ];
    await render();
    await act(async () => { pushRequest(execRequest(1, 'r')); });
    expect(container.textContent).toContain('运行中');
    await act(async () => { pushRequest(execRequest(2, 'f')); });
    expect(container.textContent).toContain('失败：');
    expect(container.textContent).toContain('64 KiB');
    await act(async () => { pushRequest(execRequest(3, 'gone')); });
    expect(container.textContent).toContain('这条 SSH 命令的记录已不在当前会话中。');
  });

  it('keeps exec tabs out of the tab store but restores them within the session', async () => {
    runs = [run('e1')];
    await render();
    await act(async () => { pushRequest(execRequest(1, 'e1')); });
    const stored = disk.get(storageKey()) as { items: WorkbenchItem[] };
    expect(stored.items).toEqual([]);
    // Switching conversations away and back remounts the Workbench.
    await remount();
    expect(execTabs()).toHaveLength(1);
    // A stored exec tab (e.g. written by an older build) is dropped on restore.
    act(() => root.unmount());
    scopeKey = JSON.stringify(['conversation', 'backend', 'w', 'restart']);
    disk.set(storageKey(), { items: [{ id: 'x', type: 'ssh-exec', title: 'prod · ls', sshExec: { conversationId: 'c', execId: 'e1' } }], activeId: 'x' });
    root = createRoot(container);
    await render();
    expect(execTabs()).toHaveLength(0);
  });

  it(`caps exec tabs at ${SSH_EXEC_TAB_LIMIT} by closing the oldest finished call`, async () => {
    runs = Array.from({ length: SSH_EXEC_TAB_LIMIT + 1 }, (_, index) => run(`e${index}`, index === 0 ? { status: 'running', exitCode: undefined } : {}));
    await render();
    for (const [index, item] of runs.entries()) {
      await act(async () => { pushRequest(execRequest(index + 1, item.id)); });
    }
    const titles = Array.from(execTabs(), tab => tab.getAttribute('aria-label'));
    expect(titles).toHaveLength(SSH_EXEC_TAB_LIMIT);
    // e0 is still running, so e1 (the oldest finished call) was closed.
    expect(titles[0]).toContain('echo e0');
    expect(titles.some(title => title?.endsWith('echo e1'))).toBe(false);
  });

  it('closes an exec tab without reopening it on later requests for other calls', async () => {
    runs = [run('e1'), run('e2')];
    await render();
    await act(async () => { pushRequest(execRequest(1, 'e1')); });
    const close = container.querySelector<HTMLButtonElement>('[aria-label="关闭此标签"]')!;
    await act(async () => { close.click(); });
    expect(execTabs()).toHaveLength(0);
    await act(async () => { pushRequest(execRequest(2, 'e2')); });
    expect(Array.from(execTabs(), tab => tab.getAttribute('aria-label'))).toEqual([expect.stringContaining('echo e2')]);
  });
});
