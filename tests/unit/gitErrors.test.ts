import { describe, expect, it } from 'vitest';
import { gitOperationOutput, isGitDiffPathRequired, isUncertainGitOutcome } from '../../src/renderer/lib/gitErrors';

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

describe('isUncertainGitOutcome', () => {
  it('treats a git command failure as plain and a partial success as uncertain', () => {
    expect(isUncertainGitOutcome({ status: 409, code: 'GIT_COMMAND_FAILED' })).toBe(false);
    expect(isUncertainGitOutcome({ status: 500, code: 'GIT_COMMAND_FAILED' })).toBe(false);
    expect(isUncertainGitOutcome({ status: 409, code: 'GIT_PARTIAL_SUCCESS' })).toBe(true);
    expect(isUncertainGitOutcome({ status: 504, code: 'GIT_COMMAND_TIMED_OUT' })).toBe(true);
    expect(isUncertainGitOutcome({ status: 502 })).toBe(true);
    expect(isUncertainGitOutcome({ status: 400, code: 'INVALID_REQUEST' })).toBe(false);
    expect(isUncertainGitOutcome({ status: 400, code: 'GIT_COMMAND_FAILED', unknownOutcome: true })).toBe(true);
  });
});

describe('gitOperationOutput', () => {
  it('maps empty and legacy placeholder outputs to the UI done text', () => {
    expect(gitOperationOutput('')).toBe('');
    expect(gitOperationOutput(undefined)).toBe('');
    expect(gitOperationOutput('Operation completed')).toBe('');
    expect(gitOperationOutput('Operation completed\n')).toBe('');
    expect(gitOperationOutput('Switched to branch main')).toBe('Switched to branch main');
  });
});
