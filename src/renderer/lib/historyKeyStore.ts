// Device history keys (32-byte X-Wing seeds, one per backend profile) for
// end-to-end encrypted conversation history. The browser keeps them in
// IndexedDB encrypted under a non-extractable AES-GCM key that lives in the
// same database: script on this origin can use the key but never read it out,
// and a copy of the seed records alone (backups, exported storage) is useless.

const DB_NAME = 'todex.web.keys';
const STORE = 'keys';
const WRAP_KEY_ID = 'history-wrap-key.v1';
const seedId = (profileId: string) => `history-seed.v1.${profileId}`;

type SealedSeed = { iv: Uint8Array; ct: ArrayBuffer };

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('此浏览器不支持 IndexedDB，无法保存历史记录密钥'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开历史记录密钥库'));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result as T);
      transaction.onerror = () => reject(transaction.error ?? new Error('历史记录密钥库读写失败'));
      transaction.onabort = () => reject(transaction.error ?? new Error('历史记录密钥库读写失败'));
    });
  } finally {
    db.close();
  }
}

let wrapKeyPromise: Promise<CryptoKey> | null = null;

/** The origin's AES-GCM wrapping key, created non-extractable on first use. */
function wrapKey(): Promise<CryptoKey> {
  wrapKeyPromise ??= (async () => {
    const existing = await run<CryptoKey | undefined>('readonly', (store) => store.get(WRAP_KEY_ID));
    if (existing) return existing;
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    // `add` fails if another tab won the race; then use the stored one.
    try {
      await run('readwrite', (store) => store.add(key, WRAP_KEY_ID));
      return key;
    } catch {
      const stored = await run<CryptoKey | undefined>('readonly', (store) => store.get(WRAP_KEY_ID));
      if (!stored) throw new Error('无法创建历史记录密钥');
      return stored;
    }
  })().catch((error: unknown) => {
    wrapKeyPromise = null;
    throw error;
  });
  return wrapKeyPromise;
}

const aad = (profileId: string) => new TextEncoder().encode(seedId(profileId));

export async function loadHistorySeed(profileId: string): Promise<Uint8Array | null> {
  const sealed = await run<SealedSeed | undefined>('readonly', (store) => store.get(seedId(profileId)));
  if (!sealed) return null;
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv as BufferSource, additionalData: aad(profileId) }, await wrapKey(), sealed.ct);
    return new Uint8Array(plain);
  } catch {
    throw new Error('历史记录密钥无法解开（浏览器密钥库可能已被清除），请在设置中重新登记此设备');
  }
}

export async function saveHistorySeed(profileId: string, seed: Uint8Array): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(profileId) }, await wrapKey(), seed as BufferSource);
  await run('readwrite', (store) => store.put({ iv, ct } satisfies SealedSeed, seedId(profileId)));
}

/** Removes every history key of this origin (local data reset). */
export function clearHistoryKeyStore(): Promise<void> {
  wrapKeyPromise = null;
  if (typeof indexedDB === 'undefined') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('无法清除历史记录密钥库'));
    // Another tab still holds the database open; it is deleted once it closes.
    request.onblocked = () => resolve();
  });
}

export async function deleteHistorySeed(profileId: string): Promise<void> {
  await run('readwrite', (store) => store.delete(seedId(profileId)));
}
