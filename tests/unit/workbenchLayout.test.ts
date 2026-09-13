import { describe, expect, it } from 'vitest';
import { workbenchLayoutStorageKey, WorkbenchLayoutStore, normalizeWorkbenchLayout, workbenchScopeKey } from '../../src/renderer/session/workbenchLayout';

const deferred = () => { let resolve!: (value: unknown) => void; const promise = new Promise<unknown>(done => { resolve = done; }); return { promise, resolve }; };
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
describe('workbench scope isolation', () => {
  it('scopes by backend/workspace and optionally conversation, without delimiter collisions', () => {
    expect(workbenchScopeKey('conversation', 'b', 'w', 'c')).not.toBe(workbenchScopeKey('conversation', 'b', 'w', 'other'));
    expect(workbenchScopeKey('workspace', 'b', 'w', 'c')).toBe(workbenchScopeKey('workspace', 'b', 'w', 'other'));
    expect(workbenchScopeKey('workspace', 'other', 'w', 'c')).not.toBe(workbenchScopeKey('workspace', 'b', 'w', 'c'));
    expect(workbenchScopeKey('conversation', 'b', '', 'c')).toBe('');
    expect(workbenchScopeKey('conversation', 'b', 'w', '')).toBe('');
  });
  it('immediately exposes defaults for a new scope while its stored layout is loading', async () => {
    const pending = deferred();
    const store = new WorkbenchLayoutStore({ load: () => pending.promise, save: async () => {} });
    store.update('a', 'isOpen', true);
    store.update('a', 'tab', 'files');
    void store.hydrate('b');
    expect(store.snapshot('b')).toEqual({ hydrated: false, isOpen: false, tab: 'terminal', target: {} });
    expect(store.snapshot('a').isOpen).toBe(true);
    pending.resolve({ isOpen: true, tab: 'browser', target: {} });
    await store.hydrate('b');
    expect(store.snapshot('b').tab).toBe('browser');
  });
  it('does not let late hydration overwrite an early user open request', async () => {
    const pending = deferred();
    const saved: unknown[] = [];
    const store = new WorkbenchLayoutStore({ load: () => pending.promise, save: async (_key, value) => { saved.push(value); } });
    const hydrate = store.hydrate('a');
    store.update('a', 'isOpen', true);
    store.update('a', 'tab', 'files');
    store.update('a', 'target', { filePath: '/new.png' });
    pending.resolve({ isOpen: false, tab: 'browser', target: { url: 'https://old.example/' } });
    await hydrate;
    await tick();
    expect(store.snapshot('a')).toEqual({ hydrated: true, isOpen: true, tab: 'files', target: { filePath: '/new.png' } });
    expect(saved).toHaveLength(1);
  });
  it('keeps late loads and writes attached to their original scope', async () => {
    const a = deferred(); const b = deferred(); const writes: string[] = [];
    const store = new WorkbenchLayoutStore({ load: key => key.endsWith(':a') ? a.promise : b.promise, save: async key => { writes.push(key); } });
    const first = store.hydrate('a'); const second = store.hydrate('b');
    b.resolve({ tab: 'browser' }); await second;
    a.resolve({ tab: 'files' }); await first;
    store.update('a', 'isOpen', true); await tick();
    expect(store.snapshot('a').tab).toBe('files');
    expect(store.snapshot('b').tab).toBe('browser');
    expect(writes).toEqual([workbenchLayoutStorageKey('a')]);
  });
  it('retains in-memory navigation while persisting only a safe target', async () => {
    const saved: unknown[] = [];
    const store = new WorkbenchLayoutStore({ load: async () => null, save: async (_key, value) => { saved.push(value); } });
    await store.hydrate('a');
    store.update('a', 'target', { url: 'https://user:secret@example.com/path?token=secret#secret', command: 'secret command' });
    await tick();
    expect(saved).toEqual([{ isOpen: false, tab: 'terminal', target: { url: 'https://example.com/path' } }]);
    expect(store.snapshot('a').target.command).toBe('secret command');
  });
  it('normalizes corrupt storage and does not persist the empty scope', async () => {
    let calls = 0;
    const store = new WorkbenchLayoutStore({ load: async () => { calls++; return null; }, save: async () => { calls++; } });
    await store.hydrate(''); store.update('', 'isOpen', true); await tick();
    expect(calls).toBe(0);
    expect(normalizeWorkbenchLayout({ tab: 'bad', target: { url: 'javascript:alert(1)', token: 'private' } })).toEqual({ isOpen: false, tab: 'terminal', target: {} });
  });
});
