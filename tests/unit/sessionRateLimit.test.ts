import { describe, expect, it } from 'vitest';
import { backendRateLimitState } from '../../src/renderer/session/sessionRateLimit';

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
