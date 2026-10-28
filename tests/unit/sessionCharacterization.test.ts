import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '../../src/renderer/components/ui/toast';
// Behaviour the session-store split must keep (see the plan of 2026-10-29).
import { useTodeXSession, type TodeXSession } from '../../src/renderer/session/useTodeXSession';
import { loadJson } from '../../src/renderer/lib/storage';
import { defaultSettings, SETTINGS_STORAGE_KEY, WORKSPACES_STORAGE_KEY, CONVERSATIONS_STORAGE_KEY,
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
let renders = 0;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
beforeEach(() => {
  renders = 0;
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
  function Harness() { session = useTodeXSession(() => {}); renders += 1; return null; }
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
const sentTypes = (socket: TestSocket) => socket.send.mock.calls.map(([text]) => {
  try { return (JSON.parse(String(text)) as { type?: string }).type ?? ''; } catch { return ''; }
});
const rowsOf = (id: string) => session.timeline.filter((entry) => entry.conversationId === id);

it('leaves one conversation\'s rows untouched by another conversation\'s events', async () => {
  const socket = await mount();
  await deliver(socket, frame('ca', HIGH_WATER + 1, 'turn.started', { turnId: 'live' }));
  await deliver(socket, frame('ca', HIGH_WATER + 2, 'message.delta', { turnId: 'live', content: 'first' }));
  const before = rowsOf('ca');
  await deliver(socket, frame('cb', HIGH_WATER + 1, 'turn.started', { turnId: 'bg' }));
  await deliver(socket, frame('cb', HIGH_WATER + 2, 'message.delta', { turnId: 'bg', content: 'background' }));
  const after = rowsOf('ca');
  expect(after).toHaveLength(before.length);
  after.forEach((entry, index) => expect(entry).toBe(before[index]));
});

it('keeps a streaming row in place while it grows', async () => {
  const socket = await mount();
  await deliver(socket, frame('ca', HIGH_WATER + 1, 'turn.started', { turnId: 'live' }));
  await deliver(socket, frame('ca', HIGH_WATER + 2, 'message.delta', { turnId: 'live', content: 'a ' }));
  const ids = rowsOf('ca').map((entry) => entry.id);
  await deliver(socket, frame('ca', HIGH_WATER + 3, 'message.delta', { turnId: 'live', content: 'b ' }));
  await deliver(socket, frame('ca', HIGH_WATER + 4, 'message.delta', { turnId: 'live', content: 'c' }));
  expect(rowsOf('ca').map((entry) => entry.id)).toEqual(ids);
  expect(rowsOf('ca').some((entry) => entry.subtitle.includes('a b c'))).toBe(true);
});

it('sends no legacy Codex command for a slash command in a v2 conversation', async () => {
  const socket = await mount();
  await act(async () => { session.sendSlashCommand('/review', 'ca'); await vi.advanceTimersByTimeAsync(100); });
  expect(sentTypes(socket).filter((type) => type.startsWith('codex.'))).toEqual([]);
});

it('keeps the workspace and conversation lists when a periodic sync changes nothing', async () => {
  await mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  const workspaces = session.workspaces;
  const conversations = session.conversations;
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(session.workspaces).toBe(workspaces);
  expect(session.conversations).toBe(conversations);
});

it('renders the session at most twice per streamed delta', async () => {
  const socket = await mount();
  await deliver(socket, frame('ca', HIGH_WATER + 1, 'turn.started', { turnId: 'live' }));
  renders = 0;
  for (let index = 2; index <= 11; index++) {
    await deliver(socket, frame('ca', HIGH_WATER + index, 'message.delta', { turnId: 'live', content: `d${index} ` }));
  }
  // Measured before the store split (20); later steps must not exceed it.
  expect(renders).toBeLessThanOrEqual(20);
});

const draft = { id: 'cd', workspaceId: 'wa', title: 'New conversation', sessionId: 'cdxs_draft', threadId: '',
  mode: 'implement' as const, preview: '', createdAt: 1, updatedAt: 1 };
const storedWith = (extra: object[], active = 'cd') => vi.mocked(loadJson).mockImplementation(async (key, fallback) => ({
  [SETTINGS_STORAGE_KEY]: { ...defaultSettings, serverUrl: 'http://127.0.0.1' },
  [BACKEND_CONNECTIONS_STORAGE_KEY]: [profile],
  [WORKSPACES_STORAGE_KEY]: [workspace],
  [CONVERSATIONS_STORAGE_KEY]: [conversation('ca'), ...extra],
  [ACTIVE_SELECTION_STORAGE_KEY]: { workspaceId: 'wa', conversationId: active },
}[key] ?? fallback) as never);

it('gives a draft without an agent the backend\'s agent, in place', async () => {
  storedWith([draft]);
  const fetchImpl = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    if (new URL(String(input)).pathname === '/v2/providers') {
      return new Response(JSON.stringify({ providers: [{ id: 'codex', displayName: 'Codex', available: true, profiles: ['default'],
        capabilities: { nativeResume: true, cancel: true, permissions: true, toolEvents: true, nativeSkills: true, nativeMcp: true,
          managedMcp: true, modelSelection: true, permissionConfig: { modes: ['ask'], defaultMode: 'ask', supportsPlan: true } },
        models: [] }] }), { status: 200 });
    }
    return fetchImpl(input, init);
  });
  function Harness() { session = useTodeXSession(() => {}); return null; }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(createElement(Harness)); });
  await act(async () => { session.connect(); });
  await act(async () => { TestSocket.instances.at(-1)!.open(); await vi.advanceTimersByTimeAsync(200); });
  const adopted = session.conversations.find((item) => item.id === 'cd');
  expect(adopted?.provider).toBe('codex');
  expect(adopted?.legacyCodex).toBeUndefined();
});

it('keeps the draft and sends nothing legacy when no agent is available', async () => {
  storedWith([draft], 'ca');
  const socket = await mount();
  await act(async () => { session.selectConversation('wa', 'cd'); await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { session.setConversationChatDraft('cd', 'hello'); await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { session.submitChat('cd'); await vi.advanceTimersByTimeAsync(50); });
  expect(session.chatDrafts.cd).toBe('hello');
  expect(sentTypes(socket).filter((type) => type.startsWith('codex.'))).toEqual([]);
});
