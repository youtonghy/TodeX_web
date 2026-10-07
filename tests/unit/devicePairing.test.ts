// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { x25519 } from '@noble/curves/ed25519.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { readFileSync } from 'node:fs';
import {
  DevicePairingRetryableError,
  PAIRING_POLL_INTERVAL_MS,
  beginDevicePairing,
  nextPairingPollDelayMs,
} from '../../src/renderer/session/devicePairing';
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
// The transport the create response offers; the transcript binds it.
let transportProtocol: string;
let transportPublicKey: string;
// The device name the create request sent; the transcript binds it last.
let deviceName: string;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

/** `create` only sees the commitment; the server learns the key at `reveal`. */
function createResponse(body: string) {
  const request = JSON.parse(body);
  expect(request.clientPublicKey).toBeUndefined();
  expect(request.devicePublicKey).toBe(device.publicKey);
  expect(request.transportBinding).toBe(1);
  expect(request.deviceNameBinding).toBe(1);
  deviceName = request.deviceName;
  commitment = request.clientCommitment;
  return response({
    requestId: id, serverPublicKey: encode(serverPublic), transportProtocol, transportPublicKey,
    expiresAt: startTime + 300_000, pollIntervalMs: 1000,
  });
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
    lp(utf8(transportProtocol)), lp(Buffer.from(transportPublicKey, 'base64url')), lp(utf8(deviceName)),
  ]));
  const salt = sha256(transcript);
  const secret = x25519.getSharedSecret(serverSecret, clientPublic);
  wrapKey = hkdf(sha256, secret, salt, utf8(`${domain}wrap-key`), 32);
  pollProof = encode(hkdf(sha256, secret, salt, utf8(`${domain}poll-proof`), 32));
  cancelProof = encode(hkdf(sha256, secret, salt, utf8(`${domain}cancel-proof`), 32));
  const nonce = new Uint8Array(24).fill(11);
  approved = {
    status: 'approved', expiresAt: startTime + 300_000, nonce: encode(nonce),
    ciphertext: encode(xchacha20poly1305(wrapKey, nonce, transcript).encrypt(utf8(JSON.stringify({
      deviceId: device.deviceId, transportProtocol, transportPublicKey,
    })))),
  };
  return response({ status: 'pending' });
}

beforeEach(() => {
  now = startTime;
  transportProtocol = 'none';
  transportPublicKey = '';
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
  expect(request.transportFingerprint).toBe('none');
  expect(await request.poll()).toEqual({
    status: 'approved', deviceId: device.deviceId, pin: { encryptionProtocol: 'none', encryptionPublicKey: '' },
  });
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

it.each([
  ['  Yoh 的 iPhone 📱\u202e \n', 'Yoh 的 iPhone 📱'],
  ['\u0007 ', 'TodeX'],
  ['a'.repeat(79) + ' tail', 'a'.repeat(79)],
])('sends and binds the normalized device name (%j)', async (input, expected) => {
  const request = await beginDevicePairing('http://localhost', input, device);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).deviceName).toBe(expected);
  const code = Buffer.from(sha256(transcript).slice(0, 5)).toString('hex').toUpperCase();
  expect(request.verificationCode).toBe(`${code.slice(0, 5)}-${code.slice(5)}`);
  expect(Buffer.from(transcript.slice(transcript.length - Buffer.byteLength(expected))).toString('utf8')).toBe(expected);
});

it.each([
  ['429 with Retry-After', () => new Response('{}', { status: 429, headers: { 'Retry-After': '3' } }), 3000],
  ['503', () => response({ code: 'INTERNAL_ERROR' }, 503), undefined],
  ['a network error', () => { throw new TypeError('Failed to fetch'); }, undefined],
] as const)('a poll that fails transiently (%s) is retryable and keeps the request', async (_label, fail, retryAfter) => {
  const request = await beginDevicePairing('http://localhost', 'Web', device);
  fetchMock.mockImplementationOnce(async () => fail());
  const error = await request.poll().catch((cause: unknown) => cause);
  expect(error).toBeInstanceOf(DevicePairingRetryableError);
  expect((error as DevicePairingRetryableError).retryAfterMs).toBe(retryAfter);
  fetchMock.mockResolvedValueOnce(response(approved));
  expect(await request.poll()).toMatchObject({ status: 'approved', deviceId: device.deviceId });
});

it.each([[404, '不支持'], [401, '未被接受']] as const)('a poll answered %i ends the request', async (status, message) => {
  const request = await beginDevicePairing('http://localhost', 'Web', device);
  fetchMock.mockResolvedValueOnce(response({ code: 'NOT_FOUND' }, status));
  const error = await request.poll().catch((cause: unknown) => cause);
  expect(error).not.toBeInstanceOf(DevicePairingRetryableError);
  expect((error as Error).message).toContain(message);
});

it('backs off transient poll failures by doubling, honouring Retry-After, up to 5 s', () => {
  const transient = new DevicePairingRetryableError('x');
  expect(nextPairingPollDelayMs(PAIRING_POLL_INTERVAL_MS, transient)).toBe(4000);
  expect(nextPairingPollDelayMs(4000, transient)).toBe(5000);
  expect(nextPairingPollDelayMs(5000, transient)).toBe(5000);
  expect(nextPairingPollDelayMs(PAIRING_POLL_INTERVAL_MS, new DevicePairingRetryableError('x', 4500))).toBe(4500);
  expect(nextPairingPollDelayMs(PAIRING_POLL_INTERVAL_MS, new DevicePairingRetryableError('x', 60_000))).toBe(5000);
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

it('binds the offered transport key: a mismatching credential pins nothing', async () => {
  const request = await beginDevicePairing('http://localhost', 'Web', device);
  const nonce = new Uint8Array(24).fill(12);
  const forged = { deviceId: device.deviceId, transportProtocol: 'x25519', transportPublicKey: encode(serverPublic) };
  const ciphertext = xchacha20poly1305(wrapKey, nonce, transcript).encrypt(utf8(JSON.stringify(forged)));
  fetchMock.mockResolvedValueOnce(response({ ...approved, nonce: encode(nonce), ciphertext: encode(ciphertext) }));
  await expect(request.poll()).rejects.toThrow('未保存任何内容');
  expect(await request.poll()).toEqual({ status: 'expired' });
});

it('refuses a credential enrolled for another device', async () => {
  const request = await beginDevicePairing('http://localhost', 'Web', device);
  const nonce = new Uint8Array(24).fill(13);
  const other = { deviceId: 'dev_AAAAAAAAAAAAAAAA', transportProtocol, transportPublicKey };
  const ciphertext = xchacha20poly1305(wrapKey, nonce, transcript).encrypt(utf8(JSON.stringify(other)));
  fetchMock.mockResolvedValueOnce(response({ ...approved, nonce: encode(nonce), ciphertext: encode(ciphertext) }));
  await expect(request.poll()).rejects.toThrow('未保存任何内容');
});

it('refuses a plaintext transport for a remote address before revealing anything', async () => {
  await expect(beginDevicePairing('http://192.168.1.20:7345', 'Web', device)).rejects.toThrow('未加密');
  expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual(['/v2/device-pairing/create']);
});

it.each([
  ['a missing transport', {}],
  ['an unknown protocol', { transportProtocol: 'X25519', transportPublicKey: encode(new Uint8Array(32).fill(9)) }],
  ['a short x25519 key', { transportProtocol: 'x25519', transportPublicKey: encode(new Uint8Array(31).fill(9)) }],
  ['a low-order x25519 key', { transportProtocol: 'x25519', transportPublicKey: encode(new Uint8Array(32)) }],
  ['a key for none', { transportProtocol: 'none', transportPublicKey: 'AA' }],
])('rejects %s before showing a code', async (_label, transport) => {
  fetchMock.mockResolvedValueOnce(response({ requestId: id, serverPublicKey: encode(serverPublic), expiresAt: now + 300_000, ...transport }));
  await expect(beginDevicePairing('http://localhost', 'Web', device)).rejects.toThrow('传输加密公钥无效');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('matches the shared pairing v3 vector (commitment, transport binding, code, proofs) and pins its key', async () => {
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
  const created = (transport: { transportProtocol: string; transportPublicKey: string }) => ({
    requestId: fixture.requestId, serverPublicKey: b64(fixture.serverPublicKey), expiresAt: startTime + 300_000, pollIntervalMs: 1000,
    transportProtocol: transport.transportProtocol, transportPublicKey: transport.transportPublicKey,
  });
  const begin = async (transport: { transportProtocol: string; transportPublicKey: string }, name: string) => {
    random.mockImplementationOnce(fixedNonce);
    fetchMock.mockResolvedValueOnce(response(created(transport))).mockResolvedValueOnce(response({ status: 'pending' }));
    return beginDevicePairing('http://localhost', name, fixtureDevice);
  };

  const request = await begin(fixture, fixture.deviceName);
  expect(request.verificationCode).toBe(fixture.verificationCode);
  expect(request.transportFingerprint).toBe(fixture.fingerprint);
  const createBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  expect(createBody).toMatchObject({
    transportBinding: 1, deviceNameBinding: 1, deviceName: fixture.deviceName,
    clientCommitment: fixture.commitmentBase64Url, devicePublicKey: b64(fixture.devicePublicKey),
  });
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
    requestId: fixture.requestId, clientPublicKey: b64(fixture.clientPublicKey), clientNonce: b64(fixture.clientNonce),
  });
  // The vector's own credential decrypts under this transcript but names
  // another device ("dev_vector"), so it is refused and nothing is pinned.
  fetchMock.mockResolvedValueOnce(response({ status: 'approved', nonce: fixture.credential.nonceBase64Url, ciphertext: fixture.credential.ciphertextBase64Url }));
  await expect(request.poll()).rejects.toThrow('校验失败');
  expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body)).proof).toBe(b64(fixture.pollProof));

  const approvedRequest = await begin(fixture, fixture.deviceName);
  const nonce = new Uint8Array(24).fill(7);
  const credential = JSON.parse(fixture.credential.plaintext);
  const ciphertext = xchacha20poly1305(hex(fixture.wrapKey), nonce, hex(fixture.transcript))
    .encrypt(utf8(JSON.stringify({ ...credential, deviceId: fixtureDevice.deviceId })));
  fetchMock.mockResolvedValueOnce(response({ status: 'approved', nonce: encode(nonce), ciphertext: encode(ciphertext) }));
  expect(await approvedRequest.poll()).toEqual({
    status: 'approved', deviceId: fixtureDevice.deviceId,
    pin: { encryptionProtocol: fixture.transportProtocol, encryptionPublicKey: fixture.transportPublicKey },
  });

  // A different transport key yields a different code, so a substituted key
  // shows up when the user compares codes.
  const tampered = await begin(fixture.tampered, fixture.deviceName);
  expect(tampered.verificationCode).toBe(fixture.tampered.verificationCode);
  await tampered.cancel();
  // So does another device name: the backend shows the name the code binds.
  for (const named of [fixture.nonAsciiName, fixture.tamperedName]) {
    const renamed = await begin(fixture, named.deviceName);
    expect(JSON.parse(String(fetchMock.mock.calls.at(-2)?.[1]?.body)).deviceName).toBe(named.deviceName);
    expect(renamed.verificationCode).toBe(named.verificationCode);
    expect(renamed.verificationCode).not.toBe(fixture.verificationCode);
    await renamed.cancel();
  }
  const none = await begin(fixture.noneCase, fixture.deviceName);
  expect(none.verificationCode).toBe(fixture.noneCase.verificationCode);
  expect(none.transportFingerprint).toBe(fixture.noneCase.fingerprint);

  const cancelled = await begin(fixture, fixture.deviceName);
  await cancelled.cancel();
  expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body)).proof).toBe(b64(fixture.cancelProof));
});
