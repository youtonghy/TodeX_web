import { describe, expect, it } from 'vitest';
import {
  evictIdleTerminalStates,
  TERMINAL_MAX_CACHED_TERMINALS,
  type TerminalClientState,
} from '../../src/renderer/session/helpers';

const terminal = (overrides: Partial<TerminalClientState>): TerminalClientState => ({
  terminalId: 't',
  workspaceId: 'w',
  conversationId: 'c',
  tenantId: 'tenant',
  cwd: '/w',
  shell: '',
  rows: 24,
  cols: 80,
  status: 'idle',
  error: '',
  updatedAt: 0,
  ...overrides,
});

describe('evictIdleTerminalStates', () => {
  it('keeps all records at or below the cache limit', () => {
    const current = Object.fromEntries(
      Array.from({ length: TERMINAL_MAX_CACHED_TERMINALS }, (_, i) => [`t${i}`, terminal({ terminalId: `t${i}`, updatedAt: i })]),
    );
    expect(evictIdleTerminalStates(current)).toBe(current);
  });

  it('evicts the oldest non-live records past the limit', () => {
    const current: Record<string, TerminalClientState> = {};
    for (let i = 0; i < TERMINAL_MAX_CACHED_TERMINALS + 3; i++) {
      current[`t${i}`] = terminal({ terminalId: `t${i}`, status: 'exited', updatedAt: i });
    }
    const next = evictIdleTerminalStates(current);
    expect(Object.keys(next)).toHaveLength(TERMINAL_MAX_CACHED_TERMINALS);
    expect(next.t0).toBeUndefined();
    expect(next.t1).toBeUndefined();
    expect(next.t2).toBeUndefined();
    expect(next.t3).toBeDefined();
  });

  it('never evicts live terminals even when they are the oldest', () => {
    const current: Record<string, TerminalClientState> = {
      live: terminal({ terminalId: 'live', status: 'running', updatedAt: 0 }),
    };
    for (let i = 0; i < TERMINAL_MAX_CACHED_TERMINALS + 2; i++) {
      current[`idle${i}`] = terminal({ terminalId: `idle${i}`, status: 'idle', updatedAt: i + 1 });
    }
    const next = evictIdleTerminalStates(current);
    expect(next.live).toBeDefined();
    expect(Object.keys(next)).toHaveLength(TERMINAL_MAX_CACHED_TERMINALS + 1);
    expect(next.idle0).toBeUndefined();
    expect(next.idle1).toBeUndefined();
  });

  it('treats starting and stopping as live', () => {
    const current: Record<string, TerminalClientState> = {
      starting: terminal({ terminalId: 'starting', status: 'starting', updatedAt: 0 }),
      stopping: terminal({ terminalId: 'stopping', status: 'stopping', updatedAt: 1 }),
    };
    for (let i = 0; i < TERMINAL_MAX_CACHED_TERMINALS + 1; i++) {
      current[`dead${i}`] = terminal({ terminalId: `dead${i}`, status: 'error', updatedAt: i + 2 });
    }
    const next = evictIdleTerminalStates(current);
    expect(next.starting).toBeDefined();
    expect(next.stopping).toBeDefined();
    expect(next.dead0).toBeUndefined();
    expect(Object.keys(next)).toHaveLength(TERMINAL_MAX_CACHED_TERMINALS + 2);
  });
});
