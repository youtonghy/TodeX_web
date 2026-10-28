// Device history keys (32-byte X-Wing seeds, one per backend profile) for
// end-to-end encrypted conversation history, and the device signing secrets
// (see lib/storage.ts). The browser keeps them in IndexedDB encrypted under a
// non-extractable AES-GCM key that lives in the same database: script on this
// origin can use the key but never read it out, and a copy of the sealed
// records alone (backups, exported storage) is useless.

import { t, type MessageKey } from '../i18n';

const DB_NAME = 'todex.web.keys';
const STORE = 'keys';
const WRAP_KEY_ID = 'history-wrap-key.v1';
const seedId = (profileId: string) => `history-seed.v1.${profileId}`;
const secretId = (key: string) => `secret.v1.${key}`;

type SealedSeed = { iv: Uint8Array; ct: ArrayBuffer };

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error(t('secureContext.indexedDbUnavailable')));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(t('secureContext.keyStoreOpenFailed')));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result as T);
      transaction.onerror = () => reject(transaction.error ?? new Error(t('secureContext.keyStoreAccessFailed')));
      transaction.onabort = () => reject(transaction.error ?? new Error(t('secureContext.keyStoreAccessFailed')));
    });
  } finally {
    db.close();
  }
}

let wrapKeyPromise: Promise<CryptoKey> | null = null;

/** The origin's AES-GCM wrapping key, created non-extractable on first use. */
function wrapKey(): Promise<CryptoKey> {
  wrapKeyPromise ??= (async () => {
    // WebCrypto only exists in secure contexts (HTTPS, localhost).
    if (!globalThis.crypto?.subtle) throw new Error(t('secureContext.webCryptoUnavailable'));
    const existing = await run<CryptoKey | undefined>('readonly', (store) => store.get(WRAP_KEY_ID));
    if (existing) return existing;
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    // `add` fails if another tab won the race; then use the stored one.
    try {
      await run('readwrite', (store) => store.add(key, WRAP_KEY_ID));
      return key;
    } catch {
      const stored = await run<CryptoKey | undefined>('readonly', (store) => store.get(WRAP_KEY_ID));
      if (!stored) throw new Error(t('secureContext.keyCreateFailed'));
      return stored;
    }
  })().catch((error: unknown) => {
    wrapKeyPromise = null;
    throw error;
  });
  return wrapKeyPromise;
}

// The /demo page shares this origin with the real app; it keeps its keys in
// memory so it never touches the app's key database.
let memoryRecords: Map<string, Uint8Array> | null = null;

/** Keeps every key of this page in memory instead of IndexedDB. */
export function keepKeysInMemory(): void {
  memoryRecords = new Map();
}

/** Record ids double as AES-GCM additional data, so a sealed value cannot be
 * moved to another record. */
async function seal(id: string, plain: Uint8Array): Promise<void> {
  if (memoryRecords) {
    memoryRecords.set(id, plain);
    return;
  }
  const key = await wrapKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) }, key, plain as BufferSource);
  await run('readwrite', (store) => store.put({ iv, ct } satisfies SealedSeed, id));
}

/** `null` when absent; rejects with `unreadable` when the record cannot be opened. */
async function unseal(id: string, unreadable: MessageKey): Promise<Uint8Array | null> {
  if (memoryRecords) return memoryRecords.get(id) ?? null;
  const sealed = await run<SealedSeed | undefined>('readonly', (store) => store.get(id));
  if (!sealed) return null;
  const key = await wrapKey();
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv as BufferSource, additionalData: new TextEncoder().encode(id) }, key, sealed.ct));
  } catch {
    throw new Error(t(unreadable));
  }
}

export async function loadHistorySeed(profileId: string): Promise<Uint8Array | null> {
  const seed = await unseal(seedId(profileId), 'secureContext.historyKeyUnreadable');
  if (seed && seed.length !== 32) throw new Error(t('secureContext.historyKeyCorrupt'));
  return seed;
}

export function saveHistorySeed(profileId: string, seed: Uint8Array): Promise<void> {
  return seal(seedId(profileId), seed);
}

export async function loadSealedSecret(key: string): Promise<string | null> {
  const plain = await unseal(secretId(key), 'secureContext.deviceKeyUnreadable');
  return plain ? new TextDecoder().decode(plain) : null;
}

/** Seals a device secret; `null` deletes it. */
export async function saveSealedSecret(key: string, value: string | null): Promise<void> {
  if (value === null) {
    if (memoryRecords) memoryRecords.delete(secretId(key));
    else await run('readwrite', (store) => store.delete(secretId(key)));
    return;
  }
  await seal(secretId(key), new TextEncoder().encode(value));
}

/** Removes every history key of this origin (local data reset). */
export function clearHistoryKeyStore(): Promise<void> {
  wrapKeyPromise = null;
  if (memoryRecords) {
    memoryRecords.clear();
    return Promise.resolve();
  }
  if (typeof indexedDB === 'undefined') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(t('secureContext.keyStoreClearFailed')));
    // Another tab still holds the database open; it is deleted once it closes.
    request.onblocked = () => resolve();
  });
}

export async function deleteHistorySeed(profileId: string): Promise<void> {
  if (memoryRecords) {
    memoryRecords.delete(seedId(profileId));
    return;
  }
  await run('readwrite', (store) => store.delete(seedId(profileId)));
}
