import { expect, it } from 'vitest';
import { pairingConnectionPatch } from '../../src/renderer/session/pairingImport';
import type { ParsedPairing } from '@todex/protocol/transportCrypto';

const pairing: ParsedPairing = { serverUrl: 'https://backend.test', encryptionProtocol: 'x25519', encryptionPublicKey: 'public-key' };
it('preserves the device enrollment when importing a public-key-only QR for the same normalized backend', () => {
  expect(pairingConnectionPatch({ serverUrl: 'wss://BACKEND.test:443/', deviceSecret: 'device-secret' }, pairing)).toEqual({ ...pairing, deviceSecret: 'device-secret' });
});
it.each(['https://other.test', 'http://backend.test', 'https://backend.test:7443'])('does not transfer the device credential from %s to another backend', serverUrl => {
  expect(pairingConnectionPatch({ serverUrl, deviceSecret: 'old-secret' }, pairing)).toEqual({ ...pairing, deviceSecret: '' });
});
