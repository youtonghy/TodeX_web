import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SmartWorkModeSettings } from '../../src/renderer/components/settings/SmartWorkModeSettings';
import { DEFAULT_SMART_WORK_MODE, type SmartWorkModeConfig } from '../../src/renderer/session/smartWorkMode';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  globalThis.CSS ??= { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`) } as typeof CSS;
});
let root: Root;
let container: HTMLDivElement;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.restoreAllMocks(); });

const models = [
  { id: 'claude-fable-5-2', displayName: 'Fable 5.2', description: '', isDefault: false, supportedReasoningEfforts: ['low', 'medium', 'high'] },
  { id: 'claude-opus-5-5', displayName: 'Opus 5.5', description: '', isDefault: true, supportedReasoningEfforts: ['low', 'medium', 'high'] },
];
const skill = (name: string) => ({ resourceId: `skill-${name}`, name, description: '', scope: 'user', source: 'shared-user', active: true, valid: true });
const claude = { id: 'claude-code', displayName: 'Claude Code', available: true, profiles: [], models, capabilities: {} };

function sessionWith(overrides: Partial<Record<keyof TodeXSession, unknown>> = {}) {
  return {
    v2Providers: [claude],
    providerModels: { 'claude-code': models },
    capabilityCatalogs: { 'claude-code': { status: 'ready', skills: { provider: 'claude-code', skills: [skill('planner'), skill('reviewer')] } } },
    modelCatalog: [],
    smartWorkMode: DEFAULT_SMART_WORK_MODE,
    smartWorkModeHydrated: true,
    setSmartWorkMode: vi.fn(),
    refreshCapabilityCatalog: vi.fn(async () => {}),
    ...overrides,
  } as unknown as TodeXSession;
}

async function render(session: TodeXSession) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(createElement(SmartWorkModeSettings, { session })); });
}

it('shows a note instead of the controls without Claude Code on the backend', async () => {
  const session = sessionWith({ v2Providers: [{ ...claude, available: false }] });
  await render(session);
  expect(container.textContent).toContain('当前后端没有可用的 Claude Code');
  expect(container.querySelector('button')).toBeNull();
  expect(session.refreshCapabilityCatalog).not.toHaveBeenCalled();
});

it('shows each stage with its model and effort and execution fixed to auto-approve', async () => {
  await render(sessionWith());
  expect(container.textContent).toContain('计划阶段');
  expect(container.textContent).toContain('执行阶段');
  const planModel = container.querySelector<HTMLButtonElement>('button[aria-label="计划阶段 · 模型"]')!;
  const executeModel = container.querySelector<HTMLButtonElement>('button[aria-label="执行阶段 · 模型"]')!;
  expect(planModel.textContent).toContain('Fable 5.2');
  expect(executeModel.textContent).toContain('Opus 5.5');
  expect(container.textContent).toContain('自动审批');
});

it('falls back to the provider default for a model the list lacks', async () => {
  const config: SmartWorkModeConfig = { ...DEFAULT_SMART_WORK_MODE, plan: { model: 'retired-model', reasoningEffort: 'medium', skill: '' } };
  await render(sessionWith({ smartWorkMode: config }));
  expect(container.querySelector('button[aria-label="计划阶段 · 模型"]')!.textContent).toContain('Opus 5.5');
});

it('picks the plan skill by name from the Claude Code catalog', async () => {
  const session = sessionWith();
  await render(session);
  const trigger = [...container.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent === '无')!;
  await act(async () => { trigger.click(); });
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((item) => item.textContent === 'planner')!;
  await act(async () => { option.click(); });
  expect(session.setSmartWorkMode).toHaveBeenCalledWith({ ...DEFAULT_SMART_WORK_MODE, plan: { ...DEFAULT_SMART_WORK_MODE.plan, skill: 'planner' } });
});

it('keeps a configured skill the catalog no longer lists, marked as not found, and loads a missing catalog', async () => {
  const session = sessionWith({
    smartWorkMode: { ...DEFAULT_SMART_WORK_MODE, plan: { ...DEFAULT_SMART_WORK_MODE.plan, skill: 'gone' } },
    capabilityCatalogs: {},
  });
  await render(session);
  expect(container.textContent).toContain('gone（未找到）');
  expect(session.refreshCapabilityCatalog).toHaveBeenCalledWith('claude-code');
});
