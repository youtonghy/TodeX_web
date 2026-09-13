import { describe, expect, it } from 'vitest';
import { createConversationRuntime } from '@todex/protocol/conversationRuntime';
import { hasActiveConversationWork } from '../../src/renderer/components/conversationProgress';

const time = '2026-09-09T00:00:00Z';
const oldTime = '2026-09-08T00:00:00Z';
const runtime = () => ({ ...createConversationRuntime('c', 'w'), activeTurnId: 'turn', status: 'running' as const });
const prompt = () => ({ id: 'user', kind: 'outgoing' as const, title: 'You', subtitle: '', raw: '', at: Date.parse(time), turnId: 'turn' });
const tool = () => ({ ...prompt(), id: 'tool', kind: 'system' as const, category: 'tool' as const, phase: 'started' as const });

describe('known current-turn work', () => {
  it('recognizes silent long tools without imposing a fixed elapsed limit', () => {
    expect(hasActiveConversationWork({ ...runtime(), timeline: [tool()], lastProgressAt: oldTime })).toBe(true);
    expect(hasActiveConversationWork({ ...runtime(), timeline: [{ ...tool(), phase: 'delta' }] })).toBe(true);
  });
  it('does not mistake completed tools, old-turn tools or unstructured labels for active work', () => {
    expect(hasActiveConversationWork({ ...runtime(), timeline: [
      { ...tool(), phase: 'completed' }, { ...tool(), turnId: 'old' },
      { ...tool(), category: undefined, phase: undefined, title: '工具调用' },
    ] })).toBe(false);
  });
  it('does not retain activity after the turn reaches a terminal state', () => {
    expect(hasActiveConversationWork({ ...runtime(), status: 'completed', timeline: [tool()] })).toBe(false);
    expect(hasActiveConversationWork({ ...runtime(), activeTurnId: '', timeline: [tool()] })).toBe(false);
  });
  it('recognizes only current-turn pending permission requests', () => {
    const pending = { id: 'p', turnId: 'turn', event: {} as never, payload: {} };
    expect(hasActiveConversationWork({ ...runtime(), pendingPermissions: [pending] })).toBe(true);
    expect(hasActiveConversationWork({ ...runtime(), pendingPermissions: [{ ...pending, turnId: 'old' }] })).toBe(false);
  });
  it('recognizes current compaction but rejects leftover or unbounded compaction', () => {
    const compaction = { status: 'running' as const, updatedAt: time };
    expect(hasActiveConversationWork({ ...runtime(), timeline: [prompt()] }, compaction)).toBe(true);
    expect(hasActiveConversationWork({ ...runtime(), timeline: [prompt()] }, { ...compaction, updatedAt: oldTime })).toBe(false);
    expect(hasActiveConversationWork(runtime(), compaction)).toBe(false);
  });
  it('recognizes current subagents and excludes old, terminal or undated runs', () => {
    const agent = { id: 'agent', conversationId: 'c', title: 'Agent', task: '', status: 'running' as const, startedAt: time };
    expect(hasActiveConversationWork({ ...runtime(), timeline: [prompt()], subagents: [agent] })).toBe(true);
    expect(hasActiveConversationWork({ ...runtime(), timeline: [prompt()], subagents: [
      { ...agent, startedAt: oldTime }, { ...agent, status: 'completed' }, { ...agent, startedAt: undefined },
    ] })).toBe(false);
  });
  it('uses the earliest current-turn user message for queued follow-ups', () => {
    const agent = { id: 'agent', conversationId: 'c', title: 'Agent', task: '', status: 'running' as const, startedAt: time };
    expect(hasActiveConversationWork({ ...runtime(), timeline: [{ ...prompt(), at: Date.parse(time) + 60_000 }, prompt()], subagents: [agent] })).toBe(true);
  });
});
