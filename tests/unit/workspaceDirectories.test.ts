// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import type { ConnectionSettings } from '@todex/protocol/todex';
import {
  canonicalAuthQuery,
  decodeBase64Url,
  deviceIdentityFromSecret,
  encodeBase64Url,
} from '@todex/protocol/deviceAuth';
import { fetchWorkspaceDirectorySnapshot } from '../../src/renderer/session/helpers';

const device = deviceIdentityFromSecret('FRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRU')!;
const settings = { serverUrl: 'http://localhost:8787', deviceSecret: device.secretKey } as ConnectionSettings;

afterEach(() => {
  vi.unstubAllGlobals();
});

function signedPayload(deviceId: string, method: string, path: string, query: string, ts: string, nonce: string, body: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const textFields = [
    'todex.device-auth.v1',
    deviceId,
    method.toUpperCase(),
    path,
    canonicalAuthQuery(query),
    ts,
    nonce,
    encodeBase64Url(sha256(body)),
  ];
  return encoder.encode(textFields.join('\0'));
}

it('signs the real directory-listing path and query', async () => {
  const snapshot = { root: '/root', current: '/root/sub', parent: '/root', entries: [] };
  const fetcher = vi.fn(async () => new Response(JSON.stringify(snapshot)));
  vi.stubGlobal('fetch', fetcher);

  await fetchWorkspaceDirectorySnapshot(settings, '/root/sub');

  const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  const requestUrl = new URL(url);
  expect(requestUrl.pathname).toBe('/v2/workspace/directories');
  expect(requestUrl.searchParams.get('path')).toBe('/root/sub');

  const headers = options.headers as Record<string, string>;
  const payload = signedPayload(
    device.deviceId,
    'GET',
    requestUrl.pathname,
    requestUrl.search.slice(1),
    headers['x-todex-auth-ts'],
    headers['x-todex-auth-nonce'],
    new Uint8Array(),
  );
  const signature = decodeBase64Url(headers['x-todex-auth-sig']);
  const publicKey = decodeBase64Url(device.publicKey);
  expect(ed25519.verify(signature, payload, publicKey)).toBe(true);
});
