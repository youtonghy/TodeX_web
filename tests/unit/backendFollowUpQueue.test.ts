import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '@heroui/react';
import { useTodeXSession, type TodeXSession } from '../../src/renderer/session/useTodeXSession';
import { loadJson, saveJson } from '../../src/renderer/lib/storage';
import { ConversationControls } from '../../src/renderer/components/ConversationControls';
import { EMPTY_FOLLOW_UP_QUEUE } from '@todex/protocol/conversationRuntime';
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
let storedConversations: object[] = [];
let extraManifests: object[] = [];
const LEGACY_KEY = 'todex.queued-follow-ups.v1';

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
  storedConversations = [];
  extraManifests = [];
  TestSocket.instances = [];
  vi.stubGlobal('WebSocket', TestSocket);
  for (const kind of ['warning', 'danger', 'info'] as const) vi.spyOn(toast, kind).mockReturnValue(`toast-${kind}`);
  vi.mocked(loadJson).mockImplementation(async (key, fallback) => ({
    [SETTINGS_STORAGE_KEY]: { ...defaultSettings, serverUrl: 'http://127.0.0.3' },
    [WORKSPACES_STORAGE_KEY]: [workspace], [CONVERSATIONS_STORAGE_KEY]: [{ ...conversation, nativeStatus: manifestStatus, lastSequence: manifestSequence }, ...storedConversations],
    [ACTIVE_SELECTION_STORAGE_KEY]: { workspaceId: 'w', conversationId: 'c' },
    [LEGACY_KEY]: storedQueue,
  }[key] ?? fallback) as never);
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    let result: unknown;
    if (url.pathname.endsWith('/events')) result = { events: journal, lastSequence: journal.length, hasMore: false };
    else if (url.pathname === '/v2/providers') result = { providers: [provider] };
    else if (url.pathname === '/v2/conversations') result = { conversations: [{ schemaVersion: 2, id: 'c', provider: 'claude-code',
      ownerId: 'owner', workspace: '/workspace', workspaceId: 'w', title: 'Queue test', status: manifestStatus,
      lastSequence: manifestSequence, createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z' }, ...extraManifests] };
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

it('migrates legacy candidates to the backend queue instead of starting a turn after a reload', async () => {
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
  // Only a taken item leaves the legacy copy, and nothing new is ever stored.
  expect(vi.mocked(saveJson).mock.calls.filter(([key]) => key === LEGACY_KEY)).toEqual([[LEGACY_KEY, undefined]]);
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
  // The backend is the only store: nothing about candidates or waits is persisted.
  const keys = vi.mocked(saveJson).mock.calls.map(([key]) => key);
  expect(keys).not.toContain(LEGACY_KEY);
  expect(keys).not.toContain('todex.rate-limits.v1');
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

it('keeps legacy candidates untouched on a backend without a queue', async () => {
  provider.capabilities.backendQueue = false;
  try {
    manifestStatus = 'running';
    manifestSequence = 3500;
    storedQueue = { c: [{ id: 'queued-1', text: 'later', attachments: [], skills: [] }] };
    const socket = await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(framesOf(socket, 'conversation.prompt')).toHaveLength(0);
    expect(framesOf(socket, 'conversation.queue.add')).toHaveLength(0);
    expect(vi.mocked(saveJson).mock.calls.filter(([key]) => key === LEGACY_KEY)).toEqual([]);
  } finally {
    provider.capabilities.backendQueue = true;
  }
});

it('rejects a busy send on a backend without a queue and keeps the composer', async () => {
  provider.capabilities.backendQueue = false;
  try {
    manifestStatus = 'running';
    manifestSequence = 1;
    journal = [event(1, 'turn.started', { turnId: 't1' })];
    const socket = await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    await act(async () => { session.setConversationChatDraft('c', 'next step'); });
    await act(async () => { session.submitChat('c'); await vi.advanceTimersByTimeAsync(10); });
    expect(framesOf(socket, 'conversation.queue.add')).toHaveLength(0);
    expect(framesOf(socket, 'conversation.prompt')).toHaveLength(0);
    expect(session.chatDrafts.c).toBe('next step');
    expect(session.lastError).toBe(t('sess.backendQueueRequired'));
    expect(vi.mocked(saveJson).mock.calls.filter(([key]) => String(key).includes('follow-ups'))).toEqual([]);
  } finally {
    provider.capabilities.backendQueue = true;
  }
});

it('keeps the draft in the composer, reported, when the backend refuses a busy send', async () => {
  manifestStatus = 'running';
  manifestSequence = 1;
  journal = [event(1, 'turn.started', { turnId: 't1' })];
  const socket = await mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  await act(async () => { session.setConversationChatDraft('c', 'next step'); });
  await act(async () => { session.submitChat('c'); });
  const add = framesOf(socket, 'conversation.queue.add').at(-1)!;
  await act(async () => {
    socket.reply({ id: add.id, type: 'server.error', payload: { code: 'INTERNAL', message: 'queue is full' } });
    await vi.advanceTimersByTimeAsync(10);
  });
  expect(session.chatDrafts.c).toBe('next step');
  expect(session.lastError).toContain('queue is full');
  expect(vi.mocked(saveJson).mock.calls.filter(([key]) => String(key).includes('follow-ups'))).toEqual([]);
});

describe('legacy candidate migration', () => {
  const legacyItem = (id: string, text: string) => ({ id, text, attachments: [], skills: [] });
  const acknowledge = async (socket: TestSocket, frame: { id: string; payload: Record<string, unknown> }) => {
    await act(async () => {
      socket.reply({ id: frame.id, type: 'server.result', payload: { status: 'queued', itemId: frame.payload.itemId } });
      await vi.advanceTimersByTimeAsync(10);
    });
  };

  it('adds the items in order and removes the local copy only after the backend took them', async () => {
    storedQueue = { c: [legacyItem('q1', 'first'), legacyItem('q2', 'second')] };
    const socket = await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(framesOf(socket, 'conversation.queue.add').map(frame => frame.payload.itemId)).toEqual(['q1']);
    await acknowledge(socket, framesOf(socket, 'conversation.queue.add')[0]);
    expect(framesOf(socket, 'conversation.queue.add').map(frame => frame.payload.itemId)).toEqual(['q1', 'q2']);
    expect(vi.mocked(saveJson).mock.calls.filter(([key]) => key === LEGACY_KEY).at(-1)![1]).toMatchObject({ queues: { c: [{ id: 'q2' }] } });
    await acknowledge(socket, framesOf(socket, 'conversation.queue.add')[1]);
    expect(vi.mocked(saveJson).mock.calls.filter(([key]) => key === LEGACY_KEY).at(-1)).toEqual([LEGACY_KEY, undefined]);
  });

  it('keeps a paused conversation paused when the backend can pause on add', async () => {
    provider.capabilities.backendQueueControl = true;
    try {
      storedQueue = { version: 2, queues: { c: [legacyItem('q1', 'after the stop')] }, paused: ['c'] };
      const socket = await mount();
      await act(async () => { await vi.advanceTimersByTimeAsync(50); });
      const adds = framesOf(socket, 'conversation.queue.add');
      expect(adds).toHaveLength(1);
      expect(adds[0].payload).toMatchObject({ itemId: 'q1', text: 'after the stop', paused: true });
      expect(framesOf(socket, 'conversation.prompt')).toHaveLength(0);
    } finally {
      delete (provider.capabilities as Record<string, unknown>).backendQueueControl;
    }
  });

  it('leaves a paused conversation local when the backend cannot pause on add', async () => {
    storedQueue = { version: 2, queues: { c: [legacyItem('q1', 'after the stop')] }, paused: ['c'] };
    const socket = await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(framesOf(socket, 'conversation.queue.add')).toHaveLength(0);
    expect(framesOf(socket, 'conversation.prompt')).toHaveLength(0);
    expect(vi.mocked(saveJson).mock.calls.filter(([key]) => key === LEGACY_KEY)).toEqual([]);
  });

  it('drops candidates of a read-only or missing conversation with a notice listing them', async () => {
    storedConversations = [{ ...conversation, id: 'ro', v2ConversationId: 'ro', sessionId: 'v2_ro', legacyPlaintext: true }];
    extraManifests = [{ schemaVersion: 2, id: 'ro', provider: 'claude-code', ownerId: 'owner', workspace: '/workspace', workspaceId: 'w',
      title: 'Old chat', status: 'idle', lastSequence: 0, legacyPlaintext: true,
      createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z' }];
    storedQueue = { ro: [legacyItem('q1', 'read only text')], missing: [legacyItem('q2', 'lost text')] };
    const socket = await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(framesOf(socket, 'conversation.queue.add')).toHaveLength(0);
    const notice = session.timeline.find(entry => entry.title === t('sess.legacyCandidatesDiscarded'));
    expect(notice?.conversationId).toBe('ro');
    expect(notice?.subtitle).toContain('read only text');
    expect(session.lastError).toContain('lost text');
    expect(vi.mocked(saveJson).mock.calls.filter(([key]) => key === LEGACY_KEY).at(-1)).toEqual([LEGACY_KEY, undefined]);
  });

  it('keeps the local copy when the add fails for a reason that may pass', async () => {
    storedQueue = { c: [legacyItem('q1', 'later')] };
    const socket = await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    const add = framesOf(socket, 'conversation.queue.add')[0];
    await act(async () => {
      socket.reply({ id: add.id, type: 'server.error', payload: { code: 'INTERNAL', message: 'try again' } });
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(vi.mocked(saveJson).mock.calls.filter(([key]) => key === LEGACY_KEY)).toEqual([]);
    expect(session.timeline.some(entry => entry.title === t('sess.legacyCandidatesDiscarded'))).toBe(false);
  });
});

it('holds a send in memory while the first prompt creates the backend conversation, then queues it', async () => {
  let created!: () => void;
  const createGate = new Promise<void>(resolve => { created = resolve; });
  const realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
    if (init?.method === 'POST' && new URL(String(input)).pathname === '/v2/conversations') {
      await createGate;
      return new Response(JSON.stringify({ schemaVersion: 2, id: 'n2', provider: 'claude-code', ownerId: 'owner',
        workspace: '/workspace', workspaceId: 'w', title: 'New chat', status: 'idle', lastSequence: 0,
        createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z' }), { status: 200 });
    }
    return realFetch(input, init);
  }));
  const socket = await mount();
  let draft: ReturnType<TodeXSession['createConversation']> = null;
  await act(async () => { draft = session.createConversation('w'); });
  const id = draft!.id;
  await act(async () => { session.setConversationChatDraft(id, 'first'); });
  await act(async () => { session.submitChat(id); await vi.advanceTimersByTimeAsync(10); });
  await act(async () => { session.setConversationChatDraft(id, 'second'); });
  await act(async () => { session.submitChat(id); await vi.advanceTimersByTimeAsync(10); });
  // Nothing about the held message is stored or sent yet; the composer is clear.
  expect(session.chatDrafts[id]).toBe('');
  expect(framesOf(socket, 'conversation.queue.add')).toHaveLength(0);
  expect(vi.mocked(saveJson).mock.calls.filter(([key]) => String(key).includes('follow-ups'))).toEqual([]);
  await act(async () => { created(); await vi.advanceTimersByTimeAsync(50); });
  const prompt = framesOf(socket, 'conversation.prompt').at(-1)!;
  expect(prompt.payload).toMatchObject({ conversationId: 'n2', text: 'first' });
  await act(async () => {
    socket.reply({ id: prompt.id, type: 'server.result', payload: { conversationId: 'n2', turnId: 't1' } });
    await vi.advanceTimersByTimeAsync(50);
  });
  const add = framesOf(socket, 'conversation.queue.add').at(-1)!;
  expect(add.payload).toMatchObject({ conversationId: 'n2', text: 'second' });
});

it('returns a held send to the composer when the backend conversation cannot be created', async () => {
  let fail!: () => void;
  const failGate = new Promise<void>(resolve => { fail = resolve; });
  const realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
    if (init?.method !== 'POST' || new URL(String(input)).pathname !== '/v2/conversations') return realFetch(input, init);
    await failGate;
    return new Response(JSON.stringify({ error: { code: 'INTERNAL', message: 'create failed' } }), { status: 500 });
  }));
  const socket = await mount();
  let draft: ReturnType<TodeXSession['createConversation']> = null;
  await act(async () => { draft = session.createConversation('w'); });
  const id = draft!.id;
  await act(async () => { session.setConversationChatDraft(id, 'first'); });
  await act(async () => { session.submitChat(id); });
  await act(async () => { session.setConversationChatDraft(id, 'second'); });
  await act(async () => { session.submitChat(id); await vi.advanceTimersByTimeAsync(10); });
  expect(session.chatDrafts[id]).toBe('');
  await act(async () => { fail(); await vi.advanceTimersByTimeAsync(100); });
  expect(framesOf(socket, 'conversation.queue.add')).toHaveLength(0);
  expect(session.chatDrafts[id]).toBe('first\n\nsecond');
});

it('pauses the queue through the backend', async () => {
  const socket = await mount();
  let edited!: Promise<boolean>;
  await act(async () => { edited = session.editFollowUpQueue('c', 'pause'); await vi.advanceTimersByTimeAsync(10); });
  const pause = framesOf(socket, 'conversation.queue.pause').at(-1)!;
  expect(pause.payload).toEqual({ conversationId: 'c' });
  await act(async () => {
    socket.reply({ id: pause.id, type: 'server.result', payload: { conversationId: 'c', queue: {
      items: [{ id: 'a', text: 'held', status: 'queued', contentCount: 0, skills: [] }], paused: true, pauseReason: 'user' } } });
    await vi.advanceTimersByTimeAsync(10);
  });
  expect(await edited).toBe(true);
  expect(session.conversationRuntimeById.c?.followUps).toMatchObject({ paused: true, pauseReason: 'user' });
});

describe('ConversationControls queue buttons', () => {
  const queue = { ...EMPTY_FOLLOW_UP_QUEUE, items: [{ id: 'a', text: 'held message', status: 'queued', queuedAt: '', contentCount: 2, skills: ['review'] }] };
  function show(props: { followUps: typeof queue; canPauseBackend: boolean; running?: boolean }) {
    const handlers = { onPauseBackend: vi.fn(), onResumeBackend: vi.fn(), onClearBackend: vi.fn(), onRemoveBackend: vi.fn() };
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    act(() => { root.render(createElement(ConversationControls, {
      runtime: { conversationId: 'c', queueItems: [], followUps: props.followUps } as never, running: props.running ?? true,
      canUseNativeQueue: false, piQueue: false, canPauseBackend: props.canPauseBackend,
      onRecover: vi.fn(), onRemoveNative: vi.fn(), onClearNative: vi.fn(), ...handlers })); });
    const button = (label: string) => [...container.querySelectorAll('button')].find(item => item.textContent === label);
    return { handlers, button };
  }
  const press = (button: HTMLElement | undefined) => act(() => { button!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

  it('shows Pause only when the backend can pause and the queue is running', () => {
    const { handlers, button } = show({ followUps: queue, canPauseBackend: true });
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('Skill · review');
    press(button(t('controls.pauseQueue')));
    expect(handlers.onPauseBackend).toHaveBeenCalledTimes(1);
    expect(button(t('controls.resumeSend'))).toBeUndefined();
  });
  it('hides Pause without backendQueueControl', () => {
    const { button } = show({ followUps: queue, canPauseBackend: false });
    expect(button(t('controls.pauseQueue'))).toBeUndefined();
  });
  it('offers Continue for a pause by the user even while a turn runs', () => {
    const { handlers, button } = show({ followUps: { ...queue, paused: true, pauseReason: 'user' }, canPauseBackend: true });
    expect(container.textContent).toContain(t('controls.backendPaused.user', { time: '' }));
    expect(button(t('controls.pauseQueue'))).toBeUndefined();
    press(button(t('controls.resumeSend')));
    expect(handlers.onResumeBackend).toHaveBeenCalledTimes(1);
  });
  it('keeps other pauses resumable only while idle', () => {
    const { button } = show({ followUps: { ...queue, paused: true, pauseReason: 'turn_failed' }, canPauseBackend: true, running: true });
    expect(button(t('controls.resumeSend'))).toBeUndefined();
  });
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
  expect(framesOf(socket, 'conversation.queue.add')).toHaveLength(0);
  expect(framesOf(socket, 'conversation.queue.list')).toHaveLength(1); // only the one sent on open
  expect(session.chatDrafts.c).toBe('');
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
