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
const session = { settings: { serverUrl: 'https://backend.test', deviceSecret: '' } } as unknown as TodeXSession;

async function render() {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(createElement(AgentDesktopSettings, { session })); });
}

const host = (permissions: { screen: boolean; accessibility: boolean }) => ({
  supported: true, available: permissions.screen && permissions.accessibility, host: 'Studio Mac', platform: 'macos', permissions,
});

it('toggles desktop tools and lists online desktops', async () => {
  vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockResolvedValue({ enabled: false, computerEnabled: false, executors: [] });
  const set = vi.spyOn(V2ApiClient.prototype, 'setAgentDesktopEnabled').mockResolvedValue({
    enabled: true, computerEnabled: false, executors: [{ executorId: 1, deviceId: 'dev', deviceName: 'Desk', platform: 'darwin', capabilities: ['browser'] }],
    computer: host({ screen: false, accessibility: true }),
  });
  await render();
  const toggle = container.querySelector<HTMLInputElement>('input[type="checkbox"], [role="switch"]');
  expect(toggle).not.toBeNull();
  await act(async () => { toggle!.click(); });
  expect(set).toHaveBeenCalledWith(true);
  expect(container.textContent).toContain('Desk');
  // Computer Use controls the backend's own computer, named by the backend.
  expect(container.textContent).toContain('允许 Agent 控制 Studio Mac');
  expect(container.textContent).toContain('需要屏幕录制权限');
  const computer = vi.spyOn(V2ApiClient.prototype, 'setAgentComputerEnabled').mockResolvedValue({
    enabled: true, computerEnabled: true, executors: [], computer: host({ screen: false, accessibility: true }),
  });
  const switches = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"], [role="switch"]');
  expect(switches.length).toBe(2);
  await act(async () => { switches[1].click(); });
  expect(computer).toHaveBeenCalledWith(true);
  // Missing permissions are requested on the host.
  const request = vi.spyOn(V2ApiClient.prototype, 'requestComputerPermissions').mockResolvedValue({
    enabled: true, computerEnabled: true, executors: [], computer: host({ screen: true, accessibility: true }),
  });
  const grant = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('请求授权'))!;
  await act(async () => { grant.click(); });
  expect(request).toHaveBeenCalled();
  expect(container.textContent).toContain('已授予屏幕录制');
  expect([...container.querySelectorAll('button')].some(button => button.textContent?.includes('请求授权'))).toBe(false);
});

it('asks to update a backend that still runs Computer Use on desktops', async () => {
  vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockResolvedValue({ enabled: true, computerEnabled: false, executors: [] });
  await render();
  expect(container.textContent).toContain('请升级后端');
  expect(container.querySelectorAll('[role="switch"], input[type="checkbox"]').length).toBe(1);
});

it('explains when the backend predates desktop tools', async () => {
  const notFound = new ConnectionError('server', 'not found', '', false);
  notFound.httpStatus = 404;
  vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockRejectedValue(notFound);
  await render();
  expect(container.textContent).toContain('请更新后端');
  expect(container.querySelector('[role="switch"], input[type="checkbox"]')).toBeNull();
});
