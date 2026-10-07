import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '@heroui/react';
import { useTodeXSession, type TodeXSession } from '../../src/renderer/session/useTodeXSession';
import { loadJson, saveJson } from '../../src/renderer/lib/storage';
import { t } from '../../src/renderer/i18n';
import { buildConversationCancelMessage, defaultSettings, formatResetInstant, hasBackendQueue, isStaleCancelResult, SETTINGS_STORAGE_KEY, WORKSPACES_STORAGE_KEY, CONVERSATIONS_STORAGE_KEY,
  ACTIVE_SELECTION_STORAGE_KEY, type ConversationRecord } from '../../src/renderer/session/helpers';

vi.mock('../../src/renderer/lib/storage', () => ({
  loadJson: vi.fn(), loadSecret: vi.fn().mockResolvedValue(''),
  saveJson: vi.fn().mockResolvedValue(undefined), saveSecret: vi.fn().mockResolvedValue(undefined),
}));
// Loopback profiles without a pinned key: plaintext, policy check skipped.
vi.mock('@todex/protocol/secureTransport', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/secureTransport')>(), verifyTransportPolicy: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@todex/protocol/connectionProbe', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/connectionProbe')>(),
  probeBackendConnection: vi.fn(async () => ({ ok: true, error: null, providers: [provider], version: null })),
}));

const provider = { id: 'claude-code', displayName: 'Claude Code', available: true, profiles: [], models: [], capabilities: {
  nativeResume: true, cancel: true, permissions: true, toolEvents: true, nativeSkills: false, nativeMcp: false,
  managedMcp: false, modelSelection: true, backendQueue: true, followUpQueue: false,
  controlActions: ['cancel', 'interrupt', 'followUp', 'retry'], permissionConfig: { modes: ['ask'], defaultMode: 'ask', supportsPlan: false },
} };
const workspace = { id: 'w', name: 'Workspace', path: '/workspace', tenantId: 'local', model: '',
  approvalPolicy: 'on-request', sandboxMode: 'workspace-write', createdAt: 1, updatedAt: 1 };
const conversation = { id: 'c', workspaceId: 'w', title: 'Queue test', sessionId: 'v2_c', threadId: '',
  provider: 'claude-code', v2ConversationId: 'c', permissionMode: 'ask', createdAt: 1, updatedAt: 1 };
let manifestStatus = 'idle';
let manifestSequence = 0;
let journal: object[] = [];
let storedQueue: unknown = {};

function event(sequence: number, type: string, payload: Record<string, unknown>) {
  return { schemaVersion: 2, eventId: `e${sequence}`, conversationId: 'c', sequence, time: '2026-10-06T00:00:00Z', type, payload };
}

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
  reply(frame: object) { this.onmessage?.({ data: JSON.stringify(frame) }); }
}
let root: Root;
let container: HTMLDivElement;
let session: TodeXSession;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
beforeEach(() => {
  vi.useFakeTimers();
  manifestStatus = 'idle';
  manifestSequence = 0;
  journal = [];
  storedQueue = {};
  TestSocket.instances = [];
  vi.stubGlobal('WebSocket', TestSocket);
  for (const kind of ['warning', 'danger', 'info'] as const) vi.spyOn(toast, kind).mockReturnValue(`toast-${kind}`);
  vi.mocked(loadJson).mockImplementation(async (key, fallback) => ({
    [SETTINGS_STORAGE_KEY]: { ...defaultSettings, serverUrl: 'http://127.0.0.3' },
    [WORKSPACES_STORAGE_KEY]: [workspace], [CONVERSATIONS_STORAGE_KEY]: [{ ...conversation, nativeStatus: manifestStatus, lastSequence: manifestSequence }],
    [ACTIVE_SELECTION_STORAGE_KEY]: { workspaceId: 'w', conversationId: 'c' },
    'todex.queued-follow-ups.v1': storedQueue,
  }[key] ?? fallback) as never);
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    let result: unknown;
    if (url.pathname.endsWith('/events')) result = { events: journal, lastSequence: journal.length, hasMore: false };
    else if (url.pathname === '/v2/providers') result = { providers: [provider] };
    else if (url.pathname === '/v2/conversations') result = { conversations: [{ schemaVersion: 2, id: 'c', provider: 'claude-code',
      ownerId: 'owner', workspace: '/workspace', workspaceId: 'w', title: 'Queue test', status: manifestStatus,
      lastSequence: manifestSequence, createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z' }] };
    else if (url.pathname === '/v2/workspaces') result = { workspaces: [workspace] };
    else if (url.pathname === '/v2/providers/models') result = { provider: 'claude-code', models: [] };
    else if (url.pathname === '/v2/catalog/skills') result = { provider: 'claude-code', skills: [] };
    else if (url.pathname === '/v2/catalog/mcp') result = { provider: 'claude-code', servers: [] };
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
  await act(async () => { session.connect(); });
  const socket = TestSocket.instances.at(-1)!;
  await act(async () => { socket.open(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  expect(session.connectionState).toBe('open');
  return socket;
}
function sent(socket: TestSocket) { return socket.send.mock.calls.map(([data]) => JSON.parse(String(data))); }
function framesOf(socket: TestSocket, type: string) { return sent(socket).filter(frame => frame.type === type); }

it('only a backend that advertises its queue holds the follow-ups', () => {
  const record = conversation as unknown as ConversationRecord;
  expect(hasBackendQueue([provider] as never, record)).toBe(true);
  expect(hasBackendQueue([{ ...provider, capabilities: { ...provider.capabilities, backendQueue: false } }] as never, record)).toBe(false);
  expect(hasBackendQueue([provider] as never, { ...record, v2ConversationId: '' })).toBe(false);
});

it('hands restored candidates to the backend queue instead of starting a turn after a reload', async () => {
  // The reported case: a long turn whose start lies below the loaded window.
  manifestStatus = 'running';
  manifestSequence = 3500;
  storedQueue = { c: [{ id: 'queued-1', text: 'follow up with image', attachments: [], skills: [] }] };
  const socket = await mount();
  const adds = framesOf(socket, 'conversation.queue.add');
  expect(adds).toHaveLength(1);
  expect(adds[0].payload).toMatchObject({ conversationId: 'c', itemId: 'queued-1', text: 'follow up with image' });
  expect(framesOf(socket, 'conversation.prompt')).toHaveLength(0);
  await act(async () => { socket.reply({ id: adds[0].id, type: 'server.result', payload: { conversationId: 'c', itemId: 'queued-1', status: 'queued' } }); });
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  expect(session.queuedChatDrafts.c ?? []).toHaveLength(0);
  expect(session.lastError).toBe('');
});

it('queues composer sends in the backend while a turn runs and shows its snapshot', async () => {
  manifestStatus = 'running';
  manifestSequence = 1;
  journal = [event(1, 'turn.started', { turnId: 't1' })];
  const socket = await mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(session.thinkingConversations.c).toBe(true);
  await act(async () => { session.setConversationChatDraft('c', 'next step'); });
  await act(async () => { session.submitChat('c'); });
  const add = framesOf(socket, 'conversation.queue.add').at(-1)!;
  expect(add.payload).toMatchObject({ conversationId: 'c', text: 'next step', permissionMode: 'ask', workMode: 'implement' });
  expect(framesOf(socket, 'conversation.prompt')).toHaveLength(0);
  await act(async () => { socket.reply({ id: add.id, type: 'server.result', payload: { status: 'queued', itemId: add.payload.itemId } }); });
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  expect(session.chatDrafts.c).toBe('');
  await act(async () => {
    socket.reply({ type: 'conversation.event', delivery: 'live', payload: event(2, 'followups.updated', {
      items: [{ id: add.payload.itemId, text: 'next step', status: 'queued', contentCount: 0, skills: [] }], paused: false }) });
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(session.conversationRuntimeById.c?.followUps.items.map(item => item.id)).toEqual([add.payload.itemId]);
});

it('moves a prompt that hits a busy conversation into the backend queue without an error', async () => {
  const socket = await mount();
  await act(async () => { session.setConversationChatDraft('c', 'are you done?'); });
  await act(async () => { session.submitChat('c'); });
  const prompt = framesOf(socket, 'conversation.prompt').at(-1)!;
  await act(async () => {
    socket.reply({ id: prompt.id, type: 'server.error', payload: { code: 'CONFLICT', message: 'conversation c is already running turn t9' } });
    await vi.advanceTimersByTimeAsync(10);
  });
  const add = framesOf(socket, 'conversation.queue.add').at(-1)!;
  expect(add.payload).toMatchObject({ itemId: prompt.payload.clientRequestId, text: 'are you done?' });
  await act(async () => {
    socket.reply({ id: add.id, type: 'server.result', payload: { status: 'queued', itemId: add.payload.itemId } });
    await vi.advanceTimersByTimeAsync(10);
  });
  expect(session.chatDrafts.c).toBe('');
  expect(session.lastError).toBe('');
});

it('keeps candidates local on a backend without a queue while its manifest reports a running turn', async () => {
  provider.capabilities.backendQueue = false;
  try {
    manifestStatus = 'running';
    manifestSequence = 3500;
    storedQueue = { c: [{ id: 'queued-1', text: 'later', attachments: [], skills: [] }] };
    const socket = await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(framesOf(socket, 'conversation.prompt')).toHaveLength(0);
    expect(framesOf(socket, 'conversation.queue.add')).toHaveLength(0);
    expect(session.queuedChatDrafts.c?.map(item => item.id)).toEqual(['queued-1']);
  } finally {
    provider.capabilities.backendQueue = true;
  }
});

async function promptAndFail(socket: TestSocket, text: string, failure: Record<string, unknown>) {
  await act(async () => { session.setConversationChatDraft('c', text); });
  await act(async () => { session.submitChat('c'); });
  const prompt = framesOf(socket, 'conversation.prompt').at(-1)!;
  await act(async () => {
    socket.reply({ id: prompt.id, type: 'server.result', payload: { conversationId: 'c', turnId: 't1' } });
    socket.reply({ type: 'conversation.event', delivery: 'live', payload: event(1, 'turn.started', {
      turnId: 't1', clientRequestId: prompt.payload.clientRequestId }) });
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(session.chatDrafts.c).toBe('');
  await act(async () => {
    socket.reply({ type: 'conversation.event', delivery: 'live', payload: event(2, 'turn.failed', {
      turnId: 't1', clientRequestId: prompt.payload.clientRequestId, ...failure }) });
    await vi.advanceTimersByTimeAsync(10);
  });
  return prompt;
}

it('leaves the rate-limit continuation to the daemon and reads the wait from its queue snapshot', async () => {
  const socket = await mount();
  const resumeAt = '2026-10-06T05:30:00Z';
  await promptAndFail(socket, 'long task', { code: 'PROVIDER_UNAVAILABLE',
    message: "provider unavailable: You've hit your session limit · resets 5:30pm (Australia/Perth)" });
  await act(async () => {
    socket.reply({ type: 'conversation.event', delivery: 'live', payload: event(3, 'followups.updated', {
      items: [{ id: 'rate-limit-continue-t1', text: 'Continue', status: 'queued', contentCount: 0, skills: [] }],
      paused: true, pauseReason: 'rate_limited', resumeAt }) });
    await vi.advanceTimersByTimeAsync(2000);
  });
  // The daemon continues the prompt itself; a local copy would run twice and
  // the error text is not parsed into a local wait.
  expect(session.queuedChatDrafts.c ?? []).toHaveLength(0);
  expect(framesOf(socket, 'conversation.queue.add')).toHaveLength(0);
  expect(framesOf(socket, 'conversation.queue.list')).toHaveLength(1); // only the one sent on open
  expect(session.chatDrafts.c).toBe('');
  expect(session.rateLimitedUntilByConversation.c).toBeUndefined();
  expect(session.lastError).toBe(t('sess.sessionLimitReached', { reset: formatResetInstant(Date.parse(resumeAt)) }));
  // While the daemon waits, a new message joins its queue instead of starting a turn.
  const prompts = framesOf(socket, 'conversation.prompt').length;
  await act(async () => { session.setConversationChatDraft('c', 'meanwhile'); });
  await act(async () => { session.submitChat('c'); await vi.advanceTimersByTimeAsync(10); });
  expect(framesOf(socket, 'conversation.prompt')).toHaveLength(prompts);
  const add = framesOf(socket, 'conversation.queue.add').at(-1)!;
  expect(add.payload).toMatchObject({ conversationId: 'c', text: 'meanwhile' });
  await act(async () => {
    socket.reply({ id: add.id, type: 'server.result', payload: { status: 'queued', itemId: add.payload.itemId } });
    await vi.advanceTimersByTimeAsync(10);
  });
  expect(session.chatDrafts.c).toBe('');
});

it('returns an ordinary failed prompt to the composer once the queue snapshot shows no continuation', async () => {
  const socket = await mount();
  const lists = framesOf(socket, 'conversation.queue.list').length;
  await promptAndFail(socket, 'long task', { code: 'PROVIDER_UNAVAILABLE', message: 'provider crashed' });
  // An empty queue publishes nothing after the failure: the client asks.
  expect(session.chatDrafts.c).toBe('');
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  const list = framesOf(socket, 'conversation.queue.list');
  expect(list).toHaveLength(lists + 1);
  await act(async () => {
    socket.reply({ id: list.at(-1)!.id, type: 'server.result', payload: { conversationId: 'c', queue: { items: [], paused: false } } });
    await vi.advanceTimersByTimeAsync(10);
  });
  expect(session.chatDrafts.c).toBe('long task');
  expect(session.lastError).toBe('provider crashed');
});

it('keeps paused candidates local across a reload until the user continues them', async () => {
  storedQueue = { version: 2, queues: { c: [{ id: 'queued-1', text: 'after the stop', attachments: [], skills: [] }] }, paused: ['c'] };
  const socket = await mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(framesOf(socket, 'conversation.queue.add')).toHaveLength(0);
  expect(framesOf(socket, 'conversation.prompt')).toHaveLength(0);
  expect(session.queuePausedByConversation.c).toBe(true);
  const saved = vi.mocked(saveJson).mock.calls.filter(([key]) => key === 'todex.queued-follow-ups.v1').at(-1)?.[1];
  expect(saved).toMatchObject({ version: 2, paused: ['c'] });
  await act(async () => { void session.resumeQueuedFollowUps('c'); await vi.advanceTimersByTimeAsync(10); });
  const adds = framesOf(socket, 'conversation.queue.add');
  expect(adds).toHaveLength(1);
  expect(adds[0].payload).toMatchObject({ itemId: 'queued-1', text: 'after the stop' });
  expect(session.queuePausedByConversation.c).toBe(false);
});

it('cancels the turn on screen and treats a stale-turn answer as a no-op', async () => {
  manifestStatus = 'running';
  manifestSequence = 1;
  journal = [event(1, 'turn.started', { turnId: 't1' })];
  const socket = await mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  await act(async () => { session.stopThinking('c'); });
  const cancel = framesOf(socket, 'conversation.cancel').at(-1)!;
  expect(cancel.payload).toEqual({ conversationId: 'c', turnId: 't1' });
  await act(async () => {
    socket.reply({ id: cancel.id, type: 'server.result', payload: { cancelled: false, activeTurnId: 't2' } });
    await vi.advanceTimersByTimeAsync(10);
  });
  expect(session.lastError).toBe('');
});

it('names the turn in cancel frames and recognizes a stale-turn answer', () => {
  expect(buildConversationCancelMessage('c', 't1').payload).toEqual({ conversationId: 'c', turnId: 't1' });
  expect(buildConversationCancelMessage('c', undefined).payload).toEqual({ conversationId: 'c' });
  expect(buildConversationCancelMessage('c', '').type).toBe('conversation.cancel');
  expect(isStaleCancelResult({ cancelled: false, activeTurnId: null })).toBe(true);
  expect(isStaleCancelResult({ cancelled: true })).toBe(false);
  expect(isStaleCancelResult({ conversationId: 'c', accepted: true })).toBe(false);
});
