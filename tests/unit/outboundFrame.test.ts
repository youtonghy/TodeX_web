import { describe, expect, it } from 'vitest';
import { x25519 } from '@noble/curves/ed25519.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { MAX_LEGACY_MESSAGE_BYTES } from '@todex/protocol/transport';
import { createTransportCryptoSession, encodeBase64Url } from '@todex/protocol/transportCrypto';
import { utf8ByteLength } from '@todex/protocol/todex';
import { encodeOutboundFrame, encryptedFrameByteLength } from '../../src/renderer/session/helpers';

function sessions() {
  return [
    createTransportCryptoSession({ encryptionProtocol: 'x25519', encryptionPublicKey: encodeBase64Url(x25519.keygen().publicKey) })!,
    createTransportCryptoSession({ encryptionProtocol: 'ml-kem-768', encryptionPublicKey: encodeBase64Url(ml_kem768.keygen().publicKey) })!,
  ];
}

describe('outbound frame size', () => {
  it('predicts the exact size of the encrypted envelope', () => {
    for (const session of sessions()) {
      for (const text of ['', 'a', 'ab', 'abc', '{"id":"x","type":"t","payload":{}}', '中文😀'.repeat(37)]) {
        const wire = session.encryptClientText(text);
        expect(encryptedFrameByteLength(utf8ByteLength(text), session.protocol)).toBe(utf8ByteLength(wire));
      }
    }
  });

  it('rejects an oversize frame before encrypting, so the nonce counter stays in step', () => {
    const [session] = sessions();
    let encrypted = 0;
    const counting = { ...session, encryptClientText: (text: string) => { encrypted += 1; return session.encryptClientText(text); } };
    // Under the limit as plaintext, over it once base64url-encrypted.
    const oversize = 'x'.repeat(MAX_LEGACY_MESSAGE_BYTES - 1024);
    expect(() => encodeOutboundFrame(oversize, counting)).toThrow(/exceeds limit|消息过大/);
    expect(encrypted).toBe(0);
    expect(encodeOutboundFrame('{"ok":true}', counting)).toContain('todex.crypto.v1');
    expect(encrypted).toBe(1);
  });

  it('passes plaintext frames through and still enforces the limit', () => {
    expect(encodeOutboundFrame('{"ok":true}', null)).toBe('{"ok":true}');
    expect(() => encodeOutboundFrame('x'.repeat(MAX_LEGACY_MESSAGE_BYTES + 1), null)).toThrow();
  });
});

describe('device identity cache', () => {
  it('derives each secret once and keeps invalid secrets null', async () => {
    const { generateDeviceIdentity } = await import('@todex/protocol/deviceAuth');
    const { cachedDeviceIdentity } = await import('../../src/renderer/session/helpers');
    const identity = generateDeviceIdentity();
    const first = cachedDeviceIdentity(identity.secretKey);
    expect(first?.deviceId).toBe(identity.deviceId);
    expect(cachedDeviceIdentity(identity.secretKey)).toBe(first);
    expect(cachedDeviceIdentity('')).toBeNull();
    expect(cachedDeviceIdentity('not-a-key')).toBeNull();
  });
});
