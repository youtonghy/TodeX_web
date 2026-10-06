import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import jsQR from 'jsqr';
import {
  HistoryContentStream,
  encodeHistoryWrappedKey,
  historyRecipientId,
  newHistorySegmentKey,
  sealHistoryContent,
  wrapHistoryKey,
  type HistorySegmentKey,
} from '@todex/protocol/historyCrypto';
import { encodeQrCode } from '@todex/protocol/qrCode';
import { recoveryQrPayload } from '@todex/protocol/recoveryKey';
import { decodeBase64UrlBytes, encodeBase64Url } from '@todex/protocol/transportCrypto';
import type { ConversationManifest } from '@todex/protocol/v2';
import { buildChatRenderItems, isChatTimelineEntry } from '../../src/renderer/components/conversationTimeline';
import { useHistoryEncryption, type HistoryEncryptionSession } from '../../src/renderer/session/useHistoryEncryption';
import type { TimelineEntry } from '../../src/renderer/session/helpers';

const seeds = vi.hoisted(() => new Map<string, Uint8Array>());
vi.mock('../../src/renderer/lib/historyKeyStore', () => ({
  loadHistorySeed: vi.fn(async (id: string) => (seeds.has(id) ? Uint8Array.from(seeds.get(id)!) : null)),
  saveHistorySeed: vi.fn(async (id: string, seed: Uint8Array) => { seeds.set(id, Uint8Array.from(seed)); }),
  deleteHistorySeed: vi.fn(async (id: string) => { seeds.delete(id); }),
}));

let root: Root | undefined;
let container: HTMLDivElement | undefined;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  seeds.clear();
});

const b64 = encodeBase64Url;
const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

/** A backend stand-in for the §7 commands this client sends. */
function fakeBackend() {
  const state = { mode: 'off', epoch: 1, recipients: [] as Record<string, unknown>[], grants: [] as unknown[], myRid: undefined as string | undefined };
  let devicePublicKey: Uint8Array | null = null;
  const keys = new Map<string, HistorySegmentKey>();
  const wrapsFetched: string[][] = [];
  let gate: Promise<void> | null = null;
  let open: () => void = () => {};
  const sendCommand = vi.fn(async ({ type, payload }: { type: string; payload: Record<string, unknown> }) => {
    if (type === 'history.encryption.get') return { ...state };
    if (type === 'history.recipient.register') {
      devicePublicKey = decodeBase64UrlBytes(payload.publicKey as string);
      const rid = b64(historyRecipientId(devicePublicKey));
      state.myRid = rid;
      state.recipients = [{ rid, kind: 'device', deviceId: 'dev_self', publicKey: payload.publicKey, addedAt: 'now', revokedAt: null }];
      return { rid };
    }
    if (type === 'history.keys.wraps') {
      wrapsFetched.push(payload.kids as string[]);
      if (gate) await gate;
      const wraps: Record<string, unknown> = {};
      for (const kid of payload.kids as string[]) {
        const key = keys.get(kid);
        if (key && devicePublicKey) wraps[kid] = encodeHistoryWrappedKey(wrapHistoryKey(key, devicePublicKey));
      }
      return { wraps };
    }
    throw new Error(`unexpected ${type}`);
  });
  return {
    state, sendCommand, wrapsFetched,
    /** A DEK the backend wrapped for this device (or kept from it). */
    key(granted = true) {
      const key = newHistorySegmentKey();
      if (granted) keys.set(b64(key.kid), key);
      return key;
    },
    hold() { gate = new Promise((resolve) => { open = resolve; }); },
    releaseAll() { gate = null; open(); },
  };
}

async function mount(backend: ReturnType<typeof fakeBackend>, onUnlocked = vi.fn()) {
  let api!: HistoryEncryptionSession;
  function Harness() {
    api = useHistoryEncryption({ activeBackendId: 'b1', connected: true, sendCommand: backend.sendCommand, onUnlocked });
    return null;
  }
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root!.render(createElement(Harness)); });
  await act(async () => { await vi.waitFor(() => expect(api.view.status).toBe('ready')); });
  return () => api;
}

function encryptedEvent(key: HistorySegmentKey, sequence: number, envelope: Record<string, unknown>, content: Record<string, unknown>) {
  return {
    eventId: `evt_${sequence}`, conversationId: 'conv', sequence, time: '2026-10-06T00:00:00Z', type: 'message.delta',
    payload: { ...envelope, $enc: { v: 1, kid: b64(key.kid), c: 'conv', n: sequence,
      f: b64(sealHistoryContent(key, 'conv', HistoryContentStream.EventFull, sequence, json({ ...envelope, ...content }))) } },
  };
}

it('creates and registers this device key on connect, then decrypts pages and locks what it cannot open', async () => {
  const backend = fakeBackend();
  const api = await mount(backend);
  expect(seeds.has('b1')).toBe(true);
  expect(api().view.localRid).toBe(backend.state.myRid);
  expect(backend.sendCommand.mock.calls.map(([frame]) => frame.type)).toEqual(['history.encryption.get', 'history.recipient.register', 'history.encryption.get']);

  const granted = backend.key();
  const foreign = backend.key(false);
  const page = {
    conversationId: 'conv', fromSequence: 0, nextSequence: 3, hasMore: false,
    events: [
      { eventId: 'evt_1', conversationId: 'conv', sequence: 1, time: 't', type: 'turn.started', payload: { turnId: 't1' } },
      encryptedEvent(granted, 2, { turnId: 't1', role: 'assistant' }, { delta: { text: 'hello' } }),
      encryptedEvent(foreign, 3, { turnId: 't1', role: 'assistant' }, { delta: { text: 'secret' } }),
    ],
  };
  const opened = await api().decryptPage('b1', 'conv', page, 'summary');
  expect(opened.events.map((event) => event.sequence)).toEqual([1, 2, 3]);
  expect(opened.events[1].payload).toEqual({ turnId: 't1', role: 'assistant', delta: { text: 'hello' } });
  expect(opened.events[2].payload).toEqual({ turnId: 't1', role: 'assistant', detailLocked: true });
  // A reconnect does not register a second time.
  await act(async () => { await api().refresh(); });
  expect(backend.sendCommand.mock.calls.filter(([frame]) => frame.type === 'history.recipient.register')).toHaveLength(1);
});

it('keeps live events in arrival order while a wrap is being fetched', async () => {
  const backend = fakeBackend();
  const api = await mount(backend);
  const key = backend.key();
  backend.hold();
  const delivered: unknown[] = [];
  const deliver = (event: Record<string, unknown>) => delivered.push(event.sequence);
  const onError = vi.fn();
  api().receiveSocketEvent('b1', 'conv', encryptedEvent(key, 5, { turnId: 't' }, { delta: { text: 'a' } }), undefined, 'full', deliver, onError);
  api().receiveSocketEvent('b1', 'conv', { conversationId: 'conv', sequence: 6, payload: { turnId: 't' } }, undefined, 'full', deliver, onError);
  expect(delivered).toEqual([]);
  // Another conversation is not held up.
  api().receiveSocketEvent('b1', 'other', { conversationId: 'other', sequence: 1, payload: {} }, undefined, 'full', deliver, onError);
  expect(delivered).toEqual([1]);
  await act(async () => { backend.releaseAll(); await vi.waitFor(() => expect(delivered).toEqual([1, 5, 6])); });
  // With the key warm, later encrypted frames deliver synchronously.
  api().receiveSocketEvent('b1', 'conv', encryptedEvent(key, 7, {}, { text: 'b' }), undefined, 'full', deliver, onError);
  expect(delivered).toEqual([1, 5, 6, 7]);
  expect(onError).not.toHaveBeenCalled();
});

it('decrypts encrypted manifest titles once the backend is ready', async () => {
  const backend = fakeBackend();
  const api = await mount(backend);
  const key = backend.key();
  const manifest = { id: 'conv', title: '', titleEnc: { kid: b64(key.kid), ct: b64(sealHistoryContent(key, 'conv', HistoryContentStream.EventFull, 0, new TextEncoder().encode('加密标题'))) } } as ConversationManifest;
  expect(api().withDecryptedTitles('b1', [manifest])[0].title).toBe('');
  await act(async () => { await api().decryptManifestTitles('b1', [manifest]); });
  expect(api().withDecryptedTitles('b1', [manifest])[0].title).toBe('加密标题');
  expect(api().titleRevision).toBe(1);
});

it('locked rows stay visible in the chat without joining a process group', () => {
  const base = { raw: '', at: 0, conversationId: 'c', turnId: 't1' };
  const entries: TimelineEntry[] = [
    { ...base, id: 'u', kind: 'outgoing', title: 'You', subtitle: 'hi' },
    { ...base, id: 'tool', kind: 'system', title: '工具调用', subtitle: '', category: 'tool', phase: 'completed' },
    { ...base, id: 'v2-locked-c-t1', kind: 'system', title: '历史已加密', subtitle: '此设备尚未获授权查看这段历史', detailLocked: true },
  ];
  const visible = entries.filter(isChatTimelineEntry);
  expect(visible.map((entry) => entry.id)).toContain('v2-locked-c-t1');
  const items = buildChatRenderItems(visible);
  expect(items.some((item) => item.type === 'entry' && item.entry.id === 'v2-locked-c-t1')).toBe(true);
  expect(items.some((item) => item.type === 'executionGroup' && item.entries.some((entry) => entry.detailLocked))).toBe(false);
});

it('renders the recovery QR code so jsQR reads the payload back', () => {
  const payload = recoveryQrPayload(new Uint8Array(32).fill(7));
  const qr = encodeQrCode(payload);
  const scale = 4;
  const quiet = 4;
  const dim = (qr.size + quiet * 2) * scale;
  const pixels = new Uint8ClampedArray(dim * dim * 4).fill(255);
  qr.modules.forEach((row, y) => row.forEach((dark, x) => {
    if (!dark) return;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const index = (((y + quiet) * scale + dy) * dim + (x + quiet) * scale + dx) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
    }
  }));
  expect(jsQR(pixels, dim, dim)?.data).toBe(payload);
});
