import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { V2ApiClient } from '@todex/protocol/v2';
import { ConnectionError } from '@todex/protocol/connectionError';
import { AgentDesktopSettings, type AgentDesktopPage } from '../../src/renderer/components/AgentDesktopSettings';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
});
let root: Root;
let container: HTMLDivElement;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.restoreAllMocks(); });

// SettingsPanel owns the page; this stands in for it.
function Harness() {
  const [page, setPage] = useState<AgentDesktopPage | null>(null);
  return createElement(AgentDesktopSettings, { session, page, onPageChange: setPage });
}

async function render() {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(createElement(Harness)); });
}

const button = (text: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.includes(text))!;
const press = async (text: string) => { await act(async () => { button(text).click(); }); };
const switches = () => container.querySelectorAll<HTMLInputElement>('input[type="checkbox"], [role="switch"]');

const host = (permissions: { screen: boolean; accessibility: boolean }) => ({
  supported: true, available: permissions.screen && permissions.accessibility, host: 'Studio Mac', platform: 'macos', permissions,
});

const session = { settings: { serverUrl: 'https://backend.test', deviceSecret: '' }, activeWorkspace: { id: 'ws_1', path: '/w/app', name: 'app' }, workspaces: [{ id: 'ws_1', path: '/w/app', name: 'app' }] } as unknown as TodeXSession;
const browser = (installed: boolean, downloading = false) => ({
  available: installed, host: 'Studio Mac', chromium: { version: '154.0', installed, downloading, overridden: false, ...(downloading ? { progress: 0.42 } : {}) },
});
const base = { enabled: true, computerEnabled: false, computer: host({ screen: false, accessibility: true }) };

it('keeps only the switch and an entry per tool on the overview; each tool has its own page', async () => {
  vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockResolvedValue({ enabled: false, computerEnabled: false });
  vi.spyOn(V2ApiClient.prototype, 'getAgentBrowserProfiles').mockResolvedValue({ profiles: [{ id: 'p1', name: 'app', createdAt: 1 }], workspaces: { ws_1: 'p1' } });
  const set = vi.spyOn(V2ApiClient.prototype, 'setAgentDesktopEnabled').mockResolvedValue({ ...base, browser: browser(false) });
  await render();
  // Off: the entries are there but cannot be opened.
  expect(button('Agent 浏览器').disabled).toBe(true);
  expect(button('Computer Use').disabled).toBe(true);
  expect(switches()).toHaveLength(1);
  await act(async () => { switches()[0].click(); });
  expect(set).toHaveBeenCalledWith(true);
  // The overview summarizes each tool instead of showing its details.
  expect(button('Agent 浏览器').textContent).toContain('未安装');
  expect(button('Computer Use').textContent).toContain('已关闭');
  expect(container.textContent).not.toContain('localhost 指那台电脑');
  expect(switches()).toHaveLength(1);

  // The browser page: Chromium missing until downloaded; profiles are the backend's.
  await press('Agent 浏览器');
  expect(container.textContent).toContain('尚未安装 Chromium');
  expect(container.textContent).toContain('localhost 指那台电脑');
  expect(container.textContent).not.toContain('允许 Agent 使用浏览器和 Computer Use');
  const install = vi.spyOn(V2ApiClient.prototype, 'installAgentBrowser').mockResolvedValue({ ...base, browser: browser(false, true) });
  await press('下载浏览器组件');
  expect(install).toHaveBeenCalled();
  expect(container.textContent).toContain('正在下载 Chromium… 42%');
  expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
  expect(container.textContent).toContain('app');
  // Back on the overview, the entry the page was opened from has focus.
  await act(async () => { container.querySelector<HTMLButtonElement>('button[aria-label="返回设置"]')!.click(); });
  expect(document.activeElement).toBe(button('Agent 浏览器'));
  expect(button('Agent 浏览器').textContent).toContain('下载中 42%');

  // The Computer Use page controls the backend's own computer, named by the backend.
  await press('Computer Use');
  expect(container.textContent).toContain('允许 Agent 控制 Studio Mac');
  expect(container.textContent).toContain('屏幕录制用于查看屏幕内容未授权');
  const computer = vi.spyOn(V2ApiClient.prototype, 'setAgentComputerEnabled').mockResolvedValue({ ...base, computerEnabled: true, browser: browser(true) });
  expect(switches()).toHaveLength(1);
  await act(async () => { switches()[0].click(); });
  expect(computer).toHaveBeenCalledWith(true);
  // Missing permissions are requested on the host.
  const request = vi.spyOn(V2ApiClient.prototype, 'requestComputerPermissions').mockResolvedValue({
    ...base, computerEnabled: true, computer: host({ screen: true, accessibility: true }), browser: browser(true),
  });
  await press('请求授权');
  expect(request).toHaveBeenCalled();
  expect(container.textContent).toContain('屏幕录制用于查看屏幕内容已授权');
  expect(button('请求授权')).toBeUndefined();
});

it('returns to the overview when the tools are turned off elsewhere', async () => {
  vi.useFakeTimers();
  try {
    const get = vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockResolvedValue({ ...base, browser: browser(true) });
    vi.spyOn(V2ApiClient.prototype, 'getAgentBrowserProfiles').mockResolvedValue({ profiles: [], workspaces: {} });
    await render();
    await press('Computer Use');
    expect(container.textContent).toContain('允许 Agent 控制 Studio Mac');
    get.mockResolvedValue({ ...base, enabled: false, browser: browser(true) });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(container.textContent).not.toContain('允许 Agent 控制 Studio Mac');
    expect(button('Computer Use').disabled).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

it('keeps the last known settings when a later poll fails', async () => {
  vi.useFakeTimers();
  try {
    const get = vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockResolvedValueOnce({ ...base, browser: browser(true) });
    vi.spyOn(V2ApiClient.prototype, 'getAgentBrowserProfiles').mockResolvedValue({ profiles: [], workspaces: {} });
    await render();
    const toggle = () => switches()[0];
    expect(toggle()?.disabled).toBe(false);
    expect(button('Agent 浏览器').textContent).toContain('已就绪');
    get.mockRejectedValue(new ConnectionError('network', 'offline', '', true));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(get).toHaveBeenCalledTimes(2);
    // A transient failure is not "backend without desktop tools".
    expect(toggle()?.disabled).toBe(false);
    expect(toggle()?.checked).toBe(true);
    expect(button('Agent 浏览器').textContent).toContain('已就绪');
    // The backend really lacking the endpoint clears them.
    const notFound = new ConnectionError('server', 'not found', '', false);
    notFound.httpStatus = 404;
    get.mockRejectedValue(notFound);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(container.textContent).not.toContain('已就绪');
    expect(container.textContent).toContain('请先更新后端');
  } finally {
    vi.useRealTimers();
  }
});

it('deletes a browser profile after confirming', async () => {
  vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockResolvedValue({ ...base, browser: browser(true) });
  vi.spyOn(V2ApiClient.prototype, 'getAgentBrowserProfiles').mockResolvedValue({ profiles: [{ id: 'p1', name: 'app', createdAt: 1 }], workspaces: { ws_1: 'p1' } });
  const remove = vi.spyOn(V2ApiClient.prototype, 'deleteAgentBrowserProfile').mockResolvedValue({ profiles: [], workspaces: {} });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await render();
  await press('Agent 浏览器');
  expect(container.textContent).toContain('Chromium版本 154.0已就绪');
  const deleteButton = container.querySelector<HTMLButtonElement>('button[aria-label="删除资料"]')!;
  await act(async () => { deleteButton.click(); });
  expect(remove).toHaveBeenCalledWith('p1');
  expect(container.textContent).toContain('还没有浏览器资料');
});

it('asks to update a backend that still runs the tools on desktops', async () => {
  vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockResolvedValue({ enabled: true, computerEnabled: false });
  vi.spyOn(V2ApiClient.prototype, 'getAgentBrowserProfiles').mockRejectedValue(new Error('404'));
  await render();
  expect(button('Agent 浏览器').textContent).toContain('需更新后端');
  expect(button('Computer Use').textContent).toContain('需更新后端');
  await press('Agent 浏览器');
  expect(container.textContent).toContain('请升级后端后再使用 Agent 浏览器');
  await act(async () => { container.querySelector<HTMLButtonElement>('button[aria-label="返回设置"]')!.click(); });
  await press('Computer Use');
  expect(container.textContent).toContain('请升级后端后再使用');
  expect(switches()).toHaveLength(0);
});

it('explains when the backend predates desktop tools', async () => {
  const notFound = new ConnectionError('server', 'not found', '', false);
  notFound.httpStatus = 404;
  vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockRejectedValue(notFound);
  await render();
  expect(container.textContent).toContain('请先更新后端');
  expect(container.querySelector('[role="switch"], input[type="checkbox"]')).toBeNull();
});
