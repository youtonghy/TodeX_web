import type { TodeXWebApi, WebDeployment } from '../../preload/index';
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

export function installWebPlatformBridge(deployment?: WebDeployment | null): void {
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
    app: {
      focus: () => window.focus(),
      windowChrome: 'native' as const,
    },
    theme: browserTheme(),
    ...(deployment?.managed ? { deployment } : {}),
  };

  window.todexWeb = api;
}

/** The system scheme from the media query, unless the user picked light or dark. */
function browserTheme(): TodeXWebApi['theme'] {
  const listeners = new Set<(dark: boolean) => void>();
  let source: 'system' | 'light' | 'dark' = 'system';
  // Looked up on first use, so installing the bridge needs no media queries.
  let media: MediaQueryList | null = null;
  const systemMedia = () => {
    if (!media) {
      media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', () => listeners.forEach((listener) => listener(dark())));
    }
    return media;
  };
  const dark = () => (source === 'system' ? systemMedia().matches : source === 'dark');
  return {
    shouldUseDark: async () => dark(),
    setSource: (next) => {
      source = next;
      listeners.forEach((listener) => listener(dark()));
    },
    onUpdated: (listener) => {
      systemMedia();
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
