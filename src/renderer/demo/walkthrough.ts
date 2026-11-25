// The walkthrough the landing page loops and `/docs` plays first: a pointer
// opens a new conversation, types a prompt and sends it, and the in-memory
// backend answers with a scripted turn.
import { t } from '../i18n';
import type { DemoDriver } from './driver';
import type { DemoTurnStep } from './transport';

export const TYPE_MS = 55;

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
export function scriptedTurn(prompt: string, turnId: string): DemoTurnStep[] {
  const call = (name: string) => `${turnId}-${name}`;
  const tool = (at: number, id: string, toolName: string, args: Record<string, unknown>, result: string, takes: number): DemoTurnStep[] => [
    [at, 'tool.started', { toolCallId: call(id), toolName, arguments: args }],
    [at + takes, 'tool.completed', { toolCallId: call(id), toolName, arguments: args, result, isError: false }],
  ];
  const plan = (
    at: number,
    s1: 'pending' | 'in_progress' | 'completed',
    s2: 'pending' | 'in_progress' | 'completed',
    s3: 'pending' | 'in_progress' | 'completed',
  ): DemoTurnStep => [
    at,
    'plan.updated',
    {
      explanation: t('demo.autoplayPlanExplanation'),
      steps: [
        { text: t('demo.autoplayPlanStep1'), status: s1 },
        { text: t('demo.autoplayPlanStep2'), status: s2 },
        { text: t('demo.autoplayPlanStep3'), status: s3 },
      ],
    },
  ];
  const answer = t('demo.autoplayAnswer');
  const answerAt = 7600;
  const streamed = streamSteps(answerAt, answer, turnId);
  const doneAt = (streamed.at(-1)?.[0] ?? answerAt) + 200;
  return [
    [0, 'message.created', { role: 'user', content: prompt }],
    [150, 'turn.started', { status: 'running' }],
    [700, 'thought.delta', { thinking: t('demo.autoplayThinking'), block: { category: 'reasoning', id: `${turnId}-thought`, turnId, phase: 'delta' } }],
    plan(1100, 'in_progress', 'pending', 'pending'),
    ...tool(1500, 'read', 'Read', { file_path: 'src/checkout/CheckoutPage.tsx' },
      'export function CheckoutPage() {\n  const cart = useCart();\n  return <CheckoutLayout aside={null}>…</CheckoutLayout>;\n}', 800),
    plan(2400, 'completed', 'in_progress', 'pending'),
    ...tool(2700, 'write', 'Write', { file_path: 'src/checkout/OrderSummary.tsx' }, 'File created successfully at: src/checkout/OrderSummary.tsx', 1000),
    ...tool(4100, 'edit', 'Edit', { file_path: 'src/checkout/CheckoutPage.tsx', old_string: 'aside={null}', new_string: 'aside={<OrderSummary cart={cart} />}' },
      'The file src/checkout/CheckoutPage.tsx has been updated.', 700),
    plan(4900, 'completed', 'completed', 'in_progress'),
    ...tool(5200, 'test', 'Bash', { command: 'pnpm test checkout', description: 'Run checkout unit tests' },
      ' ✓ src/checkout/OrderSummary.test.tsx (5 tests) 41ms\n ✓ src/checkout/schema.test.ts (14 tests) 38ms\n\n Test Files  2 passed (2)\n      Tests  19 passed (19)', 1800),
    plan(7100, 'completed', 'completed', 'completed'),
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

export const walkthroughPrompt = () => t('demo.autoplayPrompt');

export const walkthroughSteps = {
  async newConversation(d: DemoDriver) {
    // Phones keep the sidebar in a drawer: open it for the new conversation.
    await d.openSidebar();
    await d.click(await d.find(d.button(t('sidebar.newConversation'))));
    // The drawer stays open after creating; Escape slides it shut.
    d.escape();
    await d.wait(700);
  },
  async typing(d: DemoDriver) {
    const composer = await d.find(d.select('[role="textbox"][contenteditable="true"]'));
    await d.click(composer, true);
    composer.focus();
    await d.type(walkthroughPrompt(), TYPE_MS);
    await d.wait(400);
  },
  async send(d: DemoDriver) {
    await d.click(await d.find(d.button(t('workbench.send'))));
  },
  async process(d: DemoDriver) {
    // Open the running turn's work process so the steps stream in view.
    await d.click(await d.find(d.select('main section > button[aria-expanded="false"]')));
    d.hidePointer();
  },
  async answer(d: DemoDriver) {
    // The turn streams on its own.
    await d.wait(scriptedTurn(walkthroughPrompt(), 'timing').at(-1)![0]);
  },
};
