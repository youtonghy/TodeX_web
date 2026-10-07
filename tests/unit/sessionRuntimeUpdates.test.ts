import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '@heroui/react';
import { useTodeXSession, type TodeXSession } from '../../src/renderer/session/useTodeXSession';
import { loadJson } from '../../src/renderer/lib/storage';
import { applyConversationRuntimeEvents } from '@todex/protocol/conversationRuntime';
import { defaultSettings, MAX_PENDING_SOCKET_FRAMES, SETTINGS_STORAGE_KEY, WORKSPACES_STORAGE_KEY, CONVERSATIONS_STORAGE_KEY,
  ACTIVE_SELECTION_STORAGE_KEY, BACKEND_CONNECTIONS_STORAGE_KEY } from '../../src/renderer/session/helpers';

vi.mock('../../src/renderer/lib/storage', () => ({
  loadJson: vi.fn(), loadSecret: vi.fn().mockResolvedValue(''),
  saveJson: vi.fn().mockResolvedValue(undefined), saveSecret: vi.fn().mockResolvedValue(undefined),
}));
// Loopback profiles without a pinned key: plaintext, policy check skipped.
vi.mock('@todex/protocol/secureTransport', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/secureTransport')>(), verifyTransportPolicy: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@todex/protocol/conversationRuntime', async importOriginal => {
  const actual = await importOriginal<typeof import('@todex/protocol/conversationRuntime')>();
  return { ...actual, applyConversationRuntimeEvents: vi.fn(actual.applyConversationRuntimeEvents) };
});
vi.mock('@todex/protocol/connectionProbe', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/connectionProbe')>(),
  probeBackendConnection: vi.fn(async () => ({ ok: true, error: null, providers: [], version: null })),
}));

class TestSocket {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 0;
  onopen: (() => unknown) | null = null;
  onmessage: ((event: { data: string }) => unknown) | null = null;
  onerror: (() => unknown) | null = null;
  onclose: ((event: { code: number; reason: string }) => unknown) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.onclose?.({ code: 1000, reason: '' }); });
  constructor(public url: string) { TestSocket.instances.push(this); }
  open() { this.readyState = 1; void this.onopen?.(); }
}

const HIGH_WATER = 600;
const profile = { id: 'a', name: 'a', serverUrl: 'http://127.0.0.1', tenantId: 'local', encryptionProtocol: 'none', createdAt: 1, updatedAt: 1 };
const workspace = { id: 'wa', name: 'wa', path: '/wa', tenantId: 'local', model: '',
  approvalPolicy: 'on-request', sandboxMode: 'workspace-write', createdAt: 1, updatedAt: 1, backendConnectionId: 'a' };
const conversation = (id: string) => ({ id, workspaceId: 'wa', title: id, sessionId: `v2_${id}`, threadId: '',
  provider: 'codex', v2ConversationId: `v2-${id}`, permissionMode: 'ask' as const, mode: 'implement' as const,
  preview: 'reply', createdAt: 1, updatedAt: 1, lastSequence: HIGH_WATER });
const frame = (id: string, sequence: number, type: string, payload: Record<string, unknown>) => ({
  schemaVersion: 2, conversationId: `v2-${id}`, eventId: `${id}-${sequence}`, sequence, time: '2026-09-26T00:00:00Z', type, payload,
});
const journal = (id: string) => Array.from({ length: HIGH_WATER }, (_, index) => frame(id, index + 1,
  index % 20 === 0 ? 'turn.started' : index % 20 === 19 ? 'turn.completed' : 'message.delta',
  { turnId: `t${Math.floor(index / 20)}`, content: `m${index + 1} ` }));

let root: Root;
let container: HTMLDivElement;
let session: TodeXSession;
let requests: URL[];
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
beforeEach(() => {
  vi.useFakeTimers();
  requests = [];
  TestSocket.instances = [];
  vi.stubGlobal('WebSocket', TestSocket);
  for (const kind of ['warning', 'danger', 'info', 'success'] as const) vi.spyOn(toast, kind).mockReturnValue(`toast-${kind}`);
  vi.mocked(loadJson).mockImplementation(async (key, fallback) => ({
    [SETTINGS_STORAGE_KEY]: { ...defaultSettings, serverUrl: 'http://127.0.0.1' },
    [BACKEND_CONNECTIONS_STORAGE_KEY]: [profile],
    [WORKSPACES_STORAGE_KEY]: [workspace],
    [CONVERSATIONS_STORAGE_KEY]: [conversation('ca'), conversation('cb')],
    [ACTIVE_SELECTION_STORAGE_KEY]: { workspaceId: 'wa', conversationId: 'ca' },
  }[key] ?? fallback) as never);
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    requests.push(url);
    let result: unknown;
    const events = /^\/v2\/conversations\/([^/]+)\/events$/.exec(url.pathname);
    if (url.pathname === '/v2/providers') result = { providers: [] };
    else if (url.pathname === '/v2/conversations') {
      result = { conversations: ['ca', 'cb'].map((id) => ({ schemaVersion: 2, id: `v2-${id}`, provider: 'codex', ownerId: 'o',
        workspace: '/wa', workspaceId: 'wa', title: id, status: 'idle', lastSequence: HIGH_WATER,
        createdAt: '2026-09-26T00:00:00Z', updatedAt: '2026-09-26T00:00:00Z' })) };
    } else if (url.pathname === '/v2/workspaces') result = { workspaces: [workspace] };
    else if (events && url.searchParams.has('beforeSequence')) {
      const before = Number(url.searchParams.get('beforeSequence'));
      const id = decodeURIComponent(events[1]).replace(/^v2-/, '');
      const page = journal(id).filter((item) => item.sequence <= before).slice(-Number(url.searchParams.get('limit')));
      result = { conversationId: events[1], fromSequence: 0, nextSequence: before, events: page, hasMore: (page[0]?.sequence ?? 1) > 1 };
    } else if (events) result = { events: [], hasMore: false };
    else if (url.pathname === '/health' || url.pathname === '/v2/version') result = { name: 'test', version: '1' };
    else return new Promise(() => {});
    return new Response(JSON.stringify(result), { status: 200 });
  }));
});
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function mount() {
  function Harness() { session = useTodeXSession(() => {}); return null; }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(createElement(Harness)); });
  expect(session.hydrated).toBe(true);
  await act(async () => { session.connect(); });
  const socket = TestSocket.instances.at(-1)!;
  await act(async () => { socket.open(); await vi.advanceTimersByTimeAsync(200); });
  expect(session.connectionState).toBe('open');
  expect(session.conversationRuntimeById.ca?.appliedSequence).toBe(HIGH_WATER);
  return socket;
}
async function deliver(socket: TestSocket, event: ReturnType<typeof frame>) {
  await act(async () => {
    socket.onmessage?.({ data: JSON.stringify({ type: 'conversation.event', delivery: 'live', payload: event }) });
    await vi.advanceTimersByTimeAsync(25);
  });
}
const conversationListRequests = () => requests.filter((url) => url.pathname === '/v2/conversations').length;

it('lists conversations once per refresh interval while connected', async () => {
  await mount();
  const before = conversationListRequests();
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  // The manifest refresh polls every 15 s; the workspace sync timer no longer
  // lists conversations again on its own.
  expect(conversationListRequests() - before).toBe(4);
  expect(requests.filter((url) => url.pathname === '/v2/workspaces').length).toBeGreaterThanOrEqual(4);
});

it('keeps subagent and usage state untouched by deltas that do not change them', async () => {
  const socket = await mount();
  await deliver(socket, frame('ca', HIGH_WATER + 1, 'turn.started', { turnId: 'live' }));
  const subagents = session.subagentsByConversation;
  const usage = session.usageRecords;
  const timeline = session.timeline;
  await deliver(socket, frame('ca', HIGH_WATER + 2, 'message.delta', { turnId: 'live', content: 'streaming' }));
  expect(session.timeline).not.toBe(timeline);
  expect(session.subagentsByConversation).toBe(subagents);
  expect(session.usageRecords).toBe(usage);
  await deliver(socket, frame('ca', HIGH_WATER + 3, 'subagent.started', { turnId: 'live', subagentId: 's1', title: 'Helper' }));
  expect(session.subagentsByConversation).not.toBe(subagents);
  expect(session.subagentsByConversation.ca?.map((run) => run.id)).toEqual(['s1']);
  expect(session.usageRecords).toBe(usage);
});

it('releases a runtime live frames created for a background conversation once it is idle', async () => {
  const socket = await mount();
  await deliver(socket, frame('cb', HIGH_WATER + 1, 'turn.started', { turnId: 'bg' }));
  await deliver(socket, frame('cb', HIGH_WATER + 2, 'message.delta', { turnId: 'bg', content: 'background work' }));
  expect(session.conversationRuntimeById.cb?.activeTurnId).toBe('bg');
  // Busy background conversations survive the manifest refresh.
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(session.conversationRuntimeById.cb?.activeTurnId).toBe('bg');
  expect(session.timeline.some((entry) => entry.conversationId === 'cb')).toBe(true);

  await deliver(socket, frame('cb', HIGH_WATER + 3, 'turn.completed', { turnId: 'bg' }));
  expect(session.conversationRuntimeById.cb?.status).toBe('completed');
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(session.conversationRuntimeById.cb).toBeUndefined();
  expect(session.timeline.some((entry) => entry.conversationId === 'cb')).toBe(false);
  // The active conversation keeps its projection.
  expect(session.conversationRuntimeById.ca?.appliedSequence).toBe(HIGH_WATER);
});

const liveMessage = (event: ReturnType<typeof frame>) => ({ data: JSON.stringify({ type: 'conversation.event', delivery: 'live', payload: event }) });
const sentTypes = (socket: TestSocket) => socket.send.mock.calls.map(([text]) => {
  try { return (JSON.parse(String(text)) as { type?: string }).type ?? ''; } catch { return ''; }
});

it('projects a burst of live deltas once per frame, in order', async () => {
  const socket = await mount();
  await deliver(socket, frame('ca', HIGH_WATER + 1, 'turn.started', { turnId: 'live' }));
  const apply = vi.mocked(applyConversationRuntimeEvents);
  apply.mockClear();
  await act(async () => {
    for (let index = 2; index <= 6; index++) {
      socket.onmessage?.(liveMessage(frame('ca', HIGH_WATER + index, 'message.delta', { turnId: 'live', content: `d${index} ` })));
    }
    await vi.advanceTimersByTimeAsync(25);
  });
  const liveBatches = apply.mock.calls.filter(([, events]) => events.some((event) => event.sequence > HIGH_WATER + 1));
  expect(liveBatches).toHaveLength(1);
  expect(liveBatches[0][1].map((event) => event.sequence)).toEqual([2, 3, 4, 5, 6].map((index) => HIGH_WATER + index));
  expect(session.conversationRuntimeById.ca?.appliedSequence).toBe(HIGH_WATER + 6);
  expect(session.timeline.find((entry) => entry.conversationId === 'ca' && entry.subtitle.includes('d2'))?.subtitle)
    .toContain('d2 d3 d4 d5 d6');
});

it('projects buffered events before handling the next non-event message', async () => {
  const socket = await mount();
  await act(async () => {
    socket.onmessage?.(liveMessage(frame('ca', HIGH_WATER + 1, 'turn.started', { turnId: 'live' })));
    socket.onmessage?.({ data: JSON.stringify({ type: 'server.result', id: 'unknown-request', payload: {} }) });
    // Message tasks run, the animation frame does not.
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(session.conversationRuntimeById.ca?.activeTurnId).toBe('live');
});

it('drops a socket backlog the renderer cannot drain and reconnects', async () => {
  const socket = await mount();
  await act(async () => {
    for (let index = 0; index <= MAX_PENDING_SOCKET_FRAMES; index++) {
      socket.onmessage?.({ data: JSON.stringify({ type: 'server.result', id: `r${index}`, payload: {} }) });
    }
  });
  expect(socket.close).toHaveBeenCalled();
  expect(session.lastError).toBe('待处理的消息积压过多，已重新连接以同步最新状态。');
  await act(async () => { await vi.advanceTimersByTimeAsync(2_500); });
  expect(TestSocket.instances.length).toBeGreaterThan(1);
});

it('never starts the legacy Codex adapter for v2 conversations', async () => {
  const socket = await mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(sentTypes(socket)).not.toContain('codex.local.start');
});

it('starts a legacy thread adapter once per connection, even when the start fails', async () => {
  const legacy = { id: 'cl', workspaceId: 'wa', title: 'legacy', sessionId: 'cdxs_legacy', threadId: 'thread-1',
    mode: 'implement' as const, preview: 'native history', createdAt: 1, updatedAt: 1 };
  vi.mocked(loadJson).mockImplementation(async (key, fallback) => ({
    [SETTINGS_STORAGE_KEY]: { ...defaultSettings, serverUrl: 'http://127.0.0.1' },
    [BACKEND_CONNECTIONS_STORAGE_KEY]: [profile],
    [WORKSPACES_STORAGE_KEY]: [workspace],
    [CONVERSATIONS_STORAGE_KEY]: [conversation('ca'), conversation('cb'), legacy],
    [ACTIVE_SELECTION_STORAGE_KEY]: { workspaceId: 'wa', conversationId: 'ca' },
  }[key] ?? fallback) as never);
  const socket = await mount();
  // Answer liveness pings so the watchdog keeps this connection.
  socket.send.mockImplementation((text: string) => {
    const message = JSON.parse(text) as { id: string; type: string };
    if (message.type === 'server.ping') {
      queueMicrotask(() => socket.onmessage?.({ data: JSON.stringify({ type: 'server.result', id: message.id, payload: {} }) }));
    }
  });
  await act(async () => { session.selectConversation('wa', 'cl'); await vi.advanceTimersByTimeAsync(50); });
  expect(sentTypes(socket).filter((type) => type === 'codex.local.start')).toHaveLength(1);
  // The start times out (state 'error'); that must not trigger another one.
  const sockets = TestSocket.instances.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(16_000); });
  expect(session.lastError).toBe('本地会话启动超时，请先确认 Codex 本地 adapter 可用。');
  expect(TestSocket.instances).toHaveLength(sockets);
  expect(session.conversations.find((item) => item.id === 'cl')?.localAdapterState).toBe('error');
  expect(sentTypes(socket).filter((type) => type === 'codex.local.start')).toHaveLength(1);
});
