import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '@heroui/react';
import { useTodeXSession, type TodeXSession } from '../../src/renderer/session/useTodeXSession';
import { loadJson } from '../../src/renderer/lib/storage';
import { defaultSettings, SETTINGS_STORAGE_KEY, WORKSPACES_STORAGE_KEY, CONVERSATIONS_STORAGE_KEY,
  ACTIVE_SELECTION_STORAGE_KEY } from '../../src/renderer/session/helpers';

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
  probeBackendConnection: vi.fn(async () => ({ ok: true, error: null, providers: [provider], version: null })),
}));
vi.mock('@todex/protocol/transportCrypto', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/transportCrypto')>(), createTransportCryptoSession: vi.fn(() => null),
}));

const provider = { id: 'pi', displayName: 'Pi', available: true, profiles: [], models: [], capabilities: {
  nativeResume: true, cancel: true, permissions: true, toolEvents: true, nativeSkills: true, nativeMcp: false,
  managedMcp: false, modelSelection: true, runtimeStop: true, sessionCommands: true, extensionMessages: true,
  controlActions: ['compact', 'cancel'], permissionConfig: { modes: ['ask'], defaultMode: 'ask', supportsPlan: false },
} };
const workspace = { id: 'w', name: 'Workspace', path: '/workspace', tenantId: 'local', model: '',
  approvalPolicy: 'on-request', sandboxMode: 'workspace-write', createdAt: 1, updatedAt: 1 };
const conversation = { id: 'c', workspaceId: 'w', title: 'Reconcile test', sessionId: 'v2_c', threadId: '',
  provider: 'pi', v2ConversationId: 'c', permissionMode: 'ask', createdAt: 1, updatedAt: 1 };
const manifest = { schemaVersion: 2, id: 'c', provider: 'pi', ownerId: 'owner', workspace: '/workspace', workspaceId: 'w',
  title: 'Reconcile test', status: 'idle', lastSequence: 0, createdAt: '2026-09-11T00:00:00Z', updatedAt: '2026-09-11T00:00:00Z' };

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
let root: Root;
let container: HTMLDivElement;
let session: TodeXSession;
let replayedEvents: object[];
let replayFails: boolean;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
beforeEach(() => {
  vi.useFakeTimers();
  replayedEvents = [];
  replayFails = false;
  TestSocket.instances = [];
  vi.stubGlobal('WebSocket', TestSocket);
  for (const kind of ['warning', 'danger', 'info'] as const) vi.spyOn(toast, kind).mockReturnValue(`toast-${kind}`);
  vi.mocked(loadJson).mockImplementation(async (key, fallback) => ({
    [SETTINGS_STORAGE_KEY]: { ...defaultSettings, serverUrl: 'http://backend.test' },
    [WORKSPACES_STORAGE_KEY]: [workspace], [CONVERSATIONS_STORAGE_KEY]: [conversation],
    [ACTIVE_SELECTION_STORAGE_KEY]: { workspaceId: 'w', conversationId: 'c' },
  }[key] ?? fallback) as never);
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    let result: unknown;
    if (url.pathname.endsWith('/events')) {
      if (replayFails) return new Response(JSON.stringify({ message: 'journal unavailable' }), { status: 503 });
      result = { events: replayedEvents, lastSequence: replayedEvents.length };
    }
    else if (url.pathname === '/v2/providers') result = { providers: [provider] };
    else if (url.pathname === '/v2/conversations') result = { conversations: [manifest] };
    else if (url.pathname === '/v2/workspaces') result = { workspaces: [workspace] };
    else if (url.pathname === '/v2/providers/models') result = { provider: 'pi', models: [] };
    else if (url.pathname === '/v2/catalog/skills') result = { provider: 'pi', skills: [] };
    else if (url.pathname === '/v2/catalog/mcp') result = { provider: 'pi', servers: [] };
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
  expect(session.activeConversation?.id).toBe('c');
  await act(async () => { session.connect(); });
  const socket = TestSocket.instances.at(-1)!;
  await act(async () => { socket.open(); });
  expect(session.connectionState).toBe('open');
  return socket;
}
function sent(socket: TestSocket) { return socket.send.mock.calls.map(([data]) => JSON.parse(String(data))); }
async function draft(text: string) { await act(async () => { session.setConversationChatDraft('c', text); }); }

it('restores the composer draft when a lost prompt is absent from the journal', async () => {
  const socket = await mount();
  await draft('please review this');
  await act(async () => { session.submitChat('c'); });
  expect(sent(socket).some(frame => frame.type === 'conversation.prompt')).toBe(true);
  // ACK times out at 15s; the first journal replay runs inside the settle window.
  await act(async () => { await vi.advanceTimersByTimeAsync(16_000); });
  expect(session.submissionStatusByConversation.c).toBe('unknown');
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(session.submissionStatusByConversation.c).toBeUndefined();
  expect(session.chatDrafts.c).toBe('please review this');
  expect(session.lastError).toContain('未送达');
});

it('keeps tracking a lost prompt whose turn appears in the journal', async () => {
  const socket = await mount();
  await draft('run this');
  await act(async () => { session.submitChat('c'); });
  const prompt = sent(socket).find(frame => frame.type === 'conversation.prompt')!;
  const clientRequestId = prompt.payload.clientRequestId;
  replayedEvents = [
    { schemaVersion: 2, eventId: 'e1', conversationId: 'c', sequence: 1, time: '2026-09-11T00:00:00Z',
      type: 'message.created', payload: { turnId: 't1', clientRequestId, role: 'user', content: 'run this' } },
    { schemaVersion: 2, eventId: 'e2', conversationId: 'c', sequence: 2, time: '2026-09-11T00:00:01Z',
      type: 'turn.started', payload: { turnId: 't1', clientRequestId } },
  ];
  await act(async () => { await vi.advanceTimersByTimeAsync(16_000); });
  expect(session.submissionStatusByConversation.c).toBe('running');
  expect(session.chatDrafts.c).toBe('');
  expect(session.lastError).not.toContain('未送达');
});

it('reconciles a lost submission automatically after reconnect', async () => {
  replayFails = true;
  const socket = await mount();
  await draft('lost in flight');
  await act(async () => { session.submitChat('c'); });
  // A failed replay cannot prove either outcome, so the marker stays.
  await act(async () => { await vi.advanceTimersByTimeAsync(16_000); });
  expect(session.submissionStatusByConversation.c).toBe('unknown');
  replayFails = false;
  await act(async () => { socket.close(); });
  await act(async () => { session.connect(); });
  const socket2 = TestSocket.instances.at(-1)!;
  await act(async () => { socket2.open(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(session.submissionStatusByConversation.c).toBeUndefined();
  expect(session.chatDrafts.c).toBe('lost in flight');
});
