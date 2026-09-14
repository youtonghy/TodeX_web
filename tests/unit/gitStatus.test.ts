import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GitStatusIndicator } from '../../src/renderer/components/GitStatusIndicator';
import { readGitStatus, type GitStatusSummary } from '../../src/renderer/lib/gitWorkspace';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
});
vi.mock('../../src/renderer/lib/gitWorkspace', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/renderer/lib/gitWorkspace')>(), readGitStatus: vi.fn(),
}));
const status: GitStatusSummary = { repositoryPath: '/one', initialized: true, branch: 'main', worktreeKind: 'main', changedFiles: 3, additions: 17, deletions: 4, statsTruncated: false };
let root: Root;
let container: HTMLDivElement;
let session: TodeXSession;
const onOpenGit = vi.fn();
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  HTMLElement.prototype.scrollIntoView ??= () => {};
});
beforeEach(() => {
  vi.mocked(readGitStatus).mockReset().mockResolvedValue(status);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  session = {
    settings: { serverUrl: 'http://localhost', deviceSecret: 'test-secret' }, connectionState: 'open', activeBackendConnectionId: 'backend',
    activeConversation: { id: 'c', workspaceId: 'one' },
    workspaces: [{ id: 'one', path: '/one' }, { id: 'two', path: '/two' }], thinkingConversations: {},
  } as unknown as TodeXSession;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); });
async function render(gitOpen = false) {
  await act(async () => root.render(createElement(GitStatusIndicator, { session, gitOpen, onOpenGit })));
}
function deferred() {
  let resolve!: (value: GitStatusSummary) => void;
  const promise = new Promise<GitStatusSummary>(done => { resolve = done; });
  return { promise, resolve };
}
it.each(['main', 'linked'] as const)('shows branch, %s worktree kind, files and changed lines', async worktreeKind => {
  vi.mocked(readGitStatus).mockResolvedValue({ ...status, worktreeKind });
  await render();
  expect(container.textContent).toContain('main');
  expect(container.textContent).toContain(worktreeKind === 'main' ? '主工作树' : '关联工作树');
  expect(container.textContent).toContain('3 个文件');
  expect(container.textContent).toContain('+17');
  expect(container.textContent).toContain('−4');
});
it('does not fabricate zero changes for a non-repository', async () => {
  vi.mocked(readGitStatus).mockResolvedValue({ ...status, initialized: false, changedFiles: 0, additions: 0, deletions: 0 });
  await render();
  expect(container.textContent).toContain('未初始化 Git');
  expect(container.textContent).not.toContain('+0');
  expect(container.textContent).not.toContain('0 个文件');
});
it('hides previous statistics immediately after disconnecting', async () => {
  await render();
  session = { ...session, connectionState: 'closed' } as TodeXSession;
  await render();
  expect(container.textContent).toContain('Git 未连接');
  expect(container.textContent).not.toContain('+17');
});
it('shows unavailable instead of old statistics or fabricated zeros after failure', async () => {
  await render();
  vi.mocked(readGitStatus).mockRejectedValue(new Error('Network failed'));
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(container.textContent).toContain('Git 状态不可用');
  expect(container.textContent).not.toContain('+17');
  expect(container.textContent).not.toContain('+0');
});
it('hides old data on workspace change and ignores stale workspace responses', async () => {
  await render();
  const old = deferred();
  vi.mocked(readGitStatus).mockReturnValueOnce(old.promise);
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  const next = deferred();
  vi.mocked(readGitStatus).mockReturnValueOnce(next.promise);
  session = { ...session, activeConversation: { ...session.activeConversation!, id: 'next', workspaceId: 'two' } };
  await render();
  expect(container.textContent).not.toContain('+17');
  expect(container.textContent).toContain('正在读取');
  await act(async () => { next.resolve({ ...status, branch: 'feature/next', additions: 22 }); });
  await act(async () => { old.resolve({ ...status, branch: 'stale', additions: 99 }); });
  expect(container.textContent).toContain('feature/next');
  expect(container.textContent).toContain('+22');
  expect(container.textContent).not.toContain('stale');
});
it('does not overlap polls and pauses timers while the document is hidden', async () => {
  vi.useFakeTimers();
  const pending = deferred();
  vi.mocked(readGitStatus).mockReturnValueOnce(pending.promise);
  await render();
  await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(60_000); });
  expect(readGitStatus).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve(status); });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(60_000); });
  expect(readGitStatus).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(readGitStatus).toHaveBeenCalledTimes(2);
});
it('refreshes when a task ends and when the Git modal closes', async () => {
  session = { ...session, thinkingConversations: { c: true } };
  await render(true);
  session = { ...session, thinkingConversations: {} };
  await render(true);
  expect(readGitStatus).toHaveBeenCalledTimes(2);
  await render(false);
  expect(readGitStatus).toHaveBeenCalledTimes(3);
});

it('does not restore old statistics while reconnecting to the same workspace', async () => {
  await render();
  expect(container.textContent).toContain('+17');
  session = { ...session, connectionState: 'closed' } as TodeXSession;
  await render();
  const pending = deferred();
  vi.mocked(readGitStatus).mockReturnValueOnce(pending.promise);
  session = { ...session, connectionState: 'open' } as TodeXSession;
  await render();
  expect(container.textContent).toContain('正在读取 Git 状态');
  expect(container.textContent).not.toContain('main');
  expect(container.textContent).not.toContain('+17');
  expect(container.textContent).not.toContain('3 个文件');
  await act(async () => { pending.resolve({ ...status, branch: 'updated', additions: 25 }); });
  expect(container.textContent).toContain('updated');
  expect(container.textContent).toContain('+25');
});
