import { describe, expect, it } from 'vitest';
import {
  capTerminalOutput,
  evictIdleTerminalStates,
  terminalOutputLine,
  TERMINAL_MAX_CACHED_TERMINALS,
  TERMINAL_MAX_OUTPUT_BYTES,
  TERMINAL_MAX_OUTPUT_ENTRIES,
  TERMINAL_OUTPUT_SLACK_BYTES,
  type TerminalClientState,
} from '../../src/renderer/session/helpers';

const entries = (count: number, text = 'line') => (
  Array.from({ length: count }, (_, index) => terminalOutputLine('stdout', `${text}-${index}`))
);

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
  output: [],
  error: '',
  updatedAt: 0,
  ...overrides,
});

describe('capTerminalOutput', () => {
  it('keeps entries under both caps untouched', () => {
    const output = entries(10);
    expect(capTerminalOutput(output)).toEqual(output);
  });

  it('still enforces the entry-count cap', () => {
    const output = capTerminalOutput(entries(TERMINAL_MAX_OUTPUT_ENTRIES + 50));
    expect(output).toHaveLength(TERMINAL_MAX_OUTPUT_ENTRIES);
    expect(output[0].text).toBe('line-50');
  });

  it('drops the oldest entries when the byte budget is exceeded', () => {
    const big = 'x'.repeat(64 * 1024); // 64 KiB ASCII per entry
    const output = capTerminalOutput(entries(6, big));
    // 6 × 64 KiB exceeds the 256 KiB + 32 KiB slack budget; oldest entries go first.
    const bytes = output.reduce((sum, entry) => sum + entry.text.length, 0);
    expect(bytes).toBeLessThanOrEqual(TERMINAL_MAX_OUTPUT_BYTES + TERMINAL_OUTPUT_SLACK_BYTES);
    expect(output.length).toBeLessThan(6);
    expect(output[output.length - 1].text).toBe(`${big}-5`);
  });

  it('head-trims a single oversized entry at a newline boundary', () => {
    // Total exceeds 256 KiB + 32 KiB slack, so the head is trimmed by
    // ~37.9 KiB; the newline sits ~2.1 KiB past the cut point, inside the
    // 4 KiB scan window, so the cut lands just after it.
    const head = 'a'.repeat(40_000);
    const tail = 'b'.repeat(260_000);
    const output = capTerminalOutput([terminalOutputLine('stdout', `${head}\n${tail}`)]);
    expect(output).toHaveLength(1);
    expect(output[0].text).toBe(tail);
  });

  it('falls back to a hard cut when no newline is nearby', () => {
    const blob = 'x'.repeat(TERMINAL_MAX_OUTPUT_BYTES + 10 * 1024);
    const output = capTerminalOutput([terminalOutputLine('stdout', blob)]);
    expect(output).toHaveLength(1);
    expect(output[0].text.length).toBeGreaterThanOrEqual(TERMINAL_MAX_OUTPUT_BYTES);
  });

  it('counts multibyte characters against the byte budget', () => {
    const multibyte = '界'.repeat(TERMINAL_MAX_OUTPUT_BYTES); // 3 bytes each → 3× budget
    const output = capTerminalOutput([terminalOutputLine('stdout', multibyte)]);
    expect(output).toHaveLength(1);
    expect(output[0].text.length).toBeLessThan(multibyte.length);
    // The cut must not split a surrogate/code point.
    for (const char of output[0].text) expect(char).toBe('界');
  });
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
