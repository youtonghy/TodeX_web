import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SettingsPanel } from '../../src/renderer/screens/SettingsPanel';
import { beginDevicePairing } from '../../src/renderer/session/devicePairing';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
});
vi.mock('../../src/renderer/session/devicePairing', () => ({ beginDevicePairing: vi.fn() }));
let root: Root;
let container: HTMLDivElement;
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  // jsdom has no element scrolling; settings pages scroll to their top.
  Element.prototype.scrollTo ??= () => {};
});
beforeEach(() => { vi.mocked(beginDevicePairing).mockReset().mockReturnValue(new Promise(() => {})); });
afterEach(() => {
  act(() => { root?.unmount(); });
  container?.remove();
});
const KEY = Buffer.from(new Uint8Array(32).fill(5)).toString('base64url');
function render(props: { repairPairing?: boolean } = {}) {
  const updateBackendConnection = vi.fn();
  const setSettings = vi.fn();
  const credentials = { deviceSecret: 'device-secret', encryptionProtocol: 'x25519', encryptionPublicKey: KEY, transportVerified: true };
  const history = { view: { backendId: 'a', status: 'idle' }, grantRuns: {}, refresh: vi.fn(async () => {}) };
  const session = {
    activeBackendConnectionId: 'a', backendConnections: [{ id: 'a', name: 'Backend A', serverUrl: 'https://a.test', tenantId: '', ...credentials }],
    settings: { serverUrl: 'https://a.test', tenantId: '', ...credentials },
    backendLinkStatus: {}, noWorkspaceBackendId: 'a', setNoWorkspaceBackendId: vi.fn(),
    connectionState: 'idle', connectionHealth: { state: 'idle' }, updateBackendConnection, setSettings,
    historyEncryption: { ...history, forBackend: () => history },
  } as unknown as TodeXSession;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(createElement(SettingsPanel, { session, ...props })));
  return { session, updateBackendConnection, setSettings };
}
// Opens a backend's own page from the backend list.
async function openBackend(id = 'a') {
  const entry = container.querySelector<HTMLButtonElement>(`[data-backend-id="${id}"]`);
  expect(entry).toBeTruthy();
  await act(async () => { entry!.click(); });
}
// Text fields by accessible name: an aria-label (BoardUI Input) or an associated <label>.
function input(label: string) {
  const fields = [...container.querySelectorAll<HTMLInputElement>('input')];
  return fields.find(field => field.getAttribute('aria-label') === label || [...field.labels ?? []].some(item => item.textContent === label)) ?? null;
}
async function type(field: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

it('offers no way to type, paste or import a transport protocol or key', async () => {
  render();
  await openBackend();
  expect(input('加密公钥')).toBeNull();
  expect(input('加密')).toBeNull();
  expect(container.querySelector('textarea, input[type="file"]')).toBeNull();
  expect(container.textContent).not.toMatch(/导入粘贴内容|二维码/);
  // The pin is shown read-only, with the action that replaces it.
  expect(container.querySelector('dl')?.textContent).toContain('已通过设备配对验证');
  expect([...container.querySelectorAll('button')].some(button => button.textContent === '重新配对')).toBe(true);
});

it('changing the server URL drops the device key and the transport pin', async () => {
  const state = render();
  await openBackend();
  await type(input('后端地址')!, 'https://b.test');
  const cleared = { deviceSecret: '', encryptionProtocol: 'none', encryptionPublicKey: '', transportVerified: false };
  expect(state.updateBackendConnection).toHaveBeenCalledExactlyOnceWith('a', { serverUrl: 'https://b.test', ...cleared });
  // The backend profile is the only place the transport lives.
  expect(state.setSettings).not.toHaveBeenCalled();
});

it('keeps the pin when only the spelling of the same origin changes', async () => {
  const state = render();
  await openBackend();
  await type(input('后端地址')!, 'https://a.test/');
  expect(state.updateBackendConnection).toHaveBeenCalledExactlyOnceWith('a', { serverUrl: 'https://a.test/' });
});

it('a re-pair request from a refused connection starts device pairing', async () => {
  render({ repairPairing: true });
  await act(async () => {});
  expect(beginDevicePairing).toHaveBeenCalledOnce();
  expect(beginDevicePairing).toHaveBeenCalledWith('https://a.test', 'TodeX Web', expect.anything(), expect.any(AbortSignal));
});
