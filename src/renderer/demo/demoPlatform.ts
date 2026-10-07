import type { TodeXWebApi } from '../../preload/index';
import { KANBAN_TASKS_STORAGE_KEY, SETTINGS_STORAGE_KEY } from '../session/helpers';
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
  // /demo?kanban previews the task board: seed a few tasks against the demo
  // workspaces and conversations so every board feature is visible.
  if (new URLSearchParams(window.location.search).has('kanban')) {
    const now = Date.now();
    memory.set(KANBAN_TASKS_STORAGE_KEY, [
      { id: 'demo-task-board', workspaceId: 'demo-ws-web', title: '任务看板交互改版', status: 'planned', conversationIds: ['demo-conv-hero', 'demo-conv-e2e'], sortOrder: 0, createdAt: now - 7200_000, updatedAt: now - 7200_000 },
      { id: 'demo-task-e2e', workspaceId: 'demo-ws-web', title: '补齐看板拖拽用例', status: 'planned', conversationIds: ['demo-conv-e2e', 'demo-conv-removed'], sortOrder: 1, createdAt: now - 5400_000, updatedAt: now - 5400_000 },
      { id: 'demo-task-nav', workspaceId: 'demo-ws-web', title: '修复移动端导航遮挡', status: 'in-progress', conversationIds: ['demo-conv-structure'], sortOrder: 0, createdAt: now - 3600_000, updatedAt: now - 3600_000 },
      { id: 'demo-task-release', workspaceId: 'demo-ws-web', title: '发布官网 1.2', status: 'done', createdAt: now - 86_400_000, updatedAt: now - 3600_000 },
      { id: 'demo-task-auth', workspaceId: 'demo-ws-gateway', title: '网关鉴权改造', status: 'in-progress', conversationIds: ['demo-conv-auth'], sortOrder: 0, dueDate: '2026-10-20', createdAt: now - 172_800_000, updatedAt: now - 7200_000 },
      { id: 'demo-task-ratelimit', workspaceId: 'demo-ws-gateway', title: '梳理限流配置', status: 'planned', createdAt: now - 43_200_000, updatedAt: now - 43_200_000 },
    ]);
  }
  const api: TodeXWebApi = {
    store: {
      get: async (key) => (memory.has(key) ? memory.get(key) : defaultValue(key)),
      set: async (key, value) => { memory.set(key, value); },
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
