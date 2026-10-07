import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '@heroui/react';
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
});
beforeEach(() => { vi.mocked(beginDevicePairing).mockReset().mockReturnValue(new Promise(() => {})); });
afterEach(() => {
  act(() => { toast.clear(); root?.unmount(); });
  container?.remove();
});
const KEY = Buffer.from(new Uint8Array(32).fill(5)).toString('base64url');
function render(props: { repairPairing?: boolean } = {}) {
  const updateBackendConnection = vi.fn();
  const setSettings = vi.fn();
  const credentials = { deviceSecret: 'device-secret', encryptionProtocol: 'x25519', encryptionPublicKey: KEY, transportVerified: true };
  const session = {
    activeBackendConnectionId: 'a', backendConnections: [{ id: 'a', name: 'Backend A', serverUrl: 'https://a.test', tenantId: '', ...credentials }],
    settings: { serverUrl: 'https://a.test', tenantId: '', ...credentials },
    connectionState: 'idle', connectionHealth: { state: 'idle' }, updateBackendConnection, setSettings,
    historyEncryption: { view: { backendId: 'a', status: 'idle' }, grantRuns: {}, refresh: vi.fn(async () => {}) },
  } as unknown as TodeXSession;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(createElement(SettingsPanel, { session, ...props })));
  return { session, updateBackendConnection, setSettings };
}
function input(label: string) {
  const element = [...container.querySelectorAll('label')].find(item => item.textContent === label);
  return element ? document.getElementById(element.htmlFor) as HTMLInputElement | null : null;
}
async function type(field: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

it('offers no way to type, paste or import a transport protocol or key', () => {
  render();
  expect(input('加密公钥')).toBeNull();
  expect(input('加密')).toBeNull();
  expect(container.querySelector('textarea, input[type="file"]')).toBeNull();
  expect(container.textContent).not.toMatch(/导入粘贴内容|二维码/);
  // The pin is shown read-only, with the action that replaces it.
  expect(container.querySelector('dl')?.textContent).toContain('已通过设备配对验证');
  expect([...container.querySelectorAll('button')].some(button => button.textContent === '重新配对')).toBe(true);
});

it('changing the server URL drops the device key and the transport pin in both destinations', async () => {
  const state = render();
  await type(input('后端地址')!, 'https://b.test');
  const cleared = { deviceSecret: '', encryptionProtocol: 'none', encryptionPublicKey: '', transportVerified: false };
  expect(state.updateBackendConnection).toHaveBeenCalledExactlyOnceWith('a', { serverUrl: 'https://b.test', ...cleared });
  expect(state.setSettings.mock.calls[0][0](state.session.settings)).toEqual({ ...state.session.settings, serverUrl: 'https://b.test', ...cleared });
});

it('keeps the pin when only the spelling of the same origin changes', async () => {
  const state = render();
  await type(input('后端地址')!, 'https://a.test/');
  expect(state.updateBackendConnection).toHaveBeenCalledExactlyOnceWith('a', { serverUrl: 'https://a.test/' });
});

it('a re-pair request from a refused connection starts device pairing', async () => {
  render({ repairPairing: true });
  await act(async () => {});
  expect(beginDevicePairing).toHaveBeenCalledOnce();
  expect(beginDevicePairing).toHaveBeenCalledWith('https://a.test', 'TodeX Web', expect.anything(), expect.any(AbortSignal));
});
