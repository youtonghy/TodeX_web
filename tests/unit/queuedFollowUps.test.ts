import { describe, expect, it } from 'vitest';
import { migrateLegacyFollowUps, restoreQueuedFollowUps,
  type LegacyAddResult, type LegacyQueueTarget } from '../../src/renderer/session/queuedFollowUps';

const item = (id: string) => ({ id, text: `text ${id}`, attachments: [], skills: [] });

describe('legacy candidate parsing', () => {
  it('rejects malformed stored queues and bounds restored items', () => {
    expect(restoreQueuedFollowUps({ c: [null, {}, { id: 2 }] })).toEqual({ queues: {}, paused: [] });
    expect(restoreQueuedFollowUps({ c: Array(40).fill(item('a')) }).queues.c).toHaveLength(32);
    expect(restoreQueuedFollowUps({ version: 2, queues: { c: Array(40).fill(item('a')) }, paused: 'c' })).toEqual({
      queues: { c: Array(32).fill(item('a')) }, paused: [] });
  });
  it('keeps the paused flag with the candidates and still reads the old shape', () => {
    const stored = { version: 2, queues: { c: [item('a')], d: [item('a')] }, paused: ['c', 'c', 'gone'] };
    // Duplicate and orphaned pauses are dropped.
    expect(restoreQueuedFollowUps(JSON.parse(JSON.stringify(stored)))).toEqual({ queues: { c: [item('a')], d: [item('a')] }, paused: ['c'] });
    // Version 1 stored the map alone; nothing in it was marked paused.
    expect(restoreQueuedFollowUps({ c: [item('a')] })).toEqual({ queues: { c: [item('a')] }, paused: [] });
  });
});

describe('migrateLegacyFollowUps', () => {
  function run(legacy: Parameters<typeof migrateLegacyFollowUps<ReturnType<typeof item>>>[0], targets: Record<string, LegacyQueueTarget>,
    results: (id: string, itemId: string, paused: boolean) => LegacyAddResult = () => 'added') {
    const added: string[] = []; const settled: Record<string, string[]> = {};
    return {
      added, settled,
      done: migrateLegacyFollowUps(legacy, {
        resolve: (id) => targets[id] ?? { kind: 'wait' },
        add: async (id, entry, paused) => { added.push(`${id}:${entry.id}:${paused ? 'paused' : 'live'}`); return results(id, entry.id, paused); },
        settle: (id, discarded) => { settled[id] = discarded.map((entry) => entry.id); },
      }),
    };
  }

  it('adds the items in order under their original ids and settles the conversation once all moved', async () => {
    const test = run({ queues: { c: [item('a'), item('b')] }, paused: [] }, { c: { kind: 'ready', control: true } });
    await test.done;
    expect(test.added).toEqual(['c:a:live', 'c:b:live']);
    expect(test.settled).toEqual({ c: [] });
  });

  it('keeps a paused conversation paused, or leaves it untouched without queue control', async () => {
    const paused = run({ queues: { c: [item('a'), item('b')] }, paused: ['c'] }, { c: { kind: 'ready', control: true } });
    await paused.done;
    // Only the head goes in paused; the rest wait behind it.
    expect(paused.added).toEqual(['c:a:paused', 'c:b:live']);
    expect(paused.settled).toEqual({ c: [] });

    const noControl = run({ queues: { c: [item('a')] }, paused: ['c'] }, { c: { kind: 'ready', control: false } });
    await noControl.done;
    expect(noControl.added).toEqual([]);
    expect(noControl.settled).toEqual({});
  });

  it('settles conversations that are gone or read-only with everything discarded', async () => {
    const test = run({ queues: { gone: [item('a'), item('b')] }, paused: [] }, { gone: { kind: 'gone' } });
    await test.done;
    expect(test.added).toEqual([]);
    expect(test.settled).toEqual({ gone: ['a', 'b'] });
  });

  it('discards a conversation the backend refuses for good', async () => {
    const test = run({ queues: { c: [item('a'), item('b')] }, paused: [] }, { c: { kind: 'ready', control: true } },
      (_id, itemId) => (itemId === 'a' ? 'gone' : 'added'));
    await test.done;
    expect(test.added).toEqual(['c:a:live']);
    expect(test.settled).toEqual({ c: ['a', 'b'] });
  });

  it('keeps the local copy after a transient failure and leaves undecided conversations alone', async () => {
    const test = run({ queues: { c: [item('a'), item('b')], later: [item('x')] }, paused: [] }, { c: { kind: 'ready', control: true } },
      (_id, itemId) => (itemId === 'b' ? 'failed' : 'added'));
    await test.done;
    expect(test.added).toEqual(['c:a:live', 'c:b:live']);
    // A retry re-adds under the same ids, so nothing is settled yet.
    expect(test.settled).toEqual({});
  });
});
