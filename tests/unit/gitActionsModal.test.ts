import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Toast, toast } from '@heroui/react';
import { GitActionsModal } from '../../src/renderer/components/GitActionsModal';
import { GitWorkspaceError, readGitLog, readGitPullRequest, readGitScan, readGitStatus, readGitWorkspace, runGitWorkspaceOperation, type GitLogCommit } from '../../src/renderer/lib/gitWorkspace';
import { buildGitAgentPrompt, gitAgentActionGroups } from '../../src/renderer/session/gitAgentActions';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
});

vi.mock('../../src/renderer/lib/gitWorkspace', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/renderer/lib/gitWorkspace')>();
  return { ...actual, readGitWorkspace: vi.fn(), runGitWorkspaceOperation: vi.fn(), readGitPullRequest: vi.fn(), readGitStatus: vi.fn(), readGitScan: vi.fn(), readGitLog: vi.fn() };
});
beforeEach(() => {
  vi.mocked(readGitWorkspace).mockReset().mockResolvedValue({ repositoryPath: '/project/current', initialized: true, currentBranch: 'main', branches: [{ name: 'main', current: true, remote: false }], worktrees: [], dirty: false });
  vi.mocked(runGitWorkspaceOperation).mockReset().mockResolvedValue({ repositoryPath: '/project/current', action: 'create-branch', output: 'Created branch' });
  vi.mocked(readGitPullRequest).mockReset().mockResolvedValue({ repositoryPath: '/project/current', initialized: true, branch: 'feature/x', pullRequest: null });
  vi.mocked(readGitStatus).mockReset().mockResolvedValue({ repositoryPath: '/project/current', initialized: true, branch: 'main', worktreeKind: 'main',
    changedFiles: 2, additions: 5, deletions: 1, statsTruncated: false, upstream: 'origin/main', ahead: 1, behind: 0 });
  vi.mocked(readGitScan).mockReset().mockResolvedValue({ repositories: [{ path: '/project/current', name: 'current', branch: 'main', initialEligible: false, additions: 5, deletions: 1,
    files: [{ path: 'src/app.ts', status: ' M', additions: 4, deletions: 1 }, { path: 'notes.md', status: '??', additions: 1, deletions: 0 }] }] });
  vi.mocked(readGitLog).mockReset().mockImplementation(async (_settings, _path, skip, limit) => {
    const all = Array.from({ length: 8 }, (_, index) => commit(index));
    return { repositoryPath: '/project/current', initialized: true, commits: all.slice(skip, skip + limit), hasMore: skip + limit < all.length };
  });
});

function commit(index: number): GitLogCommit {
  return { sha: `${index}`.repeat(40).slice(0, 40), subject: `commit ${index}`, authorName: 'Alice', authoredAt: 1_700_000_000 - index * 3600, pushed: index === 0 ? false : true };
}

let root: Root;
let container: HTMLDivElement;
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  globalThis.CSS ??= { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`) } as typeof CSS;
  HTMLElement.prototype.scrollIntoView ??= () => {};
  // jsdom has no Web Animations API; the Tabs indicator transition queries it.
  Element.prototype.getAnimations ??= () => [];
});
afterEach(() => {
  act(() => { toast.clear(); root?.unmount(); });
  container?.remove();
});

function render({ active = true, outcome = 'sent', pending = false, busy = false, openGitWorktree, workspacePath = '/project/current', tab = 'operations' }: {
  active?: boolean; outcome?: 'sent' | 'queued'; pending?: boolean; busy?: boolean;
  openGitWorktree?: (path: string, sourceConversationId: string) => unknown;
  workspacePath?: string;
  /** The menu opens on the status tab; most tests drive the actions tab. */
  tab?: 'status' | 'operations';
} = {}) {
  // Status-tab reads need an open socket; action tests stay offline so request counts only reflect the action.
  const connected = tab === 'status';
  let finish!: (value: 'sent' | 'queued') => void;
  const response = pending ? new Promise<'sent' | 'queued'>(resolve => { finish = resolve; }) : Promise.resolve(outcome);
  const draft = Object.freeze({ c: 'Keep my unfinished message' });
  const attachments = Object.freeze({ c: Object.freeze([{ id: 'attachment' }]) });
  const sendAgentMessage = vi.fn(() => response);
  const setChatDraft = vi.fn();
  const onOpenChange = vi.fn();
  const session = {
    activeConversation: active ? { id: 'c', workspaceId: 'w', provider: 'pi', title: 'Current task' } : null,
    workspaces: [{ id: 'other', name: 'Other', path: '/wrong' }, { id: 'w', name: 'Current', path: workspacePath }],
    settings: { serverUrl: 'http://localhost', deviceSecret: 'test-secret' }, thinkingConversations: busy ? { c: true } : {}, submissionStatusByConversation: {}, sendAgentMessage,
    chatDrafts: draft, composerAttachments: attachments, setChatDraft,
    openGitWorktree: openGitWorktree ?? vi.fn(() => null),
    selectedGitRepoByWorkspace: {}, selectGitRepo: vi.fn(),
    ...(connected ? { connectionState: 'open', activeBackendConnectionId: 'b' } : {}),
  } as unknown as TodeXSession;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(createElement(React.Fragment, null,
    createElement(GitActionsModal, { session, isOpen: true, onOpenChange }),
    createElement(Toast.Provider),
  )));
  if (tab === 'operations') act(() => { menuTab('操作').click(); });
  return { session, sendAgentMessage, setChatDraft, onOpenChange, finish, draft, attachments };
}

function menuTab(label: string) {
  const found = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(item => item.textContent?.includes(label));
  expect(found, `tab ${label}`).toBeDefined();
  return found!;
}
async function settle() { for (let index = 0; index < 6; index++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); }

async function flushNotices() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); }
function notices() { return [...document.querySelectorAll('[data-slot="toast"]')].map(item => item.textContent).join(' '); }

function action(title: string) {
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    .find(element => [...element.querySelectorAll('span')].some(span => span.textContent === title));
  expect(item, `Git action ${title}`).toBeDefined();
  return item!;
}

it('renders all 27 Git action entries using the real command menu', () => {
  render();
  expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(27);
  for (const entry of gitAgentActionGroups.flatMap(group => group.actions)) expect(action(entry.title)).toBeDefined();
});

it('sends the selected action to the current conversation without touching composer data', async () => {
  const state = render();
  await act(async () => { action('解释代码更改').click(); });
  expect(state.sendAgentMessage).toHaveBeenCalledExactlyOnceWith(
    buildGitAgentPrompt('explain-pr', { workspacePath: '/project/current', workspaceName: 'Current' }), 'c',
  );
  expect(state.setChatDraft).not.toHaveBeenCalled();
  expect(state.session.chatDrafts).toBe(state.draft);
  expect(state.session.composerAttachments).toBe(state.attachments);
  expect(state.onOpenChange).toHaveBeenCalledWith(false);
});

it('disables all actions when no conversation is selected', async () => {
  const state = render({ active: false });
  const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  expect(items).toHaveLength(27);
  expect(items.every(item => item.getAttribute('aria-disabled') === 'true')).toBe(true);
  await act(async () => { action('初始化仓库').click(); });
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
});

it('ignores repeated selections while the first message is pending', async () => {
  const state = render({ pending: true });
  const target = action('解释代码更改');
  await act(async () => { target.click(); target.click(); });
  expect(state.sendAgentMessage).toHaveBeenCalledTimes(1);
  await act(async () => { action('Handoff').click(); });
  expect(state.sendAgentMessage).toHaveBeenCalledTimes(1);
  await act(async () => { state.finish('sent'); });
});

it('reports a queued request without claiming Git has completed', async () => {
  render({ outcome: 'queued', busy: true });
  await act(async () => { action('解释代码更改').click(); });
  expect(document.body.textContent).toContain('已加入当前对话的候选队列');
  expect(document.body.textContent).not.toContain('初始化完成');
  expect(document.body.textContent).not.toContain('已发送到当前 Agent');
});


function button(title: string) {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === title);
  expect(found, title).toBeDefined();
  return found!;
}
function fill(placeholder: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)!;
  expect(input).toBeTruthy();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
async function openBranchForm() {
  await act(async () => { action('创建分支').click(); });
  await act(async () => { fill('codex/my-task', 'codex/new'); fill('默认 HEAD', 'main'); });
}
it('reads branch data directly without posting a chat message', async () => {
  const state = render();
  await act(async () => { action('查看分支').click(); });
  expect(readGitWorkspace).toHaveBeenCalledWith(state.session.settings, '/project/current');
  expect(runGitWorkspaceOperation).not.toHaveBeenCalled();
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('main');
});

it('submits actual branch form parameters directly without an agent request', async () => {
  const state = render();
  await openBranchForm();
  await act(async () => { button('创建分支').click(); });
  expect(runGitWorkspaceOperation).toHaveBeenCalledExactlyOnceWith(state.session.settings, '/project/current', { action: 'create-branch', branchName: 'codex/new', startPoint: 'main' });
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
});

it('requires an explicit fallback click and includes failed operation parameters', async () => {
  vi.mocked(runGitWorkspaceOperation).mockRejectedValue(new GitWorkspaceError('Branch exists', { status: 409 }));
  const state = render();
  await openBranchForm();
  await act(async () => { button('创建分支').click(); });
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
  await flushNotices();
  expect(notices()).toContain('Branch exists');
  expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Branch exists');
  act(() => { toast.clear(); });
  await act(async () => { button('交给 Agent 处理').click(); });
  expect(state.sendAgentMessage).toHaveBeenCalledTimes(1);
  const [prompt, id] = state.sendAgentMessage.mock.calls[0] as unknown as [string, string];
  expect(id).toBe('c');
  expect(prompt).toContain('"branchName":"codex/new"');
  expect(prompt).toContain('Branch exists');
});

it('locks direct writes while an operation is pending', async () => {
  let finish!: (result: { repositoryPath: string; action: 'create-branch'; output: string }) => void;
  vi.mocked(runGitWorkspaceOperation).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render();
  await openBranchForm();
  const submit = button('创建分支');
  await act(async () => { submit.click(); submit.click(); });
  expect(runGitWorkspaceOperation).toHaveBeenCalledTimes(1);
  expect(submit.disabled).toBe(true);
  await act(async () => { finish({ repositoryPath: '/project/current', action: 'create-branch', output: 'Done' }); });
});

it('shows uncertain outcomes and prevents blind resubmission until status is checked', async () => {
  vi.mocked(runGitWorkspaceOperation).mockRejectedValue(new GitWorkspaceError('Timed out', { unknownOutcome: true }));
  const state = render();
  await openBranchForm();
  await act(async () => { button('创建分支').click(); });
  await flushNotices();
  expect(notices()).toContain('操作结果未知，请先核对实际状态。');
  expect(button('创建分支').disabled).toBe(true);
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
  await act(async () => { button('刷新状态').click(); });
  expect(readGitWorkspace).toHaveBeenCalledTimes(2);
});

it('blocks direct writes while the current agent is busy', async () => {
  const state = render({ busy: true });
  await openBranchForm();
  expect(button('创建分支').disabled).toBe(true);
  await act(async () => { button('创建分支').click(); });
  expect(runGitWorkspaceOperation).not.toHaveBeenCalled();
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
});

it('creates a todex/xxx worktree then opens its workspace conversation', async () => {
  const openGitWorktree = vi.fn(() => ({ workspace: { id: 'wt' }, conversation: { id: 'c2' } }));
  const state = render({ openGitWorktree });
  await act(async () => { action('创建工作树').click(); });
  await act(async () => { fill('my-task', 'docs'); });
  await act(async () => { button('创建工作树').click(); });
  expect(runGitWorkspaceOperation).toHaveBeenCalledExactlyOnceWith(state.session.settings, '/project/current',
    { action: 'create-worktree', path: '/project/todex/docs', branchName: 'todex/docs' });
  expect(openGitWorktree).toHaveBeenCalledExactlyOnceWith('/project/todex/docs', 'c');
  expect(state.onOpenChange).toHaveBeenCalledWith(false);
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
});

it('anchors the new worktree next to the main worktree', async () => {
  vi.mocked(readGitWorkspace).mockResolvedValue({ repositoryPath: '/project/todex/current', initialized: true, currentBranch: 'todex/current',
    branches: [{ name: 'todex/current', current: true, remote: false }],
    worktrees: [
      { path: '/project/repo', branch: 'main', current: false, main: true, locked: false, dirty: false, accessible: true },
      { path: '/project/todex/current', branch: 'todex/current', current: true, main: false, locked: false, dirty: false, accessible: true },
    ], dirty: false });
  const openGitWorktree = vi.fn(() => null);
  const state = render({ openGitWorktree, workspacePath: '/project/todex/current' });
  await act(async () => { action('创建工作树').click(); });
  await act(async () => { fill('my-task', 'next'); });
  await act(async () => { button('创建工作树').click(); });
  expect(runGitWorkspaceOperation).toHaveBeenCalledExactlyOnceWith(state.session.settings, '/project/todex/current',
    { action: 'create-worktree', path: '/project/todex/next', branchName: 'todex/next' });
});

it('keeps the result visible when the new worktree cannot be opened', async () => {
  vi.mocked(runGitWorkspaceOperation).mockResolvedValue({ repositoryPath: '/project/current', action: 'create-worktree', output: 'Preparing worktree' });
  const state = render();
  await act(async () => { action('创建工作树').click(); });
  await act(async () => { fill('my-task', 'docs'); });
  await act(async () => { button('创建工作树').click(); });
  expect(document.body.textContent).toContain('Preparing worktree');
  expect(state.onOpenChange).not.toHaveBeenCalled();
});

it('disables branch switching when the snapshot has uncommitted changes', async () => {
  vi.mocked(readGitWorkspace).mockResolvedValue({ repositoryPath: '/project/current', initialized: true, currentBranch: 'main', branches: [{ name: 'other', current: false, remote: false }], worktrees: [], dirty: true });
  render();
  await act(async () => { action('切换分支').click(); });
  expect(button('切换').disabled).toBe(true);
  expect(document.body.textContent).toContain('有未提交更改');
});

it('keeps branch writes blocked when checking an unknown operation also fails', async () => {
  vi.mocked(readGitWorkspace).mockResolvedValueOnce({ repositoryPath: '/project/current', initialized: true, currentBranch: 'main', branches: [{ name: 'other', current: false, remote: false }], worktrees: [], dirty: false })
    .mockRejectedValue(new GitWorkspaceError('Connection unavailable'));
  vi.mocked(runGitWorkspaceOperation).mockRejectedValue(new GitWorkspaceError('Switch timed out', { unknownOutcome: true }));
  const state = render();
  await act(async () => { action('切换分支').click(); });
  await act(async () => { button('切换').click(); });
  expect(runGitWorkspaceOperation).toHaveBeenCalledTimes(1);
  expect(button('切换').disabled).toBe(true);
  await act(async () => { button('刷新状态').click(); });
  await flushNotices();
  expect(notices()).toContain('操作结果未知，请先核对实际状态。');
  expect(notices()).toContain('Connection unavailable');
  expect(button('切换').disabled).toBe(true);
  await act(async () => { button('切换').click(); });
  expect(runGitWorkspaceOperation).toHaveBeenCalledTimes(1);
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
});

async function openPrForm() {
  await act(async () => { action('创建 PR').click(); });
  await act(async () => {
    fill('owner/repository 或 host/owner/repository', '  owner/project  ');
    fill('例如 main', '  main  ');
    fill('概括本次更改', '  Improve PR support  ');
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Summary\n\nValidation');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
  });
}

it('creates a draft PR with the supplied form values without sending a message', async () => {
  vi.mocked(runGitWorkspaceOperation).mockResolvedValue({ repositoryPath: '/project/current', action: 'create-pr', output: 'https://github.com/owner/project/pull/1' });
  const state = render();
  await openPrForm();
  await act(async () => { button('创建 PR').click(); });
  expect(runGitWorkspaceOperation).toHaveBeenCalledExactlyOnceWith(state.session.settings, '/project/current', {
    action: 'create-pr', repository: 'owner/project', baseBranch: 'main', title: 'Improve PR support', body: 'Summary\n\nValidation', draft: true,
  });
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
  expect(state.setChatDraft).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('https://github.com/owner/project/pull/1');
  expect(button('创建 PR').disabled).toBe(true);
  await act(async () => { button('刷新状态').click(); button('创建 PR').click(); });
  expect(runGitWorkspaceOperation).toHaveBeenCalledTimes(1);
  await act(async () => { button('交给 Agent 查看 PR').click(); });
  expect(state.sendAgentMessage).toHaveBeenCalledExactlyOnceWith(buildGitAgentPrompt('view-pr', { workspacePath: '/project/current', workspaceName: 'Current' }), 'c');
});

it('prevents duplicate PR creation while the request is pending', async () => {
  let finish!: (result: { repositoryPath: string; action: 'create-pr'; output: string }) => void;
  vi.mocked(runGitWorkspaceOperation).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const state = render();
  await openPrForm();
  const submit = button('创建 PR');
  await act(async () => { submit.click(); submit.click(); });
  expect(runGitWorkspaceOperation).toHaveBeenCalledTimes(1);
  expect(submit.disabled).toBe(true);
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
  await act(async () => { finish({ repositoryPath: '/project/current', action: 'create-pr', output: 'Created PR' }); });
});

it('keeps an uncertain PR creation blocked after a successful local status refresh', async () => {
  vi.mocked(runGitWorkspaceOperation).mockRejectedValue(new GitWorkspaceError('PR creation timed out', { unknownOutcome: true }));
  const state = render();
  await openPrForm();
  await act(async () => { button('创建 PR').click(); });
  expect(button('创建 PR').disabled).toBe(true);
  await act(async () => { button('刷新状态').click(); });
  expect(readGitWorkspace).toHaveBeenCalledTimes(2);
  await flushNotices();
  expect(notices()).toContain('操作结果未知');
  expect(button('创建 PR').disabled).toBe(true);
  await act(async () => { button('创建 PR').click(); });
  expect(runGitWorkspaceOperation).toHaveBeenCalledTimes(1);
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
  await act(async () => { button('交给 Agent 处理').click(); });
  expect(state.sendAgentMessage).toHaveBeenCalledTimes(1);
  const [prompt] = state.sendAgentMessage.mock.calls[0] as unknown as [string, string];
  expect(prompt).toContain('"repository":"owner/project"');
  expect(prompt).toContain('本次操作结果未知');
});

it.each(gitAgentActionGroups.filter(group => group.id.startsWith('pr-')).flatMap(group => group.actions).filter(action => action.mode === 'agent'))('routes $id to the current agent without a direct Git write', async ({ id, title }) => {
  const state = render();
  await act(async () => { action(title).click(); });
  expect(state.sendAgentMessage).toHaveBeenCalledExactlyOnceWith(buildGitAgentPrompt(id, { workspacePath: '/project/current', workspaceName: 'Current' }), 'c');
  expect(runGitWorkspaceOperation).not.toHaveBeenCalled();
});

const openPr = {
  number: 42, title: 'Improve support', url: 'https://github.com/owner/project/pull/42', state: 'open',
  draft: false, headRef: 'feature/x', baseRef: 'main', headSha: 'abc123', mergeable: 'mergeable',
  mergeState: 'clean', reviews: { approved: 1, changesRequested: 0, commented: 0 },
  checks: { passing: 2, failing: 0, pending: 1 },
};

it('reads the current branch PR directly without an agent request', async () => {
  vi.mocked(readGitPullRequest).mockResolvedValue({ repositoryPath: '/project/current', initialized: true, branch: 'feature/x', pullRequest: openPr });
  const state = render();
  await act(async () => { action('查看 PR').click(); });
  expect(readGitPullRequest).toHaveBeenCalledWith(state.session.settings, '/project/current');
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
  expect(runGitWorkspaceOperation).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('#42 Improve support');
  expect(document.body.textContent).toContain('feature/x → main');
});

it('closes an open PR only after inline confirmation', async () => {
  vi.mocked(readGitPullRequest).mockResolvedValue({ repositoryPath: '/project/current', initialized: true, branch: 'feature/x', pullRequest: openPr });
  const state = render();
  await act(async () => { action('关闭 PR').click(); });
  await act(async () => { button('确认关闭 PR').click(); });
  expect(runGitWorkspaceOperation).toHaveBeenCalledExactlyOnceWith(state.session.settings, '/project/current', { action: 'close-pr' });
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
  expect(readGitPullRequest).toHaveBeenCalledTimes(2);
});

it('merges with the selected method bound to the displayed head commit', async () => {
  vi.mocked(readGitPullRequest).mockResolvedValue({ repositoryPath: '/project/current', initialized: true, branch: 'feature/x', pullRequest: openPr });
  const state = render();
  await act(async () => { action('合并 PR').click(); });
  await act(async () => { button('压缩合并').click(); });
  await act(async () => { button('确认合并 PR').click(); });
  expect(runGitWorkspaceOperation).toHaveBeenCalledExactlyOnceWith(state.session.settings, '/project/current', { action: 'merge-pr', method: 'squash', headSha: 'abc123' });
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
});

it('reopens a closed PR through the shared detail panel', async () => {
  vi.mocked(readGitPullRequest).mockResolvedValue({ repositoryPath: '/project/current', initialized: true, branch: 'feature/x', pullRequest: { ...openPr, state: 'closed' } });
  const state = render();
  await act(async () => { action('重新打开 PR').click(); });
  await act(async () => { button('确认重新打开').click(); });
  expect(runGitWorkspaceOperation).toHaveBeenCalledExactlyOnceWith(state.session.settings, '/project/current', { action: 'reopen-pr' });
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
});

it('opens on the read-only status tab with changes, commits, PR and branch state', async () => {
  vi.mocked(readGitPullRequest).mockResolvedValue({ repositoryPath: '/project/current', initialized: true, branch: 'feature/x', pullRequest: openPr });
  vi.mocked(readGitWorkspace).mockResolvedValue({ repositoryPath: '/project/current', initialized: true, currentBranch: 'main', dirty: true,
    branches: [{ name: 'main', current: true, remote: false }, { name: 'origin/main', current: false, remote: true }],
    worktrees: [{ path: '/project/current', branch: 'main', current: true, main: true, locked: false, dirty: true, accessible: true },
      { path: '/project/todex/x', branch: 'todex/x', current: false, main: false, locked: true, dirty: false, accessible: true }] });
  const state = render({ tab: 'status' });
  await settle();
  expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(0);
  const text = document.body.textContent;
  expect(text).toContain('2 个文件已更改');
  expect(text).toContain('src/app.ts');
  expect(text).toContain('1 个提交未推送');
  expect(text).toContain('commit 0');
  expect(text).not.toContain('commit 1');
  expect(text).toContain('本地分支 1 · 远端 1 · 工作树 2');
  const prLink = document.querySelector<HTMLAnchorElement>('a[href="https://github.com/owner/project/pull/42"]');
  expect(prLink?.target).toBe('_blank');
  expect(prLink?.rel).toBe('noopener noreferrer');
  // Reads run one at a time and the PR, which may wait on GitHub, goes last.
  const order = [readGitLog, readGitWorkspace, readGitPullRequest].map(mock => vi.mocked(mock).mock.invocationCallOrder[0]);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(readGitLog).toHaveBeenCalledWith(state.session.settings, '/project/current', 0, 1, expect.anything());
  expect(state.sendAgentMessage).not.toHaveBeenCalled();
});

it('reveals five earlier commits per expand and collapses back to the latest without refetching', async () => {
  render({ tab: 'status' });
  await settle();
  const rows = () => document.querySelectorAll('ol[aria-label="提交记录"] > li').length;
  expect(rows()).toBe(1);
  await act(async () => { button('显示更早的 5 个提交').click(); });
  await settle();
  expect(rows()).toBe(6);
  expect(readGitLog).toHaveBeenLastCalledWith(expect.anything(), '/project/current', 1, 5, expect.anything());
  await act(async () => { button('显示更早的 5 个提交').click(); });
  await settle();
  expect(rows()).toBe(8);
  expect([...document.querySelectorAll('button')].some(item => item.textContent?.includes('显示更早'))).toBe(false);
  await act(async () => { button('收起').click(); });
  expect(rows()).toBe(1);
  const calls = vi.mocked(readGitLog).mock.calls.length;
  await act(async () => { button('显示更早的 5 个提交').click(); });
  await settle();
  expect(rows()).toBe(6);
  expect(readGitLog).toHaveBeenCalledTimes(calls);
});

it('jumps from a status section to its action group', async () => {
  render({ tab: 'status' });
  await settle();
  await act(async () => { [...document.querySelectorAll('button')].find(item => item.textContent === '分支 / 工作树操作')!.click(); });
  expect(menuTab('操作').getAttribute('aria-selected')).toBe('true');
  expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(27);
});

it('retries a status read rejected because the backend read slots are busy', async () => {
  vi.mocked(readGitStatus).mockRejectedValueOnce(new GitWorkspaceError('Git read capacity is busy', { status: 409 }));
  render({ tab: 'status' });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 700)); });
  await settle();
  expect(document.body.textContent).toContain('2 个文件已更改');
});

it('shows the not-a-repository state without loading history, branches or PR', async () => {
  vi.mocked(readGitStatus).mockResolvedValue({ repositoryPath: '/project/current', initialized: false, branch: null, worktreeKind: null,
    changedFiles: 0, additions: 0, deletions: 0, statsTruncated: false, upstream: null, ahead: null, behind: null });
  render({ tab: 'status' });
  await settle();
  expect(document.body.textContent).toContain('当前目录还不是 Git 仓库');
  expect(readGitLog).not.toHaveBeenCalled();
  expect(readGitPullRequest).not.toHaveBeenCalled();
});
