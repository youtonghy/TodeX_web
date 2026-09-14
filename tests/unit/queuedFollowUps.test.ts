import { describe, expect, it } from 'vitest';
import { QueuedFollowUps, restoreQueuedFollowUps } from '../../src/renderer/session/queuedFollowUps';

describe('local follow-up delivery', () => {
  it('advances on a completed turn once, never during historical replay', async () => {
    const queue = new QueuedFollowUps();
    const items = [{ id: 'a' }, { id: 'b' }];
    const sent: string[] = [];
    const send = async (item: { id: string }) => { sent.push(item.id); return true; };
    const remove = (id: string) => { items.splice(items.findIndex(item => item.id === id), 1); };
    await queue.settle('c', 't', 'turn.completed', true, () => items[0], send, remove);
    expect(sent).toEqual([]);
    await queue.settle('c', 't', 'turn.completed', false, () => items[0], send, remove);
    await queue.settle('c', 't', 'turn.completed', false, () => items[0], send, remove);
    expect(sent).toEqual(['a']);
    expect(items).toEqual([{ id: 'b' }]);
  });
  it('pauses only on abnormal turn end; failed sends stay queued and retryable', async () => {
    const queue = new QueuedFollowUps(); let attempts = 0;
    const items = [{ id: 'a' }];
    const next = () => items[0];
    const send = async () => { attempts++; return false; };
    const remove = () => { items.splice(0, 1); };
    // A failed send does not pause: the item stays queued for the next trigger.
    await queue.settle('c', 't1', 'turn.completed', false, next, send, remove);
    expect(attempts).toBe(1);
    expect(queue.isPaused('c')).toBe(false);
    // An abnormal terminal pauses until explicit resume.
    await queue.settle('c', 't2', 'turn.failed', false, next, send, remove);
    expect(queue.isPaused('c')).toBe(true);
    await queue.settle('c', 't3', 'turn.completed', false, next, send, remove);
    expect(attempts).toBe(1);
    await queue.resume('c', next, send, remove);
    expect(attempts).toBe(2);
    expect(queue.isPaused('c')).toBe(false);
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
  const first = queue.settle('conversation', 'a', 'turn.completed', false, () => items[0], send, remove);
  remove('b'); // Realtime terminal consumed B before its command waiter resolved.
  await queue.settle('conversation', 'b', 'turn.completed', false, () => items[0], send, remove);
  acknowledge(true); await first;
  expect(sent).toEqual(['b','c']); expect(items).toEqual([]);
});
