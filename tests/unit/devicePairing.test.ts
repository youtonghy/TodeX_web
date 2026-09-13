// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { x25519 } from '@noble/curves/ed25519.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { readFileSync } from 'node:fs';
import { beginDevicePairing } from '../../src/renderer/session/devicePairing';

// Noble freezes its public API. Keep the real algorithms but allow a fixed
// synthetic key generator for the independent Rust compatibility vector.
vi.mock('@noble/curves/ed25519.js', async importOriginal => {
  const actual = await importOriginal<typeof import('@noble/curves/ed25519.js')>();
  return { ...actual, x25519: { ...actual.x25519 } };
});

const id = '11111111-2222-4333-8444-555555555555';
const domain = 'todex.device-pairing.v1/';
const utf8 = (text: string) => new TextEncoder().encode(text);
const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
const serverSecret = new Uint8Array(32).fill(9);
const serverPublic = x25519.getPublicKey(serverSecret);
const startTime = 1_800_000_000_000;
let now: number;
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

function createResponse(body: string) {
  const request = JSON.parse(body);
  clientPublic = new Uint8Array(Buffer.from(request.clientPublicKey, 'base64url'));
  transcript = new Uint8Array(Buffer.concat([Buffer.from(`${domain}transcript\0${id}\0`), clientPublic, serverPublic]));
  const salt = sha256(transcript);
  const secret = x25519.getSharedSecret(serverSecret, clientPublic);
  wrapKey = hkdf(sha256, secret, salt, utf8(`${domain}wrap-key`), 32);
  pollProof = encode(hkdf(sha256, secret, salt, utf8(`${domain}poll-proof`), 32));
  cancelProof = encode(hkdf(sha256, secret, salt, utf8(`${domain}cancel-proof`), 32));
  const nonce = new Uint8Array(24).fill(11);
  approved = {
    status: 'approved', expiresAt: startTime + 300_000, nonce: encode(nonce),
    ciphertext: encode(xchacha20poly1305(wrapKey, nonce, transcript).encrypt(utf8(JSON.stringify({ authToken: 'synthetic-device-token' })))),
  };
  return response({ requestId: id, serverPublicKey: encode(serverPublic), expiresAt: startTime + 300_000, pollIntervalMs: 1000 });
}

beforeEach(() => {
  now = startTime;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/create')) return createResponse(String(init?.body));
    if (path.endsWith('/cancel')) return response({ status: 'cancelled' });
    return response({ status: 'pending', expiresAt: startTime + 300_000 });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('computes its own verification code and decrypts only the approved credential once', async () => {
  const request = await beginDevicePairing('http://localhost:7345', 'Desktop');
  const code = Buffer.from(sha256(transcript).slice(0, 5)).toString('hex').toUpperCase();
  expect(request.verificationCode).toBe(`${code.slice(0, 5)}-${code.slice(5)}`);
  expect(await request.poll()).toEqual({ status: 'pending' });
  fetchMock.mockResolvedValueOnce(response(approved));
  expect(await request.poll()).toEqual({ status: 'approved', authToken: 'synthetic-device-token' });
  expect(await request.poll()).toEqual({ status: 'expired' });
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ requestId: id, proof: pollProof });
  for (const [, init] of fetchMock.mock.calls) {
    expect(init).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' });
    expect(JSON.stringify(init)).not.toContain('synthetic-device-token');
  }
});

it.each(['rejected', 'expired'] as const)('closes a %s request without issuing a credential', async status => {
  const request = await beginDevicePairing('http://localhost', 'Web');
  fetchMock.mockResolvedValueOnce(response({ status }));
  expect(await request.poll()).toEqual({ status });
  expect(await request.poll()).toEqual({ status: 'expired' });
});

it('binds cancellation to a separate proof and discards an in-flight approval after cancel', async () => {
  const request = await beginDevicePairing('http://localhost', 'Web');
  let resolve!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const pending = request.poll();
  await request.cancel();
  expect(cancelProof).not.toBe(pollProof);
  expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({ requestId: id, proof: cancelProof });
  resolve(response(approved));
  expect(await pending).toEqual({ status: 'expired' });
});

it('does not accept an approval that arrives after the deadline', async () => {
  const request = await beginDevicePairing('http://localhost', 'Web');
  fetchMock.mockImplementationOnce(async () => { now += 300_001; return response(approved); });
  expect(await request.poll()).toEqual({ status: 'expired' });
});

it('rejects a modified ciphertext and closes the request', async () => {
  const request = await beginDevicePairing('http://localhost', 'Web');
  const bytes = Buffer.from(approved.ciphertext as string, 'base64url'); bytes[0] ^= 1;
  fetchMock.mockResolvedValueOnce(response({ ...approved, ciphertext: bytes.toString('base64url') }));
  await expect(request.poll()).rejects.toThrow('校验失败');
  expect(await request.poll()).toEqual({ status: 'expired' });
});

it('rejects credentials encrypted for another transcript even with the same key', async () => {
  const request = await beginDevicePairing('http://localhost', 'Web');
  const nonce = new Uint8Array(24).fill(11);
  const ciphertext = xchacha20poly1305(wrapKey, nonce, utf8('another-request')).encrypt(utf8('{"authToken":"wrong"}'));
  fetchMock.mockResolvedValueOnce(response({ ...approved, ciphertext: encode(ciphertext) }));
  await expect(request.poll()).rejects.toThrow('校验失败');
});

it('rejects a zero shared-secret public key before displaying a verification code', async () => {
  fetchMock.mockResolvedValueOnce(response({ requestId: id, serverPublicKey: encode(new Uint8Array(32)), expiresAt: now + 300_000 }));
  await expect(beginDevicePairing('http://localhost', 'Web')).rejects.toThrow();
});

it('prevents overlapping polls', async () => {
  const request = await beginDevicePairing('http://localhost', 'Web');
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
  await expect(beginDevicePairing('http://localhost', 'Web')).rejects.toThrow(message);
});

it('limits unauthenticated response size', async () => {
  fetchMock.mockResolvedValueOnce(response({ data: 'x'.repeat(17_000) }));
  await expect(beginDevicePairing('http://localhost', 'Web')).rejects.toThrow('响应过大');
});

it('matches the Rust-generated fixed transcript, proofs, verification code, and encrypted token', async () => {
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/device-pairing-v1.json', import.meta.url), 'utf8'));
  vi.spyOn(x25519, 'keygen').mockReturnValue({
    secretKey: new Uint8Array(Buffer.from(fixture.clientSecret, 'base64url')),
    publicKey: new Uint8Array(Buffer.from(fixture.clientPublicKey, 'base64url')),
  });
  fetchMock.mockResolvedValueOnce(response({
    requestId: fixture.requestId, serverPublicKey: fixture.serverPublicKey,
    expiresAt: fixture.expiresAt, pollIntervalMs: 1000,
  }));
  const request = await beginDevicePairing('http://localhost', 'Interop test');
  expect(request.verificationCode).toBe(fixture.verificationCode);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).clientPublicKey).toBe(fixture.clientPublicKey);
  fetchMock.mockResolvedValueOnce(response({ status: 'approved', expiresAt: fixture.expiresAt, nonce: fixture.nonce, ciphertext: fixture.ciphertext }));
  expect(await request.poll()).toEqual({ status: 'approved', authToken: fixture.authToken });
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).proof).toBe(fixture.pollProof);

  // Generate a fresh private key copy: the helper wipes the first key after deriving.
  vi.mocked(x25519.keygen).mockReturnValue({
    secretKey: new Uint8Array(Buffer.from(fixture.clientSecret, 'base64url')),
    publicKey: new Uint8Array(Buffer.from(fixture.clientPublicKey, 'base64url')),
  });
  fetchMock.mockResolvedValueOnce(response({ requestId: fixture.requestId, serverPublicKey: fixture.serverPublicKey, expiresAt: fixture.expiresAt }));
  const cancelled = await beginDevicePairing('http://localhost', 'Interop cancellation');
  await cancelled.cancel();
  expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body)).proof).toBe(fixture.cancelProof);
});
