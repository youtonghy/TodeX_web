import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement, useCallback, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ConversationRuntime } from '@todex/protocol/conversationRuntime';
import { WorkbenchPanel } from '../../src/renderer/screens/WorkbenchPanel';
import { createAgentBrowserWatch, takeNewAgentBrowserTab } from '../../src/renderer/session/agentBrowserTabs';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';
import type { WorkbenchRequest, WorkbenchTab } from '../../src/renderer/lib/panels';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  HTMLElement.prototype.scrollIntoView ??= () => {};
  Element.prototype.getAnimations ??= () => [];
});

const runtime = (appliedSequence: number, tabSince?: string) => ({
  appliedSequence,
  desktopBrowser: { granted: true, tabOpen: tabSince !== undefined, ...(tabSince ? { tabSince } : {}), actions: [] },
});

describe('takeNewAgentBrowserTab', () => {
  it('reports a tab lifetime that starts after the conversation became the viewed one', () => {
    const watch = createAgentBrowserWatch();
    // Not loaded yet, then a runtime whose tab was already open only seeds.
    expect(takeNewAgentBrowserTab(watch, 'c1', undefined, false)).toBe(false);
    expect(takeNewAgentBrowserTab(watch, 'c1', runtime(10, 'old'), false)).toBe(false);
    // Later events of the same lifetime (the user may have closed the panel) do not reopen it.
    expect(takeNewAgentBrowserTab(watch, 'c1', runtime(11, 'old'), false)).toBe(false);
    // A live action that opens a new lifetime does, once.
    expect(takeNewAgentBrowserTab(watch, 'c1', runtime(12, 'a2'), false)).toBe(true);
    expect(takeNewAgentBrowserTab(watch, 'c1', runtime(13, 'a2'), false)).toBe(false);
  });

  it('opens again for the lifetime after a closed event, but not for the close itself', () => {
    const watch = createAgentBrowserWatch();
    takeNewAgentBrowserTab(watch, 'c1', runtime(1), false);
    expect(takeNewAgentBrowserTab(watch, 'c1', runtime(2, 'a'), false)).toBe(true);
    expect(takeNewAgentBrowserTab(watch, 'c1', runtime(3), false)).toBe(false);
    // The same action id cannot start two lifetimes; a fresh one does.
    expect(takeNewAgentBrowserTab(watch, 'c1', runtime(4, 'b'), false)).toBe(true);
  });

  it('ignores recovery batches and history paged in below the window', () => {
    const watch = createAgentBrowserWatch();
    takeNewAgentBrowserTab(watch, 'c1', runtime(10), false);
    // Earlier page: the applied sequence did not move.
    expect(takeNewAgentBrowserTab(watch, 'c1', runtime(10, 'paged'), false)).toBe(false);
    // Recovery replay.
    expect(takeNewAgentBrowserTab(watch, 'c1', runtime(40, 'gap'), true)).toBe(false);
    expect(takeNewAgentBrowserTab(watch, 'c1', runtime(41, 'live'), false)).toBe(true);
  });

  it('reseeds when another conversation becomes the viewed one', () => {
    const watch = createAgentBrowserWatch();
    takeNewAgentBrowserTab(watch, 'c1', runtime(1), false);
    // c2's open tab never opens the panel, even though it is unseen.
    expect(takeNewAgentBrowserTab(watch, 'c2', runtime(50, 'x'), false)).toBe(false);
    expect(takeNewAgentBrowserTab(watch, 'c2', runtime(51, 'y'), false)).toBe(true);
    // Back to c1: a tab opened there meanwhile is history too.
    expect(takeNewAgentBrowserTab(watch, 'c1', runtime(9, 'meanwhile'), false)).toBe(false);
  });
});

describe('WorkbenchPanel agent browser tab', () => {
  let root: Root;
  let container: HTMLDivElement;
  let pushRequest: (request: WorkbenchRequest) => void;
  let setShown: (shown: boolean) => void;
  const disk = new Map<string, unknown>();
  const watchAgentBrowser = vi.fn(() => vi.fn());
  const conversationId = 'c-browser';
  const scopeKey = JSON.stringify(['conversation', 'backend', 'w', conversationId]);

  function Harness() {
    const [tab, setTab] = useState<WorkbenchTab>('terminal');
    const [requests, setRequests] = useState<WorkbenchRequest[]>([]);
    const [shown, setShownState] = useState(false);
    pushRequest = (request) => setRequests(current => [...current, request]);
    setShown = setShownState;
    const onHandled = useCallback((lastId: number) => setRequests(current => current.filter(request => request.id > lastId)), []);
    const session = {
      activeConversation: { id: conversationId }, activeWorkspace: { id: 'w', path: '/w', tenantId: 'local' },
      settings: { serverUrl: 'https://backend.test', deviceSecret: 'test-secret', tenantId: 'local' }, terminalById: {},
      connectionState: 'closed', connectionHealth: { latencyMs: null }, requestTerminalStatus: vi.fn(),
      startTerminalSession: vi.fn(), stopTerminalSession: vi.fn(), resizeTerminalSession: vi.fn(), sendTerminalInput: vi.fn(),
      conversations: [{ id: conversationId, v2ConversationId: 'v2-browser' }], watchAgentBrowser,
      conversationRuntimeById: { [conversationId]: { desktopBrowser: runtime(1, 'a').desktopBrowser } as unknown as ConversationRuntime },
    } as unknown as TodeXSession;
    return createElement(WorkbenchPanel, { key: scopeKey, scopeKey, session, tab, onTabChange: setTab, shown, requests, onRequestsHandled: onHandled });
  }
  const render = async () => { await act(async () => { root.render(createElement(Harness)); }); };

  beforeAll(() => { Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); });
  beforeEach(() => {
    disk.clear();
    watchAgentBrowser.mockClear();
    Object.assign(window, { todexWeb: { store: {
      get: vi.fn(async (key: string) => disk.get(key)),
      set: vi.fn(async (key: string, value: unknown) => { disk.set(key, JSON.parse(JSON.stringify(value))); }),
    } } });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('streams only while the panel is shown, and the tab survives a remount', async () => {
    await render();
    await act(async () => { pushRequest({ id: 1, kind: 'agent-browser', conversationId }); });
    expect(container.querySelector('button[aria-pressed="true"][aria-label="Agent 浏览器"]')).toBeTruthy();
    // The aside is closed: the tab exists but the live view is not watching.
    expect(watchAgentBrowser).not.toHaveBeenCalled();
    await act(async () => { setShown(true); });
    expect(watchAgentBrowser).toHaveBeenCalledWith('v2-browser', expect.any(Function));
    const unwatch = watchAgentBrowser.mock.results[0].value as ReturnType<typeof vi.fn>;
    await act(async () => { setShown(false); });
    expect(unwatch).toHaveBeenCalled();
    // The Workbench remounts (key = scope): the session-only tab is restored.
    act(() => root.unmount());
    root = createRoot(container);
    await render();
    expect(container.querySelector('button[aria-label="Agent 浏览器"]')).toBeTruthy();
  });
});
