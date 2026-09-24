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

// Two backend profiles, each owning one workspace. The conversation records
// are untagged, as manifest imports are: their workspace names the backend.
const profile = (id: string) => ({ id, name: id, serverUrl: `http://${id}.test`, tenantId: 'local', encryptionProtocol: 'none', createdAt: 1, updatedAt: 1 });
const workspace = (id: string, backendConnectionId: string) => ({ id, name: id, path: `/${id}`, tenantId: 'local', model: '',
  approvalPolicy: 'on-request', sandboxMode: 'workspace-write', createdAt: 1, updatedAt: 1, backendConnectionId });
const conversation = (id: string, workspaceId: string) => ({ id, workspaceId, title: id, sessionId: `v2_${id}`, threadId: '',
  provider: 'codex', v2ConversationId: `v2-${id}`, permissionMode: 'ask' as const, mode: 'implement' as const,
  preview: 'reply', createdAt: 1, updatedAt: 1 });

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
let requests: URL[];
let storedConversations: ReturnType<typeof conversation>[];
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
beforeEach(() => {
  vi.useFakeTimers();
  TestSocket.instances = [];
  requests = [];
  storedConversations = [conversation('ca', 'wa'), conversation('cb', 'wb')];
  vi.stubGlobal('WebSocket', TestSocket);
  for (const kind of ['warning', 'danger', 'info'] as const) vi.spyOn(toast, kind).mockReturnValue(`toast-${kind}`);
  vi.mocked(loadJson).mockImplementation(async (key, fallback) => ({
    [SETTINGS_STORAGE_KEY]: { ...defaultSettings, serverUrl: 'http://a.test' },
    [BACKEND_CONNECTIONS_STORAGE_KEY]: [profile('a'), profile('b')],
    [WORKSPACES_STORAGE_KEY]: [workspace('wa', 'a'), workspace('wb', 'b')],
    [CONVERSATIONS_STORAGE_KEY]: storedConversations,
    [ACTIVE_SELECTION_STORAGE_KEY]: { workspaceId: 'wa', conversationId: 'ca' },
  }[key] ?? fallback) as never);
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    requests.push(url);
    let result: unknown;
    if (url.pathname === '/v2/providers') result = { providers: [] };
    else if (url.pathname === '/v2/conversations') {
      const workspaceId = url.host === 'a.test' ? 'wa' : 'wb';
      result = { conversations: storedConversations.filter((item) => item.workspaceId === workspaceId).map((item) => ({
        schemaVersion: 2, id: item.v2ConversationId, provider: 'codex', ownerId: 'o', workspace: `/${workspaceId}`, workspaceId,
        title: item.title, status: 'idle', lastSequence: 0, createdAt: '2026-09-24T00:00:00Z', updatedAt: '2026-09-24T00:00:00Z' })) };
    }
    else if (url.pathname === '/v2/workspaces') result = { workspaces: [] };
    else if (url.pathname.endsWith('/events')) result = { events: [], hasMore: false };
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
  expect(session.activeBackendConnectionId).toBe('a');
}
const historyRequests = (host: string, v2Id: string) =>
  requests.filter((url) => url.host === host && url.pathname === `/v2/conversations/${v2Id}/events`);

it('reads a conversation history from the backend that owns it', async () => {
  await mount();
  await act(async () => { void session.hydrateProcessGroup('cb', [1, 2]).catch(() => undefined); });
  expect(historyRequests('b.test', 'v2-cb')).toHaveLength(1);
  expect(historyRequests('a.test', 'v2-cb')).toHaveLength(0);
});

it('closes the connection when leaving a backend and continues its history when returning', async () => {
  await mount();
  await act(async () => { session.connect(); });
  await act(async () => { TestSocket.instances.at(-1)!.open(); });
  expect(TestSocket.instances.at(-1)!.url).toContain('a.test');

  await act(async () => { session.selectWorkspace('wb'); });
  const [left, away] = TestSocket.instances.slice(-2);
  expect(left.close).toHaveBeenCalled();
  expect(away.url).toContain('b.test');
  await act(async () => { away.open(); });

  requests.length = 0;
  await act(async () => { session.selectWorkspace('wa'); });
  const back = TestSocket.instances.at(-1)!;
  expect(away.close).toHaveBeenCalled();
  expect(back.url).toContain('a.test');
  await act(async () => { back.open(); });
  expect(session.activeConversation?.id).toBe('ca');
  expect(historyRequests('a.test', 'v2-ca').length).toBeGreaterThan(0);
  expect(historyRequests('b.test', 'v2-ca')).toHaveLength(0);
});

it('keeps backend conversations whose history is not loaded out of the unused-conversation sweep', async () => {
  // Never opened here, so no preview and no loaded timeline rows.
  storedConversations.push({ ...conversation('cd', 'wa'), preview: '' });
  await mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(16_000); });
  expect(session.conversations.some((item) => item.id === 'cd')).toBe(true);
});
