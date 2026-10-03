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

it('toggles desktop tools and lists online desktops', async () => {
  vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockResolvedValue({ enabled: false, executors: [] });
  const set = vi.spyOn(V2ApiClient.prototype, 'setAgentDesktopEnabled').mockResolvedValue({
    enabled: true, executors: [{ executorId: 1, deviceId: 'dev', deviceName: 'Studio Mac', platform: 'darwin', capabilities: ['browser'] }],
  });
  await render();
  const toggle = container.querySelector<HTMLInputElement>('input[type="checkbox"], [role="switch"]');
  expect(toggle).not.toBeNull();
  await act(async () => { toggle!.click(); });
  expect(set).toHaveBeenCalledWith(true);
  expect(container.textContent).toContain('Studio Mac');
});

it('explains when the backend predates desktop tools', async () => {
  const notFound = new ConnectionError('server', 'not found', '', false);
  notFound.httpStatus = 404;
  vi.spyOn(V2ApiClient.prototype, 'getAgentDesktop').mockRejectedValue(notFound);
  await render();
  expect(container.textContent).toContain('请更新后端');
  expect(container.querySelector('[role="switch"], input[type="checkbox"]')).toBeNull();
});
