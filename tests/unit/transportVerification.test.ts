// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import type { ConnectionSettings } from '@todex/protocol/todex';
import type { TransportCryptoSession } from '@todex/protocol/transportCrypto';
import { validateTransportEncryption, verifyEncryptedSocket } from '../../src/renderer/session/transportVerification';

const settings = (protocol: ConnectionSettings['encryptionProtocol'], key = '') => ({
  serverUrl: 'http://localhost:7345', encryptionProtocol: protocol, encryptionPublicKey: key,
} as ConnectionSettings);
function policy(value: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(value), { status })));
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it.each(['x25519', 'ml-kem-768'] as const)('requires explicit %s encryption and a separately imported public key', async requiredProtocol => {
  policy({ requiredProtocol });
  await expect(validateTransportEncryption(settings('none'))).rejects.toThrow('尚未完成加密密钥传输验证');
  policy({ requiredProtocol });
  await expect(validateTransportEncryption(settings(requiredProtocol))).rejects.toThrow('尚未通过加密密钥传输验证');
  policy({ requiredProtocol });
  await expect(validateTransportEncryption(settings(requiredProtocol, 'imported-key'))).resolves.toBeUndefined();
});
it('rejects the wrong encryption protocol rather than silently changing it', async () => {
  policy({ requiredProtocol: 'ml-kem-768' });
  const original = settings('x25519', 'imported-key');
  await expect(validateTransportEncryption(original)).rejects.toThrow('后端要求 ml-kem-768');
  expect(original.encryptionProtocol).toBe('x25519');
});
it.each([200, 404])('keeps plaintext compatibility for an optional or older backend (%i)', async status => {
  policy({ requiredProtocol: 'none' }, status);
  await expect(validateTransportEncryption(settings('none'))).resolves.toBeUndefined();
  policy({}, 404);
  await expect(validateTransportEncryption(settings('x25519'))).rejects.toThrow('尚未通过');
});
it.each([{}, { requiredProtocol: 'unknown' }])('does not interpret invalid policy as encryption disabled', async payload => {
  policy(payload);
  await expect(validateTransportEncryption(settings('none'))).rejects.toThrow('响应无效');
});

class FakeSocket extends EventTarget {
  sent: string[] = [];
  send(value: string) { this.sent.push(value); }
  response(value: unknown) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) })); }
}
function fixture() {
  const socket = new FakeSocket();
  const crypto = {
    encryptClientText: vi.fn((text: string) => `encrypted:${text}`),
    decryptServerText: vi.fn((text: string) => text),
  } as unknown as TransportCryptoSession;
  return { socket, crypto, ws: socket as unknown as WebSocket };
}
it('only accepts the decrypted response to its own encrypted ping', async () => {
  const { socket, crypto, ws } = fixture();
  const verified = verifyEncryptedSocket(ws, crypto);
  const request = JSON.parse(socket.sent[0].slice('encrypted:'.length));
  expect(request.type).toBe('server.ping');
  socket.response({ id: 'unrelated', type: 'server.result', payload: { pong: true } });
  let done = false; void verified.then(() => { done = true; });
  await Promise.resolve(); expect(done).toBe(false);
  socket.response({ id: request.id, type: 'server.result', payload: { pong: true } });
  await verified;
  expect(crypto.decryptServerText).toHaveBeenCalledTimes(2);
  socket.response({ id: request.id });
  expect(crypto.decryptServerText).toHaveBeenCalledTimes(2);
});
it('rejects an invalid public-key result and removes verification listeners', async () => {
  const { socket, crypto, ws } = fixture();
  vi.mocked(crypto.decryptServerText).mockImplementation(() => { throw new Error('bad key'); });
  const verified = verifyEncryptedSocket(ws, crypto);
  socket.response({});
  await expect(verified).rejects.toThrow('尚未通过加密密钥传输验证');
  socket.response({});
  expect(crypto.decryptServerText).toHaveBeenCalledTimes(1);
});
it.each(['close', 'error'])('reports %s before confirmation as a key-verification failure', async type => {
  const { socket, crypto, ws } = fixture();
  const verified = verifyEncryptedSocket(ws, crypto);
  socket.dispatchEvent(new Event(type));
  await expect(verified).rejects.toThrow('尚未通过');
});
it('times out when the peer cannot prove possession of the matching key', async () => {
  vi.useFakeTimers();
  const { crypto, ws } = fixture();
  const verified = expect(verifyEncryptedSocket(ws, crypto)).rejects.toThrow('尚未通过');
  await vi.advanceTimersByTimeAsync(10_000);
  await verified;
});
it('aborts an obsolete verification without accepting a later response', async () => {
  const { socket, crypto, ws } = fixture();
  const controller = new AbortController();
  const verified = verifyEncryptedSocket(ws, crypto, controller.signal);
  controller.abort();
  await expect(verified).rejects.toMatchObject({ name: 'AbortError' });
  socket.response({});
  expect(crypto.decryptServerText).not.toHaveBeenCalled();
});
