import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement, useCallback, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { V2ApiClient } from '@todex/protocol/v2';
import { WorkbenchPanel } from '../../src/renderer/screens/WorkbenchPanel';
import { sshWorkbenchScopeKey } from '../../src/renderer/session/workbenchLayout';
import { SETTINGS_STORAGE_KEY } from '../../src/renderer/session/helpers';
import { normalizeRemoteFilesBinding, remoteFileSource, uploadRemoteFile, workspaceFileSource, type RemoteFilesBinding } from '../../src/renderer/session/fileSources';
import { REMOTE_UPLOAD_CHUNK_BYTES } from '@todex/protocol/ssh';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';
import type { WorkbenchItem, WorkbenchRequest, WorkbenchTab } from '../../src/renderer/lib/panels';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  HTMLElement.prototype.scrollIntoView ??= () => {};
  Object.assign(globalThis, { CSS: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`) } });
});

const binding: RemoteFilesBinding = { connectionId: 'conn-1', kind: 'sftp', label: 'prod', homeDirectory: '/home/me', host: 'prod' };

describe('file sources', () => {
  it('maps workspace entries to absolute paths, directories first', async () => {
    const api = { listWorkspaceEntries: vi.fn().mockResolvedValue({ entries: [
      { name: 'b.txt', path: 'b.txt', kind: 'file' },
      { name: 'src', path: 'src', kind: 'directory' },
    ] }) };
    const source = workspaceFileSource(() => api as unknown as V2ApiClient, '/repo');
    expect(await source.list('/repo')).toEqual([
      { name: 'src', path: '/repo/src', kind: 'directory' },
      { name: 'b.txt', path: '/repo/b.txt', kind: 'file' },
    ]);
    expect(source.canAddReference).toBe(true);
    expect(source.upload).toBeUndefined();
  });

  it('routes remote operations to the bound connection', async () => {
    const api = {
      listRemoteEntries: vi.fn().mockResolvedValue({ path: '/home/me', entries: [{ name: 'a', path: '/home/me/a', kind: 'file' }] }),
      createRemoteDirectory: vi.fn().mockResolvedValue({ ok: true }),
      renameRemoteEntry: vi.fn().mockResolvedValue({ ok: true }),
      deleteRemoteEntry: vi.fn().mockResolvedValue({ ok: true }),
      uploadRemoteChunk: vi.fn().mockResolvedValue({ sizeBytes: 5 }),
      downloadRemoteFile: vi.fn().mockResolvedValue(new Uint8Array([104, 105])),
    };
    const source = remoteFileSource(() => api as unknown as V2ApiClient, binding);
    expect(source.rootPath).toBe('/home/me');
    expect(source.canAddReference).toBe(false);
    expect(await source.list('/home/me')).toHaveLength(1);
    expect(api.listRemoteEntries).toHaveBeenCalledWith('conn-1', '/home/me');
    await source.mkdir?.('/home/me/new');
    await source.rename?.('/home/me/a', '/home/me/b');
    await source.remove?.('/home/me/b');
    expect(api.createRemoteDirectory).toHaveBeenCalledWith('conn-1', '/home/me/new');
    expect(api.renameRemoteEntry).toHaveBeenCalledWith('conn-1', '/home/me/a', '/home/me/b');
    expect(api.deleteRemoteEntry).toHaveBeenCalledWith('conn-1', '/home/me/b');

    const uploaded = await source.upload?.('/home/me', new File(['hello'], 'hello.txt'), true);
    expect(uploaded).toBe('/home/me/hello.txt');
    expect(api.uploadRemoteChunk).toHaveBeenCalledTimes(1);
    const [connectionId, path, offset, bytes, overwrite] = api.uploadRemoteChunk.mock.calls[0];
    expect([connectionId, path, offset, overwrite]).toEqual(['conn-1', '/home/me/hello.txt', 0, true]);
    expect(new TextDecoder().decode(bytes as Uint8Array)).toBe('hello');

    // Browser downloads go through a temporary <a download> link.
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('a.bin');
      expect(this.href).toBe('blob:test');
    });
    await source.download?.('/home/me/a.bin');
    expect(api.downloadRemoteFile).toHaveBeenCalledWith('conn-1', '/home/me/a.bin');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('uploads large files in ordered raw chunks and only overwrites on the first', async () => {
    const api = { uploadRemoteChunk: vi.fn().mockResolvedValue({ sizeBytes: 0 }) };
    const size = REMOTE_UPLOAD_CHUNK_BYTES + 3;
    await uploadRemoteFile(api as unknown as V2ApiClient, 'conn-1', '/srv/big.bin', new File([new Uint8Array(size)], 'big.bin'), true);
    const calls = api.uploadRemoteChunk.mock.calls.map(([, , offset, bytes, overwrite]) => [offset, (bytes as Uint8Array).length, overwrite]);
    expect(calls).toEqual([[0, REMOTE_UPLOAD_CHUNK_BYTES, true], [REMOTE_UPLOAD_CHUNK_BYTES, 3, false]]);
  });

  it('drops malformed stored remote bindings', () => {
    expect(normalizeRemoteFilesBinding({ connectionId: '', kind: 'sftp' })).toBeUndefined();
    expect(normalizeRemoteFilesBinding({ connectionId: 'x', kind: 'scp' })).toBeUndefined();
    expect(normalizeRemoteFilesBinding({ connectionId: 'x', kind: 'ftp', siteId: 's' })).toEqual({ connectionId: 'x', kind: 'ftp', label: 'x', homeDirectory: '/', siteId: 's' });
  });
});

describe('SSH workbench', () => {
  let root: Root;
  let container: HTMLDivElement;
  let pushRequest: (request: WorkbenchRequest) => void;
  let terminals: Record<string, unknown> = {};
  const disk = new Map<string, unknown>();
  const status = vi.fn();
  const startTerminal = vi.fn();
  const handled = vi.fn();
  const itemsChanged = vi.fn();
  const scopeKey = sshWorkbenchScopeKey('backend');

  function Harness() {
    const [tab, setTab] = useState<WorkbenchTab>('terminal');
    const [requests, setRequests] = useState<WorkbenchRequest[]>([]);
    pushRequest = (request) => setRequests(current => [...current, request]);
    const onHandled = useCallback((lastId: number) => {
      handled(lastId);
      setRequests(current => current.filter(request => request.id > lastId));
    }, []);
    const onItems = useCallback((items: WorkbenchItem[]) => itemsChanged(items), []);
    const session = {
      activeConversation: { id: 'c' }, activeWorkspace: { id: 'w', path: '/w', tenantId: 'local' },
      settings: { serverUrl: 'https://backend.test', deviceSecret: 'test-secret', tenantId: 'local' }, terminalById: terminals,
      connectionState: 'open', connectionHealth: { latencyMs: null }, requestTerminalStatus: status,
      startTerminalSession: startTerminal, stopTerminalSession: vi.fn(), resizeTerminalSession: vi.fn(), sendTerminalInput: vi.fn(),
    } as unknown as TodeXSession;
    return createElement(WorkbenchPanel, {
      key: scopeKey, scopeKey, session, tab, onTabChange: setTab, sshMode: true,
      requests, onRequestsHandled: onHandled, onItemsChange: onItems,
    });
  }
  const render = async () => { await act(async () => { root.render(createElement(Harness)); }); };

  beforeAll(() => { Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); });
  beforeEach(() => {
    disk.clear();
    terminals = {};
    Object.assign(window, { todexWeb: { store: {
      get: vi.fn(async (key: string) => disk.get(key)),
      set: vi.fn(async (key: string, value: unknown) => { disk.set(key, JSON.parse(JSON.stringify(value))); }),
    } } });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); });

  it('opens SSH terminals from the request queue without the new-tab menu or a cwd box', async () => {
    await render();
    expect(container.querySelector('[aria-label="新建工作台标签"]')).toBeNull();
    await act(async () => { pushRequest({ id: 1, kind: 'ssh-terminal', host: 'prod' }); });
    expect(handled).toHaveBeenLastCalledWith(1);
    expect(status).toHaveBeenLastCalledWith({ kind: 'ssh', host: 'prod' }, expect.any(String));
    expect(container.querySelector('[aria-label="终端路径"]')).toBeNull();
    expect(container.textContent).toContain('prod');
    const items = itemsChanged.mock.calls.at(-1)?.[0] as WorkbenchItem[];
    expect(items).toEqual([expect.objectContaining({ type: 'terminal', ssh: { host: 'prod' } })]);
    const stored = disk.get(`${SETTINGS_STORAGE_KEY}.workbenchTabs.v1:${scopeKey}`) as { items: WorkbenchItem[] };
    expect(stored.items[0]).toEqual(expect.objectContaining({ ssh: { host: 'prod' } }));
  });

  it('does not auto-restart an exited SSH terminal and reconnects on request', async () => {
    await render();
    await act(async () => { pushRequest({ id: 1, kind: 'ssh-terminal', host: 'prod' }); });
    const terminalId = status.mock.calls.at(-1)?.[1] as string;
    terminals = { [terminalId]: { terminalId, ssh: { host: 'prod' }, status: 'exited', output: [], rows: 30, cols: 100 } };
    vi.useFakeTimers();
    await render();
    startTerminal.mockClear();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(startTerminal).not.toHaveBeenCalled();
    const reconnect = container.querySelector<HTMLButtonElement>('[aria-label="重新连接"]');
    expect(reconnect).not.toBeNull();
    await act(async () => { reconnect!.click(); });
    expect(startTerminal).toHaveBeenCalledWith({ kind: 'ssh', host: 'prod' }, expect.objectContaining({ terminalId, cwd: '', rows: 30, cols: 100, preserveOutput: true }));
  });

  it('binds remote file tabs to their connection and closes it with the tab', async () => {
    const list = vi.spyOn(V2ApiClient.prototype, 'listRemoteEntries').mockResolvedValue({ path: '/home/me', entries: [] } as never);
    const close = vi.spyOn(V2ApiClient.prototype, 'closeRemoteConnection').mockResolvedValue({ closed: true });
    await render();
    await act(async () => { pushRequest({ id: 1, kind: 'remote-files', remote: binding }); });
    expect(list).toHaveBeenCalledWith('conn-1', '/home/me');
    expect(container.querySelector('[aria-label="上传"]')).not.toBeNull();
    const item = (itemsChanged.mock.calls.at(-1)?.[0] as WorkbenchItem[])[0];
    await act(async () => { pushRequest({ id: 2, kind: 'close', itemId: item.id }); });
    expect(close).toHaveBeenCalledWith('conn-1');
    expect(itemsChanged.mock.calls.at(-1)?.[0]).toEqual([]);
  });
});
