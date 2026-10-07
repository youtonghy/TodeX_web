import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Toast, toast } from '@heroui/react';
import { DevicePairingPanel } from '../../src/renderer/components/DevicePairingPanel';
import { beginDevicePairing } from '../../src/renderer/session/devicePairing';
import type { DevicePairingRequest } from '../../src/renderer/session/devicePairing';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';
import { deviceIdentityFromSecret, generateDeviceIdentity } from '@todex/protocol/deviceAuth';
import { transportFingerprint } from '@todex/protocol/secureChannel';
import type { BackendConnectionProfile } from '@todex/protocol/todex';

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
beforeEach(() => { vi.useFakeTimers(); vi.mocked(beginDevicePairing).mockReset(); });
afterEach(() => {
  act(() => { toast.clear(); root?.unmount(); });
  container?.remove();
  vi.useRealTimers();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
const KEY = Buffer.from(new Uint8Array(32).fill(5)).toString('base64url');
const PIN = { encryptionProtocol: 'x25519' as const, encryptionPublicKey: KEY };
function request() {
  return {
    verificationCode: 'SAFE-1234', transportFingerprint: transportFingerprint('x25519', KEY), expiresAt: Date.now() + 300_000,
    poll: vi.fn<DevicePairingRequest['poll']>().mockResolvedValue({ status: 'pending' }),
    cancel: vi.fn<DevicePairingRequest['cancel']>().mockResolvedValue(undefined),
  };
}
type ProfilePatch = Partial<Pick<BackendConnectionProfile, 'deviceSecret' | 'encryptionProtocol' | 'encryptionPublicKey' | 'transportVerified'>>;
function render(profile: ProfilePatch = {}) {
  const updateBackendConnection = vi.fn();
  const setSettings = vi.fn();
  const connect = vi.fn();
  const credentials = { deviceSecret: '', encryptionProtocol: 'none' as const, encryptionPublicKey: '', transportVerified: false, ...profile };
  const session = {
    activeBackendConnectionId: 'a',
    backendConnections: [{ id: 'a', serverUrl: 'https://a.test', ...credentials }],
    settings: { serverUrl: 'https://a.test', ...credentials },
    updateBackendConnection, setSettings, connect, onDevicePairingApproved: vi.fn(),
  } as unknown as TodeXSession;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const rerender = (next = session) => act(() => root.render(createElement(React.Fragment, null,
    createElement(DevicePairingPanel, { session: next, deviceName: 'TodeX Web' }),
    createElement(Toast.Provider),
  )));
  rerender();
  return { session, rerender, updateBackendConnection, setSettings, connect };
}
async function press(label: string) {
  const button = [...container.querySelectorAll('button')].find(item => item.textContent === label);
  expect(button, label).toBeTruthy();
  await act(async () => { button!.click(); });
}
async function flushNotices() { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); }
async function tick(ms = 2000) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  await flushNotices();
}
function notices() { return [...document.querySelectorAll('[data-slot="toast"]')].map(item => item.textContent).join(' '); }

it('shows the code and fingerprint, then pins the device key and the verified transport in one update', async () => {
  const req = request();
  req.poll.mockResolvedValue({ status: 'approved', deviceId: 'dev_test1234567890', pin: PIN });
  vi.mocked(beginDevicePairing).mockResolvedValue(req);
  const state = render();
  expect(container.textContent).toContain('未配对');
  await press('设备验证');
  expect(container.textContent).toContain('SAFE-1234');
  expect(container.textContent).toContain(transportFingerprint('x25519', KEY));
  expect(container.textContent).toContain('等待后端批准');
  // Nothing is persisted before approval.
  expect(state.updateBackendConnection).not.toHaveBeenCalled();
  expect(state.setSettings).not.toHaveBeenCalled();
  const device = vi.mocked(beginDevicePairing).mock.calls[0][2];
  expect(beginDevicePairing).toHaveBeenCalledWith('https://a.test', 'TodeX Web', expect.objectContaining({ deviceId: expect.any(String) }), expect.any(AbortSignal));
  await tick();
  expect(state.session.onDevicePairingApproved).toHaveBeenCalledExactlyOnceWith('a', {
    deviceSecret: device.secretKey, ...PIN, transportVerified: true,
  });
  expect(state.updateBackendConnection).not.toHaveBeenCalled();
  expect(notices()).toContain('已批准，可连接');
  expect(req.cancel).not.toHaveBeenCalled();
});

it('re-pairing the same backend reuses its device key', async () => {
  const secret = generateDeviceIdentity().secretKey;
  const req = request();
  req.poll.mockResolvedValue({ status: 'approved', deviceId: 'dev_test1234567890', pin: PIN });
  vi.mocked(beginDevicePairing).mockResolvedValue(req);
  const state = render({ deviceSecret: secret, encryptionProtocol: 'x25519', encryptionPublicKey: KEY, transportVerified: false });
  expect(container.textContent).toContain('未验证，需要重新配对');
  await press('重新配对');
  expect(vi.mocked(beginDevicePairing).mock.calls[0][2].deviceId).toBe(deviceIdentityFromSecret(secret)!.deviceId);
  await tick();
  expect(state.session.onDevicePairingApproved).toHaveBeenCalledExactlyOnceWith('a', {
    deviceSecret: secret, ...PIN, transportVerified: true,
  });
});

it('shows a verified pin read-only, with its fingerprint', () => {
  render({ deviceSecret: generateDeviceIdentity().secretKey, ...PIN, transportVerified: true });
  const status = container.querySelector('dl')!;
  expect(status.textContent).toContain('x25519');
  expect(status.textContent).toContain(transportFingerprint('x25519', KEY));
  expect(status.textContent).toContain('已通过设备配对验证');
  expect(container.querySelector('input, textarea, select')).toBeNull();
});

it('a mismatching approval pins nothing', async () => {
  const req = request();
  req.poll.mockRejectedValue(new Error('批准结果与此设备或配对时显示的加密公钥不一致，未保存任何内容，请重新配对。'));
  vi.mocked(beginDevicePairing).mockResolvedValue(req);
  const state = render();
  await press('设备验证');
  await tick();
  expect(notices()).toContain('未保存任何内容');
  expect(state.session.onDevicePairingApproved).not.toHaveBeenCalled();
  expect(state.updateBackendConnection).not.toHaveBeenCalled();
  expect(state.setSettings).not.toHaveBeenCalled();
});

it.each(['profile', 'address', 'settings address'] as const)('ignores a late approval after changing %s', async change => {
  const req = request();
  const pending = deferred<Awaited<ReturnType<DevicePairingRequest['poll']>>>();
  req.poll.mockReturnValue(pending.promise);
  vi.mocked(beginDevicePairing).mockResolvedValue(req);
  const state = render();
  await press('设备验证');
  await tick();
  const next = { ...state.session };
  if (change === 'profile') next.activeBackendConnectionId = 'b';
  else if (change === 'address') next.backendConnections = state.session.backendConnections.map(p => ({ ...p, serverUrl: 'https://b.test' }));
  else next.settings = { ...state.session.settings, serverUrl: 'https://b.test' };
  state.rerender(next);
  await act(async () => { pending.resolve({ status: 'approved', deviceId: 'dev_late1234567890', pin: PIN }); });
  expect(req.cancel).toHaveBeenCalledOnce();
  expect(req.poll.mock.calls[0][0]?.aborted).toBe(true);
  expect(next.onDevicePairingApproved).not.toHaveBeenCalled();
  await flushNotices();
  expect(notices()).not.toContain('已批准');
});

it('does not overlap polls and cancels an in-flight request without accepting its result', async () => {
  const req = request();
  const pending = deferred<Awaited<ReturnType<DevicePairingRequest['poll']>>>();
  req.poll.mockReturnValue(pending.promise);
  vi.mocked(beginDevicePairing).mockResolvedValue(req);
  const state = render();
  await press('设备验证');
  await tick(10_000);
  expect(req.poll).toHaveBeenCalledOnce();
  await press('取消验证');
  await act(async () => { pending.resolve({ status: 'approved', deviceId: 'dev_late1234567890', pin: PIN }); });
  await flushNotices();
  expect(notices()).toContain('已取消');
  expect(req.cancel).toHaveBeenCalledOnce();
  expect(state.session.onDevicePairingApproved).not.toHaveBeenCalled();
});

it('cancels a late creation response after unmounting', async () => {
  const pending = deferred<DevicePairingRequest>();
  vi.mocked(beginDevicePairing).mockReturnValue(pending.promise);
  render();
  await press('设备验证');
  act(() => root.unmount());
  const req = request();
  await act(async () => { pending.resolve(req); });
  expect(vi.mocked(beginDevicePairing).mock.calls).toHaveLength(1);
  expect(vi.mocked(beginDevicePairing).mock.calls[0][3]?.aborted).toBe(true);
  expect(req.cancel).toHaveBeenCalledOnce();
  expect(req.poll).not.toHaveBeenCalled();
});

it('expires locally even while a poll is stalled and ignores a late approval', async () => {
  const req = request();
  req.expiresAt = Date.now() + 5000;
  const pending = deferred<Awaited<ReturnType<DevicePairingRequest['poll']>>>();
  req.poll.mockReturnValue(pending.promise);
  vi.mocked(beginDevicePairing).mockResolvedValue(req);
  const state = render();
  await press('设备验证');
  await tick(5000);
  expect(notices()).toContain('申请已过期');
  await act(async () => { pending.resolve({ status: 'approved', deviceId: 'dev_late1234567890', pin: PIN }); });
  expect(state.session.onDevicePairingApproved).not.toHaveBeenCalled();
  expect(req.cancel).toHaveBeenCalledOnce();
});

it.each(['rejected', 'expired'] as const)('shows terminal %s feedback and stops polling', async status => {
  const req = request();
  req.poll.mockResolvedValue({ status });
  vi.mocked(beginDevicePairing).mockResolvedValue(req);
  const state = render();
  await press('设备验证');
  await tick(10_000);
  expect(notices()).toContain(status === 'rejected' ? '后端已拒绝申请' : '申请已过期');
  expect(req.poll).toHaveBeenCalledOnce();
  expect(state.updateBackendConnection).not.toHaveBeenCalled();
  // A retry for the same backend enrolls the same (not yet persisted) key.
  await press('重新申请');
  const [first, second] = vi.mocked(beginDevicePairing).mock.calls;
  expect(second[2].deviceId).toBe(first[2].deviceId);
});

it('shows a safe error instead of applying a malformed approval', async () => {
  const req = request();
  req.poll.mockRejectedValue(new Error('校验失败，请重试'));
  vi.mocked(beginDevicePairing).mockResolvedValue(req);
  const state = render();
  await press('设备验证');
  await tick();
  expect(notices()).toContain('校验失败');
  expect(state.session.onDevicePairingApproved).not.toHaveBeenCalled();
});
