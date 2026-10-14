import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { formatElapsed, ToolElapsed, ToolSilentNotice, TOOL_SILENT_AFTER_MS } from '../../src/renderer/components/chat/ToolRunStatus';
import { setLocale } from '../../src/renderer/i18n';

let root: Root;
let container: HTMLDivElement;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); setLocale('en'); });
afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.useRealTimers(); });

function render(element: React.ReactElement) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  act(() => { root.render(element); });
}

it('formats seconds, minutes and hours', () => {
  expect(formatElapsed(-5)).toBe('0s');
  expect(formatElapsed(12_400)).toBe('12s');
  expect(formatElapsed(185_000)).toBe('3m 05s');
  expect(formatElapsed(3_720_000)).toBe('1h 02m');
});

it('ticks while running and freezes at the last event once done', () => {
  vi.useFakeTimers();
  const start = Date.parse('2026-10-14T08:28:20Z');
  vi.setSystemTime(start + 5_000);
  render(createElement(ToolElapsed, { startedAt: start, endedAt: start, running: true }));
  expect(container.textContent).toBe('5s');
  act(() => { vi.advanceTimersByTime(3_000); });
  expect(container.textContent).toBe('8s');
  act(() => { root.render(createElement(ToolElapsed, { startedAt: start, endedAt: start + 40_000, running: false })); });
  act(() => { vi.advanceTimersByTime(10_000); });
  expect(container.textContent).toBe('40s');
});

it('omits the elapsed time without a start event', () => {
  render(createElement(ToolElapsed, { startedAt: undefined, endedAt: 1, running: true }));
  expect(container.textContent).toBe('');
});

it('offers to stop the turn after the tool stays quiet', () => {
  vi.useFakeTimers();
  const last = Date.parse('2026-10-14T08:28:20Z');
  vi.setSystemTime(last + TOOL_SILENT_AFTER_MS - 1_000);
  const onStop = vi.fn();
  render(createElement(ToolSilentNotice, { lastEventAt: last, running: true, onStop }));
  expect(container.textContent).toBe('');
  act(() => { vi.advanceTimersByTime(1_000); });
  expect(container.textContent).toContain('No new output for 2 minutes');
  const button = container.querySelector('button');
  expect(button?.textContent).toContain('Stop this turn');
  act(() => { button!.click(); });
  expect(onStop).toHaveBeenCalledTimes(1);
  // Read-only conversations get the notice without the action.
  act(() => { root.render(createElement(ToolSilentNotice, { lastEventAt: last, running: true })); });
  expect(container.querySelector('button')).toBeNull();
  act(() => { root.render(createElement(ToolSilentNotice, { lastEventAt: last, running: false, onStop })); });
  expect(container.textContent).toBe('');
});
