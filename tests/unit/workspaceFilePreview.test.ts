import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { V2ApiClient } from '@todex/protocol/v2';
import { WorkbenchPanel } from '../../src/renderer/screens/WorkbenchPanel';
import { WorkspaceFilePreview, type PreviewFile } from '../../src/renderer/components/WorkspaceFilePreview';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';
import type { OpenPanelOptions } from '../../src/renderer/lib/panels';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  HTMLElement.prototype.scrollIntoView ??= () => {};
});
vi.mock('../../src/renderer/components/XtermTerminal', () => ({ XtermTerminal: () => null }));

let root: Root;
let container: HTMLDivElement;
let stored: unknown;
const storeGet = vi.fn(async () => stored);
const storeSet = vi.fn(async () => undefined);
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
const session = {
  activeConversation: { id: 'conversation' },
  activeWorkspace: { id: 'workspace', path: '/workspace' },
  settings: { serverUrl: 'https://backend.test', authToken: 'test-token' },
  terminalById: {}, connectionState: 'closed', connectionHealth: { latencyMs: null },
} as unknown as TodeXSession;

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
beforeEach(() => {
  stored = undefined;
  Object.assign(window, { todexWeb: { store: { get: storeGet, set: storeSet } } });
  vi.spyOn(V2ApiClient.prototype, 'listWorkspaceEntries').mockResolvedValue({ entries: [] } as never);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function imageFile(path: string): PreviewFile {
  return { name: path.split('/').pop(), path, mimeType: 'image/png', dataUrl: png };
}
async function renderWorkbench(target: OpenPanelOptions, onTabChange = vi.fn()) {
  await act(async () => { root.render(createElement(WorkbenchPanel, { session, tab: 'files', target, onTabChange })); });
  return onTabChange;
}
async function renderPreview(file: PreviewFile | null) {
  await act(async () => { root.render(createElement(WorkspaceFilePreview, { file })); });
}

describe('Files open requests', () => {
  it('creates a file tab from empty storage and previews the requested backend image', async () => {
    const read = vi.spyOn(V2ApiClient.prototype, 'readWorkspaceFile').mockResolvedValue(imageFile('/workspace/shot.png') as never);
    await renderWorkbench({ filePath: '/workspace/shot.png' });
    expect(storeGet).toHaveBeenCalled();
    expect(read).toHaveBeenCalledExactlyOnceWith('/workspace/shot.png');
    expect(container.querySelector('img')?.getAttribute('src')).toBe(png);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('shot.png');
    expect(container.textContent).toContain('文件 1');
    expect(container.textContent).not.toContain('暂无打开的标签');
  });

  it('honors the explicit file target when storage restores an active terminal', async () => {
    stored = { items: [{ id: 'terminal-old', type: 'terminal', title: '终端 1' }], activeId: 'terminal-old' };
    const read = vi.spyOn(V2ApiClient.prototype, 'readWorkspaceFile').mockResolvedValue(imageFile('/workspace/shot.png') as never);
    const onTabChange = await renderWorkbench({ filePath: '/workspace/shot.png' });
    expect(onTabChange).not.toHaveBeenCalledWith('terminal');
    expect(read).toHaveBeenCalledWith('/workspace/shot.png');
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.closest('.hidden')).toBeNull();
    expect(container.textContent).toContain('终端 1');
    expect(container.textContent).toContain('文件 1');
  });

  it('ignores an older file response that arrives after the newly requested file', async () => {
    const a = deferred<PreviewFile>();
    const b = deferred<PreviewFile>();
    vi.spyOn(V2ApiClient.prototype, 'readWorkspaceFile').mockImplementation(path => (path.endsWith('a.png') ? a.promise : b.promise) as never);
    const onTabChange = vi.fn();
    await renderWorkbench({ filePath: '/workspace/a.png' }, onTabChange);
    await renderWorkbench({ filePath: '/workspace/b.png' }, onTabChange);
    await act(async () => { b.resolve(imageFile('/workspace/b.png')); });
    expect(container.querySelector('img')?.alt).toBe('b.png');
    await act(async () => { a.resolve(imageFile('/workspace/a.png')); });
    expect(container.querySelector('img')?.alt).toBe('b.png');
    expect(container.querySelector('img[alt="a.png"]')).toBeNull();
  });

  it('reads the same path again for a new explicit open request', async () => {
    const read = vi.spyOn(V2ApiClient.prototype, 'readWorkspaceFile').mockResolvedValue(imageFile('/workspace/shot.png') as never);
    const onTabChange = vi.fn();
    await renderWorkbench({ filePath: '/workspace/shot.png' }, onTabChange);
    await renderWorkbench({ filePath: '/workspace/shot.png' }, onTabChange);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenLastCalledWith('/workspace/shot.png');
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('does not replace the current preview with a late failure from the previous request', async () => {
    const a = deferred<PreviewFile>();
    vi.spyOn(V2ApiClient.prototype, 'readWorkspaceFile').mockImplementation(path => (path.endsWith('a.png') ? a.promise : Promise.resolve(imageFile(path))) as never);
    const onTabChange = vi.fn();
    await renderWorkbench({ filePath: '/workspace/a.png' }, onTabChange);
    await renderWorkbench({ filePath: '/workspace/b.png' }, onTabChange);
    await act(async () => { a.reject(new Error('Old file unavailable')); });
    expect(container.querySelector('img')?.alt).toBe('b.png');
    expect(container.textContent).not.toContain('Old file unavailable');
  });
});

describe('WorkspaceFilePreview', () => {
  it('distinguishes an empty text file from an unsupported binary file', async () => {
    await renderPreview({ path: '/workspace/empty.txt', mimeType: 'text/plain', text: '' });
    expect(container.textContent).toContain('此文件为空');
    await renderPreview({ path: '/workspace/archive.zip', mimeType: 'application/zip' });
    expect(container.textContent).toContain('暂不支持预览此文件格式');
    expect(container.textContent).not.toContain('此文件为空');
  });

  it('renders Markdown as formatted content', async () => {
    await renderPreview({ path: '/workspace/README.md', mimeType: 'text/markdown', text: '# Preview heading\n\n**Formatted content**' });
    expect(container.querySelector('h1')?.textContent).toBe('Preview heading');
    expect(container.querySelector('strong')?.textContent).toBe('Formatted content');
  });

  it.each([undefined, 'https://other.test/shot.png', 'data:image/jpeg;base64,AAAA'])('shows a graceful fallback for an unavailable or mismatched image payload (%s)', async dataUrl => {
    await renderPreview({ path: '/workspace/shot.png', mimeType: 'image/png', dataUrl });
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('当前后端未返回图片预览');
  });

  it('shows a selection prompt with no file selected', async () => {
    await renderPreview(null);
    expect(container.textContent).toContain('选择文件预览');
  });
});


describe('legacy file response compatibility', () => {
  it('does not label a PNG with generic MIME and null text as an empty file', async () => {
    await renderPreview({ path: '/workspace/modal-classic.png', mimeType: 'application/octet-stream', text: null, sizeBytes: 38542 });
    expect(container.textContent).toContain('当前后端未返回图片预览');
    expect(container.textContent).not.toContain('此文件为空');
  });
  it('recognizes image payloads by extension even with a generic MIME', async () => {
    await renderPreview({ path: '/workspace/modal-classic.PNG', mimeType: 'application/octet-stream', text: null, dataUrl: png, sizeBytes: 38542 });
    expect(container.querySelector('img')?.getAttribute('src')).toBe(png);
  });
  it('does not conflate missing binary text or unavailable text with a zero-byte file', async () => {
    await renderPreview({ path: '/workspace/archive.zip', mimeType: 'application/octet-stream', text: null, sizeBytes: 100 });
    expect(container.textContent).toContain('暂不支持预览此文件格式');
    await renderPreview({ path: '/workspace/readme.txt', mimeType: 'text/plain', text: '', sizeBytes: 100 });
    expect(container.textContent).not.toContain('此文件为空');
  });
});
