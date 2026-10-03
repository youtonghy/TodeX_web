import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useTodeXSession, type TodeXSession } from '../../src/renderer/session/useTodeXSession';
import { loadJson } from '../../src/renderer/lib/storage';
import { defaultSettings, SETTINGS_STORAGE_KEY, WORKSPACES_STORAGE_KEY, BACKEND_CONNECTIONS_STORAGE_KEY } from '../../src/renderer/session/helpers';

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

const profile = { id: 'a', name: 'a', serverUrl: 'http://a.test', tenantId: 'local', encryptionProtocol: 'none', createdAt: 1, updatedAt: 1 };
const workspace = { id: 'wa', name: 'wa', path: '/wa', tenantId: 'local', model: '',
  approvalPolicy: 'on-request', sandboxMode: 'workspace-write', createdAt: 1, updatedAt: 1, backendConnectionId: 'a' };

let root: Root;
let container: HTMLDivElement;
let session: TodeXSession;

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
beforeEach(() => {
  vi.useFakeTimers();
  TestSocket.instances = [];
  vi.stubGlobal('WebSocket', TestSocket);
  vi.mocked(loadJson).mockImplementation(async (key, fallback) => ({
    [SETTINGS_STORAGE_KEY]: { ...defaultSettings, serverUrl: 'http://a.test' },
    [BACKEND_CONNECTIONS_STORAGE_KEY]: [profile],
    [WORKSPACES_STORAGE_KEY]: [workspace],
  }[key] ?? fallback) as never);
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.pathname === '/health' || url.pathname === '/v2/version') return new Response(JSON.stringify({ name: 'test', version: '1' }));
    if (url.pathname === '/v2/workspaces') return new Response(JSON.stringify({ workspaces: [workspace] }));
    if (url.pathname === '/v2/conversations') return new Response(JSON.stringify({ conversations: [] }));
    if (url.pathname === '/v2/providers') return new Response(JSON.stringify({ providers: [] }));
    return new Promise<Response>(() => {});
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
  expect(session.connectionState).toBe('open');
  return socket;
}
const sentFrames = (socket: TestSocket, type: string) => socket.send.mock.calls
  .map(([data]) => JSON.parse(String(data)) as { type: string; payload: Record<string, unknown> })
  .filter(frame => frame.type === type);

it('starts SSH terminals with an ssh payload and no workspace or cwd', async () => {
  const socket = await mount();
  await act(async () => { session.startTerminalSession({ kind: 'ssh', host: 'prod' }, { terminalId: 'term-ssh', cwd: '/ignored', shell: '', rows: 30, cols: 100 }); });
  const [start] = sentFrames(socket, 'terminal.start');
  expect(start.payload).toEqual({ terminalId: 'term-ssh', tenantId: 'local', cwd: '', ssh: { host: 'prod' }, rows: 30, cols: 100 });
  expect(session.terminalById['term-ssh']).toMatchObject({ ssh: { host: 'prod' }, workspaceId: '', conversationId: '', cwd: '' });

  await act(async () => { session.requestTerminalStatus({ kind: 'ssh', host: 'prod' }, 'term-ssh'); });
  expect(sentFrames(socket, 'terminal.status').at(-1)?.payload).toEqual({ tenantId: 'local', terminalId: 'term-ssh' });
});

it('does not echo SSH input locally, so password prompts never land in the transcript', async () => {
  const socket = await mount();
  await act(async () => { session.startTerminalSession({ kind: 'ssh', host: 'prod' }, { terminalId: 'term-ssh', cwd: '', shell: '', rows: 24, cols: 80 }); });
  const before = session.terminalById['term-ssh'].output.length;
  await act(async () => { session.sendTerminalInput('term-ssh', 'local', 'hunter2\n'); });
  expect(sentFrames(socket, 'terminal.input').at(-1)?.payload).toMatchObject({ terminalId: 'term-ssh', data: 'hunter2\n' });
  expect(session.terminalById['term-ssh'].output).toHaveLength(before);
  expect(session.terminalById['term-ssh'].output.some(entry => entry.text.includes('hunter2'))).toBe(false);
});
