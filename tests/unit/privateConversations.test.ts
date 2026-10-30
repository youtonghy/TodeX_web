import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ConversationManifest } from '@todex/protocol/v2';
import { toast } from '../../src/renderer/components/ui/toast';
import { useTodeXSession, type TodeXSession } from '../../src/renderer/session/useTodeXSession';
import { loadJson, saveJson } from '../../src/renderer/lib/storage';
import { t } from '../../src/renderer/i18n';
import {
  ACTIVE_SELECTION_STORAGE_KEY, BACKEND_CONNECTIONS_STORAGE_KEY, CONVERSATIONS_STORAGE_KEY, defaultSettings,
  mergeManifestConversations, SETTINGS_STORAGE_KEY, TIMELINE_STORAGE_KEY, WORKSPACES_STORAGE_KEY, type ConversationRecord,
} from '../../src/renderer/session/helpers';
import {
  persistableConversations, privateConversationIds, providerPrivateMode, vanishedPrivateConversations, withoutPrivateEntries,
} from '../../src/renderer/session/privateConversations';
import { WorkbenchLayoutStore } from '../../src/renderer/session/workbenchLayout';

vi.mock('../../src/renderer/lib/storage', () => ({
  loadJson: vi.fn(), loadSecret: vi.fn().mockResolvedValue(''),
  saveJson: vi.fn().mockResolvedValue(undefined), saveSecret: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@todex/protocol/secureTransport', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/secureTransport')>(), verifyTransportPolicy: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@todex/protocol/connectionProbe', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/connectionProbe')>(),
  // The probe lists the backend's agents (`codex` below, read at call time).
  probeBackendConnection: vi.fn(async () => ({ ok: true, error: null, providers: [codex], version: null })),
}));

const workspace = { id: 'wa', name: 'wa', path: '/wa', tenantId: 'local', model: '',
  approvalPolicy: 'on-request', sandboxMode: 'workspace-write', createdAt: 1, updatedAt: 1, backendConnectionId: 'a' };
const record = (id: string, extra: Partial<ConversationRecord> = {}): ConversationRecord => ({
  id, workspaceId: 'wa', title: id, sessionId: `v2_${id}`, threadId: '', provider: 'codex', v2ConversationId: `v2-${id}`,
  backendConnectionId: 'a', preview: '', createdAt: 1, updatedAt: 1, ...extra,
});
const manifest = (id: string, extra: Partial<ConversationManifest> = {}): ConversationManifest => ({
  schemaVersion: 2, id, provider: 'codex', ownerId: 'o', workspace: '/wa', workspaceId: 'wa', title: id,
  status: 'idle', lastSequence: 0, createdAt: '2026-10-30T00:00:00Z', updatedAt: '2026-10-30T00:00:00Z', ...extra,
});

describe('private conversation helpers', () => {
  it('keeps private records, receipts and usage out of what is persisted', () => {
    const conversations = [record('ca'), record('cp', { ephemeral: true })];
    expect(persistableConversations(conversations).map((item) => item.id)).toEqual(['ca']);
    const ids = privateConversationIds(conversations);
    expect([...ids].sort()).toEqual(['cp', 'v2-cp']);
    const receipts = [{ conversationId: 'ca', text: 'a' }, { conversationId: 'cp', text: 'secret' }, { conversationId: 'v2-cp', text: 'secret' }];
    expect(withoutPrivateEntries(receipts, ids).map((item) => item.text)).toEqual(['a']);
  });

  it('only counts providers that declare a private mode', () => {
    expect(providerPrivateMode({ capabilities: { privateConversations: 'native' } } as never)).toBe('native');
    expect(providerPrivateMode({ capabilities: { privateConversations: 'scrubbed' } } as never)).toBe('scrubbed');
    expect(providerPrivateMode({ capabilities: {} } as never)).toBeNull();
  });

  it('maps the echoed ephemeral flag and merges it like other manifest fields', () => {
    const merged = mergeManifestConversations([], [manifest('v2-cp', { ephemeral: true })], [workspace], 'a');
    expect(merged[0].ephemeral).toBe(true);
    const again = mergeManifestConversations(merged, [manifest('v2-cp', { ephemeral: true })], [workspace], 'a');
    expect(again).toBe(merged);
  });

  it('finds private conversations a backend no longer lists, only on that backend', () => {
    const current = [record('ca'), record('cp', { ephemeral: true }), record('cq', { ephemeral: true, backendConnectionId: 'b' }),
      record('draft', { ephemeral: true, v2ConversationId: undefined })];
    expect(vanishedPrivateConversations(current, [manifest('v2-ca')], [workspace], 'a').map((item) => item.id)).toEqual(['cp']);
    expect(vanishedPrivateConversations(current, [manifest('v2-ca'), manifest('v2-cp')], [workspace], 'a')).toEqual([]);
  });

  it('keeps a private workbench scope in memory', async () => {
    const save = vi.fn(async () => {});
    const load = vi.fn(async () => ({ isOpen: true }));
    const store = new WorkbenchLayoutStore({ load, save });
    store.markEphemeral('private');
    await store.hydrate('private');
    store.update('private', 'isOpen', true);
    expect(store.snapshot('private')).toMatchObject({ hydrated: true, isOpen: true });
    expect(load).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});

describe('private notification feed entries', () => {
  beforeEach(() => { vi.resetModules(); window.localStorage.clear(); });

  it('shows them this session but never writes them to localStorage', async () => {
    const feed = await import('../../src/renderer/session/notificationFeed');
    feed.addNotification({ kind: 'conversation', status: 'success', title: 'public', description: 'reply', conversationId: 'ca' });
    feed.addNotification({ kind: 'conversation', status: 'success', title: t('private.notifyReply'), description: '', conversationId: 'cp', ephemeral: true });
    const stored = JSON.parse(window.localStorage.getItem('todex.notificationFeed.v1') ?? '[]') as Array<{ title: string }>;
    expect(stored.map((item) => item.title)).toEqual(['public']);
    feed.forgetConversationNotifications(new Set(['cp']));
    const reloaded = await (vi.resetModules(), import('../../src/renderer/session/notificationFeed'));
    let items: unknown[] = [];
    function Probe() { items = reloaded.useNotificationFeed(); return null; }
    const host = document.createElement('div');
    const probeRoot = createRoot(host);
    await act(async () => { probeRoot.render(createElement(Probe)); });
    expect(items).toHaveLength(1);
    act(() => probeRoot.unmount());
  });
});

// --- Session: create, old-backend safety and daemon restarts ----------------

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

const profile = { id: 'a', name: 'a', serverUrl: 'http://127.0.0.1', tenantId: 'local', encryptionProtocol: 'none', createdAt: 1, updatedAt: 1 };
const codex = { id: 'codex', displayName: 'Codex', available: true, profiles: ['default'],
  capabilities: { nativeResume: true, cancel: true, permissions: true, toolEvents: true, nativeSkills: true, nativeMcp: true,
    managedMcp: true, modelSelection: true, privateConversations: 'scrubbed',
    permissionConfig: { modes: ['ask'], defaultMode: 'ask', supportsPlan: true } },
  models: [] };

let root: Root;
let container: HTMLDivElement;
let session: TodeXSession;
let listed: ConversationManifest[];
let echoEphemeral: boolean;
let requests: Array<{ method: string; path: string; body: unknown }>;

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });

describe('private conversations in the session', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(saveJson).mockClear();
    requests = [];
    listed = [manifest('v2-ca')];
    echoEphemeral = true;
    TestSocket.instances = [];
    vi.stubGlobal('WebSocket', TestSocket);
    for (const kind of ['warning', 'danger', 'info', 'success'] as const) vi.spyOn(toast, kind).mockReturnValue(`toast-${kind}`);
    vi.mocked(loadJson).mockImplementation(async (key, fallback) => ({
      [SETTINGS_STORAGE_KEY]: { ...defaultSettings, serverUrl: 'http://127.0.0.1' },
      [BACKEND_CONNECTIONS_STORAGE_KEY]: [profile],
      [WORKSPACES_STORAGE_KEY]: [workspace],
      [CONVERSATIONS_STORAGE_KEY]: [record('ca', { permissionMode: 'ask', mode: 'implement' })],
      [ACTIVE_SELECTION_STORAGE_KEY]: { workspaceId: 'wa', conversationId: 'ca' },
    }[key] ?? fallback) as never);
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      const raw = init?.body;
      const text = typeof raw === 'string' ? raw : raw && ArrayBuffer.isView(raw) ? new TextDecoder().decode(raw) : '';
      const body = text ? JSON.parse(text) as Record<string, unknown> : undefined;
      requests.push({ method, path: url.pathname, body });
      let result: unknown;
      if (url.pathname === '/v2/providers') result = { providers: [codex] };
      else if (url.pathname === '/v2/conversations' && method === 'POST') {
        result = manifest('v2-new', body?.ephemeral === true && echoEphemeral ? { ephemeral: true } : {});
        if (echoEphemeral) listed = [...listed, result as ConversationManifest];
      } else if (url.pathname === '/v2/conversations') result = { conversations: listed };
      else if (/^\/v2\/conversations\/[^/]+$/.test(url.pathname) && method === 'DELETE') return new Response(null, { status: 204 });
      else if (/^\/v2\/conversations\/[^/]+\/events$/.test(url.pathname)) result = { events: [], hasMore: false };
      else if (url.pathname === '/v2/workspaces') result = { workspaces: [workspace] };
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
    await act(async () => { socket.open(); await vi.advanceTimersByTimeAsync(200); });
    expect(session.v2Providers.map((item) => item.id)).toEqual(['codex']);
  }
  const savedConversations = () => vi.mocked(saveJson).mock.calls
    .filter(([key]) => key === CONVERSATIONS_STORAGE_KEY).map(([, value]) => value as ConversationRecord[]);
  const flushSaves = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(2_000); }); };

  it('creates a private conversation on the backend at once and never persists it', async () => {
    await mount();
    let created: ConversationRecord | null = null;
    await act(async () => { created = await session.createPrivateConversation('wa', { provider: 'codex' }); });
    expect(created).toMatchObject({ v2ConversationId: 'v2-new', ephemeral: true });
    expect(requests.find((request) => request.method === 'POST' && request.path === '/v2/conversations')?.body)
      .toMatchObject({ provider: 'codex', workspace: '/wa', ephemeral: true });
    expect(session.activeConversationId).toBe(created!.id);
    await flushSaves();
    const saved = savedConversations();
    expect(saved.length).toBeGreaterThan(0);
    for (const list of saved) expect(list.some((item) => item.ephemeral || item.v2ConversationId === 'v2-new')).toBe(false);
    const selections = vi.mocked(saveJson).mock.calls.filter(([key]) => key === ACTIVE_SELECTION_STORAGE_KEY).map(([, value]) => value as { conversationId?: string });
    expect(selections.some((value) => value.conversationId === created!.id)).toBe(false);

    // A normal "new conversation" never lands in the private one.
    let normal: ConversationRecord | null = null;
    act(() => { normal = session.createConversation('wa'); });
    expect(normal!.id).not.toBe(created!.id);
    expect(normal!.ephemeral).toBeUndefined();
  });

  it('deletes a conversation an old backend did not keep private and reports it', async () => {
    echoEphemeral = false;
    await mount();
    let created: ConversationRecord | null = {} as ConversationRecord;
    await act(async () => { created = await session.createPrivateConversation('wa', { provider: 'codex' }); });
    expect(created).toBeNull();
    expect(requests.some((request) => request.method === 'DELETE' && request.path === '/v2/conversations/v2-new')).toBe(true);
    expect(session.lastError).toBe(t('private.backendUnsupported'));
    expect(session.conversations.some((item) => item.v2ConversationId === 'v2-new' || item.ephemeral)).toBe(false);
    await flushSaves();
    for (const list of savedConversations()) expect(list.some((item) => item.ephemeral || item.v2ConversationId === 'v2-new')).toBe(false);
  });

  it('never writes the timeline of a deleted conversation', async () => {
    await mount();
    let created: ConversationRecord | null = null;
    await act(async () => { created = await session.createPrivateConversation('wa', { provider: 'codex' }); });
    const row = { id: 'row-private', kind: 'outgoing', title: 'user', subtitle: 'PRIVCANARY', raw: 'PRIVCANARY', at: 1, workspaceId: 'wa', conversationId: created!.id };
    act(() => { session.stores.timeline.set([row as never, ...session.stores.timeline.get()]); });
    // Deleting drops the record (forgetDeletedConversations) but not its rows.
    act(() => { session.stores.conversations.set(session.stores.conversations.get().filter((item) => item.id !== created!.id)); });
    // Rows can linger in memory after the record is gone; they still must not be saved.
    act(() => { session.stores.timeline.set([...session.stores.timeline.get(), { ...row, id: 'row-after' } as never]); });
    await flushSaves();
    const savedTimelines = vi.mocked(saveJson).mock.calls.filter(([key]) => key === TIMELINE_STORAGE_KEY).map(([, value]) => value as Array<{ conversationId?: string }>);
    for (const list of savedTimelines) expect(list.some((entry) => entry.conversationId === created!.id)).toBe(false);
  });

  it('refuses a private conversation in the None workspace', async () => {
    await mount();
    let created: ConversationRecord | null = {} as ConversationRecord;
    await act(async () => { created = await session.createPrivateConversation('__none__'); });
    expect(created).toBeNull();
    expect(requests.some((request) => request.method === 'POST' && request.path === '/v2/conversations')).toBe(false);
  });

  it('forgets a private conversation once a daemon restart drops it from the list', async () => {
    await mount();
    let created: ConversationRecord | null = null;
    await act(async () => { created = await session.createPrivateConversation('wa', { provider: 'codex' }); });
    expect(session.conversations.some((item) => item.id === created!.id)).toBe(true);
    // The daemon restarted: its list no longer has the private conversation.
    listed = [manifest('v2-ca')];
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(session.conversations.some((item) => item.id === created!.id || item.v2ConversationId === 'v2-new')).toBe(false);
    expect(session.activeConversationId).not.toBe(created!.id);
    expect(toast.info).toHaveBeenCalledWith(t('private.cleared'));
    expect(session.conversations.some((item) => item.id === 'ca')).toBe(true);
  });
});
