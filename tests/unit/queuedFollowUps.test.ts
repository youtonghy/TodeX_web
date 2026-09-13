import { describe, expect, it } from 'vitest';
import { QueuedFollowUps, restoreQueuedFollowUps } from '../../src/renderer/session/queuedFollowUps';

describe('local follow-up delivery', () => {
  it('only advances a live completed submission once, never historical replay', async () => {
    const queue = new QueuedFollowUps();
    const items = [{ id: 'a' }, { id: 'b' }];
    const sent: string[] = [];
    const send = async (item: { id: string }) => { sent.push(item.id); return true; };
    const remove = (id: string) => { items.splice(items.findIndex(item => item.id === id), 1); };
    await queue.settle('c', 'old', 'turn.completed', false, false, () => items[0], send, remove);
    await queue.settle('c', 't', 'turn.completed', true, true, () => items[0], send, remove);
    expect(sent).toEqual([]);
    await queue.settle('c', 't', 'turn.completed', true, false, () => items[0], send, remove);
    await queue.settle('c', 't', 'turn.completed', true, false, () => items[0], send, remove);
    expect(sent).toEqual(['a']);
    expect(items).toEqual([{ id: 'b' }]);
  });
  it('pauses on failed turns and uncertain sends until explicit resume', async () => {
    const queue = new QueuedFollowUps(); let attempts = 0;
    const next = () => ({ id: 'same-stable-id' });
    const send = async () => { attempts++; return false; };
    await queue.settle('c', 't', 'turn.failed', true, false, next, send, () => {});
    await queue.settle('c', 't2', 'turn.completed', true, false, next, send, () => {});
    expect(attempts).toBe(0);
    await queue.resume('c', next, send, () => { throw new Error('unknown send removed'); });
    expect(attempts).toBe(1); expect(queue.isPaused('c')).toBe(true);
  });
  it('serializes concurrent resume calls', async () => {
    const queue = new QueuedFollowUps(); let attempts = 0; let finish!: (ok: boolean) => void;
    const send = () => { attempts++; return new Promise<boolean>(resolve => { finish = resolve; }); };
    const first = queue.resume('c', () => ({ id: 'a' }), send, () => {});
    await queue.resume('c', () => ({ id: 'a' }), send, () => {});
    expect(attempts).toBe(1); finish(true); await first;
  });
  it('rejects malformed stored queues and bounds restored items', () => {
    expect(restoreQueuedFollowUps({ c: [null, {}, { id: 2 }] })).toEqual({});
    const item = { id: 'a', text: 'hello', attachments: [], skills: [] };
    expect(restoreQueuedFollowUps({ c: Array(40).fill(item) }).c).toHaveLength(32);
  });
});

it('advances after a queued turn finishes before its submission ACK', async () => {
  const queue = new QueuedFollowUps(); const items = [{id:'b'}, {id:'c'}]; const sent: string[] = [];
  let acknowledge!: (value: boolean) => void;
  const send = (item: {id: string}) => { sent.push(item.id); return item.id === 'b'
    ? new Promise<boolean>(resolve => { acknowledge = resolve; }) : Promise.resolve(true); };
  const remove = (id: string) => { const index = items.findIndex(item => item.id === id); if (index >= 0) items.splice(index, 1); };
  const first = queue.settle('conversation', 'a', 'turn.completed', true, false, () => items[0], send, remove);
  remove('b'); // Realtime terminal consumed B before its command waiter resolved.
  await queue.settle('conversation', 'b', 'turn.completed', true, false, () => items[0], send, remove);
  acknowledge(true); await first;
  expect(sent).toEqual(['b','c']); expect(items).toEqual([]);
});
