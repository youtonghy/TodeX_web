import { describe, expect, it } from 'vitest';
import { isGitDiffPathRequired } from '../../src/renderer/lib/gitErrors';

describe('isGitDiffPathRequired', () => {
  it('recognises an old backend rejecting the whole-repo diff', () => {
    // Axum query rejection: plain text body, so no code and a generic message.
    expect(isGitDiffPathRequired({ status: 400 })).toBe(true);
    expect(isGitDiffPathRequired({ status: 400, code: 'INVALID_REQUEST', message: 'path is required' })).toBe(true);
    expect(isGitDiffPathRequired({ status: 422, message: 'Failed to deserialize query string: missing field `path`' })).toBe(true);
  });

  it('does not mistake other diff failures for an old backend', () => {
    expect(isGitDiffPathRequired({ status: 404, code: 'NOT_FOUND' })).toBe(false);
    expect(isGitDiffPathRequired({ status: 400, code: 'WORKSPACE_PATH_NOT_FOUND', message: 'no such path' })).toBe(false);
    expect(isGitDiffPathRequired({ status: 400, code: 'INVALID_REQUEST', message: 'workspace is not a repository' })).toBe(false);
    expect(isGitDiffPathRequired({ status: 500 })).toBe(false);
    expect(isGitDiffPathRequired({})).toBe(false);
  });
});
