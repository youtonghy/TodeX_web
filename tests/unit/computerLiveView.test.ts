import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { V2ApiClient } from '@todex/protocol/v2';
import { ComputerLiveView } from '../../src/renderer/components/ComputerLiveView';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';

let root: Root;
let container: HTMLDivElement;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.restoreAllMocks(); });
const session = { settings: { serverUrl: 'https://backend.test', deviceSecret: '' } } as unknown as TodeXSession;
const action = (actionId: string, extra: Record<string, unknown> = {}) => ({
  actionId, tool: 'computer_act' as const, ok: true, summary: `click ${actionId}`, deviceId: 'dev', deviceName: 'Studio Mac', time: '2026-10-04T12:00:00Z', ...extra,
});

async function render(state: Parameters<typeof ComputerLiveView>[0]['state']) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(createElement(ComputerLiveView, { session, conversationId: 'c', state })); });
}

it('stays hidden unless the agent controls the computer', async () => {
  await render({ active: false, actions: [action('a', { shotId: 'shot_a' })] });
  expect(container.textContent).toBe('');
});

it('says when the first use waits for the person at the host', async () => {
  await render({ active: false, awaitingHost: true, deviceName: 'Studio Mac', actions: [] });
  expect(container.textContent).toContain('正在等待 Studio Mac 前的人允许 Computer Use');
});

it('shows the live frame, the action and a working stop button', async () => {
  const frame = vi.spyOn(V2ApiClient.prototype, 'getComputerFrame').mockResolvedValue({ mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,live' });
  const revoke = vi.spyOn(V2ApiClient.prototype, 'revokeAgentDesktop').mockResolvedValue({ conversationId: 'c', revoked: true });
  await render({ active: true, deviceName: 'Studio Mac', actions: [action('a', { shotId: 'shot_a' }), action('b', { app: 'TextEdit' })] });
  expect(frame).toHaveBeenCalledWith('c');
  expect(container.textContent).toContain('Studio Mac');
  expect(container.textContent).toContain('click b · TextEdit');
  expect(container.textContent).toContain('实时');
  expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/jpeg;base64,live');
  const stop = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('停止'))!;
  await act(async () => { stop.click(); });
  expect(revoke).toHaveBeenCalledWith('c', 'screen');
});

it('falls back to the latest screenshot without a live frame', async () => {
  vi.spyOn(V2ApiClient.prototype, 'getComputerFrame').mockRejectedValue(new Error('404'));
  vi.spyOn(V2ApiClient.prototype, 'getAgentShot').mockImplementation(async (_c, shotId) => ({ shotId, mimeType: 'image/jpeg', dataUrl: `data:image/jpeg;base64,${shotId}` }));
  await render({ active: true, deviceName: 'Studio Mac', actions: [action('a', { shotId: 'shot_a' })] });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/jpeg;base64,shot_a');
  expect(container.textContent).not.toContain('实时');
});
