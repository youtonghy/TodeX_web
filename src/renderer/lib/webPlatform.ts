import type { TodeXWebApi } from '../../preload/index';
import { t } from '../i18n';

const STORAGE_SCHEMA_KEY = 'todex.web.schemaVersion';
const STORAGE_SCHEMA_VERSION = '1';

export function readLocalStorage(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeLocalStorage(key: string, value: unknown): void {
  try {
    if (value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    window.dispatchEvent(new CustomEvent('todex-storage-error', { detail: { key } }));
    throw error;
  }
}

export function clearWebStorage(): void {
  const keys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
    .filter((key): key is string => Boolean(key?.startsWith('todex.web.')));
  keys.forEach((key) => window.localStorage.removeItem(key));
}

export function insecureBackendReason(serverUrl: string, pageProtocol = window.location.protocol): string | null {
  if (pageProtocol !== 'https:') return null;
  try {
    const url = new URL(serverUrl);
    const host = url.hostname.toLowerCase();
    const loopback = host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
    if (url.protocol === 'http:' && !loopback) {
      return t('storage.insecureBackend');
    }
  } catch {
    return null;
  }
  return null;
}

export function installWebPlatformBridge(): void {
  if (window.todexWeb) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_SCHEMA_KEY, STORAGE_SCHEMA_VERSION);
  } catch {
    // Individual writes report a visible error once React has mounted.
  }

  const api: TodeXWebApi = {
    store: {
      get: async (key) => readLocalStorage(key),
      set: async (key, value) => {
        writeLocalStorage(key, value);
      },
    },
    fs: {
      readFile: async () => {
        throw new Error(t('storage.browserReadFile'));
      },
    },
    app: {
      focus: () => window.focus(),
    },
    theme: {
      shouldUseDark: async () => window.matchMedia('(prefers-color-scheme: dark)').matches,
      onUpdated: (listener) => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => listener(media.matches);
        media.addEventListener('change', handler);
        return () => media.removeEventListener('change', handler);
      },
    },
  };

  window.todexWeb = api;
}
