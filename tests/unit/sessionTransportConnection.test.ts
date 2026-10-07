import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { x25519 } from '@noble/curves/ed25519.js';
import { useTodeXSession, type TodeXSession } from '../../src/renderer/session/useTodeXSession';
import { probeBackendConnection } from '@todex/protocol/connectionProbe';
import {
  RecordCipher,
  TRANSPORT_V2_DIRECTION_DOWN,
  TRANSPORT_V2_DIRECTION_UP,
  TRANSPORT_V2_WS_LABEL,
  deriveTransportKeys,
} from '@todex/protocol/secureChannel';
import { loadJson, loadSecret } from '../../src/renderer/lib/storage';

vi.mock('../../src/renderer/lib/storage', () => ({
  // Leave hydration pending so tests exercise explicit connection attempts,
  // without restoring unrelated workspace/session state or auto-connecting.
  loadJson: vi.fn(() => new Promise(() => {})), loadSecret: vi.fn(() => new Promise(() => {})),
  saveJson: vi.fn().mockResolvedValue(undefined), saveSecret: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@todex/protocol/connectionProbe', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/connectionProbe')>(), probeBackendConnection: vi.fn(),
}));

const serverSecret = new Uint8Array(32).fill(7);
const serverPublic = x25519.getPublicKey(serverSecret);
const pinnedKey = Buffer.from(serverPublic).toString('base64url');
const b64 = (value: string | null) => new Uint8Array(Buffer.from(value ?? '', 'base64url'));

/** WebSocket double that plays the backend side of transport v2 (or plaintext). */
class TestSocket {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 0;
  binaryType = 'blob';
  onopen: (() => unknown) | null = null;
  onmessage: ((event: { data: unknown }) => unknown) | null = null;
  onerror: (() => unknown) | null = null;
  onclose: ((event: { code: number; reason: string }) => unknown) | null = null;
  /** Opened client messages (decrypted when the socket is v2). */
  texts: string[] = [];
  raw: unknown[] = [];
  private up: RecordCipher | null = null;
  private down: RecordCipher | null = null;
  readonly url: URL;
  send = vi.fn((data: unknown) => {
    this.raw.push(data);
    if (!this.up) { this.texts.push(String(data)); return; }
    const frame = data as Uint8Array;
    const counter = new DataView(frame.buffer, frame.byteOffset).getBigUint64(0, false);
    this.texts.push(new TextDecoder().decode(this.up.open(counter, frame.subarray(8), false)));
  });
  close = vi.fn((code = 1000, reason = '') => { this.readyState = 3; this.onclose?.({ code, reason }); });
  constructor(url: string) { this.url = new URL(url); TestSocket.instances.push(this); }
  open() { this.readyState = 1; void this.onopen?.(); }
  /** Sends the server hello and keys both directions. */
  hello() {
    const query = this.url.searchParams;
    const clientMaterial = b64(query.get('client_key'));
    const serverNonce = new Uint8Array(32).fill(3);
    const keys = deriveTransportKeys({
      label: TRANSPORT_V2_WS_LABEL, protocol: 'x25519', deviceId: query.get('device_id') ?? '',
      serverStaticPublic: serverPublic, clientMaterial, clientNonce: b64(query.get('client_nonce')), serverNonce,
      shared: x25519.getSharedSecret(serverSecret, clientMaterial),
    });
    this.up = new RecordCipher(keys.kUp, keys.th, TRANSPORT_V2_DIRECTION_UP);
    this.down = new RecordCipher(keys.kDown, keys.th, TRANSPORT_V2_DIRECTION_DOWN);
    this.onmessage?.({ data: JSON.stringify({ type: 'todex.transport.hello', version: 2, serverNonce: Buffer.from(serverNonce).toString('base64url') }) });
  }
  reply(message: unknown) {
    const text = JSON.stringify(message);
    if (!this.down) { this.onmessage?.({ data: text }); return; }
    const { counter, ciphertext } = this.down.seal(new TextEncoder().encode(text), false);
    const frame = new Uint8Array(8 + ciphertext.length);
    new DataView(frame.buffer).setBigUint64(0, counter, false);
    frame.set(ciphertext, 8);
    this.onmessage?.({ data: frame.buffer });
  }
  /** Answers the verification ping (the first client message). */
  pong() {
    const ping = JSON.parse(this.texts[0]) as { id: string; type: string };
    expect(ping.type).toBe('server.ping');
    this.reply({ id: ping.id, type: 'server.result', payload: { pong: true } });
  }
}

let root: Root;
let container: HTMLDivElement;
let session: TodeXSession;
let policy: Record<string, unknown> | Promise<Record<string, unknown>>;
let fetchMock: ReturnType<typeof vi.fn>;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
beforeEach(() => {
  vi.useFakeTimers();
  TestSocket.instances = [];
  vi.stubGlobal('WebSocket', TestSocket);
  policy = { requiredProtocol: 'x25519', transportVersion: 2 };
  fetchMock = vi.fn(async (url: string) => {
    if (new URL(String(url)).pathname === '/v2/transport-policy') return new Response(JSON.stringify(await policy));
    if (String(url).endsWith('/health')) return new Response('{}');
    return new Promise(() => {});
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(loadJson).mockReset().mockImplementation(() => new Promise(() => {}));
  vi.mocked(loadSecret).mockReset().mockImplementation(() => new Promise(() => {}));
  vi.mocked(probeBackendConnection).mockReset().mockResolvedValue({ ok: true, error: null, providers: [], version: null } as never);
});
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function render(profile: { serverUrl: string; encryptionProtocol: 'none' | 'x25519' | 'ml-kem-768'; encryptionPublicKey: string } = {
  serverUrl: 'https://backend.test', encryptionProtocol: 'x25519', encryptionPublicKey: pinnedKey,
}) {
  function Harness() { session = useTodeXSession(() => {}); return null; }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  act(() => root.render(createElement(Harness)));
  act(() => session.setSettings(value => ({ ...value, deviceSecret: 'test-secret', ...profile })));
}
async function connect() { await act(async () => { session.connect(); }); }
const requestedPaths = () => fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname);

it('a pinned key opens a tv=2 socket, verifies it with a sealed ping and only then resumes', async () => {
  render(); await connect();
  expect(requestedPaths()).toEqual(['/v2/transport-policy']);
  expect(vi.mocked(fetchMock).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(probeBackendConnection).mock.invocationCallOrder[0]);
  expect(vi.mocked(probeBackendConnection).mock.calls[0][0].transport.mode).toBe('v2');
  const socket = TestSocket.instances[0];
  expect(socket.url.protocol).toBe('wss:');
  expect(socket.url.searchParams.get('tv')).toBe('2');
  expect(socket.url.searchParams.get('enc')).toBe('x25519');
  expect(socket.url.searchParams.get('historyEncryption')).toBe('1');
  expect(socket.binaryType).toBe('arraybuffer');
  await act(async () => socket.open());
  expect(socket.send).not.toHaveBeenCalled();
  await act(async () => socket.hello());
  expect(session.connectionState).toBe('connecting');
  expect(socket.raw).toHaveLength(1);
  expect(socket.raw[0]).toBeInstanceOf(Uint8Array);
  // Messages before the pong belong to the verifier only.
  await act(async () => { socket.reply({ type: 'conversation.event', payload: {} }); });
  expect(session.connectionState).toBe('connecting');
  await act(async () => socket.pong());
  expect(session.connectionState).toBe('open');
  expect(socket.texts.some((text) => text.includes('session.resume'))).toBe(true);
  expect(socket.raw.every((frame) => frame instanceof Uint8Array)).toBe(true);
});

it('refuses a remote backend without a pinned key before any request and asks for encrypted pairing', async () => {
  render({ serverUrl: 'http://192.168.1.20:7345', encryptionProtocol: 'none', encryptionPublicKey: '' });
  await connect();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(probeBackendConnection).not.toHaveBeenCalled();
  expect(TestSocket.instances).toHaveLength(0);
  expect(session.connectionState).toBe('error');
  expect(session.connectionHealth).toMatchObject({ status: 'offline', code: 'encryption_required' });
  expect(session.lastError).toContain('配对二维码');
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(TestSocket.instances).toHaveLength(0);
});

it.each([
  ['a different protocol', { requiredProtocol: 'ml-kem-768', transportVersion: 2 }, 'ml-kem-768'],
  ['plaintext', { requiredProtocol: 'none', transportVersion: 2 }, 'none'],
])('asks to re-pair when the backend now requires %s, never downgrading', async (_label, answer, protocol) => {
  policy = answer;
  render(); await connect();
  expect(probeBackendConnection).not.toHaveBeenCalled();
  expect(TestSocket.instances).toHaveLength(0);
  expect(session.connectionHealth).toMatchObject({ status: 'offline', code: 'encryption_required' });
  expect(session.lastError).toContain(protocol);
  expect(session.lastError).toContain('重新导入');
});

it('reports an outdated backend that does not speak transport v2', async () => {
  policy = { requiredProtocol: 'x25519' };
  render(); await connect();
  expect(TestSocket.instances).toHaveLength(0);
  expect(session.lastError).toContain('transport v2');
});

it('rejects an unusable pinned key without touching the network', async () => {
  render({ serverUrl: 'https://backend.test', encryptionProtocol: 'x25519', encryptionPublicKey: 'AAAA' });
  await connect();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(session.connectionHealth).toMatchObject({ code: 'encryption_required' });
  expect(session.lastError).toContain('加密公钥无效');
});

it('maps a 4400 close to a retryable transport error and reconnects with a fresh handshake', async () => {
  vi.mocked(loadJson).mockImplementation((_key, fallback) => Promise.resolve(fallback));
  vi.mocked(loadSecret).mockResolvedValue('');
  render(); await act(async () => {});
  // Hydration restored the stored (default) profile; pin the key again.
  act(() => session.setSettings(value => ({ ...value, serverUrl: 'https://backend.test', encryptionProtocol: 'x25519', encryptionPublicKey: pinnedKey })));
  await connect();
  const socket = TestSocket.instances[0];
  await act(async () => { socket.open(); socket.hello(); });
  await act(async () => { socket.onclose?.({ code: 4400, reason: 'transport crypto failure' }); });
  expect(session.connectionState).toBe('error');
  expect(session.connectionHealth).toMatchObject({ code: 'protocol_mismatch' });
  expect(session.lastError).toContain('加密传输校验失败');
  await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
  expect(TestSocket.instances.length).toBeGreaterThan(1);
  const next = TestSocket.instances.at(-1)!;
  expect(next.url.searchParams.get('client_nonce')).not.toBe(socket.url.searchParams.get('client_nonce'));
});

it('a tampered server frame closes the socket with 4400', async () => {
  render(); await connect();
  const socket = TestSocket.instances[0];
  await act(async () => { socket.open(); socket.hello(); });
  await act(async () => { socket.onmessage?.({ data: new Uint8Array(40).buffer }); });
  expect(socket.close).toHaveBeenCalledWith(4400, 'transport crypto failure');
  expect(session.lastError).toContain('加密传输校验失败');
});

it('a wrong verification reply is a non-retryable verification error', async () => {
  render(); await connect();
  const socket = TestSocket.instances[0];
  await act(async () => { socket.open(); socket.hello(); });
  const ping = JSON.parse(socket.texts[0]) as { id: string };
  await act(async () => { socket.reply({ id: ping.id, type: 'server.error', payload: {} }); });
  expect(session.connectionState).toBe('error');
  expect(session.lastError).toContain('加密连接未通过验证');
  expect(socket.close).toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(TestSocket.instances).toHaveLength(1);
});

it('ignores a policy answer that arrives after its attempt was replaced', async () => {
  let release!: (value: Record<string, unknown>) => void;
  policy = new Promise((resolve) => { release = resolve; });
  render(); await connect();
  policy = { requiredProtocol: 'x25519', transportVersion: 2 };
  await connect();
  expect(TestSocket.instances).toHaveLength(1);
  await act(async () => release({ requiredProtocol: 'x25519', transportVersion: 2 }));
  expect(TestSocket.instances).toHaveLength(1);
  expect(probeBackendConnection).toHaveBeenCalledOnce();
});

it('a loopback backend without a key stays plaintext and skips the encrypted challenge', async () => {
  policy = { requiredProtocol: 'none', transportVersion: 2 };
  render({ serverUrl: 'http://127.0.0.1:7345', encryptionProtocol: 'none', encryptionPublicKey: '' });
  await connect();
  expect(vi.mocked(probeBackendConnection).mock.calls[0][0].transport.mode).toBe('plaintext');
  const socket = TestSocket.instances[0];
  expect(socket.url.searchParams.get('tv')).toBeNull();
  await act(async () => socket.open());
  expect(session.connectionState).toBe('open');
  expect(socket.texts.some((text) => text.includes('server.ping'))).toBe(false);
  expect(socket.texts.some((text) => text.includes('session.resume'))).toBe(true);
});

it('moves the socket to the newly active backend profile', async () => {
  policy = { requiredProtocol: 'none', transportVersion: 2 };
  vi.mocked(loadJson).mockImplementation((_key, fallback) => Promise.resolve(fallback));
  vi.mocked(loadSecret).mockResolvedValue('');
  render({ serverUrl: 'http://127.0.0.1:7345', encryptionProtocol: 'none', encryptionPublicKey: '' });
  await act(async () => {});
  await connect();
  expect(TestSocket.instances).toHaveLength(1);
  await act(async () => { session.addBackendConnection({ serverUrl: 'http://127.0.0.2:7346', deviceSecret: 'other-secret' }); });
  expect(TestSocket.instances).toHaveLength(2);
  expect(TestSocket.instances[0].close).toHaveBeenCalled();
  expect(TestSocket.instances[1].url.host).toBe('127.0.0.2:7346');
});
