import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Toast, toast } from '@heroui/react';
import { DevicePairingPanel } from '../../src/renderer/components/DevicePairingPanel';
import { beginDevicePairing } from '../../src/renderer/session/devicePairing';
import type { DevicePairingRequest } from '../../src/renderer/session/devicePairing';
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
function request() {
  return {
    verificationCode: 'SAFE-1234', expiresAt: Date.now() + 300_000,
    poll: vi.fn<DevicePairingRequest['poll']>().mockResolvedValue({ status: 'pending' }),
    cancel: vi.fn<DevicePairingRequest['cancel']>().mockResolvedValue(undefined),
  };
}
function render() {
  const updateBackendConnection = vi.fn();
  const setSettings = vi.fn();
  const connect = vi.fn();
  const session = {
    activeBackendConnectionId: 'a',
    backendConnections: [{ id: 'a', serverUrl: 'https://a.test', encryptionProtocol: 'x25519', encryptionPublicKey: '' }],
    settings: { serverUrl: 'https://a.test', deviceSecret: '', encryptionProtocol: 'x25519', encryptionPublicKey: '' },
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

it('shows a verification code, enrolls a fresh device key, and connects on approval', async () => {
  const req = request();
  req.poll.mockResolvedValue({ status: 'approved', deviceId: 'dev_test1234567890' });
  vi.mocked(beginDevicePairing).mockResolvedValue(req);
  const state = render();
  await press('设备验证');
  expect(container.textContent).toContain('SAFE-1234');
  expect(container.textContent).toContain('等待后端批准');
  // A device key is generated and persisted before the request is sent.
  expect(state.updateBackendConnection).toHaveBeenCalledWith('a', { deviceSecret: expect.any(String) });
  expect(beginDevicePairing).toHaveBeenCalledWith('https://a.test', 'TodeX Web', expect.objectContaining({ deviceId: expect.any(String) }), expect.any(AbortSignal));
  await tick();
  expect(state.session.onDevicePairingApproved).toHaveBeenCalledOnce();
  expect(notices()).toContain('已批准，可连接');
  expect(notices()).toContain('仍需通过下方二维码或粘贴配对内容导入公钥');
  expect(container.querySelector('section')?.textContent).not.toContain('缺少加密公钥');
  expect(req.cancel).not.toHaveBeenCalled();
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
  await act(async () => { pending.resolve({ status: 'approved', deviceId: 'dev_late1234567890' }); });
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
  await act(async () => { pending.resolve({ status: 'approved', deviceId: 'dev_late1234567890' }); });
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
  await act(async () => { pending.resolve({ status: 'approved', deviceId: 'dev_late1234567890' }); });
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
  // The device key is persisted up front so a retry enrolls the same key.
  expect(state.updateBackendConnection).toHaveBeenCalledExactlyOnceWith('a', { deviceSecret: expect.any(String) });
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
