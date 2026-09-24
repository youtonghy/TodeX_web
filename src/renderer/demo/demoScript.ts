import { t } from '../i18n';
import {
  DemoEventStream,
  WEATHER_DIFF,
  commandItem,
  diffState,
  fileChangeItem,
  terminalLines,
} from './demoData';
import {
  DEMO_NEW_CONVERSATION_ID,
  DEMO_NEW_WORKSPACE_ID,
  DEMO_NEW_WORKSPACE_NAME,
  appendDemoTerminal,
  createDemoConversation,
  createDemoWorkspace,
  finishDemoTurn,
  initialDemoState,
  openWorkspaceModal,
  setDemoDiff,
  setDemoDraft,
  setDemoRun,
  updateWorkspaceModal,
  upsertDemoEntries,
  type DemoState,
} from './demoState';

/** Elements the pointer visits; DemoApp resolves them to on-screen rects. */
export type DemoTarget = 'menu' | 'new-workspace' | 'workspace-name' | 'create-workspace' | 'new-conversation' | 'composer';

export type DemoScriptContext = {
  update: (next: (state: DemoState) => DemoState) => void;
  /** Resolves after `ms` of visible playback; rejects once the run is aborted. */
  wait: (ms: number) => Promise<void>;
  point: (target: DemoTarget) => Promise<void>;
  click: () => Promise<void>;
  hideCursor: () => void;
  /** Phone layouts keep the sidebar in a sheet; these open and close it (no-ops on desktop). */
  revealSidebar: () => Promise<void>;
  hideSidebar: () => Promise<void>;
  now: () => number;
};

const TURN_ID = 'turn-weather';

/** Types `text` over roughly `duration` ms, one grapheme-ish step at a time. */
async function type(ctx: DemoScriptContext, text: string, duration: number, apply: (value: string) => void) {
  const characters = Array.from(text);
  const step = Math.max(20, Math.min(90, duration / Math.max(1, characters.length)));
  for (let index = 1; index <= characters.length; index += 1) {
    apply(characters.slice(0, index).join(''));
    await ctx.wait(step);
  }
}

/** Streams `text` into a block the way provider deltas grow a message. */
async function stream(ctx: DemoScriptContext, text: string, apply: (value: string) => void) {
  const characters = Array.from(text);
  const chunk = Math.max(2, Math.ceil(characters.length / 60));
  for (let index = chunk; index < characters.length + chunk; index += chunk) {
    apply(characters.slice(0, index).join(''));
    await ctx.wait(32);
  }
}

/** One pass: create a workspace, open a conversation, send a prompt, receive the answer. */
export async function playDemoOnce(ctx: DemoScriptContext): Promise<void> {
  ctx.update(() => initialDemoState(ctx.now()));
  await ctx.wait(2200);

  // 1. New workspace
  await ctx.revealSidebar();
  await ctx.point('new-workspace');
  await ctx.click();
  ctx.update((state) => openWorkspaceModal(state, '~/code/'));
  await ctx.wait(500);
  await ctx.point('workspace-name');
  await type(ctx, DEMO_NEW_WORKSPACE_NAME, 700, (name) => ctx.update((state) => updateWorkspaceModal(state, { name, path: `~/code/${name}` })));
  await ctx.wait(350);
  await ctx.point('create-workspace');
  await ctx.click();
  ctx.update((state) => createDemoWorkspace(state, ctx.now()));
  await ctx.wait(900);

  // 2. New conversation
  await ctx.point('new-conversation');
  await ctx.click();
  ctx.update((state) => createDemoConversation(state, ctx.now()));
  await ctx.wait(700);
  await ctx.hideSidebar();

  // 3. Send a message
  await ctx.point('composer');
  await ctx.click();
  const prompt = t('demo.prompt');
  await type(ctx, prompt, 1800, (draft) => ctx.update((state) => setDemoDraft(state, DEMO_NEW_CONVERSATION_ID, draft)));
  await ctx.wait(400);
  ctx.hideCursor();
  const events = new DemoEventStream(DEMO_NEW_WORKSPACE_ID, DEMO_NEW_CONVERSATION_ID, ctx.now());
  ctx.update((state) => setDemoRun(upsertDemoEntries(setDemoDraft(state, DEMO_NEW_CONVERSATION_ID, ''), [events.userMessage(TURN_ID, prompt)]), DEMO_NEW_CONVERSATION_ID, { turnId: TURN_ID, submission: 'sending' }));
  await ctx.wait(500);
  ctx.update((state) => setDemoRun(state, DEMO_NEW_CONVERSATION_ID, { turnId: TURN_ID, submission: 'running' }));

  // 4. Receive the answer: reasoning, tool calls, then the streamed reply.
  const reasoning = t('demo.reasoning');
  await stream(ctx, reasoning, (text) => ctx.update((state) => upsertDemoEntries(state, [events.reasoning(TURN_ID, 'reasoning-1', text, 'delta')])));
  ctx.update((state) => upsertDemoEntries(state, [events.reasoning(TURN_ID, 'reasoning-1', reasoning, 'completed')]));
  await ctx.wait(500);

  ctx.update((state) => upsertDemoEntries(state, [events.tool(TURN_ID, 'tool-scan', commandItem('ls src'), 'started')]));
  await ctx.wait(700);
  ctx.update((state) => upsertDemoEntries(state, [events.tool(TURN_ID, 'tool-scan', commandItem('ls src', 'App.tsx  main.tsx  styles.css'), 'completed')]));
  await ctx.wait(400);

  ctx.update((state) => setDemoDiff(upsertDemoEntries(state, [events.tool(TURN_ID, 'tool-edit', fileChangeItem(['src/App.tsx', 'src/components/CurrentConditions.tsx', 'src/components/ForecastList.tsx', 'src/hooks/useForecast.ts']), 'completed')]), DEMO_NEW_CONVERSATION_ID, diffState(WEATHER_DIFF, ctx.now())));
  await ctx.wait(900);

  ctx.update((state) => ({ ...upsertDemoEntries(state, [events.tool(TURN_ID, 'tool-test', commandItem('pnpm test'), 'started')]), workbenchTab: 'terminal' }));
  ctx.update((state) => appendDemoTerminal(state, DEMO_NEW_CONVERSATION_ID, [terminalLines('input', '$ pnpm test', ctx.now())]));
  const testOutput = [' ✓ src/hooks/useForecast.test.ts (4 tests)', ' ✓ src/components/ForecastList.test.tsx (5 tests)', ' ✓ src/components/CurrentConditions.test.tsx (3 tests)', ' Test Files  3 passed (3)\n      Tests  12 passed (12)'];
  for (const line of testOutput) {
    await ctx.wait(420);
    ctx.update((state) => appendDemoTerminal(state, DEMO_NEW_CONVERSATION_ID, [terminalLines('stdout', line, ctx.now())]));
  }
  ctx.update((state) => upsertDemoEntries(state, [events.tool(TURN_ID, 'tool-test', commandItem('pnpm test', '✓ 12 passed (1.4s)'), 'completed')]));
  await ctx.wait(600);

  const reply = t('demo.reply');
  await stream(ctx, reply, (text) => ctx.update((state) => upsertDemoEntries(state, [events.reply(TURN_ID, 'reply', text, 'delta')])));
  const finishedAt = ctx.now();
  ctx.update((state) => ({
    ...finishDemoTurn(upsertDemoEntries(state, [events.reply(TURN_ID, 'reply', reply, 'completed')]), DEMO_NEW_CONVERSATION_ID, t('demo.newTitle'), {
      usedTokens: 23_400, contextWindow: 400_000, inputTokens: 19_800, outputTokens: 3_600, cachedInputTokens: 12_000, cacheWriteTokens: 0, model: 'gpt-5.5', updatedAt: finishedAt,
    }),
    workbenchTab: 'git-diff',
  }));
}
