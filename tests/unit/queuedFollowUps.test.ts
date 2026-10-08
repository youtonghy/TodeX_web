import { describe, expect, it } from 'vitest';
import { migrateLegacyFollowUps, restoreQueuedFollowUps, serializeQueuedFollowUps,
  type LegacyAddResult, type LegacyConversationState } from '../../src/renderer/session/queuedFollowUps';

const item = (id: string) => ({ id, text: `text ${id}`, attachments: [], skills: [] });

describe('legacy candidate parsing', () => {
  it('rejects malformed stored queues and bounds restored items', () => {
    expect(restoreQueuedFollowUps({ c: [null, {}, { id: 2 }] })).toEqual({ queues: {}, paused: [] });
    expect(restoreQueuedFollowUps({ c: Array(40).fill(item('a')) }).queues.c).toHaveLength(32);
    expect(restoreQueuedFollowUps({ version: 2, queues: { c: Array(40).fill(item('a')) }, paused: 'c' })).toEqual({
      queues: { c: Array(32).fill(item('a')) }, paused: [] });
  });
  it('keeps the paused flag with the candidates and still reads the old shape', () => {
    const stored = serializeQueuedFollowUps({ c: [item('a')], d: [item('a')] }, ['c', 'c', 'gone']);
    // A pause without candidates behind it is not stored.
    expect(stored).toEqual({ version: 2, queues: { c: [item('a')], d: [item('a')] }, paused: ['c'] });
    expect(restoreQueuedFollowUps(JSON.parse(JSON.stringify(stored)))).toEqual({ queues: { c: [item('a')], d: [item('a')] }, paused: ['c'] });
    // Version 1 stored the map alone; nothing in it was marked paused.
    expect(restoreQueuedFollowUps({ c: [item('a')] })).toEqual({ queues: { c: [item('a')] }, paused: [] });
  });
});

describe('migrateLegacyFollowUps', () => {
  function run(legacy: Parameters<typeof migrateLegacyFollowUps<ReturnType<typeof item>>>[0], states: Record<string, LegacyConversationState>,
    results: (id: string, itemId: string, paused: boolean) => LegacyAddResult = () => 'added') {
    const added: string[] = []; const settled: Record<string, string[]> = {}; const discarded: Record<string, string[]> = {};
    return {
      added, settled, discarded,
      done: migrateLegacyFollowUps(legacy, {
        state: (id) => states[id] ?? 'wait',
        add: async (id, entry, paused) => { added.push(`${id}:${entry.id}:${paused ? 'paused' : 'live'}`); return results(id, entry.id, paused); },
        settle: (id, remaining) => { settled[id] = remaining.map((entry) => entry.id); },
        discarded: (id, items) => { discarded[id] = items.map((entry) => entry.id); },
      }),
    };
  }

  it('adds the items in order under their original ids and settles each one', async () => {
    const test = run({ queues: { c: [item('a'), item('b')] }, paused: [] }, { c: { control: true } });
    expect(await test.done).toEqual({ queues: {}, paused: [] });
    expect(test.added).toEqual(['c:a:live', 'c:b:live']);
    expect(test.settled.c).toEqual([]);
  });
  it('keeps a paused conversation paused, or leaves it untouched without queue control', async () => {
    const paused = run({ queues: { c: [item('a'), item('b')] }, paused: ['c'] }, { c: { control: true } });
    await paused.done;
    expect(paused.added).toEqual(['c:a:paused', 'c:b:paused']);
    const legacy = { queues: { c: [item('a')] }, paused: ['c'] };
    const noControl = run(legacy, { c: { control: false } });
    expect(await noControl.done).toEqual(legacy);
    expect(noControl.added).toEqual([]);
    expect(noControl.settled).toEqual({});
  });
  it('drops conversations that are gone or read-only and reports what was discarded', async () => {
    const test = run({ queues: { gone: [item('a')], ro: [item('b'), item('c')] }, paused: ['ro'] }, { gone: 'gone', ro: 'readOnly' });
    expect(await test.done).toEqual({ queues: {}, paused: [] });
    expect(test.discarded).toEqual({ gone: ['a'], ro: ['b', 'c'] });
    expect(test.added).toEqual([]);
    expect(test.settled).toEqual({ gone: [], ro: [] });
  });
  it('drops the rest of a conversation the backend refuses for good', async () => {
    const test = run({ queues: { c: [item('a'), item('b')] }, paused: [] }, { c: { control: true } },
      (_id, itemId) => itemId === 'a' ? 'added' : 'discard');
    expect(await test.done).toEqual({ queues: {}, paused: [] });
    expect(test.discarded).toEqual({ c: ['b'] });
  });
  it('keeps the unsent items after a transient failure and waits for conversations not ready', async () => {
    const legacy = { queues: { c: [item('a'), item('b'), item('c')], other: [item('x')] }, paused: ['other'] };
    const test = run(legacy, { c: { control: true } }, (_id, itemId) => itemId === 'b' ? 'transient' : 'added');
    expect(await test.done).toEqual({ queues: { c: [item('b'), item('c')], other: [item('x')] }, paused: ['other'] });
    expect(test.added).toEqual(['c:a:live', 'c:b:live']);
    expect(test.settled.c).toEqual(['b', 'c']);
    expect(test.discarded).toEqual({});
  });
});
