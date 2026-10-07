import { describe, expect, it } from 'vitest';
import { backendRateLimitState, parseSessionLimitReset, restoreRateLimitWaits } from '../../src/renderer/session/sessionRateLimit';

const CLAUDE_LIMIT = "provider unavailable: You've hit your session limit · resets 11:30pm (Australia/Perth)";

function wallClock(instant: number, timeZone: string) {
  const parts: Record<string, number> = { hour: 0, minute: 0, day: 0 };
  const format = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  for (const part of format.formatToParts(new Date(instant))) {
    if (part.type in parts) parts[part.type] = Number.parseInt(part.value, 10) || 0;
  }
  return parts;
}

describe('parseSessionLimitReset', () => {
  const now = Date.UTC(2026, 9, 1, 10, 0, 0); // 2026-10-01 10:00 UTC, 18:00 Perth

  it('resolves the reported reset time in the reported IANA zone', () => {
    const parsed = parseSessionLimitReset(CLAUDE_LIMIT, now);
    expect(parsed).not.toBeNull();
    expect(parsed!.label).toBe('11:30pm (Australia/Perth)');
    expect(parsed!.until).toBeGreaterThan(now);
    // 23:30 the same day in Perth (UTC+8) is 15:30 UTC — under 6h ahead.
    expect(parsed!.until).toBe(Date.UTC(2026, 9, 1, 15, 30, 0));
    const wall = wallClock(parsed!.until, 'Australia/Perth');
    expect([wall.hour, wall.minute]).toEqual([23, 30]);
  });

  it('rolls over to the next day when the reset time already passed', () => {
    const late = Date.UTC(2026, 9, 1, 16, 0, 0); // 00:00 next day in Perth
    const parsed = parseSessionLimitReset(CLAUDE_LIMIT, late);
    expect(parsed).not.toBeNull();
    expect(parsed!.until).toBe(Date.UTC(2026, 9, 2, 15, 30, 0));
  });

  it('tolerates "reset at" phrasing and a missing zone by using local time', () => {
    const localZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parsed = parseSessionLimitReset("You've hit your session limit, reset at 8pm", now);
    expect(parsed).not.toBeNull();
    expect(parsed!.label).toBe('8pm');
    const wall = wallClock(parsed!.until, localZone);
    expect([wall.hour, wall.minute]).toEqual([20, 0]);
  });

  it('ignores messages that are not provider session limits', () => {
    expect(parseSessionLimitReset('provider unavailable: rate limit exceeded', now)).toBeNull();
    expect(parseSessionLimitReset('provider unavailable: OpenCode resident session limit reached (32); close an idle session', now)).toBeNull();
    expect(parseSessionLimitReset('some other error', now)).toBeNull();
  });

  it('fails closed on a timezone the runtime cannot resolve', () => {
    expect(parseSessionLimitReset("You've hit your session limit · resets 11:30pm (Not/AZone)", now)).toBeNull();
  });

  it('rejects out-of-range clock values', () => {
    expect(parseSessionLimitReset("You've hit your session limit · resets 13:40pm", now)).toBeNull();
  });
});

describe('restoreRateLimitWaits', () => {
  const now = Date.UTC(2026, 9, 1, 10, 0, 0);

  it('keeps future waits and drops expired or malformed entries', () => {
    const restored = restoreRateLimitWaits({
      good: { until: now + 1000, label: '11:30pm (Australia/Perth)' },
      expired: { until: now - 1, label: '8pm' },
      badUntil: { until: 'soon', label: '8pm' },
      badLabel: { until: now + 1000, label: 42 },
      junk: null,
    }, now);
    expect(restored).toEqual({ good: { until: now + 1000, label: '11:30pm (Australia/Perth)' } });
  });

  it('returns an empty map for non-object payloads', () => {
    expect(restoreRateLimitWaits(null, now)).toEqual({});
    expect(restoreRateLimitWaits([], now)).toEqual({});
    expect(restoreRateLimitWaits('nope', now)).toEqual({});
  });
});

describe('backendRateLimitState', () => {
  const item = (id: string) => ({ id, text: 'x', status: 'queued', queuedAt: '', contentCount: 0, skills: [] });
  const queue = (overrides: object) => ({ items: [], paused: false, pauseReason: '', pauseMessage: '', resumeAt: '', ...overrides });

  it('reads the wait and the continuation from the queue snapshot only', () => {
    expect(backendRateLimitState(queue({ paused: true, pauseReason: 'rate_limited', resumeAt: '2026-10-08T05:00:00Z',
      items: [item('rate-limit-continue-t1'), item('queued-2')] }))).toEqual({
      waiting: true, resumeAt: Date.parse('2026-10-08T05:00:00Z'), continues: true });
  });

  it('keeps another pause reason but still sees the continuation at the head', () => {
    const state = backendRateLimitState(queue({ paused: true, pauseReason: 'turn_cancelled', items: [item('rate-limit-continue-t1')] }));
    expect(state.waiting).toBe(false);
    expect(state.continues).toBe(true);
  });

  it('reports nothing for an ordinary pause, a continuation behind other items, or no snapshot', () => {
    expect(backendRateLimitState(queue({ paused: true, pauseReason: 'turn_failed', items: [item('a'), item('rate-limit-continue-t1')] })))
      .toMatchObject({ waiting: false, continues: false });
    expect(backendRateLimitState(undefined)).toMatchObject({ waiting: false, continues: false });
    expect(backendRateLimitState(queue({ paused: true, pauseReason: 'rate_limited', resumeAt: 'later' })).resumeAt).toBeNaN();
  });
});
