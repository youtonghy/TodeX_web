// Web implementation of the shared platform interface (./types.ts) over the
// browser bridge (lib/webPlatform.ts). Members read `window.todexWeb` when
// used: the demo swaps its store and theme after installing it.
import { clearHistoryKeyStore } from '../lib/historyKeyStore';
import { clearWebStorage, insecureBackendReason } from '../lib/webPlatform';
import { managedBackendProfiles } from '../lib/webDeployment';
import type { Platform, PlatformDeployment } from './types';

export type * from './types';

const bridge = () => window.todexWeb;
const NO_CONTAINERS: ReadonlySet<string> = new Set();

function deployment(): PlatformDeployment | undefined {
  const pinned = bridge()?.deployment;
  if (!pinned) return undefined;
  return {
    backends: pinned.backends,
    profiles: (stored, template) => managedBackendProfiles(pinned, stored, template),
  };
}

export const platform: Platform = {
  kind: 'web',
  productName: 'TodeX Web',
  storagePrefix: 'todex.web',
  os: navigator.userAgent.includes('Mac') ? 'darwin' : navigator.userAgent.includes('Win') ? 'win32' : 'other',
  get windowChrome() { return bridge().app.windowChrome; },
  reservedNewShortcuts: true,
  store: {
    get: (key) => bridge().store.get(key),
    set: (key, value) => bridge().store.set(key, value),
  },
  app: {
    focus: () => bridge().app.focus(),
    // Browsers reserve Cmd+W for closing the browser tab, so this only runs
    // in hosts that deliver the key (e.g. embedded webviews).
    onCloseShortcut: (handler) => {
      const onKeyDown = (event: KeyboardEvent) => {
        if (!event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (event.key.toLowerCase() !== 'w') return;
        if (handler()) event.preventDefault();
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    },
  },
  theme: {
    shouldUseDark: () => bridge().theme.shouldUseDark(),
    setSource: (source) => bridge().theme.setSource(source),
    onUpdated: (listener) => bridge().theme.onUpdated(listener),
  },
  backendUrlProblem: (serverUrl) => insecureBackendReason(serverUrl),
  get deployment() { return deployment(); },
  clearLocalData: async () => {
    clearWebStorage();
    // History keys and sealed device keys live in IndexedDB.
    await clearHistoryKeyStore();
  },
  containers: {
    useProfileIds: () => NO_CONTAINERS,
    isContainerProfile: () => false,
  },
};
