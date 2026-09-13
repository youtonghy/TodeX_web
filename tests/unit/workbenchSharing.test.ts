import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useWorkbenchSharing } from '../../src/renderer/session/useWorkbenchSharing';
import { loadJson, saveJson } from '../../src/renderer/lib/storage';
import { SETTINGS_STORAGE_KEY } from '../../src/renderer/session/helpers';

const STORAGE_KEY = `${SETTINGS_STORAGE_KEY}.workbenchSharing.v1`;

vi.mock('../../src/renderer/lib/storage', () => ({ loadJson: vi.fn(), saveJson: vi.fn() }));
let root: Root;
let container: HTMLDivElement;
let state: ReturnType<typeof useWorkbenchSharing>;
function Probe() { state = useWorkbenchSharing(); return null; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
beforeAll(() => { Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); });
beforeEach(() => {
  vi.mocked(loadJson).mockReset().mockResolvedValue('conversation');
  vi.mocked(saveJson).mockReset().mockResolvedValue(undefined);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
async function mount() { await act(async () => { root.render(createElement(Probe)); }); }

it('defaults to independent conversation panels without writing during hydration', async () => {
  const loading = deferred<unknown>();
  vi.mocked(loadJson).mockReturnValue(loading.promise);
  await mount();
  expect(state.workbenchSharing).toBe('conversation');
  expect(state.workbenchSharingHydrated).toBe(false);
  expect(saveJson).not.toHaveBeenCalled();
  await act(async () => { loading.resolve(undefined); });
  expect(state.workbenchSharing).toBe('conversation');
  expect(state.workbenchSharingHydrated).toBe(true);
  expect(saveJson).not.toHaveBeenCalled();
});

it('restores workspace sharing without rewriting any existing panel layout', async () => {
  vi.mocked(loadJson).mockResolvedValue('workspace');
  await mount();
  expect(state.workbenchSharing).toBe('workspace');
  expect(state.workbenchSharingHydrated).toBe(true);
  expect(loadJson).toHaveBeenCalledExactlyOnceWith(STORAGE_KEY, 'conversation');
  expect(saveJson).not.toHaveBeenCalled();
});

it.each([null, 'invalid', {}, 1])('falls back to independent panels for invalid persisted preference %s', async value => {
  vi.mocked(loadJson).mockResolvedValue(value);
  await mount();
  expect(state.workbenchSharing).toBe('conversation');
  expect(state.workbenchSharingHydrated).toBe(true);
});

it('keeps a user choice when an earlier storage read resolves later', async () => {
  const loading = deferred<unknown>();
  vi.mocked(loadJson).mockReturnValue(loading.promise);
  await mount();
  await act(async () => { state.setWorkbenchSharing('workspace'); });
  await act(async () => { loading.resolve('conversation'); });
  expect(state.workbenchSharing).toBe('workspace');
  expect(saveJson).toHaveBeenCalledExactlyOnceWith(STORAGE_KEY, 'workspace');
});

it('serializes rapid preference changes so persistence retains the final selection', async () => {
  const firstWrite = deferred<void>();
  vi.mocked(saveJson).mockImplementationOnce(() => firstWrite.promise);
  await mount();
  await act(async () => { state.setWorkbenchSharing('workspace'); state.setWorkbenchSharing('conversation'); });
  expect(state.workbenchSharing).toBe('conversation');
  expect(saveJson).toHaveBeenCalledTimes(1);
  await act(async () => { firstWrite.resolve(); });
  expect(vi.mocked(saveJson).mock.calls).toEqual([
    [STORAGE_KEY, 'workspace'],
    [STORAGE_KEY, 'conversation'],
  ]);
});

it('remains usable after a storage read fails', async () => {
  vi.mocked(loadJson).mockRejectedValue(new Error('storage unavailable'));
  await mount();
  expect(state.workbenchSharing).toBe('conversation');
  expect(state.workbenchSharingHydrated).toBe(true);
  await act(async () => { state.setWorkbenchSharing('workspace'); });
  expect(state.workbenchSharing).toBe('workspace');
  expect(saveJson).toHaveBeenCalledExactlyOnceWith(STORAGE_KEY, 'workspace');
});
