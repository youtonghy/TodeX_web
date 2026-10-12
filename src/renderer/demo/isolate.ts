// Imported first by the demo entry, before any module can touch storage: the
// demo shares its origin with /app, so localStorage and the key store must
// stay in memory for this page.
import { keepKeysInMemory } from '../lib/historyKeyStore';

/** A Storage that forgets everything when the page goes away. */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() { return items.size; },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => { items.delete(key); },
    setItem: (key, value) => { items.set(key, String(value)); },
  };
}

Object.defineProperty(window, 'localStorage', { configurable: true, value: memoryStorage() });
keepKeysInMemory();
