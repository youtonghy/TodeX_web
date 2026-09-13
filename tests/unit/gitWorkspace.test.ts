import { afterEach, expect, it, vi } from 'vitest';
import type { ConnectionSettings } from '@todex/protocol/todex';
import { GitWorkspaceError, readGitStatus, readGitWorkspace, runGitWorkspaceOperation } from '../../src/renderer/lib/gitWorkspace';

const settings = { serverUrl: 'ws://localhost:8787', authToken: 'test-token' } as ConnectionSettings;
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('reads the selected workspace using an encoded query and bearer authentication', async () => {
  const snapshot = { repositoryPath: '/test', initialized: true, currentBranch: 'main', branches: [], worktrees: [], dirty: false };
  const fetcher = vi.fn(async () => new Response(JSON.stringify(snapshot)));
  vi.stubGlobal('fetch', fetcher);
  expect(await readGitWorkspace(settings, '/test & examples')).toEqual(snapshot);
  const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(new URL(url).pathname).toBe('/v2/git/workspace');
  expect(new URL(url).searchParams.get('workspacePath')).toBe('/test & examples');
  expect(options.method).toBe('GET');
  expect(options.headers).toEqual({ Authorization: 'Bearer test-token' });
});

it('posts the operation as structured JSON with the workspace and no shell interpolation', async () => {
  const result = { repositoryPath: '/test', action: 'create-branch', output: 'Created branch' };
  const fetcher = vi.fn(async () => new Response(JSON.stringify(result)));
  vi.stubGlobal('fetch', fetcher);
  const operation = { action: 'create-branch' as const, branchName: 'feature/test', startPoint: 'main' };
  expect(await runGitWorkspaceOperation(settings, '/test', operation)).toEqual(result);
  const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(new URL(url).pathname).toBe('/v2/git/operation');
  expect(options.method).toBe('POST');
  expect(options.headers).toEqual({ Authorization: 'Bearer test-token', 'Content-Type': 'application/json' });
  expect(JSON.parse(options.body as string)).toEqual({ workspacePath: '/test', operation });
});

it.each(['GIT_PARTIAL_SUCCESS', 'GIT_COMMAND_TIMED_OUT'])('preserves uncertain backend error %s and never retries', async code => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ code, message: 'Operation incomplete' }), { status: 409 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(runGitWorkspaceOperation(settings, '/test', { action: 'push' })).rejects.toMatchObject({
    status: 409, code, message: 'Operation incomplete', unknownOutcome: true,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('retains ordinary HTTP failures without claiming uncertain mutation', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'GIT_DIRTY', message: 'Uncommitted edits' }), { status: 409 })));
  await expect(runGitWorkspaceOperation(settings, '/test', { action: 'switch-branch', branchName: 'other' })).rejects.toMatchObject({ status: 409, code: 'GIT_DIRTY', unknownOutcome: false });
});

it('marks disconnected mutations unknown and does not retry', async () => {
  const fetcher = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
  vi.stubGlobal('fetch', fetcher);
  await expect(runGitWorkspaceOperation(settings, '/test', { action: 'init' })).rejects.toMatchObject({ unknownOutcome: true, code: 'NETWORK_ERROR' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('aborts timed out mutations without retry and reports an unknown outcome', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  vi.stubGlobal('fetch', fetcher);
  const pending = runGitWorkspaceOperation(settings, '/test', { action: 'push' });
  const assertion = expect(pending).rejects.toMatchObject({ code: 'REQUEST_ABORTED', unknownOutcome: true });
  await vi.advanceTimersByTimeAsync(120_000);
  await assertion;
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('supports cancellation of reads without marking the repository outcome unknown', async () => {
  const abort = new AbortController();
  vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  })));
  const pending = readGitWorkspace(settings, '/test', abort.signal);
  abort.abort();
  await expect(pending).rejects.toBeInstanceOf(GitWorkspaceError);
  await expect(pending).rejects.toMatchObject({ unknownOutcome: false });
});


it('reads status from the encoded workspace route with auth and propagates cancellation', async () => {
  const abort = new AbortController();
  const fetcher = vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  vi.stubGlobal('fetch', fetcher);
  const pending = readGitStatus(settings, '/test & worktree', abort.signal);
  const [url, options] = fetcher.mock.calls[0];
  expect(new URL(url).pathname).toBe('/v2/git/status');
  expect(new URL(url).searchParams.get('workspacePath')).toBe('/test & worktree');
  expect(options.method).toBe('GET');
  expect(options.headers).toEqual({ Authorization: 'Bearer test-token' });
  abort.abort();
  await expect(pending).rejects.toMatchObject({ code: 'REQUEST_ABORTED', unknownOutcome: false });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
