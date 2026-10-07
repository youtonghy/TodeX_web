import { beforeEach, describe, expect, it, vi } from 'vitest';

const sealed = new Map<string, string>();
const keyStore = vi.hoisted(() => ({ failSave: false, failLoad: false }));

vi.mock('../../src/renderer/lib/historyKeyStore', () => ({
  loadSealedSecret: vi.fn(async (key: string) => {
    if (keyStore.failLoad) throw new Error('secure context required');
    return sealed.get(key) ?? null;
  }),
  saveSealedSecret: vi.fn(async (key: string, value: string | null) => {
    if (keyStore.failSave) throw new Error('secure context required');
    if (value === null) sealed.delete(key);
    else sealed.set(key, value);
  }),
}));

const KEY = 'todex.web.deviceSecret.v1';

async function freshStorage() {
  vi.resetModules();
  const { installWebPlatformBridge } = await import('../../src/renderer/lib/webPlatform');
  installWebPlatformBridge();
  return import('../../src/renderer/lib/storage');
}

describe('device secret storage', () => {
  beforeEach(() => {
    sealed.clear();
    window.localStorage.clear();
    keyStore.failSave = false;
    keyStore.failLoad = false;
    Reflect.deleteProperty(window, 'todexWeb');
  });

  it('migrates a plaintext localStorage secret into the sealed store and deletes the plaintext', async () => {
    window.localStorage.setItem(KEY, JSON.stringify('seed-1'));
    const { loadSecret } = await freshStorage();
    await expect(loadSecret(KEY)).resolves.toBe('seed-1');
    expect(sealed.get(KEY)).toBe('seed-1');
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('keeps the plaintext when sealing fails, so the key is not lost', async () => {
    window.localStorage.setItem(KEY, JSON.stringify('seed-1'));
    keyStore.failSave = true;
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { loadSecret } = await freshStorage();
    await expect(loadSecret(KEY)).resolves.toBe('seed-1');
    expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify('seed-1'));
    expect(error).toHaveBeenCalled();
  });

  it('falls back to the plaintext when the sealed store cannot be read, and rejects without one', async () => {
    keyStore.failLoad = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { loadSecret } = await freshStorage();
    await expect(loadSecret(KEY)).rejects.toThrow('secure context required');
    window.localStorage.setItem(KEY, JSON.stringify('seed-1'));
    await expect(loadSecret(KEY)).resolves.toBe('seed-1');
  });

  it('saves sealed only, never as plaintext, and an empty value deletes the key', async () => {
    const { saveSecret, loadSecret } = await freshStorage();
    await saveSecret(KEY, 'seed-2');
    expect(sealed.get(KEY)).toBe('seed-2');
    expect(window.localStorage.getItem(KEY)).toBeNull();
    await expect(loadSecret(KEY)).resolves.toBe('seed-2');
    await saveSecret(KEY, '');
    expect(sealed.has(KEY)).toBe(false);
  });

  it('rejects a save the sealed store refuses instead of writing plaintext', async () => {
    keyStore.failSave = true;
    const { saveSecret } = await freshStorage();
    await expect(saveSecret(KEY, 'seed-3')).rejects.toThrow('secure context required');
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});
