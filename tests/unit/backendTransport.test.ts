// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { x25519 } from '@noble/curves/ed25519.js';
import {
  MAX_REST_BODY_BYTES,
  RecordCipher,
  TRANSPORT_V2_DIRECTION_DOWN,
  TRANSPORT_V2_DIRECTION_UP,
  TransportCryptoError,
  decodeInnerRequest,
  deriveRestDownKey,
  deriveRestTransportKeys,
  encodeInnerResponse,
  openRecordStream,
  sealRecordStream,
} from '@todex/protocol/secureChannel';
import {
  BackendUpgradeRequiredError,
  EncryptionRequiredError,
  InvalidPinnedKeyError,
  TransportPolicyError,
  TransportRepairRequiredError,
} from '@todex/protocol/secureTransport';
import { ConnectionError, ConnectionErrorType } from '@todex/protocol/connectionError';
import { SocketVerificationError } from '@todex/protocol/socketVerification';
import { generateDeviceIdentity } from '@todex/protocol/deviceAuth';
import { backendApi, backendFetch, backendTransport, describeTransportFailure } from '../../src/renderer/session/helpers';
import { readGitStatus } from '../../src/renderer/lib/gitWorkspace';
import { getWorkspaceTrust } from '../../src/renderer/lib/webBackend';

const serverSecret = new Uint8Array(32).fill(5);
const serverPublic = x25519.getPublicKey(serverSecret);
const device = generateDeviceIdentity();
const pinned = (serverUrl: string) => ({
  serverUrl, deviceSecret: device.secretKey, encryptionProtocol: 'x25519' as const,
  encryptionPublicKey: Buffer.from(serverPublic).toString('base64url'), transportVerified: true,
});
/** A key saved before pairing bound the transport (manual import): never trusted. */
const unverified = (serverUrl: string) => ({ ...pinned(serverUrl), transportVerified: false });
const unpaired = (serverUrl: string) => ({ serverUrl, deviceSecret: device.secretKey, encryptionProtocol: 'none' as const, encryptionPublicKey: '', transportVerified: false });

type Inner = ReturnType<typeof decodeInnerRequest>;
/** A `fetch` that only answers `/v2/sealed`, the way the backend tunnel does (sealed revision 2). */
function sealedBackend(answer: (inner: Inner) => { status: number; body: unknown }, contentType = 'application/vnd.todex.sealed; r=2') {
  const calls: { url: URL; inner?: Inner }[] = [];
  const fetchImpl = vi.fn(async (input: string, init: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url });
    if (url.pathname !== '/v2/sealed') return new Response('{"code":"PROTOCOL_UPGRADE_REQUIRED"}', { status: 426 });
    const headers = init.headers as Record<string, string>;
    const clientMaterial = new Uint8Array(Buffer.from(headers['x-todex-client-key'], 'base64url'));
    expect(headers['x-todex-sealed-revision']).toBe('2');
    const keys = deriveRestTransportKeys({
      protocol: 'x25519', deviceId: '', serverStaticPublic: serverPublic, clientMaterial,
      clientNonce: new Uint8Array(Buffer.from(headers['x-todex-request-nonce'], 'base64url')), serverNonce: new Uint8Array(),
      shared: x25519.getSharedSecret(serverSecret, clientMaterial),
    });
    const inner = decodeInnerRequest(openRecordStream(new RecordCipher(keys.kUp, keys.th, TRANSPORT_V2_DIRECTION_UP), init.body as Uint8Array));
    calls[calls.length - 1].inner = inner;
    const result = answer(inner);
    const responseNonce = crypto.getRandomValues(new Uint8Array(32));
    const records = sealRecordStream(new RecordCipher(deriveRestDownKey(keys.prk, responseNonce), keys.th, TRANSPORT_V2_DIRECTION_DOWN),
      encodeInnerResponse({ status: result.status, headers: { 'content-type': 'application/json' } }, new TextEncoder().encode(JSON.stringify(result.body))));
    const sealed = new Uint8Array(32 + records.length);
    sealed.set(responseNonce);
    sealed.set(records, 32);
    return new Response(sealed as Uint8Array<ArrayBuffer>, { status: 200, headers: { 'content-type': contentType } });
  });
  vi.stubGlobal('fetch', fetchImpl);
  return calls;
}
afterEach(() => { vi.unstubAllGlobals(); });

it('selects the transport per profile: pinned key -> v2 (loopback too), unpaired remote -> refused, unpaired loopback -> plaintext', () => {
  expect(backendTransport(pinned('http://127.0.0.1:7345')).mode).toBe('v2');
  expect(backendTransport(pinned('http://192.168.1.20:7345')).mode).toBe('v2');
  expect(backendTransport(unpaired('http://192.168.1.20:7345')).mode).toBe('refused');
  expect(backendTransport(unpaired('http://localhost:7345')).mode).toBe('plaintext');
  expect(backendTransport(pinned('http://10.1.1.1:7345'))).toBe(backendTransport(pinned('http://10.1.1.1:7345')));
});

it('refuses an unverified pin on every host, loopback included, without touching the network', async () => {
  const fetchImpl = vi.fn();
  vi.stubGlobal('fetch', fetchImpl);
  for (const serverUrl of ['http://127.0.0.1:7345', 'http://localhost:7345', 'http://192.168.1.20:7345']) {
    expect(backendTransport(unverified(serverUrl)).mode).toBe('refused');
    const failure = await backendFetch(unverified(serverUrl), { method: 'GET', path: '/v2/workspaces' }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(TransportRepairRequiredError);
    expect(failure).toMatchObject({ required: null });
    expect(describeTransportFailure(failure)).toMatchObject({ retryable: false, code: 'encryption_required' });
    expect(describeTransportFailure(failure)?.message).toContain('重新配对');
  }
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('refuses REST calls to an unpaired remote backend without touching the network', async () => {
  const fetchImpl = vi.fn();
  vi.stubGlobal('fetch', fetchImpl);
  await expect(backendFetch(unpaired('http://192.168.1.20:7345'), { method: 'GET', path: '/v2/workspaces' })).rejects.toBeInstanceOf(EncryptionRequiredError);
  await expect(backendApi(unpaired('http://192.168.1.20:7345')).listConversations()).rejects.toBeInstanceOf(EncryptionRequiredError);
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('tunnels every REST helper through /v2/sealed with the inner request signed', async () => {
  const calls = sealedBackend((inner) => inner.path === '/v2/workspaces/w%201/trust'
    ? { status: 200, body: { workspacePath: '/w', trusted: true } }
    : inner.path === '/v2/git/status' ? { status: 200, body: { repositoryPath: '/w', initialized: true } }
      : { status: 200, body: { conversations: [] } });
  const settings = { ...pinned('http://192.168.1.20:7345'), tenantId: 'local' } as never;
  expect(await backendApi(settings).listConversations()).toEqual({ conversations: [] });
  expect(await getWorkspaceTrust(settings, 'w 1')).toMatchObject({ trusted: true });
  expect(await readGitStatus(settings, '/w')).toMatchObject({ repositoryPath: '/w' });
  const response = await backendFetch(settings, { method: 'PUT', path: '/v2/workspaces', headers: { 'content-type': 'application/json' }, body: '{"workspaces":[]}' });
  expect(response.ok).toBe(true);
  expect(calls.every(({ url }) => url.pathname === '/v2/sealed' && url.search === '')).toBe(true);
  expect(calls.map(({ inner }) => `${inner?.method} ${inner?.path}`)).toEqual([
    'GET /v2/conversations', 'GET /v2/workspaces/w%201/trust', 'GET /v2/git/status', 'PUT /v2/workspaces',
  ]);
  expect(calls[2].inner?.query).toBe('workspacePath=%2Fw');
  for (const { inner } of calls) {
    expect(inner?.headers['x-todex-device-id']).toBe(device.deviceId);
    expect(inner?.headers['x-todex-auth-sig']).toBeTruthy();
  }
  expect(new TextDecoder().decode(calls[3].inner?.body)).toBe('{"workspaces":[]}');
});

it('surfaces inner error statuses as plain responses and an unsealed answer as a request failure', async () => {
  sealedBackend(() => ({ status: 409, body: { code: 'CONFLICT', message: 'busy' } }));
  const response = await backendFetch(pinned('http://192.168.1.20:7345'), { method: 'GET', path: '/v2/workspaces' });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ code: 'CONFLICT', message: 'busy' });

  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"code":"TRANSPORT_CRYPTO_FAILED","message":"transport crypto failure"}', { status: 400 })));
  const failure = await backendFetch(pinned('http://192.168.1.21:7345'), { method: 'GET', path: '/v2/workspaces' }).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(ConnectionError);
  expect(describeTransportFailure(failure)).toMatchObject({ retryable: true, code: 'protocol_mismatch' });

  // A sealed answer without r=2 comes from a backend that must be updated.
  sealedBackend(() => ({ status: 200, body: {} }), 'application/vnd.todex.sealed');
  const outdated = await backendFetch(pinned('http://192.168.1.22:7345'), { method: 'GET', path: '/v2/workspaces' }).catch((error: unknown) => error);
  expect(outdated).toBeInstanceOf(BackendUpgradeRequiredError);
  expect(describeTransportFailure(outdated)).toMatchObject({ retryable: false, code: 'protocol_mismatch' });
  expect(describeTransportFailure(outdated)?.message).toContain('升级后端');
});

it('maps every transport failure to a localized message and retry policy', () => {
  expect(describeTransportFailure(new EncryptionRequiredError('http://x'))).toMatchObject({ retryable: false, code: 'encryption_required' });
  expect(describeTransportFailure(new InvalidPinnedKeyError('x25519'))).toMatchObject({ retryable: false, code: 'encryption_required' });
  expect(describeTransportFailure(new TransportRepairRequiredError('x25519', 'ml-kem-768'))?.message).toContain('ml-kem-768');
  expect(describeTransportFailure(new TransportRepairRequiredError('x25519', 'ml-kem-768'))?.message).toContain('重新配对');
  expect(describeTransportFailure(new InvalidPinnedKeyError('x25519'))?.message).toContain('重新配对');
  expect(describeTransportFailure(new EncryptionRequiredError('http://x'))?.message).not.toMatch(/二维码|粘贴/);
  expect(describeTransportFailure(new TransportPolicyError('outdated', false))).toMatchObject({ retryable: false });
  expect(describeTransportFailure(new BackendUpgradeRequiredError('policy'))).toMatchObject({ retryable: false, code: 'protocol_mismatch' });
  expect(describeTransportFailure(new TransportPolicyError('unreachable', true))).toMatchObject({ retryable: true, code: 'backend_unreachable' });
  expect(describeTransportFailure(new TransportPolicyError('timeout', true))).toMatchObject({ retryable: true });
  expect(describeTransportFailure(new TransportPolicyError('http', false, 403))).toMatchObject({ retryable: false });
  expect(describeTransportFailure(new TransportCryptoError('socket'))).toMatchObject({ retryable: true });
  const upgrade = ConnectionError.apiRequestFailed(426, 'PROTOCOL_UPGRADE_REQUIRED');
  expect(describeTransportFailure(upgrade)).toMatchObject({ retryable: false, code: 'encryption_required' });
  expect(describeTransportFailure(new SocketVerificationError(false))).toMatchObject({ retryable: false });
  expect(describeTransportFailure(new SocketVerificationError(true))).toMatchObject({ retryable: true });
  expect(describeTransportFailure(new Error('other'))).toBeNull();
});

it('refuses an over-limit REST body before sealing, with a localized error', async () => {
  const fetchImpl = vi.fn();
  vi.stubGlobal('fetch', fetchImpl);
  const body = new Uint8Array(MAX_REST_BODY_BYTES + 1);
  for (const profile of [pinned('http://10.0.0.5:7345'), unpaired('http://127.0.0.1:7345')]) {
    const failure = await backendFetch(profile, { method: 'PUT', path: '/v2/remote/files', body }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ConnectionError);
    expect(failure).toMatchObject({ type: ConnectionErrorType.MESSAGE_TOO_LARGE, retryable: false, code: 'request_failed' });
    expect((failure as Error).message).toContain('32 MiB');
  }
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(backendTransport(unpaired('http://127.0.0.1:7345'))).toBe(backendTransport(unpaired('http://127.0.0.1:7345')));
});
