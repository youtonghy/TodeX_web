import { describe, expect, it, vi } from 'vitest';
import { ConversationRecovery } from '../../src/renderer/session/conversationRecovery';
import type { ConversationEvent, ConversationReplay } from '@todex/protocol/v2';

function event(sequence: number, type: string, payload: Record<string, unknown>): ConversationEvent {
  return { schemaVersion: 1, conversationId: 'c', eventId: `e${sequence}`, sequence, type, time: '2026-09-06T00:00:00Z', payload };
}
const start = event(1, 'turn.started', { turnId: 't' });
const hello = event(2, 'message.delta', { turnId: 't', content: 'Hello ' });
const world = event(3, 'message.delta', { turnId: 't', content: 'world' });
const page = (events: ConversationEvent[], hasMore = false): ConversationReplay => ({
  conversationId: 'c', fromSequence: 0, nextSequence: events.at(-1)?.sequence ?? 0, events, hasMore,
});

describe('shared conversation recovery', () => {
  it('does not commit a cursor when the consumer throws', () => {
    const update = vi.fn().mockImplementationOnce(() => { throw new Error('projection failed'); });
    const recovery = new ConversationRecovery(async () => page([]), update, () => {});
    expect(() => recovery.receive('c', 'w', [start])).toThrow('projection failed');
    expect(recovery.get('c')).toBeUndefined();
    recovery.receive('c', 'w', [start]);
    expect(recovery.get('c')?.appliedSequence).toBe(1);
  });

  it('merges late history with newer live deltas without overwriting or duplicating', async () => {
    let deliver!: (value: ConversationReplay) => void;
    const replay = vi.fn(() => new Promise<ConversationReplay>((resolve) => { deliver = resolve; }));
    const recovery = new ConversationRecovery(replay, () => {}, () => {});
    recovery.receive('c', 'w', [start]);
    const work = recovery.recover('c', 'w');
    await Promise.resolve();
    recovery.receive('c', 'w', [hello, world, world]);
    deliver(page([start, hello]));
    await work;
    expect(recovery.get('c')?.appliedSequence).toBe(3);
    expect(recovery.get('c')?.timeline.map((item) => item.subtitle)).toEqual(['Hello world']);
  });

  it('buffers a higher sequence and recovers a gap with one in-flight request', async () => {
    const replay = vi.fn(async () => page([start, hello]));
    const recovery = new ConversationRecovery(replay, () => {}, () => {});
    recovery.receive('c', 'w', [world]);
    expect(recovery.get('c')?.appliedSequence).toBe(0);
    await recovery.recover('c', 'w');
    expect(replay).toHaveBeenCalledTimes(1);
    expect(recovery.get('c')?.appliedSequence).toBe(3);
  });

  it('does not expose an already resolved historical approval as a live action', async () => {
    const states: { recovering: boolean; permissions: number }[] = [];
    const requested = event(2, 'permission.requested', { turnId: 't', permissionId: 'p' });
    const resolved = event(3, 'permission.resolved', { permissionId: 'p' });
    const replay = vi.fn().mockResolvedValueOnce(page([start, requested], true)).mockResolvedValueOnce(page([resolved]));
    const recovery = new ConversationRecovery(replay, (state, _, recovering) => {
      states.push({ recovering, permissions: state.pendingPermissions.length });
    }, () => {});
    await recovery.recover('c', 'w');
    expect(states.some((state) => !state.recovering && state.permissions > 0)).toBe(false);
  });

  it('ignores responses from a previous backend after reset', async () => {
    let deliver!: (value: ConversationReplay) => void;
    const update = vi.fn();
    const recovery = new ConversationRecovery(() => new Promise((resolve) => { deliver = resolve; }), update, () => {});
    const work = recovery.recover('c', 'w');
    await Promise.resolve();
    recovery.reset();
    deliver(page([start]));
    await work;
    expect(recovery.get('c')).toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });
  it('keeps partial approval history hidden after replay fails, until a complete recovery', async () => {
    const states: boolean[] = [];
    const replay = vi.fn().mockResolvedValueOnce(page([start, event(2, 'permission.requested', { permissionId: 'p' })], true))
      .mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page([event(3, 'permission.resolved', { permissionId: 'p' })]));
    const recovery = new ConversationRecovery(replay, (_, __, recovering) => states.push(recovering), () => {});
    await recovery.recover('c', 'w');
    expect(recovery.isRecovering('c')).toBe(true);
    expect(states.every(Boolean)).toBe(true);
    await recovery.recover('c', 'w');
    expect(recovery.isRecovering('c')).toBe(false);
    expect(recovery.get('c')?.pendingPermissions).toHaveLength(0);
  });

  it('refuses to hydrate a conversation without a committed runtime', () => {
    const update = vi.fn();
    const recovery = new ConversationRecovery(async () => page([]), update, () => {});
    const full = event(2, 'provider.event', {
      turnId: 't', toolCallId: 'b',
      block: { id: 'b', category: 'tool', phase: 'completed', turnId: 't' },
    });
    expect(recovery.hydrate('missing', 'w', [full])).toBe(false);
    expect(recovery.get('missing')).toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });

  it('hydrates folded stub entries into the committed runtime', () => {
    const stub = event(2, 'provider.event', {
      turnId: 't', detailStub: true, toolCallId: 'b',
      block: { id: 'b', category: 'tool', phase: 'completed', turnId: 't' },
    });
    const update = vi.fn();
    const recovery = new ConversationRecovery(async () => page([]), update, () => {});
    recovery.receive('c', 'w', [start, stub]);
    expect(recovery.get('c')?.timeline.some((entry) => entry.detailStub)).toBe(true);
    const full = event(2, 'provider.event', {
      turnId: 't', toolCallId: 'b', result: 'ok',
      block: { id: 'b', category: 'tool', phase: 'completed', turnId: 't' },
    });
    expect(recovery.hydrate('c', 'w', [full])).toBe(true);
    const entry = recovery.get('c')?.timeline.find((item) => item.category === 'tool');
    expect(entry?.detailStub).toBeUndefined();
    expect(entry?.subtitle).toContain('ok');
    expect(update).toHaveBeenCalled();
  });

});
