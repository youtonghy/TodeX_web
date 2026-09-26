import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '@heroui/react';
import { useTodeXSession, type TodeXSession } from '../../src/renderer/session/useTodeXSession';
import { loadJson } from '../../src/renderer/lib/storage';
import { canAutoLoadEarlierHistory, defaultSettings, SETTINGS_STORAGE_KEY, WORKSPACES_STORAGE_KEY, CONVERSATIONS_STORAGE_KEY,
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

const HIGH_WATER = 600;
const profile = { id: 'a', name: 'a', serverUrl: 'http://a.test', tenantId: 'local', encryptionProtocol: 'none', createdAt: 1, updatedAt: 1 };
const workspace = { id: 'wa', name: 'wa', path: '/wa', tenantId: 'local', model: '',
  approvalPolicy: 'on-request', sandboxMode: 'workspace-write', createdAt: 1, updatedAt: 1, backendConnectionId: 'a' };
const conversation = (id: string) => ({ id, workspaceId: 'wa', title: id, sessionId: `v2_${id}`, threadId: '',
  provider: 'codex', v2ConversationId: `v2-${id}`, permissionMode: 'ask' as const, mode: 'implement' as const,
  preview: 'reply', createdAt: 1, updatedAt: 1, lastSequence: HIGH_WATER });
const journal = (id: string) => Array.from({ length: HIGH_WATER }, (_, index) => ({
  schemaVersion: 2, conversationId: id, eventId: `${id}-${index + 1}`, sequence: index + 1, time: '2026-09-26T00:00:00Z',
  type: 'message.delta', payload: { turnId: `t${Math.floor(index / 20)}`, content: `m${index + 1} ` },
}));

let root: Root;
let container: HTMLDivElement;
let session: TodeXSession;
let requests: URL[];
/** The window page loads; every older page fails. */
let failOlderPages: boolean;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
beforeEach(() => {
  vi.useFakeTimers();
  requests = [];
  failOlderPages = true;
  vi.stubGlobal('WebSocket', class { readyState = 0; send = vi.fn(); close = vi.fn(); });
  for (const kind of ['warning', 'danger', 'info'] as const) vi.spyOn(toast, kind).mockReturnValue(`toast-${kind}`);
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
    }
    else if (url.pathname === '/v2/workspaces') result = { workspaces: [] };
    else if (events && url.searchParams.has('beforeSequence')) {
      const before = Number(url.searchParams.get('beforeSequence'));
      if (before < HIGH_WATER && failOlderPages) return new Response(JSON.stringify({ error: 'offline' }), { status: 503 });
      const page = journal(decodeURIComponent(events[1])).filter((item) => item.sequence <= before)
        .slice(-Number(url.searchParams.get('limit')));
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
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(session.earlierHistory.ca).toMatchObject({ hasMore: true, loading: false });
}
const olderPageRequests = () => requests.filter((url) => url.pathname === '/v2/conversations/v2-ca/events'
  && url.searchParams.has('beforeSequence') && Number(url.searchParams.get('beforeSequence')) < HIGH_WATER);
/** What the chat panel does on scroll and after every layout pass. */
async function autoTrigger(times: number) {
  for (let count = 0; count < times; count++) {
    await act(async () => {
      if (canAutoLoadEarlierHistory(session.earlierHistory.ca)) void session.loadEarlierHistory('ca');
      await vi.advanceTimersByTimeAsync(100);
    });
  }
}

it('stops paging automatically after a failed page until an explicit retry', async () => {
  await mount();
  await autoTrigger(5);
  expect(olderPageRequests()).toHaveLength(1);
  expect(session.earlierHistory.ca).toMatchObject({ hasMore: true, loading: false, failed: true });

  await act(async () => { await session.loadEarlierHistory('ca'); });
  expect(olderPageRequests()).toHaveLength(2);
  await autoTrigger(5);
  expect(olderPageRequests()).toHaveLength(2);

  failOlderPages = false;
  await act(async () => { await session.loadEarlierHistory('ca'); });
  expect(olderPageRequests()).toHaveLength(3);
  expect(session.earlierHistory.ca.failed).toBeUndefined();
});

it('clears a failed page when the conversation is opened again', async () => {
  await mount();
  await autoTrigger(1);
  expect(session.earlierHistory.ca?.failed).toBe(true);
  await act(async () => { session.selectConversation('wa', 'cb'); await vi.advanceTimersByTimeAsync(200); });
  await act(async () => { session.selectConversation('wa', 'ca'); await vi.advanceTimersByTimeAsync(200); });
  expect(session.earlierHistory.ca?.failed).toBeUndefined();
  await autoTrigger(1);
  expect(olderPageRequests()).toHaveLength(2);
});
