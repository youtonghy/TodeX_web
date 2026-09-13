import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '@heroui/react';
import { SettingsPanel } from '../../src/renderer/screens/SettingsPanel';
import { resolvePairingPayload, type ParsedPairing } from '@todex/protocol/transportCrypto';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
});
vi.mock('@todex/protocol/transportCrypto', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/transportCrypto')>(),
  resolvePairingPayload: vi.fn(),
  parsePairingQrFrame: vi.fn(raw => ({ kind: 'pairing', raw })),
}));
let root: Root;
let container: HTMLDivElement;
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(() => {
  act(() => { toast.clear(); root?.unmount(); });
  container?.remove();
});
function render() {
  const updateBackendConnection = vi.fn();
  const setSettings = vi.fn();
  const session = {
    activeBackendConnectionId: 'a', backendConnections: [{ id: 'a', name: 'Backend A', serverUrl: 'https://a.test', authToken: 'device-token', tenantId: '', encryptionProtocol: 'x25519', encryptionPublicKey: '' }],
    settings: { serverUrl: 'https://a.test', authToken: 'device-token', tenantId: '', encryptionProtocol: 'x25519', encryptionPublicKey: '' },
    connectionState: 'idle', connectionHealth: { state: 'idle' }, updateBackendConnection, setSettings,
  } as unknown as TodeXSession;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const rerender = (next = session) => act(() => root.render(createElement(SettingsPanel, { session: next })));
  rerender();
  return { session, rerender, updateBackendConnection, setSettings };
}
async function importQr() {
  const textarea = container.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'qr payload');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent === '导入粘贴内容')!.click(); });
}
const pairing: ParsedPairing = { serverUrl: 'https://a.test', authToken: '', encryptionProtocol: 'x25519', encryptionPublicKey: 'imported-key' };
it('updates both the profile and live settings with the imported public key without losing device approval', async () => {
  vi.mocked(resolvePairingPayload).mockResolvedValue(pairing);
  const state = render();
  await importQr();
  const expected = { ...pairing, authToken: 'device-token' };
  expect(state.updateBackendConnection).toHaveBeenCalledExactlyOnceWith('a', expected);
  expect(state.setSettings.mock.calls[0][0](state.session.settings)).toEqual({ ...state.session.settings, ...expected });
});
it('clears the old backend token in both destinations when importing a different public backend', async () => {
  const other = { ...pairing, serverUrl: 'https://b.test' };
  vi.mocked(resolvePairingPayload).mockResolvedValue(other);
  const state = render();
  await importQr();
  expect(state.updateBackendConnection).toHaveBeenCalledExactlyOnceWith('a', other);
  expect(state.setSettings.mock.calls[0][0](state.session.settings).authToken).toBe('');
});
it('ignores an import that resolves after the user switches backend profiles', async () => {
  let finish!: (value: ParsedPairing) => void;
  vi.mocked(resolvePairingPayload).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const state = render();
  await importQr();
  state.rerender({ ...state.session, activeBackendConnectionId: 'b' });
  await act(async () => { finish(pairing); });
  expect(state.updateBackendConnection).not.toHaveBeenCalled();
  expect(state.setSettings).not.toHaveBeenCalled();
});

it('immediately applies a directly pasted encryption public key without losing the approved token', async () => {
  const state = render();
  const label = [...container.querySelectorAll('label')].find(item => item.textContent === '加密公钥');
  expect(label).toBeTruthy();
  const input = document.getElementById(label!.htmlFor) as HTMLInputElement;
  expect(input).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'directly-pasted-key');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(state.updateBackendConnection).toHaveBeenCalledExactlyOnceWith('a', { encryptionPublicKey: 'directly-pasted-key' });
  expect(state.setSettings.mock.calls[0][0](state.session.settings)).toEqual({ ...state.session.settings, encryptionPublicKey: 'directly-pasted-key' });
});
