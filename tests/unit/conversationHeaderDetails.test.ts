import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ConversationHeaderDetails } from '../../src/renderer/components/ConversationHeaderDetails';
import { readGitStatus } from '../../src/renderer/lib/gitWorkspace';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
});
vi.mock('../../src/renderer/lib/gitWorkspace', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/renderer/lib/gitWorkspace')>(), readGitStatus: vi.fn(),
}));
let root: Root;
let container: HTMLDivElement;
let width = 900;
const observers = new Set<{ targets: Set<Element>; callback: ResizeObserverCallback }>();
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React });
  HTMLElement.prototype.scrollIntoView ??= () => {};
});
beforeEach(() => {
  width = 900;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.dataset.testid === 'header-details' ? width : 900;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('inert') ? 600 : 0;
  });
  vi.stubGlobal('ResizeObserver', class {
    targets = new Set<Element>();
    constructor(public callback: ResizeObserverCallback) { observers.add(this); }
    observe(element: Element) { this.targets.add(element); }
    unobserve(element: Element) { this.targets.delete(element); }
    disconnect() { observers.delete(this); }
  });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  vi.mocked(readGitStatus).mockReset().mockResolvedValue({ repositoryPath: '/project', initialized: true, branch: 'feature/header', worktreeKind: 'linked', changedFiles: 5, additions: 23, deletions: 7, statsTruncated: false });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); observers.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render() {
  const session = {
    settings: { serverUrl: 'http://localhost', authToken: 'test' }, connectionState: 'open', activeBackendConnectionId: 'backend',
    activeConversation: { id: 'c', workspaceId: 'w', provider: 'pi', version: 2 },
    workspaces: [{ id: 'w', name: 'Workspace title', path: '/project' }], thinkingConversations: {},
  } as unknown as TodeXSession;
  const onOpenGit = vi.fn();
  await act(async () => root.render(createElement(ConversationHeaderDetails, { session, title: 'Current task title', gitOpen: false, onOpenGit })));
  return { onOpenGit };
}
async function resize(next: number) {
  width = next;
  await act(async () => {
    for (const observer of [...observers]) {
      if ([...observer.targets].some(target => target.getAttribute('data-testid') === 'header-details')) {
        observer.callback([], observer as unknown as ResizeObserver);
      }
    }
  });
}
function moreButton() { return container.querySelector<HTMLButtonElement>('button[aria-label="对话与 Git 信息"]'); }
it('collapses to a details menu when narrow and restores inline details when wide', async () => {
  await render();
  expect(container.querySelector('[data-testid="header-details"]')?.getAttribute('data-compact')).toBe('false');
  expect(moreButton()).toBeNull();
  await resize(300);
  expect(moreButton()).not.toBeNull();
  await act(async () => { moreButton()!.click(); });
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain('Current task title');
  expect(dialog?.textContent).toContain('Workspace title');
  expect(dialog?.textContent).toContain('/project');
  expect(dialog?.textContent).toContain('feature/header');
  expect(dialog?.textContent).toContain('+23');
  expect(dialog?.textContent).toContain('−7');
  await resize(900);
  expect(moreButton()).toBeNull();
  expect(container.querySelector('[data-testid="header-details"]')?.getAttribute('data-compact')).toBe('false');
});
it('fetches Git only once despite hidden measurements and opening the compact presentation', async () => {
  const state = await render();
  expect(readGitStatus).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[inert][aria-hidden="true"]')).not.toBeNull();
  await resize(300);
  await act(async () => { moreButton()!.click(); });
  expect(readGitStatus).toHaveBeenCalledTimes(1);
  const gitButton = document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label*="feature/header"]');
  expect(gitButton).not.toBeNull();
  await act(async () => { gitButton!.click(); });
  expect(state.onOpenGit).toHaveBeenCalledTimes(1);
  expect(readGitStatus).toHaveBeenCalledTimes(1);
});
