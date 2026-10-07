import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { AgentBrowserFrame } from '@todex/protocol/agentDesktop';
import { V2ApiClient } from '@todex/protocol/v2';
import { AgentBrowserLiveView } from '../../src/renderer/components/AgentBrowserLiveView';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';

let root: Root;
let container: HTMLDivElement;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.restoreAllMocks(); });

const action = (actionId: string, extra: Record<string, unknown> = {}) => ({
  actionId, tool: 'browser_act' as const, ok: true, summary: `click ${actionId}`, deviceId: 'host', deviceName: 'Studio Mac', time: '2026-10-06T00:00:00Z', ...extra,
});

function session(listeners: Map<string, (frame: AgentBrowserFrame) => void>, unwatch = vi.fn()) {
  return {
    settings: { serverUrl: 'https://backend.test', deviceSecret: '' },
    conversationRuntimeById: {
      c: { desktopBrowser: { granted: true, tabOpen: true, deviceName: 'Studio Mac', actions: [action('a', { tool: 'browser_open', url: 'http://localhost:5173/', title: 'Dev', shotId: 'shot_a' }), action('b')] } },
    },
    watchAgentBrowser: (conversationId: string, listener: (frame: AgentBrowserFrame) => void) => {
      listeners.set(conversationId, listener);
      return unwatch;
    },
  } as unknown as TodeXSession;
}

async function render(value: TodeXSession, isActive = true) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(createElement(AgentBrowserLiveView, { session: value, conversationId: 'c', isActive })); });
}

it('streams frames while shown and stops watching when hidden', async () => {
  const bitmap = { width: 4, height: 3, close: vi.fn() };
  vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
  vi.spyOn(V2ApiClient.prototype, 'getAgentShot').mockResolvedValue({ shotId: 'shot_a', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,shot' });
  const listeners = new Map<string, (frame: AgentBrowserFrame) => void>();
  const unwatch = vi.fn();
  await render(session(listeners, unwatch));
  expect(container.textContent).toContain('Dev');
  expect(container.textContent).toContain('click b · http://localhost:5173/');
  // Before the first frame: the latest screenshot.
  expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/jpeg;base64,shot');
  await act(async () => {
    listeners.get('c')!({ conversationId: 'c', seq: 1, mimeType: 'image/jpeg', data: btoa('jpeg'), width: 4, height: 3 });
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  expect(container.textContent).toContain('实时');
  const canvas = container.querySelector('canvas')!;
  expect([canvas.width, canvas.height]).toEqual([4, 3]);
  expect(bitmap.close).toHaveBeenCalled();
  // The tab closed on the backend.
  await act(async () => { listeners.get('c')!({ conversationId: 'c', closed: true }); });
  expect(container.textContent).not.toContain('实时');
  await act(async () => { root.render(createElement(AgentBrowserLiveView, { session: session(listeners, unwatch), conversationId: 'c', isActive: false })); });
  expect(unwatch).toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it('stop revokes the conversation browser', async () => {
  vi.spyOn(V2ApiClient.prototype, 'getAgentShot').mockResolvedValue({ shotId: 'shot_a', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,shot' });
  const revoke = vi.spyOn(V2ApiClient.prototype, 'revokeAgentDesktop').mockResolvedValue({ conversationId: 'c', revoked: true });
  await render(session(new Map()));
  const stop = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('停止'))!;
  await act(async () => { stop.click(); });
  expect(revoke).toHaveBeenCalledWith('c', 'browser');
});

it('decodes frames natively when available and keeps a steady canvas size', async () => {
  const bitmap = { width: 4, height: 3, close: vi.fn() };
  const blobs: Blob[] = [];
  vi.stubGlobal('createImageBitmap', vi.fn(async (blob: Blob) => { blobs.push(blob); return bitmap; }));
  const drawImage = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage })) as never;
  vi.spyOn(V2ApiClient.prototype, 'getAgentShot').mockResolvedValue({ shotId: 'shot_a', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,shot' });
  const fromBase64 = vi.fn((value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0)));
  Object.defineProperty(Uint8Array, 'fromBase64', { value: fromBase64, configurable: true, writable: true });
  const listeners = new Map<string, (frame: AgentBrowserFrame) => void>();
  try {
    await render(session(listeners));
    const canvas = container.querySelector('canvas')!;
    let resizes = 0;
    for (const key of ['width', 'height'] as const) {
      let size = 0;
      Object.defineProperty(canvas, key, { configurable: true, get: () => size, set: (value: number) => { resizes += 1; size = value; } });
    }
    for (const seq of [1, 2, 3]) {
      await act(async () => {
        listeners.get('c')!({ conversationId: 'c', seq, mimeType: 'image/jpeg', data: btoa(`jpeg${seq}`), width: 4, height: 3 });
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    }
    expect(fromBase64).toHaveBeenCalledTimes(3);
    expect(await blobs[2].text()).toBe('jpeg3');
    expect(drawImage).toHaveBeenCalledTimes(3);
    // Sized once by the first frame; the later frames only draw.
    expect(resizes).toBe(2);
    expect([canvas.width, canvas.height]).toEqual([4, 3]);
  } finally {
    delete (Uint8Array as { fromBase64?: unknown }).fromBase64;
    vi.unstubAllGlobals();
  }
});
