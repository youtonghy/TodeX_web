import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { V2ApiClient } from '@todex/protocol/v2';
import { AgentBrowserShotsPane } from '../../src/renderer/components/AgentBrowserShotsPane';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';

let root: Root;
let container: HTMLDivElement;
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.restoreAllMocks(); });

const session = { settings: { serverUrl: 'https://backend.test', deviceSecret: '' } } as unknown as TodeXSession;
const action = (actionId: string, extra: Record<string, unknown> = {}) => ({
  actionId, tool: 'browser_snapshot' as const, ok: true, summary: actionId, deviceId: 'dev', deviceName: 'Studio Mac', time: '2026-10-03T12:00:00Z', ...extra,
});

async function render(state: Parameters<typeof AgentBrowserShotsPane>[0]['state']) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(createElement(AgentBrowserShotsPane, { state, session, conversationId: 'c' })); });
}

it('shows the newest screenshot and lists actions newest first', async () => {
  const getShot = vi.spyOn(V2ApiClient.prototype, 'getAgentShot').mockImplementation(async (_conversation, shotId) => ({ shotId, mimeType: 'image/jpeg', dataUrl: `data:image/jpeg;base64,${shotId}` }));
  await render({ granted: true, deviceName: 'Studio Mac', actions: [
    action('open http://localhost:5173/', { url: 'http://localhost:5173/', title: 'Dev' }),
    action('snapshot', { shotId: 'shot_old' }),
    action('click e1', { shotId: 'shot_new' }),
  ] });
  expect(getShot).toHaveBeenCalledWith('c', 'shot_new');
  expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/jpeg;base64,shot_new');
  const rows = [...container.querySelectorAll('button')].map(button => button.textContent ?? '');
  expect(rows.findIndex(row => row.includes('click e1'))).toBeLessThan(rows.findIndex(row => row.includes('snapshot')));
  expect(container.textContent).toContain('Dev');
});

it('explains where the agent browses before any screenshot', async () => {
  await render({ granted: false, actions: [] });
  expect(container.textContent).toContain('桌面端');
  const stop = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('停止'));
  expect(stop?.disabled).toBe(true);
});
