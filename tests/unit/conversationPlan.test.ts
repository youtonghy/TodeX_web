import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { RuntimePlan } from '@todex/protocol/conversationRuntime';
import { ConversationPlanBar } from '../../src/renderer/components/ConversationPlan';

let root: Root | undefined;
let container: HTMLDivElement | undefined;
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
});
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});
function render(element: ReturnType<typeof createElement>) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root!.render(element));
  return container;
}

const plan: RuntimePlan = {
  turnId: 't1',
  explanation: '先复现再修复',
  updatedAt: '2026-09-06T00:00:00Z',
  steps: [
    { text: '定位问题', status: 'completed' },
    { text: '修复抖动', status: 'in_progress' },
    { text: '补回归测试', status: 'pending' },
  ],
};

describe('conversation plan bar', () => {
  it('lists the steps with the done count and collapses from the header', async () => {
    const dom = render(createElement(ConversationPlanBar, { plan }));
    const header = dom.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    expect(header.textContent).toContain('计划');
    expect(header.textContent).toContain('1/3');
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(dom.textContent).toContain('先复现再修复');
    const list = dom.querySelector('ul[aria-label="计划步骤"]')!;
    expect([...list.querySelectorAll('li')].map(item => item.textContent)).toEqual(['定位问题', '修复抖动', '补回归测试']);
    // Steps are read-only: no row is a button.
    expect(list.querySelector('button')).toBeNull();
    await act(async () => header.click());
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(dom.querySelector('ul[aria-label="计划步骤"]')).toBeNull();
  });
});
