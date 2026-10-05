import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { V2ApiClient } from '@todex/protocol/v2';
import { ConnectionError } from '@todex/protocol/connectionError';
import { AgentDesktopSettings } from '../../src/renderer/components/AgentDesktopSettings';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';

let root: Root;
let container: HTMLDivElement;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.restoreAllMocks(); });

async function render() {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(createElement(AgentDesktopSettings, { session })); });
}

const host = (permissions: { screen: boolean; accessibility: boolean }) => ({
  supported: true, available: permissions.screen && permissions.accessibility, host: 'Studio Mac', platform: 'macos', permissions,
});

const session = { settings: { serverUrl: 'https://backend.test', deviceSecret: '' }, activeWorkspace: { id: 'ws_1', path: '/w/app', name: 'app' }, workspaces: [{ id: 'ws_1', path: '/w/app', name: 'app' }] } as unknown as TodeXSession;
const browser = (installed: boolean, downloading = false) => ({
  available: installed, host: 'Studio Mac', chromium: { version: '154.0', installed, downloading, overridden: false, ...(downloading ? { progress: 0.42 } : {}) },
});
const base = { enabled: true, computerEnabled: false, computer: host({ screen: false, accessibility: true }) };

it('toggles desktop tools; Computer Use and the browser run on the backend computer', async () => {
  vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockResolvedValue({ enabled: false, computerEnabled: false });
  vi.spyOn(V2ApiClient.prototype, 'getAgentBrowserProfiles').mockResolvedValue({ profiles: [{ id: 'p1', name: 'app', createdAt: 1 }], workspaces: { ws_1: 'p1' } });
  const set = vi.spyOn(V2ApiClient.prototype, 'setAgentDesktopEnabled').mockResolvedValue({ ...base, browser: browser(false) });
  await render();
  const toggle = container.querySelector<HTMLInputElement>('input[type="checkbox"], [role="switch"]');
  expect(toggle).not.toBeNull();
  await act(async () => { toggle!.click(); });
  expect(set).toHaveBeenCalledWith(true);
  // Computer Use controls the backend's own computer, named by the backend.
  expect(container.textContent).toContain('允许 Agent 控制 Studio Mac');
  expect(container.textContent).toContain('需要屏幕录制权限');
  // The browser: Chromium missing until downloaded; profiles are the backend's.
  expect(container.textContent).toContain('尚未安装 Chromium');
  expect(container.textContent).toContain('localhost 指那台电脑');
  const install = vi.spyOn(V2ApiClient.prototype, 'installAgentBrowser').mockResolvedValue({ ...base, browser: browser(false, true) });
  const download = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('下载浏览器组件'))!;
  await act(async () => { download.click(); });
  expect(install).toHaveBeenCalled();
  expect(container.textContent).toContain('正在下载 Chromium… 42%');
  expect(container.textContent).toContain('app');
  const computer = vi.spyOn(V2ApiClient.prototype, 'setAgentComputerEnabled').mockResolvedValue({ ...base, computerEnabled: true, browser: browser(true) });
  const switches = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"], [role="switch"]');
  expect(switches.length).toBe(2);
  await act(async () => { switches[1].click(); });
  expect(computer).toHaveBeenCalledWith(true);
  expect(container.textContent).toContain('Chromium 154.0 已就绪');
  // Missing permissions are requested on the host.
  const request = vi.spyOn(V2ApiClient.prototype, 'requestComputerPermissions').mockResolvedValue({
    ...base, computerEnabled: true, computer: host({ screen: true, accessibility: true }), browser: browser(true),
  });
  const grant = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('请求授权'))!;
  await act(async () => { grant.click(); });
  expect(request).toHaveBeenCalled();
  expect(container.textContent).toContain('已授予屏幕录制');
});

it('deletes a browser profile after confirming', async () => {
  vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockResolvedValue({ ...base, browser: browser(true) });
  vi.spyOn(V2ApiClient.prototype, 'getAgentBrowserProfiles').mockResolvedValue({ profiles: [{ id: 'p1', name: 'app', createdAt: 1 }], workspaces: { ws_1: 'p1' } });
  const remove = vi.spyOn(V2ApiClient.prototype, 'deleteAgentBrowserProfile').mockResolvedValue({ profiles: [], workspaces: {} });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await render();
  const deleteButton = container.querySelector<HTMLButtonElement>('button[aria-label="删除资料"]')!;
  await act(async () => { deleteButton.click(); });
  expect(remove).toHaveBeenCalledWith('p1');
  expect(container.textContent).toContain('还没有浏览器资料');
});

it('asks to update a backend that still runs the tools on desktops', async () => {
  vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockResolvedValue({ enabled: true, computerEnabled: false });
  vi.spyOn(V2ApiClient.prototype, 'getAgentBrowserProfiles').mockRejectedValue(new Error('404'));
  await render();
  expect(container.textContent).toContain('请升级后端');
  expect(container.querySelectorAll('[role="switch"], input[type="checkbox"]').length).toBe(1);
});

it('explains when the backend predates desktop tools', async () => {
  const notFound = new ConnectionError('server', 'not found', '', false);
  notFound.httpStatus = 404;
  vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockRejectedValue(notFound);
  await render();
  expect(container.textContent).toContain('请先更新后端');
  expect(container.querySelector('[role="switch"], input[type="checkbox"]')).toBeNull();
});
