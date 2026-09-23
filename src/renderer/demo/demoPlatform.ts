import type { TodeXWebApi } from '../../preload/index';
import { SETTINGS_STORAGE_KEY } from '../session/helpers';
import { DEMO_DIFF_TAB_ID, DEMO_TERMINAL_TAB_ID } from './demoData';

const WORKBENCH_TABS_PREFIX = `${SETTINGS_STORAGE_KEY}.workbenchTabs.v1:`;

/** Every workbench scope opens with the same Git diff + terminal tabs. */
function defaultValue(key: string): unknown {
  if (!key.startsWith(WORKBENCH_TABS_PREFIX)) return null;
  return {
    items: [
      { id: DEMO_DIFF_TAB_ID, type: 'git-diff', title: 'Git Diff 1' },
      { id: DEMO_TERMINAL_TAB_ID, type: 'terminal', title: 'Terminal 1' },
    ],
    activeId: DEMO_DIFF_TAB_ID,
  };
}

/**
 * The demo runs same-origin with the real web client, so it gets an
 * in-memory store: nothing it renders may leak into the visitor's saved
 * workbench state. It is always light to match the landing page.
 */
export function installDemoPlatformBridge(): void {
  const memory = new Map<string, unknown>();
  const api: TodeXWebApi = {
    store: {
      get: async (key) => (memory.has(key) ? memory.get(key) : defaultValue(key)),
      set: async (key, value) => { memory.set(key, value); },
    },
    fs: {
      readFile: async () => { throw new Error('The demo has no file system.'); },
    },
    app: { focus: () => {}, windowChrome: 'native' },
    theme: {
      shouldUseDark: async () => false,
      onUpdated: () => () => {},
    },
  };
  window.todexWeb = api;
  document.documentElement.classList.remove('dark');
  document.documentElement.dataset.theme = 'light';
  document.documentElement.dataset.windowChrome = api.app.windowChrome;

  // The demo is embedded in the landing page and never takes input. Modal
  // autofocus or composer focus inside the frame would otherwise pull
  // keyboard focus (and scroll position) away from the host page.
  HTMLElement.prototype.focus = function focus() {};
}
