import { expect, it } from 'vitest';
import { pairingConnectionPatch } from '../../src/renderer/session/pairingImport';
import type { ParsedPairing } from '@todex/protocol/transportCrypto';

const pairing: ParsedPairing = { serverUrl: 'https://backend.test', authToken: '', encryptionProtocol: 'x25519', encryptionPublicKey: 'public-key' };
it('preserves a device-approved token when importing a public-key-only QR for the same normalized backend', () => {
  expect(pairingConnectionPatch({ serverUrl: 'wss://BACKEND.test:443/', authToken: 'device-token' }, pairing)).toEqual({ ...pairing, authToken: 'device-token' });
});
it.each(['https://other.test', 'http://backend.test', 'https://backend.test:7443'])('does not transfer credentials from %s to another backend', serverUrl => {
  expect(pairingConnectionPatch({ serverUrl, authToken: 'old-token' }, pairing)).toEqual(pairing);
});
it('uses an explicitly imported token even when a token was previously saved', () => {
  expect(pairingConnectionPatch({ serverUrl: pairing.serverUrl, authToken: 'old-token' }, { ...pairing, authToken: 'imported-token' }).authToken).toBe('imported-token');
});
