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
const conversation = { id: 'c', workspaceId: 'w', title: 'Pi test', sessionId: 'v2_c', threadId: '',
  provider: 'pi', v2ConversationId: 'c', permissionMode: 'ask', createdAt: 1, updatedAt: 1 };
const manifest = { schemaVersion: 2, id: 'c', provider: 'pi', ownerId: 'owner', workspace: '/workspace', workspaceId: 'w',
  title: 'Pi test', status: 'idle', lastSequence: 0, createdAt: '2026-09-11T00:00:00Z', updatedAt: '2026-09-11T00:00:00Z' };

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
let catalogStatus: 'ready' | 'loading' | 'error';
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
beforeEach(() => {
  vi.useFakeTimers();
  catalogStatus = 'ready';
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
    if (url.pathname === '/v2/providers/commands') {
      if (catalogStatus === 'loading') return new Promise(() => {});
      if (catalogStatus === 'error') return new Response(JSON.stringify({ message: 'unavailable' }), { status: 503 });
      result = { provider: 'pi', source: 'rpc', catalogSource: 'session', conversationId: 'c', runtimeId: 'r1',
        fetchedAt: '', commands: [{ name: 'compact', description: 'Native compact', source: 'extension', invocation: 'prompt' }] };
    } else if (url.pathname === '/v2/providers') result = { providers: [provider] };
    else if (url.pathname === '/v2/conversations') result = { conversations: [manifest] };
    else if (url.pathname === '/v2/workspaces') result = { workspaces: [workspace] };
    else if (url.pathname.endsWith('/events')) result = { events: [], lastSequence: 0 };
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
async function deliver(socket: TestSocket, sequence: number, type: string, payload: object, delivery = 'live') {
  await act(async () => {
    socket.onmessage?.({ data: JSON.stringify({ type: 'conversation.event', delivery, payload: {
      schemaVersion: 2, eventId: `event-${sequence}`, conversationId: 'c', sequence,
      time: '2026-09-11T00:00:00Z', type, payload,
    } }) });
    await vi.advanceTimersByTimeAsync(25);
  });
}
async function draft(text: string) { await act(async () => { session.setConversationChatDraft('c', text); }); }

it.each(['loading', 'error'] as const)('real Pi composer preserves blocked drafts when command catalog is %s', async status => {
  catalogStatus = status;
  const socket = await mount();
  await draft('/compact');
  await act(async () => { session.submitChat('c'); });
  expect(session.chatDrafts.c).toBe('/compact');
  expect(sent(socket).filter(frame => ['conversation.prompt', 'conversation.compact'].includes(frame.type))).toEqual([]);
  expect(toast.warning).toHaveBeenCalled();
});

it('real Pi composer sends a native /compact as prompt and never invokes the Todex compact control', async () => {
  const socket = await mount();
  expect(session.getProviderCommandCatalog('c')?.status).toBe('ready');
  await draft('/compact');
  await act(async () => { session.submitChat('c'); });
  expect(sent(socket).filter(frame => frame.type === 'conversation.prompt')).toHaveLength(1);
  expect(sent(socket).find(frame => frame.type === 'conversation.prompt').payload.text).toBe('/compact');
  expect(sent(socket).some(frame => frame.type === 'conversation.compact')).toBe(false);
});

it('real event delivery applies live draft suggestions conservatively and keeps replay effects silent', async () => {
  const socket = await mount();
  await deliver(socket, 1, 'provider.runtime', { provider: 'pi', runtimeId: 'r1', status: 'ready' });
  await deliver(socket, 2, 'extension.ui', { provider: 'pi', runtimeId: 'r1', scope: 'session', method: 'set_editor_text', text: 'first' });
  expect(session.chatDrafts.c).toBe('first');
  await draft('my draft');
  await deliver(socket, 3, 'extension.ui', { provider: 'pi', runtimeId: 'r1', scope: 'session', method: 'set_editor_text', text: 'second' });
  expect(session.chatDrafts.c).toBe('my draft');
  expect(session.pendingPluginDrafts.c?.text).toBe('second');
  await deliver(socket, 4, 'extension.ui', { provider: 'pi', runtimeId: 'r1', scope: 'session', method: 'set_editor_text', text: 'replayed' }, 'replay');
  expect(session.chatDrafts.c).toBe('my draft');
  expect(session.pendingPluginDrafts.c).toBeUndefined();
  await deliver(socket, 5, 'extension.ui', { provider: 'pi', runtimeId: 'r1', scope: 'session', method: 'notify', message: 'historical' }, 'replay');
  expect(toast.info).not.toHaveBeenCalled();
  await deliver(socket, 6, 'extension.ui', { provider: 'pi', runtimeId: 'r1', scope: 'session', method: 'notify', message: 'live' });
  expect(toast.info).toHaveBeenCalledOnce();
});
