import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement, useCallback, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { V2ApiClient } from '@todex/protocol/v2';
import { WorkbenchPanel } from '../../src/renderer/screens/WorkbenchPanel';
import { workbenchScopeKey } from '../../src/renderer/session/workbenchLayout';
import { SETTINGS_STORAGE_KEY } from '../../src/renderer/session/helpers';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';
import type { OpenPanelOptions, WorkbenchTab } from '../../src/renderer/lib/panels';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  HTMLElement.prototype.scrollIntoView ??= () => {};
  Object.assign(globalThis, { CSS: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`) } });
});
vi.mock('../../src/renderer/components/XtermTerminal', () => ({ XtermTerminal: () => null }));

let root: Root;
let container: HTMLDivElement;
let requestOpen: (tab: WorkbenchTab, target: OpenPanelOptions) => void;
const disk = new Map<string, unknown>();
const status = vi.fn();
const startTerminal = vi.fn();
const stopTerminal = vi.fn();
let terminals: Record<string, unknown> = {};
const scope = (conversation: string, workspace = 'workspace', mode: 'conversation' | 'workspace' = 'conversation') => workbenchScopeKey(mode, 'backend', workspace, conversation);
const tabsKey = (key: string) => `${SETTINGS_STORAGE_KEY}.workbenchTabs.v1:${key}`;
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';

function Harness({ conversation, workspace, mode }: { conversation: string; workspace: string; mode: 'conversation' | 'workspace' }) {
  const [tab, setTab] = useState<WorkbenchTab>('terminal');
  const [target, setTarget] = useState<OpenPanelOptions>({});
  const consumed = useCallback(() => setTarget({}), []);
  const tabChanged = useCallback((next: WorkbenchTab) => { setTab(next); setTarget({}); }, []);
  requestOpen = (next, nextTarget) => { setTab(next); setTarget(nextTarget); };
  const session = {
    activeConversation: { id: conversation }, activeWorkspace: { id: workspace, path: `/${workspace}` },
    settings: { serverUrl: 'https://backend.test', deviceSecret: 'test-secret' }, terminalById: terminals,
    connectionState: 'open', connectionHealth: { latencyMs: null }, requestTerminalStatus: status,
    startTerminalSession: startTerminal, stopTerminalSession: stopTerminal, resizeTerminalSession: vi.fn(),
  } as unknown as TodeXSession;
  const scopeKey = scope(conversation, workspace, mode);
  return createElement(WorkbenchPanel, { key: scopeKey, scopeKey, session, tab, target, onTabChange: tabChanged, onTargetConsumed: consumed });
}
beforeAll(() => { Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); });
beforeEach(() => {
  disk.clear();
  status.mockClear(); startTerminal.mockClear(); stopTerminal.mockClear(); terminals = {};
  Object.assign(window, { todexWeb: { store: {
    get: vi.fn(async (key: string) => disk.get(key)),
    set: vi.fn(async (key: string, value: unknown) => { disk.set(key, JSON.parse(JSON.stringify(value))); }),
  } } });
  vi.spyOn(V2ApiClient.prototype, 'fetchBrowser').mockImplementation(async url => ({ url, status: 200, contentType: 'text/html', body: '<html><body>Saved browser preview</body></html>' }));
  vi.spyOn(V2ApiClient.prototype, 'listWorkspaceEntries').mockResolvedValue({ entries: [] } as never);
  vi.spyOn(V2ApiClient.prototype, 'readWorkspaceFile').mockImplementation(async path => ({ path, name: path.split('/').pop(), mimeType: 'image/png', dataUrl: png }) as never);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); window.localStorage.clear(); vi.useRealTimers(); });
async function render(conversation: string, workspace = 'workspace', mode: 'conversation' | 'workspace' = 'conversation') {
  await act(async () => { root.render(createElement(Harness, { conversation, workspace, mode })); });
}
async function open(tab: WorkbenchTab, target: OpenPanelOptions) { await act(async () => { requestOpen(tab, target); }); }
async function addTerminal() {
  const trigger = container.querySelector<HTMLElement>('[aria-label="新建工作台标签"]');
  expect(trigger).not.toBeNull();
  await act(async () => { trigger!.click(); });
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(node => node.textContent === '终端');
  expect(item).not.toBeUndefined();
  await act(async () => { item!.click(); });
}

it('isolates new conversations and restores each conversation’s tabs and file/browser targets', async () => {
  await render('a');
  await open('files', { filePath: '/workspace/shot.png' });
  await open('browser', { url: 'http://127.0.0.1:8080/preview' });
  await addTerminal();
  expect(container.textContent).toContain('文件 1');
  expect(container.textContent).toContain('浏览器 1');
  expect(container.textContent).toContain('终端 1');
  const storedA = disk.get(tabsKey(scope('a')));
  expect(storedA).toEqual(expect.objectContaining({ items: expect.arrayContaining([
    expect.objectContaining({ type: 'files', target: { filePath: '/workspace/shot.png' } }),
    expect.objectContaining({ type: 'browser', target: { url: 'http://127.0.0.1:8080/preview' } }),
    expect.objectContaining({ type: 'terminal' }),
  ]) }));
  await render('b');
  expect(container.textContent).toContain('暂无打开的标签');
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('iframe')).toBeNull();
  expect(disk.get(tabsKey(scope('a')))).toEqual(storedA);
  await render('a');
  expect(container.textContent).toContain('文件 1');
  expect(container.textContent).toContain('浏览器 1');
  expect(container.textContent).toContain('终端 1');
  expect(container.querySelector('img')?.alt).toBe('shot.png');
  expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toContain('Saved browser preview');
  expect(V2ApiClient.prototype.fetchBrowser).toHaveBeenLastCalledWith('http://127.0.0.1:8080/preview');
});

it('keeps the same shared terminal identity when changing conversations within a workspace', async () => {
  await render('a', 'workspace', 'workspace');
  await addTerminal();
  const firstId = status.mock.calls.at(-1)?.[2];
  expect(firstId).toBeTruthy();
  await render('b', 'workspace', 'workspace');
  expect(container.textContent).toContain('终端 1');
  expect(status.mock.calls.at(-1)?.[2]).toBe(firstId);
  expect(status.mock.calls.at(-1)?.[1]).toEqual(expect.objectContaining({ id: 'b' }));
  const tabKeys = [...disk.keys()].filter(key => key.includes('.workbenchTabs.v1:'));
  expect(tabKeys).toEqual([tabsKey(scope('a', 'workspace', 'workspace'))]);
});

it('does not share tabs across different workspaces even in workspace-sharing mode', async () => {
  await render('a', 'one', 'workspace');
  await open('files', { filePath: '/one/shot.png' });
  expect(container.querySelector('img')).not.toBeNull();
  await render('b', 'two', 'workspace');
  expect(container.textContent).toContain('暂无打开的标签');
  expect(container.querySelector('img')).toBeNull();
  await render('c', 'one', 'workspace');
  expect(container.querySelector('img')?.alt).toBe('shot.png');
  expect(V2ApiClient.prototype.readWorkspaceFile).toHaveBeenLastCalledWith('/one/shot.png');
});

it('routes a Files open request to Files even when Browser was the active tab', async () => {
  await render('a');
  await open('browser', { url: 'http://127.0.0.1:8080/preview' });
  await open('files', { filePath: '/workspace/shot.png' });
  expect(container.querySelector('img')?.alt).toBe('shot.png');
  expect(container.querySelector('img')?.closest('.hidden')).toBeNull();
  expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toContain('Saved browser preview');
  expect(V2ApiClient.prototype.fetchBrowser).toHaveBeenLastCalledWith('http://127.0.0.1:8080/preview');
  expect(disk.get(tabsKey(scope('a')))).toEqual(expect.objectContaining({ items: expect.arrayContaining([
    expect.objectContaining({ type: 'browser', target: { url: 'http://127.0.0.1:8080/preview' } }),
    expect.objectContaining({ type: 'files', target: { filePath: '/workspace/shot.png' } }),
  ]) }));
});


it('disables adding tabs until delayed stored tabs have finished restoring', async () => {
  let resolve!: (value: unknown) => void;
  const pending = new Promise<unknown>(yes => { resolve = yes; });
  const saved = { items: [{ id: 'stored-file', type: 'files', title: 'Existing file', target: { filePath: '/workspace/kept.png' } }], activeId: 'stored-file' };
  vi.mocked(window.todexWeb.store.get).mockImplementationOnce(() => pending as never);
  await render('a');
  const trigger = container.querySelector<HTMLElement>('[aria-label="新建工作台标签"]');
  expect(trigger).not.toBeNull();
  expect(trigger?.hasAttribute('disabled') || trigger?.getAttribute('aria-disabled') === 'true').toBe(true);
  await act(async () => { trigger!.click(); });
  expect(document.querySelector('[role="menu"]')).toBeNull();
  expect(window.todexWeb.store.set).not.toHaveBeenCalled();
  await act(async () => { resolve(saved); });
  expect(container.textContent).toContain('Existing file');
  expect(container.querySelector('img')?.alt).toBe('kept.png');
  expect(disk.get(tabsKey(scope('a')))).toEqual(saved);
  expect(trigger?.hasAttribute('disabled') || trigger?.getAttribute('aria-disabled') === 'true').toBe(false);
});

it('keeps a manually stopped shared terminal stopped when switching conversations', async () => {
  await render('a', 'workspace', 'workspace');
  await addTerminal();
  const terminalId = status.mock.calls.at(-1)?.[2] as string;
  expect(terminalId).toBeTruthy();
  terminals = { [terminalId]: { id: terminalId, status: 'running', output: [], rows: 24, cols: 80 } };
  await render('a', 'workspace', 'workspace');
  vi.useFakeTimers();
  const stop = container.querySelector<HTMLButtonElement>('[aria-label="停止终端"]');
  expect(stop?.disabled).toBe(false);
  await act(async () => { stop!.click(); });
  expect(stopTerminal).toHaveBeenCalled();
  terminals = { [terminalId]: { id: terminalId, status: 'exited', output: [], rows: 24, cols: 80 } };
  await render('b', 'workspace', 'workspace');
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(startTerminal).not.toHaveBeenCalled();
  expect(container.textContent).toContain('终端 1');
});
