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

const provider = { id: 'codex', displayName: 'Codex', available: true, profiles: [], models: [], capabilities: {
  nativeResume: true, cancel: true, permissions: true, toolEvents: true, nativeSkills: false, nativeMcp: false,
  managedMcp: false, modelSelection: true, runtimeStop: true, sessionCommands: true, extensionMessages: false,
  controlActions: ['compact', 'cancel'], permissionConfig: { modes: ['ask', 'auto', 'full-access'], defaultMode: 'ask', supportsPlan: true },
} };
const workspace = { id: 'w', name: 'Workspace', path: '/workspace', tenantId: 'local', model: '',
  approvalPolicy: 'on-request', sandboxMode: 'workspace-write', createdAt: 1, updatedAt: 1 };
const workspace2 = { id: 'w2', name: 'Workspace 2', path: '/workspace2', tenantId: 'local', model: '',
  approvalPolicy: 'on-request', sandboxMode: 'workspace-write', createdAt: 1, updatedAt: 1 };
const conversation = { id: 'c', workspaceId: 'w', title: 'Codex test', sessionId: 'v2_c', threadId: '',
  provider: 'codex', v2ConversationId: 'c', permissionMode: 'ask' as const, mode: 'implement' as const, createdAt: 1, updatedAt: 1 };
// preview makes c2 count as used, so the unused-conversation sweep keeps it.
const conversation2 = { id: 'c2', workspaceId: 'w2', title: 'Codex used', sessionId: 'v2_c2', threadId: '',
  provider: 'codex', v2ConversationId: 'c2', permissionMode: 'ask' as const, mode: 'implement' as const,
  preview: 'earlier reply', createdAt: 1, updatedAt: 1 };
const manifest = { schemaVersion: 2, id: 'c', provider: 'codex', ownerId: 'owner', workspace: '/workspace', workspaceId: 'w',
  title: 'Codex test', status: 'idle', lastSequence: 0, createdAt: '2026-09-11T00:00:00Z', updatedAt: '2026-09-11T00:00:00Z' };
const manifest2 = { schemaVersion: 2, id: 'c2', provider: 'codex', ownerId: 'owner', workspace: '/workspace2', workspaceId: 'w2',
  title: 'Codex used', status: 'idle', lastSequence: 1, createdAt: '2026-09-11T00:00:00Z', updatedAt: '2026-09-11T00:00:00Z' };

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
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
beforeEach(() => {
  vi.useFakeTimers();
  TestSocket.instances = [];
  vi.stubGlobal('WebSocket', TestSocket);
  for (const kind of ['warning', 'danger', 'info'] as const) vi.spyOn(toast, kind).mockReturnValue(`toast-${kind}`);
  vi.mocked(loadJson).mockImplementation(async (key, fallback) => ({
    [SETTINGS_STORAGE_KEY]: { ...defaultSettings, serverUrl: 'http://backend.test' },
    [WORKSPACES_STORAGE_KEY]: [workspace, workspace2], [CONVERSATIONS_STORAGE_KEY]: [conversation, conversation2],
    [ACTIVE_SELECTION_STORAGE_KEY]: { workspaceId: 'w', conversationId: 'c' },
  }[key] ?? fallback) as never);
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    let result: unknown;
    if (url.pathname === '/v2/providers') result = { providers: [provider] };
    else if (url.pathname === '/v2/conversations') result = { conversations: [manifest, manifest2] };
    else if (url.pathname === '/v2/workspaces') result = { workspaces: [workspace, workspace2] };
    else if (url.pathname.endsWith('/events')) result = { events: [], lastSequence: 0 };
    else if (url.pathname === '/v2/providers/models') result = { provider: 'codex', models: [
      { id: 'model-a', isDefault: true, supportedReasoningEfforts: ['low', 'medium', 'high'] },
      { id: 'model-b', supportedReasoningEfforts: ['medium', 'high'] },
    ] };
    else if (url.pathname === '/v2/providers/commands') result = { provider: 'codex', source: 'rpc', catalogSource: 'session', conversationId: 'c', runtimeId: 'r1', fetchedAt: '', commands: [] };
    else if (url.pathname === '/v2/catalog/skills') result = { provider: 'codex', skills: [] };
    else if (url.pathname === '/v2/catalog/mcp') result = { provider: 'codex', servers: [] };
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

it('new conversations keep the last approval and work mode after a model selection', async () => {
  await mount();
  await act(async () => { await session.applyConversationPermissionMode('c', 'auto'); });
  await act(async () => { await session.applyConversationWorkMode('c', 'plan'); });
  await act(async () => { session.applyConversationModelSelection('c', 'model-b', 'high'); });
  let created: ReturnType<TodeXSession['createConversation']> = null;
  await act(async () => { created = session.createConversation('w'); });
  expect(created?.provider).toBe('codex');
  expect(created?.permissionMode).toBe('auto');
  expect(created?.mode).toBe('plan');
});

it('reusing an unused draft conversation refreshes it to the latest remembered modes', async () => {
  await mount();
  await act(async () => { await session.applyConversationPermissionMode('c', 'auto'); });
  let draft: ReturnType<TodeXSession['createConversation']> = null;
  await act(async () => { draft = session.createConversation('w'); });
  expect(draft?.permissionMode).toBe('auto');
  await act(async () => { await session.applyConversationPermissionMode(draft!.id, 'ask'); });
  await act(async () => { await session.applyConversationPermissionMode('c2', 'full-access'); });
  let reused: ReturnType<TodeXSession['createConversation']> = null;
  await act(async () => { reused = session.createConversation('w'); });
  expect(reused?.id).toBe(draft!.id);
  expect(reused?.permissionMode).toBe('full-access');
});
