// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { x25519 } from '@noble/curves/ed25519.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { readFileSync } from 'node:fs';
import { beginDevicePairing } from '../../src/renderer/session/devicePairing';
import { deviceIdentityFromSecret } from '@todex/protocol/deviceAuth';

// Noble freezes its public API. Keep the real algorithms but allow a fixed
// synthetic key generator for the independent Rust compatibility vector.
vi.mock('@noble/curves/ed25519.js', async importOriginal => {
  const actual = await importOriginal<typeof import('@noble/curves/ed25519.js')>();
  return { ...actual, x25519: { ...actual.x25519 } };
});

const id = '11111111-2222-4333-8444-555555555555';
const domain = 'todex.device-pairing.v3/';
const utf8 = (text: string) => new TextEncoder().encode(text);
const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
const lp = (bytes: Uint8Array) => { const out = Buffer.alloc(4 + bytes.length); out.writeUInt32BE(bytes.length); out.set(bytes, 4); return out; };
const serverSecret = new Uint8Array(32).fill(9);
const serverPublic = x25519.getPublicKey(serverSecret);
const device = deviceIdentityFromSecret('FRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRU')!;
const devicePublic = Buffer.from(device.publicKey, 'base64url');
const startTime = 1_800_000_000_000;
let now: number;
let commitment: string;
let clientPublic: Uint8Array;
let pollProof: string;
let cancelProof: string;
let transcript: Uint8Array;
let wrapKey: Uint8Array;
let approved: Record<string, unknown>;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

/** `create` only sees the commitment; the server learns the key at `reveal`. */
function createResponse(body: string) {
  const request = JSON.parse(body);
  expect(request.clientPublicKey).toBeUndefined();
  expect(request.devicePublicKey).toBe(device.publicKey);
  commitment = request.clientCommitment;
  return response({ requestId: id, serverPublicKey: encode(serverPublic), expiresAt: startTime + 300_000, pollIntervalMs: 1000 });
}

function revealResponse(body: string) {
  const request = JSON.parse(body);
  expect(request.requestId).toBe(id);
  clientPublic = new Uint8Array(Buffer.from(request.clientPublicKey, 'base64url'));
  const clientNonce = new Uint8Array(Buffer.from(request.clientNonce, 'base64url'));
  expect(clientNonce).toHaveLength(32);
  // The server checks the commitment before deriving anything.
  expect(encode(sha256(Buffer.concat([lp(utf8(`${domain}commit`)), clientPublic, clientNonce])))).toBe(commitment);
  transcript = new Uint8Array(Buffer.concat([
    Buffer.from(`${domain}transcript\0${id}\0`), clientPublic, serverPublic,
    Buffer.from([0]), devicePublic, clientNonce,
  ]));
  const salt = sha256(transcript);
  const secret = x25519.getSharedSecret(serverSecret, clientPublic);
  wrapKey = hkdf(sha256, secret, salt, utf8(`${domain}wrap-key`), 32);
  pollProof = encode(hkdf(sha256, secret, salt, utf8(`${domain}poll-proof`), 32));
  cancelProof = encode(hkdf(sha256, secret, salt, utf8(`${domain}cancel-proof`), 32));
  const nonce = new Uint8Array(24).fill(11);
  approved = {
    status: 'approved', expiresAt: startTime + 300_000, nonce: encode(nonce),
    ciphertext: encode(xchacha20poly1305(wrapKey, nonce, transcript).encrypt(utf8(JSON.stringify({ deviceId: device.deviceId })))),
  };
  return response({ status: 'pending' });
}

beforeEach(() => {
  now = startTime;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/create')) return createResponse(String(init?.body));
    if (path.endsWith('/reveal')) return revealResponse(String(init?.body));
    if (path.endsWith('/cancel')) return response({ status: 'cancelled' });
    return response({ status: 'pending', expiresAt: startTime + 300_000 });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('computes its own verification code and decrypts the approved device id once', async () => {
  const request = await beginDevicePairing('http://localhost:7345', 'Desktop', device);
  const code = Buffer.from(sha256(transcript).slice(0, 5)).toString('hex').toUpperCase();
  expect(request.verificationCode).toBe(`${code.slice(0, 5)}-${code.slice(5)}`);
  expect(await request.poll()).toEqual({ status: 'pending' });
  fetchMock.mockResolvedValueOnce(response(approved));
  expect(await request.poll()).toEqual({ status: 'approved', deviceId: device.deviceId });
  expect(await request.poll()).toEqual({ status: 'expired' });
  expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
    '/v2/device-pairing/create', '/v2/device-pairing/reveal', '/v2/device-pairing/poll', '/v2/device-pairing/poll',
  ]);
  expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({ requestId: id, proof: pollProof });
  for (const [, init] of fetchMock.mock.calls) {
    expect(init).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' });
    expect(JSON.stringify(init)).not.toContain(device.secretKey);
  }
});

it.each(['rejected', 'expired'] as const)('closes a %s request without enrolling a device', async status => {
  const request = await beginDevicePairing('http://localhost', 'Web', device);
  fetchMock.mockResolvedValueOnce(response({ status }));
  expect(await request.poll()).toEqual({ status });
  expect(await request.poll()).toEqual({ status: 'expired' });
});

it('binds cancellation to a separate proof and discards an in-flight approval after cancel', async () => {
  const request = await beginDevicePairing('http://localhost', 'Web', device);
  let resolve!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const pending = request.poll();
  await request.cancel();
  expect(cancelProof).not.toBe(pollProof);
  expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual({ requestId: id, proof: cancelProof });
  resolve(response(approved));
  expect(await pending).toEqual({ status: 'expired' });
});

it('does not accept an approval that arrives after the deadline', async () => {
  const request = await beginDevicePairing('http://localhost', 'Web', device);
  fetchMock.mockImplementationOnce(async () => { now += 300_001; return response(approved); });
  expect(await request.poll()).toEqual({ status: 'expired' });
});

it('rejects a modified ciphertext and closes the request', async () => {
  const request = await beginDevicePairing('http://localhost', 'Web', device);
  const bytes = Buffer.from(approved.ciphertext as string, 'base64url'); bytes[0] ^= 1;
  fetchMock.mockResolvedValueOnce(response({ ...approved, ciphertext: bytes.toString('base64url') }));
  await expect(request.poll()).rejects.toThrow('校验失败');
  expect(await request.poll()).toEqual({ status: 'expired' });
});

it('rejects credentials encrypted for another transcript even with the same key', async () => {
  const request = await beginDevicePairing('http://localhost', 'Web', device);
  const nonce = new Uint8Array(24).fill(11);
  const ciphertext = xchacha20poly1305(wrapKey, nonce, utf8('another-request')).encrypt(utf8('{"deviceId":"dev_wrong000000000"}'));
  fetchMock.mockResolvedValueOnce(response({ ...approved, ciphertext: encode(ciphertext) }));
  await expect(request.poll()).rejects.toThrow('校验失败');
});

it('rejects a zero shared-secret public key before displaying a verification code', async () => {
  fetchMock.mockResolvedValueOnce(response({ requestId: id, serverPublicKey: encode(new Uint8Array(32)), expiresAt: now + 300_000 }));
  await expect(beginDevicePairing('http://localhost', 'Web', device)).rejects.toThrow();
});

it('prevents overlapping polls', async () => {
  const request = await beginDevicePairing('http://localhost', 'Web', device);
  let resolve!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const first = request.poll();
  await expect(request.poll()).rejects.toThrow('正在查询');
  resolve(response({ status: 'pending' }));
  await first;
  await request.cancel();
});

it.each([[404, '不支持'], [429, '过于频繁']] as const)('reports HTTP %i without echoing a remote response body', async (status, message) => {
  fetchMock.mockResolvedValueOnce(response({ error: 'do-not-display-remote-data' }, status));
  await expect(beginDevicePairing('http://localhost', 'Web', device)).rejects.toThrow(message);
});

it('limits unauthenticated response size', async () => {
  fetchMock.mockResolvedValueOnce(response({ data: 'x'.repeat(17_000) }));
  await expect(beginDevicePairing('http://localhost', 'Web', device)).rejects.toThrow('响应过大');
});

it('rejects a reveal the server does not accept, before showing a code', async () => {
  fetchMock.mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/create')) return createResponse(String(init?.body));
    return response({ code: 'CONFLICT' }, 409);
  });
  await expect(beginDevicePairing('http://localhost', 'Web', device)).rejects.toThrow('409');
});

it('matches the shared pairing v3 vector (commitment, code, proofs) and decrypts its approval', async () => {
  const fixture = JSON.parse(readFileSync(new URL('../../../TodeX_protocol/tests/fixtures/transport-v2.json', import.meta.url), 'utf8')).pairingV3;
  const hex = (value: string) => new Uint8Array(Buffer.from(value, 'hex'));
  const b64 = (value: string) => Buffer.from(value, 'hex').toString('base64url');
  const fixtureDevice = deviceIdentityFromSecret(b64(fixture.deviceSeed))!;
  expect(fixtureDevice.publicKey).toBe(b64(fixture.devicePublicKey));
  const freshKeys = () => ({ secretKey: hex(fixture.clientSecretKey), publicKey: hex(fixture.clientPublicKey) });
  vi.spyOn(x25519, 'keygen').mockImplementation(freshKeys);
  // Only the pairing nonce is fixed; noble's own blinding keeps real randomness.
  const random = vi.spyOn(globalThis.crypto, 'getRandomValues');
  const fixedNonce = <T extends ArrayBufferView | null>(array: T) => {
    (array as unknown as Uint8Array).set(hex(fixture.clientNonce));
    return array;
  };
  random.mockImplementationOnce(fixedNonce);
  const created = { requestId: fixture.requestId, serverPublicKey: b64(fixture.serverPublicKey), expiresAt: startTime + 300_000, pollIntervalMs: 1000 };
  fetchMock.mockResolvedValueOnce(response(created)).mockResolvedValueOnce(response({ status: 'pending' }));
  const request = await beginDevicePairing('http://localhost', 'Interop test', fixtureDevice);
  expect(request.verificationCode).toBe(fixture.verificationCode);
  const createBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  expect(createBody).toMatchObject({ clientCommitment: fixture.commitmentBase64Url, devicePublicKey: b64(fixture.devicePublicKey) });
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
    requestId: fixture.requestId, clientPublicKey: b64(fixture.clientPublicKey), clientNonce: b64(fixture.clientNonce),
  });
  const nonce = new Uint8Array(24).fill(7);
  const ciphertext = xchacha20poly1305(hex(fixture.wrapKey), nonce, hex(fixture.transcript))
    .encrypt(utf8(JSON.stringify({ deviceId: fixtureDevice.deviceId })));
  fetchMock.mockResolvedValueOnce(response({ status: 'approved', nonce: encode(nonce), ciphertext: encode(ciphertext) }));
  expect(await request.poll()).toEqual({ status: 'approved', deviceId: fixtureDevice.deviceId });
  expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body)).proof).toBe(b64(fixture.pollProof));

  random.mockImplementationOnce(fixedNonce);
  fetchMock.mockResolvedValueOnce(response(created)).mockResolvedValueOnce(response({ status: 'pending' }));
  const cancelled = await beginDevicePairing('http://localhost', 'Interop cancellation', fixtureDevice);
  await cancelled.cancel();
  expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body)).proof).toBe(b64(fixture.cancelProof));
});
