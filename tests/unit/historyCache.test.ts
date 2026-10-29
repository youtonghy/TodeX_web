import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HISTORY_CACHE_FLUSH_DELAY_MS,
  HISTORY_CACHE_MAX_CONVERSATIONS,
  HISTORY_CACHE_TAIL_EVENTS,
  HistoryTailCache,
  type HistoryCacheStore,
  type HistoryTailMeta,
  type StoredHistoryTail,
  type StoredHistoryWrap,
} from '../../src/renderer/session/historyCache';
import type { HistoryWireEvent } from '@todex/protocol/historyEncryption';

function memoryStore() {
  const tails = new Map<string, StoredHistoryTail>();
  const metas = new Map<string, HistoryTailMeta>();
  const wraps = new Map<string, StoredHistoryWrap>();
  const inBackend = (key: string, backendId: string) => key.startsWith(`${backendId}\u0000`);
  const store: HistoryCacheStore = {
    getTail: async (key) => tails.get(key),
    putTail: async (tail, meta) => { tails.set(tail.key, tail); metas.set(meta.key, meta); },
    putTailMeta: async (meta) => { metas.set(meta.key, meta); },
    listTailMeta: async () => [...metas.values()],
    deleteTails: async (keys) => { for (const key of keys) { tails.delete(key); metas.delete(key); } },
    getWraps: async (keys) => Object.fromEntries(keys.flatMap((key) => (wraps.has(key) ? [[key, wraps.get(key)!.wrap]] : []))),
    putWraps: async (entries) => { for (const entry of entries) wraps.set(entry.key, entry); },
    deleteWraps: async (keys) => { for (const key of keys) wraps.delete(key); },
    listWrapKeys: async (backendId) => [...wraps.keys()].filter((key) => inBackend(key, backendId)),
    deleteBackend: async (backendId) => {
      for (const map of [tails, metas, wraps]) for (const key of [...map.keys()]) if (inBackend(key, backendId)) map.delete(key);
    },
    clear: async () => { tails.clear(); metas.clear(); wraps.clear(); },
  };
  return { store, tails, metas, wraps };
}

function settingsStore(initial?: unknown) {
  const values = new Map<string, unknown>(initial === undefined ? [] : [['cache', initial]]);
  return { get: async (key: string) => values.get(key), set: async (key: string, value: unknown) => { values.set(key, value); }, values };
}

const encrypted = (sequence: number, extra: Record<string, unknown> = {}): HistoryWireEvent => ({
  conversationId: 'c', eventId: `e${sequence}`, sequence, type: 'message.delta',
  payload: { $enc: { v: 1, kid: 'k1', c: 'cid', n: sequence, s: `sum${sequence}`, f: `full${sequence}`, ...extra } },
});
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => encrypted(from + index));

function setup(initialSettings?: unknown) {
  const memory = memoryStore();
  const settings = settingsStore(initialSettings);
  const cache = new HistoryTailCache(memory.store, settings, 'cache');
  cache.setRecipientResolver(async (backendId) => (backendId === 'b-norid' ? undefined : 'rid1'));
  return { cache, settings, ...memory };
}
const storedSequences = (tails: Map<string, StoredHistoryTail>, key = 'b\u0000rid1\u0000c') => tails.get(key)?.events.map((event) => event.sequence);

describe('history tail cache', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts a tail only from a history window and extends it with later events', async () => {
    const { cache, tails } = setup();
    cache.capture('b', 'c', [encrypted(5)], undefined);
    await cache.flushAll();
    expect(tails.size).toBe(0);
    cache.capture('b', 'c', range(1, 3), undefined, { start: true });
    cache.capture('b', 'c', [encrypted(4)], undefined);
    await cache.flushAll();
    expect(storedSequences(tails)).toEqual([1, 2, 3, 4]);
  });

  it('writes after the quiet delay, keeping only summary ciphertext and referenced frames', async () => {
    const { cache, tails } = setup();
    const framed = encrypted(2, { fr: { s: 'frame-a' } });
    cache.capture('b', 'c', [encrypted(1), framed], { 'frame-a': { kid: 'k1' }, 'frame-b': { kid: 'k1' } }, { start: true });
    expect(tails.size).toBe(0);
    await vi.advanceTimersByTimeAsync(HISTORY_CACHE_FLUSH_DELAY_MS);
    const tail = tails.get('b\u0000rid1\u0000c')!;
    expect(tail.events.map((event) => (event.payload as { $enc: Record<string, unknown> }).$enc.f)).toEqual([undefined, undefined]);
    expect(tail.frames).toEqual({ 'frame-a': { kid: 'k1' } });
  });

  it('keeps the newest contiguous run, at most one window', async () => {
    const { cache, tails } = setup();
    cache.capture('b', 'c', range(1, 10), undefined, { start: true });
    cache.capture('b', 'c', [encrypted(12), encrypted(13)], undefined);
    await cache.flushAll();
    expect(storedSequences(tails)).toEqual([12, 13]);
    cache.capture('b', 'c', range(14, 14 + HISTORY_CACHE_TAIL_EVENTS), undefined);
    await cache.flushAll();
    const kept = storedSequences(tails)!;
    expect(kept).toHaveLength(HISTORY_CACHE_TAIL_EVENTS);
    expect(kept.at(-1)).toBe(14 + HISTORY_CACHE_TAIL_EVENTS);
  });

  it('never stores plaintext and drops what it held for that conversation', async () => {
    const { cache, tails } = setup();
    cache.capture('b', 'c', range(1, 2), undefined, { start: true });
    await cache.flushAll();
    expect(tails.size).toBe(1);
    cache.capture('b', 'c', [{ conversationId: 'c', sequence: 3, payload: { content: 'plain' } }], undefined);
    await vi.runAllTimersAsync();
    cache.capture('b', 'c', range(4, 5), undefined, { start: true });
    await cache.flushAll();
    expect(tails.size).toBe(0);
  });

  it('writes nothing without this device key', async () => {
    const { cache, tails } = setup();
    cache.capture('b-norid', 'c', range(1, 2), undefined, { start: true });
    await cache.flushAll();
    expect(tails.size).toBe(0);
  });

  it('reads a stored tail, which later events then extend', async () => {
    const first = setup();
    first.cache.capture('b', 'c', range(1, 3), undefined, { start: true });
    await first.cache.flushAll();
    const reopened = new HistoryTailCache(first.store, settingsStore(), 'cache');
    reopened.setRecipientResolver(async () => 'rid1');
    expect((await reopened.read('b', 'c'))?.events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    reopened.capture('b', 'c', [encrypted(4)], undefined);
    await reopened.flushAll();
    expect(storedSequences(first.tails)).toEqual([1, 2, 3, 4]);
    // Another device key reads nothing.
    reopened.setRecipientResolver(async () => 'rid2');
    expect(await reopened.read('b', 'c')).toBeNull();
  });

  it('refuses a stored tail with a hole in it', async () => {
    const { cache, store } = setup();
    await store.putTail({ key: 'b\u0000rid1\u0000c', events: [encrypted(1), encrypted(3)], frames: {} },
      { key: 'b\u0000rid1\u0000c', backendId: 'b', rid: 'rid1', conversationId: 'c', firstSequence: 1, lastSequence: 3, savedAt: 0, usedAt: 0, bytes: 1 });
    expect(await cache.read('b', 'c')).toBeNull();
  });

  it('evicts the least recently used conversations beyond the limit', async () => {
    const { cache, tails } = setup();
    for (let index = 0; index <= HISTORY_CACHE_MAX_CONVERSATIONS; index += 1) {
      vi.setSystemTime(1_000 + index);
      cache.capture('b', `c${index}`, range(1, 1), undefined, { start: true });
      await cache.flushAll();
    }
    expect(tails.size).toBe(HISTORY_CACHE_MAX_CONVERSATIONS);
    expect(tails.has('b\u0000rid1\u0000c0')).toBe(false);
  });

  it('forgets a conversation, a backend, and conversations its list no longer has', async () => {
    const { cache, tails, wraps } = setup();
    for (const [backend, conversation] of [['b', 'c1'], ['b', 'c2'], ['b', 'c3'], ['other', 'c1']]) {
      cache.capture(backend, conversation, range(1, 1), undefined, { start: true });
    }
    await cache.flushAll();
    await cache.wrapsFetcher('b', async () => ({ k1: { rid: 'rid1', kemCt: 'x', wrapped: 'y' } }))({ conversationId: 'c1', kids: ['k1'], rid: 'rid1' });
    await vi.runAllTimersAsync();
    expect(wraps.size).toBe(1);
    await cache.forgetConversation('b', 'c1');
    expect([...tails.keys()].sort()).toEqual(['b\u0000rid1\u0000c2', 'b\u0000rid1\u0000c3', 'other\u0000rid1\u0000c1']);
    expect(wraps.size).toBe(0);
    await cache.retainConversations('b', new Set(['c2']));
    expect([...tails.keys()].sort()).toEqual(['b\u0000rid1\u0000c2', 'other\u0000rid1\u0000c1']);
    await cache.forgetBackend('b');
    expect([...tails.keys()]).toEqual(['other\u0000rid1\u0000c1']);
  });

  it('answers stored wraps without a round trip and stores fetched ones', async () => {
    const { cache } = setup();
    const wrap = { rid: 'rid1', kemCt: 'x', wrapped: 'y' };
    const fetch = vi.fn(async (request: { kids: string[] }) => Object.fromEntries(request.kids.map((kid) => [kid, wrap])));
    const fetcher = cache.wrapsFetcher('b', fetch);
    await expect(fetcher({ conversationId: 'c', kids: ['k1'], rid: 'rid1' })).resolves.toEqual({ k1: wrap });
    await vi.runAllTimersAsync();
    await expect(fetcher({ conversationId: 'c', kids: ['k1', 'k2'], rid: 'rid1' })).resolves.toEqual({ k1: wrap, k2: wrap });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0].kids).toEqual(['k2']);
  });

  it('stores nothing and clears everything once switched off', async () => {
    const { cache, tails, settings } = setup();
    cache.capture('b', 'c', range(1, 2), undefined, { start: true });
    await cache.flushAll();
    await cache.setEnabled(false);
    expect(tails.size).toBe(0);
    expect(settings.values.get('cache')).toEqual({ enabled: false });
    cache.capture('b', 'c', range(1, 2), undefined, { start: true });
    await cache.flushAll();
    expect(tails.size).toBe(0);
    const restarted = setup({ enabled: false }).cache;
    await restarted.read('b', 'c');
    expect(restarted.isEnabled()).toBe(false);
  });
});
