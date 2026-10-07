import { describe, expect, it } from 'vitest';
import { isChatTimelineEntry, isChatToolEntry } from '../../src/renderer/components/conversationTimeline';
import { classifyV2ConversationEvent } from '@todex/protocol/mobileParity';

const base = { schemaVersion: 1, eventId: 'e', conversationId: 'c', sequence: 1, time: '2026-09-06T00:00:00Z' };

describe('semantic chat rendering', () => {
  it('keeps canonical and legacy failed turns visible after replay', () => {
    const error = classifyV2ConversationEvent({ ...base, type: 'turn.failed', payload: { turnId: 't', message: 'Provider failed' } }, 'w')!;
    expect(isChatTimelineEntry(error)).toBe(true);
    const semantic = { ...error, category: 'error' as const, title: '运行异常' };
    expect(isChatTimelineEntry(semantic)).toBe(true);
  });
  it('recognizes semantic MCP tools without guessing JSON property names', () => {
    const tool = classifyV2ConversationEvent({ ...base, type: 'tool.completed', payload: {
      item: { type: 'mcpToolCall', server: 'example', name: 'lookup', result: { found: true } },
      block: { id: 'tool', turnId: 't', category: 'tool', phase: 'completed' },
    } }, 'w')!;
    expect(isChatTimelineEntry(tool)).toBe(true);
    expect(isChatToolEntry(tool)).toBe(true);
    expect(isChatToolEntry({ ...tool, category: 'error' })).toBe(false);
  });
});

import { activeChatProcessId, buildChatRenderItems } from '../../src/renderer/components/conversationTimeline';
import type { TimelineEntry } from '@todex/protocol/mobileParity';

const entry = (id: string, kind: TimelineEntry['kind'], turnId?: string, category?: TimelineEntry['category']): TimelineEntry => ({
  id, kind, turnId, category, title: id, subtitle: id, raw: '', at: 1, conversationId: 'c',
});
const prompt = (id: string, turnId?: string) => entry(id, 'outgoing', turnId);
const step = (id: string, turnId?: string, category: TimelineEntry['category'] = 'tool') => entry(id, 'system', turnId, category);

describe('turn-based process layout', () => {
  it('omits unattributed startup statuses above the first prompt', () => {
    const items = buildChatRenderItems([step('setup', undefined, 'status'), prompt('u', 't'), step('tool', 't')]);
    expect(items.map(item => item.type)).toEqual(['entry', 'executionGroup']);
    expect(items[0]).toMatchObject({ entry: { id: 'u' } });
    expect(items[1]).toMatchObject({ entries: [{ id: 'tool' }] });
  });
  it('puts a single stable trace after its prompt even when status arrives first', () => {
    const items = buildChatRenderItems([step('status', 't', 'status'), prompt('u', 't'), step('tool', 't')]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ entry: { id: 'u' } });
    expect(items[1]).toMatchObject({ entries: [{ id: 'status' }, { id: 'tool' }], userMessageId: 'u' });
  });
  it('keeps assistant progress narration visible instead of folded into the trace', () => {
    const items = buildChatRenderItems([prompt('u', 't'), step('toolA', 't'), step('note', 't', 'assistant_progress'), step('toolB', 't')]);
    expect(items.map(item => item.type)).toEqual(['entry', 'executionGroup', 'entry', 'executionGroup']);
    expect(items[1]).toMatchObject({ entries: [{ id: 'toolA' }] });
    expect(items[2]).toMatchObject({ entry: { id: 'note' } });
    expect(items[3]).toMatchObject({ entries: [{ id: 'toolB' }] });
  });
  it('interleaves progress folds with the text they separate', () => {
    const items = buildChatRenderItems([prompt('u', 't'), step('one', 't'), entry('answer', 'incoming', 't'),
      step('failure', 't', 'error'), step('two', 't')]);
    expect(items.map(item => item.type)).toEqual(['entry', 'executionGroup', 'entry', 'entry', 'executionGroup']);
    expect(items[1]).toMatchObject({ entries: [{ id: 'one' }] });
    expect(items[3]).toMatchObject({ entry: { id: 'failure' } });
    expect(items[4]).toMatchObject({ entries: [{ id: 'two' }] });
  });
  it('splits narration into segments around step runs', () => {
    const items = buildChatRenderItems([prompt('u', 't'), entry('seg-a', 'incoming', 't'),
      step('tool', 't'), entry('seg-b', 'incoming', 't'), step('thought', 't', 'reasoning'),
      entry('seg-c', 'incoming', 't')]);
    expect(items.map(item => item.type)).toEqual(
      ['entry', 'entry', 'executionGroup', 'entry', 'executionGroup', 'entry']);
    expect(items[2]).toMatchObject({ entries: [{ id: 'tool' }] });
    expect(items[4]).toMatchObject({ entries: [{ id: 'thought' }] });
  });
  it('keeps different turns separate and does not animate an old turn for a new prompt', () => {
    const items = buildChatRenderItems([prompt('u1', 't1'), step('one', 't1'), entry('answer', 'incoming', 't1'), prompt('u2', 't2')]);
    expect(activeChatProcessId(items, 't2')).toBe('');
    expect(activeChatProcessId(items, 't1')).toBe('');
    const updated = buildChatRenderItems([prompt('u1', 't1'), step('one', 't1'), prompt('u2', 't2'), step('two', 't2')]);
    const groups = updated.filter(item => item.type === 'executionGroup');
    expect(new Set(groups.map(item => item.id)).size).toBe(2);
    expect(activeChatProcessId(updated, 't2')).toBe(groups[1].id);
  });
  it('stops marking a group live once the agent replies after it', () => {
    const items = buildChatRenderItems([prompt('u', 't'), step('one', 't'), entry('narration', 'incoming', 't'),
      step('bg', 't'), entry('waiting', 'incoming', 't')]);
    expect(activeChatProcessId(items, 't')).toBe('');
    const live = buildChatRenderItems([prompt('u', 't'), step('one', 't'), entry('narration', 'incoming', 't'), step('bg', 't')]);
    expect(activeChatProcessId(live, 't')).toBe(live[3].id);
  });
  it('preserves orphan tool and approval records when history has no prompt', () => {
    const items = buildChatRenderItems([step('tool', 'old'), step('approval', 'old', 'approval'), prompt('new', 'new')]);
    expect(items[0]).toMatchObject({ entries: [{ id: 'tool' }, { id: 'approval' }] });
    expect(activeChatProcessId(items, 'new')).toBe('');
  });
  it('groups legacy entries within their own user-message window', () => {
    const items = buildChatRenderItems([prompt('u1'), step('one'), entry('answer', 'incoming'), step('two'), prompt('u2'), step('three')]);
    const groups = items.filter(item => item.type === 'executionGroup');
    expect(groups).toHaveLength(3);
    expect(groups[0].entries.map(item => item.id)).toEqual(['one']);
    expect(groups[1].entries.map(item => item.id)).toEqual(['two']);
    expect(groups[2].entries.map(item => item.id)).toEqual(['three']);
    expect(activeChatProcessId(items)).toBe(groups[2].id);
  });
});


it('keeps turn identity when a progress event omits its turn ID', () => {
  const items = buildChatRenderItems([prompt('u', 't'), step('unattributed'), step('tool', 't')]);
  expect(items).toHaveLength(2);
  expect(items[1]).toMatchObject({ turnId: 't', entries: [{ id: 'unattributed' }, { id: 'tool' }] });
  expect(activeChatProcessId(items, 't')).toBe(items[1].type === 'executionGroup' ? items[1].id : '');
});

import { compareChatEntries, sameTimelineEntries, sortChatEntries } from '../../src/renderer/components/conversationTimeline';

describe('chat row order', () => {
  const row = (id: string, sequence: number | undefined, at: number): TimelineEntry => ({ ...entry(id, 'incoming'), sequence, at });
  // The order ChatPanel produced before it skipped sorted input.
  const previousOrder = (rows: TimelineEntry[]) => rows.slice().sort((left, right) => {
    if (left.sequence !== undefined && right.sequence !== undefined && left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }
    if (left.at !== right.at) return left.at - right.at;
    return left.id.localeCompare(right.id);
  });

  it('returns rows already in display order as they are', () => {
    const rows = [row('a', 1, 5), row('b', 2, 1), row('c', undefined, 3), row('d', 4, 9)];
    expect(sortChatEntries(rows)).toBe(rows);
  });

  it('orders like the previous sort for any input', () => {
    let seed = 7;
    const random = (limit: number) => { seed = (seed * 48271) % 2147483647; return seed % limit; };
    for (let round = 0; round < 200; round += 1) {
      const rows = Array.from({ length: 1 + random(12) }, (_, index) =>
        row(`r${random(5)}-${index}`, random(4) === 0 ? undefined : random(6), random(4)));
      expect(sortChatEntries(rows).map(item => item.id)).toEqual(previousOrder(rows).map(item => item.id));
    }
    expect(compareChatEntries(row('a', 1, 9), row('b', 2, 1))).toBeLessThan(0);
  });

  it('treats the same row objects as the same list', () => {
    const rows = [row('a', 1, 1), row('b', 2, 2)];
    expect(sameTimelineEntries(rows, [...rows])).toBe(true);
    expect(sameTimelineEntries(rows, [rows[0], { ...rows[1] }])).toBe(false);
    expect(sameTimelineEntries(rows, rows.slice(0, 1))).toBe(false);
  });
});
