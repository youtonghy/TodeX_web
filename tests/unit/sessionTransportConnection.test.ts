import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useTodeXSession, type TodeXSession } from '../../src/renderer/session/useTodeXSession';
import { validateTransportEncryption, verifyEncryptedSocket } from '../../src/renderer/session/transportVerification';
import { probeBackendConnection } from '@todex/protocol/connectionProbe';
import { createTransportCryptoSession } from '@todex/protocol/transportCrypto';
import { loadJson, loadSecret } from '../../src/renderer/lib/storage';

vi.mock('../../src/renderer/lib/storage', () => ({
  // Leave hydration pending so tests exercise explicit connection attempts,
  // without restoring unrelated workspace/session state or auto-connecting.
  loadJson: vi.fn(() => new Promise(() => {})), loadSecret: vi.fn(() => new Promise(() => {})),
  saveJson: vi.fn().mockResolvedValue(undefined), saveSecret: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/renderer/session/transportVerification', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/renderer/session/transportVerification')>(),
  validateTransportEncryption: vi.fn(), verifyEncryptedSocket: vi.fn(),
}));
vi.mock('@todex/protocol/connectionProbe', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/connectionProbe')>(), probeBackendConnection: vi.fn(),
}));
vi.mock('@todex/protocol/transportCrypto', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/transportCrypto')>(), createTransportCryptoSession: vi.fn(),
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
let root: Root;
let container: HTMLDivElement;
let session: TodeXSession;
const encrypted = {
  protocol: 'x25519' as const, queryString: 'enc=x25519&clientPublicKey=test',
  encryptClientText: vi.fn((text: string) => `encrypted:${text}`),
  decryptServerText: vi.fn((text: string) => text),
};
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
beforeEach(() => {
  vi.useFakeTimers();
  TestSocket.instances = [];
  vi.stubGlobal('WebSocket', TestSocket);
  vi.stubGlobal('fetch', vi.fn((url: string) => String(url).endsWith('/health') || String(url).endsWith('/v2/version')
    ? Promise.resolve(new Response(JSON.stringify({ name: 'test', version: '1' }))) : new Promise(() => {})));
  vi.mocked(loadJson).mockReset().mockImplementation(() => new Promise(() => {}));
  vi.mocked(loadSecret).mockReset().mockImplementation(() => new Promise(() => {}));
  vi.mocked(validateTransportEncryption).mockReset().mockResolvedValue(undefined);
  vi.mocked(probeBackendConnection).mockReset().mockResolvedValue({ ok: true, error: null, providers: [], version: null } as never);
  vi.mocked(verifyEncryptedSocket).mockReset().mockResolvedValue(undefined);
  vi.mocked(createTransportCryptoSession).mockReset().mockReturnValue(encrypted);
  encrypted.encryptClientText.mockClear(); encrypted.decryptServerText.mockClear();
});
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function render() {
  function Harness() { session = useTodeXSession(() => {}); return null; }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  act(() => root.render(createElement(Harness)));
  act(() => session.setSettings(value => ({ ...value, serverUrl: 'https://backend.test', deviceSecret: 'test-secret', encryptionProtocol: 'x25519', encryptionPublicKey: 'key' })));
}
async function connect() { await act(async () => { session.connect(); }); }
function deferred() {
  let resolve!: () => void; let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

it('validates policy before probing and only resumes the session after encrypted verification succeeds', async () => {
  const verify = deferred(); vi.mocked(verifyEncryptedSocket).mockReturnValue(verify.promise);
  render(); await connect();
  expect(vi.mocked(validateTransportEncryption).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(probeBackendConnection).mock.invocationCallOrder[0]);
  const socket = TestSocket.instances[0];
  await act(async () => socket.open());
  expect(session.connectionState).toBe('connecting');
  expect(socket.send).not.toHaveBeenCalled();
  await act(async () => { socket.onmessage?.({ data: 'verification frame' }); });
  expect(encrypted.decryptServerText).not.toHaveBeenCalled();
  await act(async () => verify.resolve());
  expect(session.connectionState).toBe('open');
  expect(socket.send.mock.calls.some(([data]) => String(data).includes('session.resume'))).toBe(true);
});

it('stops before the authenticated probe when backend policy rejects the local encryption settings', async () => {
  vi.mocked(validateTransportEncryption).mockRejectedValue(new Error('后端要求 ml-kem-768 加密'));
  render(); await connect();
  expect(probeBackendConnection).not.toHaveBeenCalled();
  expect(TestSocket.instances).toHaveLength(0);
  expect(session.connectionState).toBe('error');
  expect(session.connectionHealth).toMatchObject({ status: 'offline', code: 'protocol_mismatch' });
  expect(session.lastError).toContain('ml-kem-768');
});

it.each(['onclose', 'onerror'] as const)('reports a non-retryable verification error if %s runs before verifier rejection', async event => {
  const verify = deferred(); vi.mocked(verifyEncryptedSocket).mockReturnValue(verify.promise);
  vi.mocked(loadJson).mockImplementation((_key, fallback) => Promise.resolve(fallback));
  vi.mocked(loadSecret).mockResolvedValue('');
  render(); await act(async () => {});
  expect(session.hydrated).toBe(true);
  await connect(); const socket = TestSocket.instances[0];
  await act(async () => socket.open());
  await act(async () => { socket[event]?.(); verify.reject(new Error('late rejection')); });
  expect(session.connectionState).toBe('error');
  expect(session.connectionHealth).toMatchObject({ status: 'offline', code: 'protocol_mismatch' });
  expect(session.lastError).toContain('加密密钥传输验证');
  expect(socket.close).toHaveBeenCalled();
  expect(socket.send).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(TestSocket.instances).toHaveLength(1);
});

it('ignores old verification results and socket callbacks after a replacement connection succeeds', async () => {
  const old = deferred(); vi.mocked(verifyEncryptedSocket).mockReturnValueOnce(old.promise).mockResolvedValue(undefined);
  render(); await connect(); const first = TestSocket.instances[0];
  await act(async () => first.open());
  await connect(); const second = TestSocket.instances[1];
  await act(async () => second.open());
  expect(session.connectionState).toBe('open');
  await act(async () => { old.reject(new Error('old failure')); first.onerror?.(); first.onclose?.(); first.onmessage?.({ data: 'old frame' }); });
  expect(session.connectionState).toBe('open');
  expect(session.lastError).not.toContain('old failure');
  expect(second.close).not.toHaveBeenCalled();
  expect(first.send).not.toHaveBeenCalled();
});

it('does not create a socket from a policy response after that attempt has been cancelled', async () => {
  const policy = deferred(); vi.mocked(validateTransportEncryption).mockReturnValueOnce(policy.promise).mockResolvedValue(undefined);
  render(); await connect(); await connect();
  expect(TestSocket.instances).toHaveLength(1);
  await act(async () => policy.resolve());
  expect(TestSocket.instances).toHaveLength(1);
  expect(probeBackendConnection).toHaveBeenCalledOnce();
  expect(vi.mocked(validateTransportEncryption).mock.calls[0][1]?.aborted).toBe(true);
});

it('opens an unencrypted connection without running an encrypted challenge', async () => {
  vi.mocked(createTransportCryptoSession).mockReturnValue(null);
  render(); act(() => session.setSettings(value => ({ ...value, encryptionProtocol: 'none', encryptionPublicKey: '' })));
  await connect(); const socket = TestSocket.instances[0];
  await act(async () => socket.open());
  expect(verifyEncryptedSocket).not.toHaveBeenCalled();
  expect(session.connectionState).toBe('open');
  expect(socket.send.mock.calls.some(([data]) => String(data).includes('session.resume'))).toBe(true);
});

it('explains public-key verification failure when local crypto initialization rejects a malformed key', async () => {
  vi.mocked(createTransportCryptoSession).mockImplementation(() => { throw new Error('invalid key length'); });
  render(); await connect();
  expect(TestSocket.instances).toHaveLength(0);
  expect(session.connectionState).toBe('error');
  expect(session.connectionHealth).toMatchObject({ status: 'offline', code: 'protocol_mismatch' });
  expect(session.lastError).toContain('尚未通过加密密钥传输验证');
  expect(session.lastError).toContain('invalid key length');
});
