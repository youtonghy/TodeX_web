import { describe, expect, it } from 'vitest';
import { GIT_LOG_FIRST_READ, nextCommitReveal, shouldPrefetchCommits } from '../../src/renderer/session/gitLogPaging';

describe('git log paging', () => {
  it('keeps one page ahead of the latest commit on the first read', () => {
    expect(GIT_LOG_FIRST_READ).toBe(6);
    expect(nextCommitReveal(6, 1, true)).toEqual({ count: 5 });
    expect(shouldPrefetchCommits(6, 1, true)).toBe(false);
  });

  it('names exactly what is left of a short history', () => {
    expect(nextCommitReveal(3, 1, false)).toEqual({ count: 2 });
    expect(nextCommitReveal(3, 3, false)).toBeNull();
    expect(nextCommitReveal(1, 1, false)).toBeNull();
    expect(shouldPrefetchCommits(3, 3, false)).toBe(false);
  });

  it('fetches the next page after an expand before a count is shown', () => {
    expect(shouldPrefetchCommits(6, 6, true)).toBe(true);
    expect(nextCommitReveal(6, 6, true)).toEqual({});
    expect(nextCommitReveal(11, 6, true)).toEqual({ count: 5 });
    expect(shouldPrefetchCommits(11, 6, true)).toBe(false);
  });

  it('clamps a shown count past the loaded items', () => {
    expect(nextCommitReveal(8, 11, false)).toBeNull();
    expect(nextCommitReveal(8, 11, true)).toEqual({});
  });
});
