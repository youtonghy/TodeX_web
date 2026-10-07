import { describe, expect, it, vi } from 'vitest';
import { MAX_LEGACY_MESSAGE_BYTES } from '@todex/protocol/transport';
import { TransportPayloadTooLargeError, assertWsPlaintextFits } from '@todex/protocol/secureChannel';
import { ConnectionError } from '@todex/protocol/connectionError';
import type { SecureSocket } from '@todex/protocol/secureTransport';
import { sendSocketText } from '../../src/renderer/session/helpers';

describe('outbound frame size', () => {
  it('rejects an oversize frame before sealing, as a ConnectionError, without sending', () => {
    const sent: string[] = [];
    // Mirrors SecureSocket.send: the plaintext pre-check runs before sealing.
    const socket = { send: (text: string) => { assertWsPlaintextFits(text); sent.push(text); } } as unknown as SecureSocket;
    // Fits as plaintext but not once the 24-byte frame overhead is added.
    const oversize = 'x'.repeat(MAX_LEGACY_MESSAGE_BYTES - 10);
    expect(() => sendSocketText(socket, oversize)).toThrow(ConnectionError);
    expect(sent).toHaveLength(0);
    sendSocketText(socket, '{"ok":true}');
    expect(sent).toEqual(['{"ok":true}']);
  });

  it('passes other send failures through unchanged', () => {
    const failure = new Error('secure socket is not open');
    const socket = { send: vi.fn(() => { throw failure; }) } as unknown as SecureSocket;
    expect(() => sendSocketText(socket, '{}')).toThrow(failure);
    expect(new TransportPayloadTooLargeError(2, 1)).toBeInstanceOf(Error);
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
