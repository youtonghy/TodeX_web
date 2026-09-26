import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '@heroui/react';
import { useTodeXSession, type TodeXSession } from '../../src/renderer/session/useTodeXSession';
import { loadJson } from '../../src/renderer/lib/storage';
import { defaultSettings, SETTINGS_STORAGE_KEY, WORKSPACES_STORAGE_KEY, CONVERSATIONS_STORAGE_KEY,
  ACTIVE_SELECTION_STORAGE_KEY, BACKEND_CONNECTIONS_STORAGE_KEY } from '../../src/renderer/session/helpers';

vi.mock('../../src/renderer/lib/storage', () => ({
  loadJson: vi.fn(), loadSecret: vi.fn().mockResolvedValue(''),
  saveJson: vi.fn().mockResolvedValue(undefined), saveSecret: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/renderer/session/transportVerification', () => ({
  ENCRYPTION_VERIFICATION_ERROR: 'verification failed',
  validateTransportEncryption: vi.fn().mockResolvedValue(undefined), verifyEncryptedSocket: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@todex/protocol/connectionProbe', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/connectionProbe')>(),
  probeBackendConnection: vi.fn(async () => ({ ok: true, error: null, providers: [], version: null })),
}));
vi.mock('@todex/protocol/transportCrypto', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/transportCrypto')>(), createTransportCryptoSession: vi.fn(() => null),
}));

class TestSocket {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 0;
  onopen: (() => unknown) | null = null;
  onmessage: ((event: { data: string }) => unknown) | null = null;
  onerror: (() => unknown) | null = null;
  onclose: (() => unknown) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.onclose?.(); });
  constructor(public url: string) { TestSocket.instances.push(this); }
  open() { this.readyState = 1; void this.onopen?.(); }
}

const HIGH_WATER = 600;
const profile = { id: 'a', name: 'a', serverUrl: 'http://a.test', tenantId: 'local', encryptionProtocol: 'none', createdAt: 1, updatedAt: 1 };
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
    [SETTINGS_STORAGE_KEY]: { ...defaultSettings, serverUrl: 'http://a.test' },
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
