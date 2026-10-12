// Landing-page autoplay for the demo (`/demo?autoplay`): a pointer drives the
// real workbench — opens a new conversation, types a prompt and sends it —
// and the in-memory backend answers with a scripted turn. The static `/demo`
// (no `autoplay`) stays identical to the desktop's `?demo`.
import { t } from '../i18n';
import { isDemoPlaybackMessage } from './playback';
import { setDemoTurnScript, type DemoTurnStep } from './transport';

const LOOP_PAUSE_MS = 8000;

class Stopped extends Error {}

/** The assistant's reply arrives in chunks, like a provider stream. */
function streamSteps(start: number, text: string, turnId: string): DemoTurnStep[] {
  const block = { category: 'assistant_final', id: `${turnId}-answer`, turnId, phase: 'delta' };
  const characters = Array.from(text);
  const size = Math.max(4, Math.ceil(characters.length / 70));
  const steps: DemoTurnStep[] = [];
  for (let index = 0, time = start; index < characters.length; index += size, time += 45) {
    steps.push([time, 'message.delta', { role: 'assistant', delta: characters.slice(index, index + size).join(''), block }]);
  }
  return steps;
}

/** Reasoning, a few tool calls with results, then the streamed answer. */
function scriptedTurn(prompt: string, turnId: string): DemoTurnStep[] {
  const call = (name: string) => `${turnId}-${name}`;
  const tool = (at: number, id: string, toolName: string, args: Record<string, unknown>, result: string, takes: number): DemoTurnStep[] => [
    [at, 'tool.started', { toolCallId: call(id), toolName, arguments: args }],
    [at + takes, 'tool.completed', { toolCallId: call(id), toolName, arguments: args, result, isError: false }],
  ];
  const answer = t('demo.autoplayAnswer');
  const answerAt = 7600;
  const streamed = streamSteps(answerAt, answer, turnId);
  const doneAt = (streamed.at(-1)?.[0] ?? answerAt) + 200;
  return [
    [0, 'message.created', { role: 'user', content: prompt }],
    [150, 'turn.started', { status: 'running' }],
    [700, 'thought.delta', { thinking: t('demo.autoplayThinking') }],
    ...tool(1500, 'read', 'Read', { file_path: 'src/checkout/CheckoutPage.tsx' },
      'export function CheckoutPage() {\n  const cart = useCart();\n  return <CheckoutLayout aside={null}>…</CheckoutLayout>;\n}', 800),
    ...tool(2700, 'write', 'Write', { file_path: 'src/checkout/OrderSummary.tsx' }, 'File created successfully at: src/checkout/OrderSummary.tsx', 1000),
    ...tool(4100, 'edit', 'Edit', { file_path: 'src/checkout/CheckoutPage.tsx', old_string: 'aside={null}', new_string: 'aside={<OrderSummary cart={cart} />}' },
      'The file src/checkout/CheckoutPage.tsx has been updated.', 700),
    ...tool(5200, 'test', 'Bash', { command: 'pnpm test checkout', description: 'Run checkout unit tests' },
      ' ✓ src/checkout/OrderSummary.test.tsx (5 tests) 41ms\n ✓ src/checkout/schema.test.ts (14 tests) 38ms\n\n Test Files  2 passed (2)\n      Tests  19 passed (19)', 1800),
    ...streamed,
    [doneAt, 'message.completed', {
      role: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: answer }] },
      block: { category: 'assistant_final', id: `${turnId}-answer`, turnId, phase: 'completed' },
    }],
    [doneAt + 100, 'usage.updated', { model: 'opus', contextWindow: 200_000, usage: { last: { input: 18_400, output: 1_150, cacheRead: 64_000, cacheWrite: 2_100, total: 19_550 } } }],
    [doneAt + 200, 'turn.completed', { status: 'completed' }],
  ];
}

function createPointer() {
  const pointer = document.createElement('div');
  pointer.setAttribute('aria-hidden', 'true');
  Object.assign(pointer.style, {
    position: 'fixed', top: '0', left: '0', zIndex: '2147483647', pointerEvents: 'none',
    opacity: '0', transform: 'translate(-40px, -40px)',
    transition: 'transform 700ms cubic-bezier(0.45, 0, 0.2, 1), opacity 300ms ease',
  });
  pointer.innerHTML = '<span data-ripple style="position:absolute;left:-16px;top:-16px;width:32px;height:32px;border-radius:9999px;background:rgb(18 141 219 / 0.28);transform:scale(0);transition:transform 180ms ease"></span>'
    + '<svg width="22" height="22" viewBox="0 0 24 24" style="position:relative;filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.25))"><path d="M4 2.5 20 11l-7 2-3.5 7z" fill="#18222e" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  document.body.append(pointer);
  const ripple = pointer.querySelector<HTMLElement>('[data-ripple]')!;
  return {
    moveTo(element: Element, caret = false) {
      const rect = element.getBoundingClientRect();
      // Text fields are clicked near where the caret lands, buttons in the middle.
      const x = caret ? rect.left + Math.min(48, rect.width / 2) : rect.left + rect.width / 2;
      pointer.style.opacity = '1';
      pointer.style.transform = `translate(${x}px, ${rect.top + rect.height / 2}px)`;
    },
    press(down: boolean) { ripple.style.transform = down ? 'scale(1)' : 'scale(0)'; },
    hide() { pointer.style.opacity = '0'; },
  };
}

function visible(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement) || element.closest('[inert]')) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function startDemoAutoplay(): void {
  if (!new URLSearchParams(window.location.search).has('autoplay')) return;
  // Reduced motion keeps the still demo.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const prompt = t('demo.autoplayPrompt');
  setDemoTurnScript((text, turnId) => (text.trim() === prompt ? scriptedTurn(prompt, turnId) : null));

  // The landing page pauses the walkthrough while it is scrolled away.
  let hostVisible = true;
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    if (isDemoPlaybackMessage(event.data)) hostVisible = event.data.playing;
  });
  const wait = async (ms: number) => {
    let remaining = ms;
    while (remaining > 0) {
      const slice = Math.min(remaining, 100);
      await new Promise((resolve) => window.setTimeout(resolve, slice));
      if (hostVisible && document.visibilityState === 'visible') remaining -= slice;
    }
  };
  const find = async (lookup: () => Element | null | undefined, timeout = 8000) => {
    for (let waited = 0; waited < timeout; waited += 100) {
      const element = lookup();
      if (visible(element ?? null)) return element as HTMLElement;
      await wait(100);
    }
    throw new Stopped();
  };
  const byLabel = (label: string) => () => [...document.querySelectorAll('button, [role="button"]')]
    .find((element) => element.getAttribute('aria-label') === label || element.textContent?.trim() === label);

  const pointer = createPointer();
  const click = async (element: HTMLElement, caret = false) => {
    pointer.moveTo(element, caret);
    await wait(850);
    pointer.press(true);
    await wait(180);
    element.click();
    pointer.press(false);
    await wait(250);
  };

  const run = async () => {
    await wait(2600);
    // Phones keep the sidebar in a drawer: open it for the new conversation.
    const newConversation = byLabel(t('sidebar.newConversation'));
    if (!visible(newConversation() ?? null)) await click(await find(byLabel(t('app.openSidebar'))));
    await click(await find(newConversation));
    // The drawer stays open after creating; Escape slides it shut.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wait(700);

    const composer = await find(() => document.querySelector('[role="textbox"][contenteditable="true"]'));
    await click(composer, true);
    composer.focus();
    for (const character of Array.from(prompt)) {
      document.execCommand('insertText', false, character);
      await wait(55);
    }
    await wait(400);
    await click(await find(byLabel(t('workbench.send'))));
    // Open the running turn's work process so the steps stream in view.
    const process = await find(() => [...document.querySelectorAll('button[aria-expanded="false"]')]
      .find((button) => button.textContent?.includes(t('chat.working'))));
    await click(process);
    pointer.hide();
    // The turn streams on its own; let the finished answer sit, then start over.
    await wait(scriptedTurn(prompt, 'timing').at(-1)![0] + LOOP_PAUSE_MS);
    window.location.reload();
  };
  void run().catch((error: unknown) => {
    pointer.hide();
    if (!(error instanceof Stopped)) console.error('TodeX demo autoplay stopped', error);
  });
}
