import { describe, expect, it, vi } from 'vitest';
import { ConversationRecovery, REOPEN_GAP_EVENTS } from '../../src/renderer/session/conversationRecovery';
import { canAutoLoadEarlierHistory, capTimelinePerConversation, MAX_CONVERSATION_TIMELINE_ITEMS, mergeSequenceRanges } from '../../src/renderer/session/helpers';
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
/** A journal of `length` events whose turn 't' starts at `startAt`. */
const journal = (length: number, startAt = 1) => Array.from({ length }, (_, index) => index + 1 === startAt
  ? event(index + 1, 'turn.started', { turnId: 't' })
  : event(index + 1, 'message.delta', { turnId: 't', content: 'x' }));
/** Reverse paging over a fixed journal, like the backend's `beforeSequence`. */
const pagesBefore = (events: ConversationEvent[]) => vi.fn(async (_id: string, before: number, limit: number) => {
  const slice = events.filter((item) => item.sequence <= before).slice(-limit);
  return page(slice, (slice[0]?.sequence ?? 1) > 1);
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
    const replay = vi.fn(async () => page([hello]));
    const recovery = new ConversationRecovery(replay, () => {}, () => {});
    recovery.receive('c', 'w', [start]);
    recovery.receive('c', 'w', [world]);
    expect(recovery.get('c')?.appliedSequence).toBe(1);
    await recovery.recover('c', 'w');
    expect(replay).toHaveBeenCalledTimes(1);
    expect(recovery.get('c')?.appliedSequence).toBe(3);
  });

  it('releases a loaded conversation so the next open pages in from the tail again', async () => {
    const replayBefore = vi.fn(async () => page([hello, world], true));
    const recovery = new ConversationRecovery(async () => page([]), () => {}, () => {}, replayBefore);
    await recovery.open('c', 'w', { highWater: 3 });
    expect(recovery.release('c')).toBe(true);
    expect(recovery.get('c')).toBeUndefined();
    await recovery.open('c', 'w', { highWater: 3 });
    expect(replayBefore).toHaveBeenCalledTimes(2);
    expect(recovery.hasEarlierHistory('c')).toBe(true);
  });

  it('refuses to release a conversation while its history is loading', () => {
    const recovery = new ConversationRecovery(() => new Promise<ConversationReplay>(() => {}), () => {}, () => {});
    void recovery.recover('c', 'w');
    expect(recovery.release('c')).toBe(false);
  });

  it('treats history below the first live event of an unopened conversation as unloaded, not a gap', async () => {
    const replay = vi.fn(async () => page([]));
    const recovery = new ConversationRecovery(replay, () => {}, () => {});
    recovery.receive('c', 'w', [world]);
    await Promise.resolve();
    expect(replay).not.toHaveBeenCalled();
    expect(recovery.get('c')?.appliedSequence).toBe(3);
    expect(recovery.isRecovering('c')).toBe(false);
    expect(recovery.hasEarlierHistory('c')).toBe(true);
  });

  it('pages back to the running turn start when an unopened conversation receives a mid-turn frame', async () => {
    const replay = vi.fn(async () => page([]));
    const replayBefore = vi.fn(async () => page([start, hello]));
    const recovery = new ConversationRecovery(replay, () => {}, () => {}, replayBefore);
    recovery.receive('c', 'w', [world]);
    await vi.waitFor(() => expect(recovery.isRecovering('c')).toBe(false));
    expect(replayBefore).toHaveBeenCalledWith('c', 2, expect.any(Number));
    expect(replay).not.toHaveBeenCalled();
    expect(recovery.get('c')).toMatchObject({ appliedSequence: 3, activeTurnId: 't', status: 'running' });
  });

  it('seeds without fetching when the unopened frame settles the turn itself', async () => {
    const replayBefore = vi.fn(async () => page([start, hello]));
    const recovery = new ConversationRecovery(async () => page([]), () => {}, () => {}, replayBefore);
    recovery.receive('c', 'w', [event(4, 'turn.completed', { turnId: 't' })]);
    await Promise.resolve();
    expect(replayBefore).not.toHaveBeenCalled();
    expect(recovery.get('c')).toMatchObject({ appliedSequence: 4, activeTurnId: '' });
    expect(recovery.hasEarlierHistory('c')).toBe(true);
  });

  it('adopts a running turn whose start lies beyond the projected window', async () => {
    const events = journal(5000);
    const replayBefore = pagesBefore(events);
    const replay = vi.fn(async () => page([]));
    const recovery = new ConversationRecovery(replay, () => {}, () => {}, replayBefore);
    recovery.receive('c', 'w', [event(5001, 'message.delta', { turnId: 't', content: 'live' })]);
    await vi.waitFor(() => expect(recovery.get('c')?.activeTurnId).toBe('t'));
    expect(replay).not.toHaveBeenCalled();
    expect(recovery.isRecovering('c')).toBe(false);
    expect(recovery.get('c')).toMatchObject({ appliedSequence: 5001, status: 'running' });
    // Only the bounded window projects; the rest was searched, not loaded.
    expect(recovery.hasEarlierHistory('c')).toBe(true);
  });

  it('keeps live frames on their own floor when the turn search fails, then retries on demand', async () => {
    const errors: string[] = [];
    let offline = true;
    const events = journal(40, 10);
    const history = pagesBefore(events);
    const replayBefore = vi.fn(async (id: string, before: number, limit: number) => {
      if (offline) throw new Error('offline');
      return history(id, before, limit);
    });
    const replay = vi.fn(async () => page([]));
    const recovery = new ConversationRecovery(replay, () => {}, (message) => errors.push(message), replayBefore);
    recovery.receive('c', 'w', [event(41, 'message.delta', { turnId: 't', content: 'a' })]);
    await vi.waitFor(() => expect(errors).toEqual(['offline']));
    recovery.receive('c', 'w', [event(42, 'message.delta', { turnId: 't', content: 'b' })]);
    expect(replay).not.toHaveBeenCalled();
    expect(recovery.isRecovering('c')).toBe(false);
    expect(recovery.get('c')).toMatchObject({ appliedSequence: 42, activeTurnId: '' });
    offline = false;
    await recovery.resolveTurn('c');
    expect(recovery.get('c')).toMatchObject({ activeTurnId: 't', status: 'running' });
    const calls = replayBefore.mock.calls.length;
    await recovery.resolveTurn('c');
    expect(replayBefore).toHaveBeenCalledTimes(calls);
  });

  it('renders the window even when the search beyond it fails, and settles without a replay flag', async () => {
    const errors: string[] = [];
    const events = journal(5000);
    const history = pagesBefore(events);
    const replayBefore = vi.fn(async (id: string, before: number, limit: number) => {
      if (limit > 300) throw new Error('search failed');
      return history(id, before, limit);
    });
    const recovery = new ConversationRecovery(async () => page([]), () => {}, (message) => errors.push(message), replayBefore);
    await recovery.open('c', 'w', { highWater: 5000, turnActive: true });
    await vi.waitFor(() => expect(errors).toEqual(['search failed']));
    expect(recovery.get('c')).toMatchObject({ appliedSequence: 5000, activeTurnId: '' });
    expect(recovery.isRecovering('c')).toBe(false);
  });

  it('projects the first page of a running conversation before searching for its turn start', async () => {
    const events = journal(5000);
    const replayBefore = pagesBefore(events);
    let requestsAtFirstPaint = -1;
    const recovery = new ConversationRecovery(async () => page([]), (state) => {
      if (requestsAtFirstPaint < 0 && state.timeline.length) requestsAtFirstPaint = replayBefore.mock.calls.length;
    }, () => {}, replayBefore);
    await recovery.open('c', 'w', { highWater: 5000, turnActive: true });
    expect(requestsAtFirstPaint).toBe(1);
    expect(recovery.hasEarlierHistory('c')).toBe(true);
    // The running turn is still adopted, by the search that follows.
    await vi.waitFor(() => expect(recovery.get('c')).toMatchObject({ activeTurnId: 't', status: 'running' }));
    expect(recovery.get('c')?.appliedSequence).toBe(5000);
  });

  it('reports an open as opening, then failed, and settles it on a successful retry', async () => {
    const statuses: (string | undefined)[] = [];
    let offline = true;
    const history = pagesBefore([start, hello, world]);
    const replayBefore = vi.fn(async (id: string, before: number, limit: number) => {
      if (offline) throw new Error('offline');
      return history(id, before, limit);
    });
    const errors: string[] = [];
    const recovery = new ConversationRecovery(async () => page([]), () => {}, (message) => errors.push(message), replayBefore,
      (_id, status) => statuses.push(status));
    const opening = recovery.open('c', 'w', { highWater: 3 });
    expect(recovery.openStatus('c')).toBe('opening');
    await opening;
    expect(recovery.get('c')).toBeUndefined();
    expect(recovery.openStatus('c')).toBe('failed');
    expect(errors).toEqual(['offline']);
    offline = false;
    await recovery.open('c', 'w', { highWater: 3 });
    expect(recovery.openStatus('c')).toBeUndefined();
    expect(recovery.get('c')?.timeline.map((item) => item.subtitle)).toEqual(['Hello world']);
    expect(statuses).toEqual(['opening', 'failed', 'opening', undefined]);
  });

  it('closes a gap between buffered frames after the window failed', async () => {
    const replayBefore = vi.fn(async (): Promise<ConversationReplay> => { throw new Error('offline'); });
    const replay = vi.fn(async () => page([event(42, 'message.delta', { turnId: 't', content: 'b' })]));
    const recovery = new ConversationRecovery(replay, () => {}, () => {}, replayBefore);
    recovery.receive('c', 'w', [event(41, 'message.delta', { turnId: 't', content: 'a' })]);
    recovery.receive('c', 'w', [event(43, 'turn.completed', { turnId: 't' })]);
    await vi.waitFor(() => expect(recovery.get('c')?.appliedSequence).toBe(43));
    expect(replay).toHaveBeenCalledWith('c', 41, expect.any(Number));
    expect(recovery.get('c')?.status).toBe('completed');
  });

  it('reports realtime frames that land during a history window as live', async () => {
    const updates: { applied: number[]; recovering: boolean; live: number[] }[] = [];
    let deliver!: (value: ConversationReplay) => void;
    const replayBefore = vi.fn(() => new Promise<ConversationReplay>((resolve) => { deliver = resolve; }));
    const recovery = new ConversationRecovery(async () => page([]), (_state, applied, recovering, live) => {
      updates.push({ applied: applied.map((item) => item.sequence), recovering, live: [...live] });
    }, () => {}, replayBefore);
    recovery.receive('c', 'w', [world]);
    await vi.waitFor(() => expect(replayBefore).toHaveBeenCalled());
    recovery.receive('c', 'w', [event(4, 'turn.completed', { turnId: 't' })]);
    deliver(page([start, hello]));
    await vi.waitFor(() => expect(recovery.isRecovering('c')).toBe(false));
    const applied = updates.find((update) => update.applied.length);
    expect(applied).toEqual({ applied: [1, 2, 3, 4], recovering: true, live: [3, 4] });
    expect(recovery.get('c')).toMatchObject({ activeTurnId: '', status: 'completed' });
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

  it('hydrates a folded reasoning row from every summary stub it merged', () => {
    const reasoning = (sequence: number, thinking?: string) => event(sequence, 'provider.event', {
      turnId: 't', ...(thinking === undefined ? { detailStub: true } : { thinking }),
      block: { id: 'r', category: 'reasoning', phase: 'delta', turnId: 't' },
    });
    const journalEvents = [start, reasoning(2, 'r2 '), reasoning(3, 'r3 '), reasoning(4, 'r4 ')];
    const recovery = new ConversationRecovery(async () => page([]), () => {}, () => {});
    recovery.receive('c', 'w', [start, reasoning(2), reasoning(3), reasoning(4)]);
    const stub = recovery.get('c')?.timeline.find((item) => item.detailStub);
    expect(stub).toMatchObject({ firstSequence: 2, sequence: 4 });
    const [[from, to]] = mergeSequenceRanges([[stub!.firstSequence!, stub!.sequence!]]);
    expect(recovery.hydrate('c', 'w', journalEvents.filter((item) => item.sequence >= from && item.sequence <= to))).toBe(true);
    const row = recovery.get('c')?.timeline.find((item) => item.category === 'reasoning');
    expect(row?.detailStub).toBeUndefined();
    expect(row?.subtitle).toBe('r2 r3 r4 ');
  });

  it('stops paging earlier history once a conversation holds the row cap', async () => {
    const rows = Array.from({ length: MAX_CONVERSATION_TIMELINE_ITEMS + 10 }, (_, index) =>
      event(index + 1, 'message.delta', { turnId: `t${index + 1}`, content: 'x' }));
    const replayBefore = pagesBefore(rows);
    const recovery = new ConversationRecovery(async () => page([]), () => {}, () => {}, replayBefore);
    await recovery.open('c', 'w', { highWater: rows.length, pageLimit: MAX_CONVERSATION_TIMELINE_ITEMS });
    expect(recovery.get('c')?.timeline).toHaveLength(MAX_CONVERSATION_TIMELINE_ITEMS);
    await expect(recovery.loadEarlier('c', 'w')).resolves.toEqual({ hasMore: true, capped: true });
    expect(replayBefore).toHaveBeenCalledTimes(1);
    expect(canAutoLoadEarlierHistory({ hasMore: true, loading: false, capped: true })).toBe(false);
  });

  it('keeps the active conversation rows while a background conversation streams past the cap', () => {
    const row = (conversationId: string, index: number) => ({ id: `${conversationId}-${index}`, conversationId });
    let timeline = capTimelinePerConversation(Array.from({ length: 100 }, (_, index) => row('active', 99 - index)));
    let background: ReturnType<typeof row>[] = [];
    for (let batch = 0; batch < 60; batch++) {
      // Each runtime update replaces the background rows with its newest-first projection.
      background = [...Array.from({ length: 100 }, (_, index) => row('bg', batch * 100 + 99 - index)), ...background];
      const others = timeline.filter((entry) => entry.conversationId !== 'bg');
      timeline = capTimelinePerConversation([...background, ...others]);
    }
    expect(timeline.filter((entry) => entry.conversationId === 'active')).toHaveLength(100);
    const kept = timeline.filter((entry) => entry.conversationId === 'bg');
    expect(kept).toHaveLength(MAX_CONVERSATION_TIMELINE_ITEMS);
    expect(kept[0].id).toBe('bg-5999');
    expect(kept.at(-1)?.id).toBe(`bg-${6000 - MAX_CONVERSATION_TIMELINE_ITEMS}`);
  });

  /** Settled turns of 100 events each; `open` leaves turn 't<n>' running. */
  const settledJournal = (length: number, open?: number) => Array.from({ length }, (_, index) => {
    const sequence = index + 1;
    const turnId = `t${Math.floor(index / 100)}`;
    if (sequence % 100 === 1) return event(sequence, 'turn.started', { turnId });
    if (sequence % 100 === 0 && Math.floor(index / 100) !== open) return event(sequence, 'turn.completed', { turnId });
    return event(sequence, 'message.delta', { turnId, content: 'x' });
  });
  const forwardPages = (events: ConversationEvent[]) => vi.fn(async (_id: string, after: number, limit: number) => {
    const slice = events.filter((item) => item.sequence > after).slice(0, limit);
    return page(slice, (slice.at(-1)?.sequence ?? after) < events.length);
  });

  it('reopens an idle lazy conversation from the tail instead of replaying a long gap', async () => {
    const events = settledJournal(1000 + REOPEN_GAP_EVENTS + 1000);
    const replay = forwardPages(events);
    const replayBefore = pagesBefore(events);
    const recovery = new ConversationRecovery(replay, () => {}, () => {}, replayBefore);
    await recovery.open('c', 'w', { highWater: 1000 });
    expect(recovery.get('c')?.appliedSequence).toBe(1000);
    // A live frame far past the cursor reveals the gap.
    recovery.receive('c', 'w', [events.at(-1)!]);
    await recovery.recover('c', 'w');
    expect(replay).not.toHaveBeenCalled();
    expect(replayBefore.mock.calls.map(([, before]) => before)).toEqual([1000, events.length]);
    const state = recovery.get('c')!;
    expect(state.appliedSequence).toBe(events.length);
    expect(state.timeline.every((entry) => (entry.sequence ?? 0) > events.length - 300)).toBe(true);
    expect(recovery.hasEarlierHistory('c')).toBe(true);
    expect(recovery.isRecovering('c')).toBe(false);
  });

  it('adopts a turn that started inside the skipped gap', async () => {
    // Turn t35 starts at 3501 and is still running at the tail (3900).
    const events = settledJournal(3900, 35).map((item) => item.sequence > 3501 && item.type !== 'message.delta'
      ? event(item.sequence, 'message.delta', { turnId: 't35', content: 'x' }) : item);
    const replayBefore = pagesBefore(events);
    const recovery = new ConversationRecovery(forwardPages(events), () => {}, () => {}, replayBefore);
    await recovery.open('c', 'w', { highWater: 1000 });
    await recovery.recover('c', 'w', events.length);
    await vi.waitFor(() => expect(recovery.get('c')?.activeTurnId).toBe('t35'));
    expect(recovery.get('c')?.status).toBe('running');
  });

  it('replays a long gap forward while a turn runs or the consumer has pending work', async () => {
    const events = settledJournal(1000 + REOPEN_GAP_EVENTS + 1000);
    let pending = true;
    const replay = forwardPages(events);
    const replayBefore = pagesBefore(events);
    const recovery = new ConversationRecovery(replay, () => {}, () => {}, replayBefore, undefined, () => pending);
    await recovery.open('c', 'w', { highWater: 1000 });
    await recovery.recover('c', 'w', events.length);
    expect(replayBefore).toHaveBeenCalledTimes(1);
    expect(replay).toHaveBeenCalled();
    expect(recovery.get('c')?.appliedSequence).toBe(events.length);

    // A running turn keeps its projection too.
    pending = false;
    const running = settledJournal(1000 + REOPEN_GAP_EVENTS + 1000, 9);
    const replayRunning = forwardPages(running);
    const busy = new ConversationRecovery(replayRunning, () => {}, () => {}, pagesBefore(running));
    await busy.open('c', 'w', { highWater: 950 });
    expect(busy.get('c')?.activeTurnId).toBe('t9');
    await busy.recover('c', 'w', running.length);
    expect(replayRunning).toHaveBeenCalled();
  });

  it('merges folded row ranges so each event is fetched once', () => {
    expect(mergeSequenceRanges([[7, 9], [2, 4], [3, 5], [6, 6], [12, 12], [0, 3], [5, 1]]))
      .toEqual([[2, 9], [12, 12]]);
  });

});
