// What the scripted demos drive the real workbench with: a clock that only
// runs while the demo plays (and runs faster while it fast-forwards), a
// pointer that moves to and clicks real elements, and lookups by the same
// i18n labels the workbench renders.
import { t, type MessageKey } from '../i18n';
import type { DemoTimer } from './transport';

/** A target did not show up in time; the demo stops where it is. */
export class Stopped extends Error {}

const TICK_MS = 40;
const MOVE_MS = 700;

/** Time that only passes while the demo plays and the page is shown, so
 * pausing holds the pointer, the typing and the streamed turn alike. `speed`
 * scales it while the player fast-forwards to a step. */
export function createClock() {
  let now = 0;
  let running = true;
  let speed = 1;
  // Unscaled running time, so lookups give the real app the same time to
  // render whether or not the demo fast-forwards.
  let elapsed = 0;
  let last = performance.now();
  const tasks = new Set<{ due: number; callback: () => void }>();
  window.setInterval(() => {
    const current = performance.now();
    // Cap the step so a throttled background tab does not jump ahead.
    if (running && document.visibilityState === 'visible') {
      const step = Math.min(current - last, 250);
      now += step * speed;
      elapsed += step;
    }
    last = current;
    for (const task of [...tasks].sort((a, b) => a.due - b.due)) {
      if (task.due > now) break;
      tasks.delete(task);
      task.callback();
    }
  }, TICK_MS);
  const after: DemoTimer = (callback, ms) => {
    const task = { due: now + ms, callback };
    tasks.add(task);
    return () => { tasks.delete(task); };
  };
  return {
    after,
    wait: (ms: number) => new Promise<void>((resolve) => { after(resolve, ms); }),
    now: () => now,
    elapsed: () => elapsed,
    speed: () => speed,
    setRunning(value: boolean) { running = value; },
    setSpeed(value: number) { speed = value; },
  };
}
export type DemoClock = ReturnType<typeof createClock>;

function createPointer(clock: DemoClock) {
  const pointer = document.createElement('div');
  pointer.setAttribute('aria-hidden', 'true');
  Object.assign(pointer.style, {
    position: 'fixed', top: '0', left: '0', zIndex: '2147483647', pointerEvents: 'none',
    opacity: '0', transform: 'translate(-40px, -40px)',
  });
  pointer.innerHTML = '<span data-ripple style="position:absolute;left:-16px;top:-16px;width:32px;height:32px;border-radius:9999px;background:rgb(18 141 219 / 0.28);transform:scale(0);transition:transform 180ms ease"></span>'
    + '<svg width="22" height="22" viewBox="0 0 24 24" style="position:relative;filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.25))"><path d="M4 2.5 20 11l-7 2-3.5 7z" fill="#18222e" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  // A ring around what a "look here" step points at.
  const ring = document.createElement('div');
  ring.setAttribute('aria-hidden', 'true');
  Object.assign(ring.style, {
    position: 'fixed', zIndex: '2147483646', pointerEvents: 'none', opacity: '0', borderRadius: '10px',
    boxShadow: '0 0 0 2px rgb(18 141 219 / 0.85), 0 0 0 6px rgb(18 141 219 / 0.18)', transition: 'opacity 250ms ease',
  });
  document.body.append(ring, pointer);
  const ripple = pointer.querySelector<HTMLElement>('[data-ripple]')!;
  return {
    moveTo(element: Element, caret = false) {
      const rect = element.getBoundingClientRect();
      // Text fields are clicked near where the caret lands, buttons in the middle.
      const x = caret ? rect.left + Math.min(48, rect.width / 2) : rect.left + rect.width / 2;
      pointer.style.transition = `transform ${Math.round(MOVE_MS / clock.speed())}ms cubic-bezier(0.45, 0, 0.2, 1), opacity 300ms ease`;
      pointer.style.opacity = '1';
      pointer.style.transform = `translate(${x}px, ${rect.top + rect.height / 2}px)`;
    },
    press(down: boolean) { ripple.style.transform = down ? 'scale(1)' : 'scale(0)'; },
    hide() { pointer.style.opacity = '0'; },
    highlight(element: Element | null) {
      if (!element) {
        ring.style.opacity = '0';
        return;
      }
      const rect = element.getBoundingClientRect();
      Object.assign(ring.style, { left: `${rect.left - 4}px`, top: `${rect.top - 4}px`, width: `${rect.width + 8}px`, height: `${rect.height + 8}px`, opacity: '1' });
    },
  };
}

/** Rendered, sized and not inside an inert subtree (SVG counts: the invite
 * QR code is one). */
export function isShown(element: Element | null | undefined): element is HTMLElement | SVGElement {
  if (!(element instanceof HTMLElement || element instanceof SVGElement) || element.closest('[inert]')) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isEnabled(element: Element): boolean {
  return !(element instanceof HTMLButtonElement && element.disabled) && element.getAttribute('aria-disabled') !== 'true';
}

/** The text before and after a message's `{param}`, to match labels that
 * carry a name or a count. */
export function messageParts(key: MessageKey, param: string): [string, string] {
  const marker = '\u0000';
  const [before = '', after = ''] = t(key, { [param]: marker }).split(marker);
  return [before, after];
}

/** The accessible name of a control: its `aria-label`, or the text of the
 * elements its `aria-labelledby` points at. */
function nameOf(element: Element): string {
  const label = element.getAttribute('aria-label');
  if (label) return label;
  const ids = element.getAttribute('aria-labelledby');
  if (ids) return ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim();
  return element.textContent?.trim() ?? '';
}

type Lookup = () => Element | null | undefined;

export function createDriver(clock: DemoClock, { pointer: showPointer = true } = {}) {
  const pointer = showPointer ? createPointer(clock) : null;
  const wait = clock.wait;

  /** Waits for an element to show up, in running (not fast-forwarded) time.
   * Typed as HTMLElement for `click()`; `point()` also takes SVG targets. */
  const find = async (lookup: Lookup, timeout = 8000): Promise<HTMLElement> => {
    const deadline = clock.elapsed() + timeout;
    for (;;) {
      const element = lookup();
      if (isShown(element)) return element as HTMLElement;
      if (clock.elapsed() > deadline) throw new Stopped();
      await wait(100);
    }
  };

  const reveal = (element: Element) => {
    const rect = element.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight || rect.left < 0 || rect.right > window.innerWidth) {
      element.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  };

  const driver = {
    wait,
    find,
    /** Lingers so the reader can take in what just happened. */
    hold: (ms = 1800) => wait(ms),
    /** The topmost open dialog, or the page when none is open. */
    scope(): ParentNode {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter((dialog) => isShown(dialog));
      return dialogs.at(-1) ?? document;
    },
    /** A visible, enabled control named `label` (aria-label, labelledby or text). */
    button(label: string, scope?: ParentNode): Lookup {
      return () => [...(scope ?? document).querySelectorAll('button, [role="button"], [role="tab"], [role="option"], [role="switch"], a')]
        .find((element) => isShown(element) && isEnabled(element) && nameOf(element) === label);
    },
    /** A control whose name matches `test` (for labels that carry a count). */
    buttonWhere(test: (name: string) => boolean, scope?: ParentNode): Lookup {
      return () => [...(scope ?? document).querySelectorAll('button, [role="button"]')]
        .find((element) => isShown(element) && isEnabled(element) && test(nameOf(element)));
    },
    /** The innermost visible element whose text is exactly `text`. */
    text(text: string, selector = '*', scope?: ParentNode): Lookup {
      return () => [...(scope ?? document).querySelectorAll(selector)]
        .filter((element) => isShown(element) && element.textContent?.trim() === text).at(-1);
    },
    select(selector: string, scope?: ParentNode): Lookup {
      return () => [...(scope ?? document).querySelectorAll(selector)].find((element) => isShown(element));
    },
    async click(element: HTMLElement, caret = false) {
      reveal(element);
      pointer?.highlight(null);
      pointer?.moveTo(element, caret);
      await wait(850);
      pointer?.press(true);
      await wait(180);
      element.click();
      pointer?.press(false);
      await wait(250);
    },
    /** Points at an element and rings it, without clicking. */
    async point(element: Element, holdMs = 1800) {
      reveal(element);
      pointer?.moveTo(element);
      await wait(850);
      pointer?.highlight(element);
      await wait(holdMs);
      pointer?.highlight(null);
    },
    /** Types into the focused field one character at a time. */
    async type(text: string, perCharacter: number) {
      for (const character of Array.from(text)) {
        document.execCommand('insertText', false, character);
        await wait(perCharacter);
      }
    },
    /** Escape on the focused element (closes popovers) and the window (the
     * phone sidebar drawer listens there). */
    escape() {
      const init = { key: 'Escape', bubbles: true, cancelable: true };
      (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', init));
      window.dispatchEvent(new KeyboardEvent('keydown', init));
    },
    hidePointer() {
      pointer?.highlight(null);
      pointer?.hide();
    },
    /** Phones keep the sidebar in a drawer: opens it when it is shut and
     * reports whether it did. */
    async openSidebar(): Promise<boolean> {
      if (driver.button(t('app.settings'))()) return false;
      const open = driver.button(t('app.openSidebar'))();
      if (!isShown(open)) return false;
      await driver.click(open as HTMLElement);
      await find(driver.button(t('app.settings')));
      return true;
    },
    async openConversation(title: string, workspaceName?: string) {
      await driver.openSidebar();
      if (workspaceName) {
        const workspace = await find(() => [...document.querySelectorAll('[role="row"], aside span, aside button')]
          .find((element) => isShown(element) && element.textContent?.trim() === workspaceName));
        await driver.click(workspace);
      }
      const row = await find(() => [...document.querySelectorAll('[role="grid"] [role="row"]')]
        .find((element) => isShown(element) && element.textContent?.includes(title)));
      await driver.click(row);
      // On phone viewports the sidebar drawer stays open after picking a row.
      driver.escape();
      await wait(500);
    },
    /** Opens Settings on a category and returns the settings dialog. */
    async openSettings(sectionLabel: string): Promise<HTMLElement> {
      await driver.openSidebar();
      await driver.click(await find(driver.button(t('app.settings'))));
      const nav = await find(() => document.querySelector(`nav[aria-label="${CSS.escape(t('app.settings'))}"]`));
      await driver.click(await find(driver.button(sectionLabel, nav)));
      await wait(300);
      return nav.closest<HTMLElement>('[role="dialog"]') ?? document.body;
    },
    /** Clicks `trigger` until `popup` shows up: a popover that is still
     * closing can swallow the first press. Returns the popup. */
    async open(trigger: Lookup, popup: Lookup): Promise<HTMLElement> {
      for (let attempt = 0; ; attempt += 1) {
        await driver.click(await find(trigger));
        try {
          return await find(popup, 1500);
        } catch (error) {
          if (attempt >= 2) throw error;
        }
      }
    },
    /** Closes a popover: Escape from inside it (focus may not have moved in
     * yet), then a second press on its trigger if it is still open. */
    async dismiss(popup: HTMLElement, trigger: Lookup) {
      popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      for (let waited = 0; waited < 1000 && isShown(popup); waited += 100) await wait(100);
      if (!isShown(popup)) return;
      await driver.click(await find(trigger));
      for (let waited = 0; waited < 1000 && isShown(popup); waited += 100) await wait(100);
    },
    /** Opens a select or menu named `label` and picks the option `option`. */
    async choose(label: string, option: string, scope?: ParentNode) {
      const item = () => [...document.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"]')]
        .find((element) => isShown(element) && element.textContent?.trim() === option);
      await driver.click(await driver.open(driver.button(label, scope), item));
      await wait(400);
    },
  };
  return driver;
}
export type DemoDriver = ReturnType<typeof createDriver>;
