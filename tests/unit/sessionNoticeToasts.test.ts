import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '@heroui/react';
import { connectionFailureLabel } from '@todex/protocol/connectionError';
import { SessionNoticeToasts } from '../../src/renderer/components/SessionNoticeToasts';
import type { ConnectionHealth } from '../../src/renderer/session/helpers';

let root: Root;
let container: HTMLDivElement;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
beforeEach(() => {
  vi.useFakeTimers();
  let sequence = 0;
  vi.spyOn(toast, 'danger').mockImplementation(() => `notice-${++sequence}`);
  vi.spyOn(toast, 'close').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function health(status: ConnectionHealth['status'], error = ''): ConnectionHealth {
  return { status, error, latencyMs: null, lastCheckedAt: Date.now() };
}
function render(currentHealth: ConnectionHealth, lastError = '', scope = 'backend-a') {
  act(() => root.render(createElement(React.StrictMode, null,
    createElement(SessionNoticeToasts, { health: currentHealth, lastError, scope }),
  )));
  act(() => vi.advanceTimersByTime(0));
}

it('notifies once in StrictMode and dismisses a resolved error', () => {
  render(health('online'), '操作失败');
  render(health('online'), '操作失败');
  expect(toast.danger).toHaveBeenCalledExactlyOnceWith('操作失败', expect.objectContaining({ timeout: 6000 }));
  render(health('online'));
  expect(toast.close).toHaveBeenCalledWith('notice-1');
});

it('does not repeat a persistent failure during periodic health checks', () => {
  render(health('offline', '健康检查超时'));
  for (let attempt = 0; attempt < 3; attempt++) {
    act(() => vi.advanceTimersByTime(5000));
    render(health('checking'));
    render(health('offline', '健康检查超时'));
  }
  expect(toast.danger).toHaveBeenCalledExactlyOnceWith('健康检查超时', expect.any(Object));
  expect(toast.close).not.toHaveBeenCalled();
});

it('notifies again when the same failure returns after a successful health check', () => {
  render(health('offline', '健康检查超时'));
  render(health('checking'));
  render(health('online'));
  expect(toast.close).toHaveBeenCalledWith('notice-1');
  render(health('checking'));
  render(health('offline', '健康检查超时'));
  expect(toast.danger).toHaveBeenCalledTimes(2);
  expect(toast.danger).toHaveBeenLastCalledWith('健康检查超时', expect.any(Object));
});

it('reports a new connection failure while an older operation error remains', () => {
  render(health('online'), '当前 Agent 不支持此权限模式。');
  render(health('offline', '健康检查超时'), '当前 Agent 不支持此权限模式。');
  expect(vi.mocked(toast.danger).mock.calls.map(([message]) => message)).toEqual([
    '当前 Agent 不支持此权限模式。', '健康检查超时',
  ]);
});

it.each(['raw', 'classified'] as const)('does not report the same %s connection error twice', kind => {
  const failure = { ...health('offline', '后端连接被拒绝'), code: 'backend_unreachable' as const };
  const lastError = kind === 'raw' ? failure.error : connectionFailureLabel(failure.code);
  render(failure, lastError);
  expect(toast.danger).toHaveBeenCalledExactlyOnceWith(lastError, expect.any(Object));
});

it('dismisses the previous backend failure while the new backend is being checked', () => {
  render(health('offline', '健康检查超时'));
  render(health('checking'), '', 'backend-b');
  expect(toast.close).toHaveBeenCalledWith('notice-1');
  expect(toast.danger).toHaveBeenCalledOnce();
  render(health('offline', '健康检查超时'), '', 'backend-b');
  expect(toast.danger).toHaveBeenCalledTimes(2);
});
