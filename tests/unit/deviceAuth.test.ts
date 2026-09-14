// @vitest-environment node
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  canonicalAuthQuery,
  decodeBase64Url,
  deviceAuthHeaders,
  deviceIdentityFromSecret,
} from '@todex/protocol/deviceAuth';

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/device-auth-v1.json', import.meta.url), 'utf8'),
) as {
  deviceSeed: string;
  devicePublicKey: string;
  deviceId: string;
  method: string;
  path: string;
  rawQuery: string;
  canonicalQuery: string;
  timestamp: string;
  nonce: string;
  body: string;
  payload: string;
  signature: string;
};

it('derives the device identity pinned by the Rust fixture', () => {
  const device = deviceIdentityFromSecret(fixture.deviceSeed)!;
  expect(device.secretKey).toBe(fixture.deviceSeed);
  expect(device.publicKey).toBe(fixture.devicePublicKey);
  expect(device.deviceId).toBe(fixture.deviceId);
});

it('canonicalizes queries exactly like the daemon', () => {
  expect(canonicalAuthQuery(fixture.rawQuery)).toBe(fixture.canonicalQuery);
  expect(canonicalAuthQuery('')).toBe('');
  expect(canonicalAuthQuery('q=a+b')).toBe('q=a%20b');
  expect(canonicalAuthQuery('a=b%26c%3Dd')).toBe('a=b%26c%3Dd');
});

it('produces the byte-identical signature for the fixed timestamp and nonce', () => {
  const device = deviceIdentityFromSecret(fixture.deviceSeed)!;
  const nonce = decodeBase64Url(fixture.nonce);
  const headers = deviceAuthHeaders(
    device,
    fixture.method,
    `${fixture.path}?${fixture.rawQuery}`,
    new TextEncoder().encode(fixture.body),
    { now: Number(fixture.timestamp) * 1000, nonce },
  );
  expect(headers['x-todex-device-id']).toBe(fixture.deviceId);
  expect(headers['x-todex-auth-ts']).toBe(fixture.timestamp);
  expect(headers['x-todex-auth-nonce']).toBe(fixture.nonce);
  expect(headers['x-todex-auth-sig']).toBe(fixture.signature);
});
