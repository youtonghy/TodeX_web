import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ProviderModelDescriptor } from '@todex/protocol/v2';
import { ModelReasoningCard } from '../../src/renderer/components/ModelReasoningCard';
import type { TodeXSession } from '../../src/renderer/session/useTodeXSession';

vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, media: '', onchange: null });
});

let root: Root;
let container: HTMLDivElement;
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  globalThis.CSS ??= { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`) } as typeof CSS;
  HTMLElement.prototype.scrollIntoView ??= () => {};
});
afterEach(() => {
  act(() => { root?.unmount(); });
  container?.remove();
});

const models: ProviderModelDescriptor[] = [
  { id: 'claude-opus', displayName: 'Claude Opus 5 Medium', description: '', isDefault: true, supportedReasoningEfforts: [] },
  { id: 'claude-sonnet', displayName: 'Claude Sonnet 5 High', description: '', isDefault: false, supportedReasoningEfforts: [] },
  { id: 'gpt-astra', displayName: 'GPT Astra', description: '', isDefault: false, supportedReasoningEfforts: [] },
];

function Harness({ items, onSelectModel }: { items: ProviderModelDescriptor[]; onSelectModel: (id: string) => void }) {
  const [currentModel, setCurrentModel] = useState('claude-opus');
  return createElement(ModelReasoningCard, {
    currentModel,
    currentModelDescriptor: items.find(item => item.id === currentModel),
    modelCatalog: [] as TodeXSession['modelCatalog'],
    providerModels: items,
    supportedReasoningEfforts: [],
    currentReasoningEffort: null,
    displayedReasoningEffort: null,
    onSelectModel: (id: string) => { onSelectModel(id); setCurrentModel(id); },
    onSelectReasoningEffort: vi.fn(),
  });
}

function renderCard({ items = models }: { items?: ProviderModelDescriptor[] } = {}) {
  const onSelectModel = vi.fn();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(createElement(Harness, { items, onSelectModel })));
  return { onSelectModel };
}

const trigger = () => document.querySelector<HTMLElement>('.composer-model-card__trigger')!;
const searchInput = () => document.querySelector<HTMLInputElement>('input[aria-label="搜索模型"]');
const options = () => [...document.querySelectorAll<HTMLElement>('.composer-model-card__listbox .composer-model-card__list-item')];
const dropdownOpen = () => document.querySelector('.composer-model-card__listbox') !== null;

async function openPicker() {
  await act(async () => { trigger().click(); });
  expect(searchInput(), 'search input').toBeTruthy();
}

async function search(value: string) {
  const input = searchInput()!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function pressKey(target: EventTarget, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
}

it('opens with the search field focused and filters options case-insensitively without selecting', async () => {
  const { onSelectModel } = renderCard();
  await openPicker();
  expect(options()).toHaveLength(3);
  expect(document.activeElement).toBe(searchInput());
  await search('  CLAUDE  ');
  const filtered = options();
  expect(filtered).toHaveLength(2);
  expect(filtered.every(option => option.textContent?.includes('Claude'))).toBe(true);
  expect(trigger().textContent).toContain('Claude Opus 5 Medium');
  expect(onSelectModel).not.toHaveBeenCalled();
  await search('   ');
  expect(options()).toHaveLength(3);
});

it('shows an empty state, supports clearing, selects by click, and resets on reopen', async () => {
  const { onSelectModel } = renderCard();
  await openPicker();
  await search('no-such-model');
  expect(options()).toHaveLength(0);
  expect(document.querySelector('.composer-model-card__empty')?.textContent).toContain('未找到匹配的模型');
  const clear = document.querySelector<HTMLButtonElement>('button[aria-label="清除搜索"]')!;
  expect(clear).toBeTruthy();
  await act(async () => { clear.click(); });
  expect(searchInput()!.value).toBe('');
  expect(options()).toHaveLength(3);
  expect(onSelectModel).not.toHaveBeenCalled();
  const gpt = options().find(option => option.textContent?.includes('GPT Astra'))!;
  expect(gpt).toBeTruthy();
  await act(async () => { gpt.click(); });
  expect(onSelectModel).toHaveBeenCalledExactlyOnceWith('gpt-astra');
  expect(dropdownOpen()).toBe(false);
  expect(trigger().textContent).toContain('GPT Astra');
  await openPicker();
  expect(searchInput()!.value).toBe('');
  expect(options()).toHaveLength(3);
  const selected = options().find(option => option.getAttribute('aria-selected') === 'true');
  expect(selected?.textContent).toContain('GPT Astra');
});

it('selects via ArrowDown + Enter and closes on Escape without selecting', async () => {
  const { onSelectModel } = renderCard();
  await openPicker();
  await search('Sonnet');
  expect(options()).toHaveLength(1);
  await act(async () => { pressKey(searchInput()!, 'ArrowDown'); });
  await act(async () => { pressKey(document.activeElement ?? searchInput()!, 'Enter'); });
  expect(onSelectModel).toHaveBeenCalledExactlyOnceWith('claude-sonnet');
  expect(dropdownOpen()).toBe(false);
  await openPicker();
  await search('gpt');
  expect(options()).toHaveLength(1);
  const input = searchInput()!;
  await act(async () => { pressKey(input, 'Escape'); });
  if (dropdownOpen()) {
    expect(searchInput()!.value).toBe('');
    await act(async () => { pressKey(document.activeElement ?? input, 'Escape'); });
  }
  expect(dropdownOpen()).toBe(false);
  expect(onSelectModel).toHaveBeenCalledTimes(1);
  await openPicker();
  expect(searchInput()!.value).toBe('');
  expect(options()).toHaveLength(3);
});

it('renders the empty state for an empty catalog and keeps search usable', async () => {
  const { onSelectModel } = renderCard({ items: [] });
  await openPicker();
  expect(options()).toHaveLength(0);
  expect(document.querySelector('.composer-model-card__empty')?.textContent).toContain('未找到匹配的模型');
  await search('claude');
  expect(searchInput()!.value).toBe('claude');
  expect(options()).toHaveLength(0);
  expect(onSelectModel).not.toHaveBeenCalled();
});
