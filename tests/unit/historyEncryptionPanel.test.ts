import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Toast, toast } from '@heroui/react';
import type { HistoryEncryptionState } from '@todex/protocol/historyEncryption';
import { HistoryEncryptionPanel } from '../../src/renderer/components/HistoryEncryptionPanel';
import type { HistoryEncryptionSession, RecoveryKeyDraft } from '../../src/renderer/session/useHistoryEncryption';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
});

let root: Root | undefined;
let container: HTMLDivElement | undefined;
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(() => {
  act(() => { toast.clear(); root?.unmount(); });
  container?.remove();
  root = undefined;
});

const WORDS = 'abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor actress actual'.split(' ');

function session(state: Partial<HistoryEncryptionState> = {}, extra: Partial<HistoryEncryptionSession> = {}) {
  const draft: RecoveryKeyDraft = { seed: new Uint8Array(32).fill(1), words: WORDS, qrPayload: 'todex-recovery:v1:AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE' };
  return {
    view: {
      backendId: 'b1', status: 'ready', localRid: 'me',
      state: { mode: 'off', epoch: 1, myRid: 'me', grants: [],
        recipients: [{ rid: 'me', kind: 'device', deviceId: 'dev_me', publicKey: 'pk', addedAt: 'a', revokedAt: null }], ...state },
    },
    e2e: state.mode === 'e2e',
    grantRuns: {},
    createRecoveryDraft: vi.fn(() => draft),
    confirmRecoveryKey: vi.fn(async () => {}),
    enable: vi.fn(async () => ({} as HistoryEncryptionState)),
    disable: vi.fn(async () => ({} as HistoryEncryptionState)),
    revoke: vi.fn(async () => ({} as HistoryEncryptionState)),
    requestGrant: vi.fn(async () => 'grt_new'),
    dismissGrant: vi.fn(async () => {}),
    authorizeGrant: vi.fn(async () => {}),
    pauseGrant: vi.fn(),
    importRecoveryKey: vi.fn(async () => ({ processed: 2, added: 2, skipped: 0 })),
    refresh: vi.fn(async () => {}),
    resetDeviceKey: vi.fn(async () => {}),
    ...extra,
  } as unknown as HistoryEncryptionSession;
}

async function render(history: HistoryEncryptionSession) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root!.render(createElement(React.Fragment, null, createElement(HistoryEncryptionPanel, { history }), createElement(Toast.Provider))); });
}

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find((item) => item.textContent === label);
  expect(found, label).toBeTruthy();
  return found as HTMLButtonElement;
}
async function press(label: string) { await act(async () => { button(label).click(); }); }

it('enabling shows the 24 words and QR, requires confirmation, then uploads the recovery key and enables', async () => {
  const history = session();
  await render(history);
  expect(container!.textContent).toContain('未加密');
  await press('开启端到端加密');
  const words = document.querySelector('ol[aria-label="恢复单词"]');
  expect(words?.querySelectorAll('li')).toHaveLength(24);
  expect(document.querySelector('svg[aria-label="恢复密钥二维码"] path')?.getAttribute('d')).toMatch(/^M\d/);
  expect(button('保存并开启加密').disabled || button('保存并开启加密').getAttribute('data-disabled') === 'true').toBe(true);
  const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
  await act(async () => { checkbox.click(); });
  await press('保存并开启加密');
  expect(history.confirmRecoveryKey).toHaveBeenCalledTimes(1);
  expect(history.enable).toHaveBeenCalledTimes(1);
});

it('skipping the recovery key needs a second, explicit warning', async () => {
  const history = session();
  await render(history);
  await press('开启端到端加密');
  await press('跳过');
  expect(document.body.textContent).toContain('永久无法读取');
  expect(history.enable).not.toHaveBeenCalled();
  await press('仍然跳过并开启');
  expect(history.enable).toHaveBeenCalledTimes(1);
  expect(history.confirmRecoveryKey).not.toHaveBeenCalled();
});

it('lists recipients with revoke, authorizes pending grants and imports a recovery key', async () => {
  const history = session({
    mode: 'e2e',
    recipients: [
      { rid: 'me', kind: 'device', deviceId: 'dev_me', publicKey: 'pk', addedAt: 'a', revokedAt: null },
      { rid: 'r2', kind: 'device', deviceId: 'dev_new', publicKey: 'pk2', addedAt: 'a', revokedAt: null },
      { rid: 'rec', kind: 'recovery', deviceId: null, publicKey: 'pk3', addedAt: 'a', revokedAt: null },
    ],
    grants: [{ grantId: 'grt_1', rid: 'r2', deviceId: 'dev_new', requestedAt: '2026-10-06', status: 'pending' }],
  });
  await render(history);
  expect(container!.textContent).toContain('端到端加密');
  expect(container!.textContent).toContain('此设备');
  expect(container!.textContent).toContain('设备 dev_new');
  expect(container!.textContent).toContain('恢复密钥');
  // Only other recipients can be revoked from here.
  expect([...container!.querySelectorAll('button')].filter((item) => item.textContent === '吊销')).toHaveLength(2);
  await press('授权');
  expect(history.authorizeGrant).toHaveBeenCalledWith(expect.objectContaining({ grantId: 'grt_1' }));

  const textarea = container!.querySelector('textarea')!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    setter.call(textarea, WORDS.join(' '));
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await press('用恢复密钥解锁历史');
  expect(history.importRecoveryKey).toHaveBeenCalledWith(WORDS.join(' '), expect.any(Function));
  expect(container!.textContent).toContain('已处理 2 个密钥');
});

it('shows an unavailable backend and grant progress', async () => {
  await render(session({}, { view: { backendId: 'b1', status: 'unavailable', error: '[INVALID_REQUEST] unknown command' } } as Partial<HistoryEncryptionSession>));
  expect(container!.textContent).toContain('此后端未提供历史记录加密');
  expect(container!.textContent).toContain('unknown command');
  act(() => root!.unmount());
  container!.remove();
  const pauseGrant = vi.fn();
  await render(session({
    mode: 'e2e',
    recipients: [{ rid: 'me', kind: 'device', deviceId: 'dev_me', publicKey: 'pk', addedAt: 'a', revokedAt: null }, { rid: 'r2', kind: 'device', deviceId: 'dev_new', publicKey: 'pk2', addedAt: 'a', revokedAt: null }],
    grants: [{ grantId: 'grt_1', rid: 'r2', deviceId: 'dev_new', requestedAt: 'x', status: 'pending' }],
  }, { grantRuns: { grt_1: { running: true, progress: { processed: 500, added: 480, skipped: 20, cursor: 'c' } } }, pauseGrant }));
  expect(container!.textContent).toContain('已处理 500 个密钥，新增授权 480 个，跳过 20 个');
  await press('暂停');
  expect(pauseGrant).toHaveBeenCalledWith('grt_1');
});
