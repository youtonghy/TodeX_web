import { describe, expect, it } from 'vitest';
import { playDemoOnce, type DemoScriptContext, type DemoTarget } from '../../src/renderer/demo/demoScript';
import { DEMO_NEW_CONVERSATION_ID, DEMO_NEW_WORKSPACE_ID, initialDemoState, type DemoState } from '../../src/renderer/demo/demoState';
import { buildDemoSession } from '../../src/renderer/demo/demoSession';
import { demoBackend } from '../../src/renderer/demo/demoData';
import { buildChatRenderItems } from '../../src/renderer/components/conversationTimeline';
import { translate } from '../../src/renderer/i18n';

async function runOnce() {
  let state: DemoState = initialDemoState(0);
  const states: DemoState[] = [];
  const pointed: DemoTarget[] = [];
  const context: DemoScriptContext = {
    update: (next) => { state = next(state); states.push(state); },
    wait: async () => {},
    point: async (target) => { pointed.push(target); },
    click: async () => {},
    hideCursor: () => {},
    now: () => 1_000,
  };
  await playDemoOnce(context);
  return { state, states, pointed };
}

describe('landing-page demo script', () => {
  it('walks through workspace, conversation, prompt and answer in order', async () => {
    const { states, pointed } = await runOnce();
    expect(pointed).toEqual(['new-workspace', 'workspace-name', 'create-workspace', 'new-conversation', 'composer']);
    const firstIndex = (predicate: (state: DemoState) => boolean) => states.findIndex(predicate);
    const modal = firstIndex((state) => state.modal !== null);
    const workspace = firstIndex((state) => state.activeWorkspaceId === DEMO_NEW_WORKSPACE_ID);
    const conversation = firstIndex((state) => state.activeConversationId === DEMO_NEW_CONVERSATION_ID);
    const sent = firstIndex((state) => state.timeline.some((entry) => entry.conversationId === DEMO_NEW_CONVERSATION_ID && entry.kind === 'outgoing'));
    const answered = firstIndex((state) => state.timeline.some((entry) => entry.conversationId === DEMO_NEW_CONVERSATION_ID && entry.kind === 'incoming'));
    expect(modal).toBeGreaterThan(-1);
    expect([modal, workspace, conversation, sent, answered]).toEqual([...[modal, workspace, conversation, sent, answered]].sort((a, b) => a - b));
    expect(states.slice(sent).some((state) => state.thinkingConversations[DEMO_NEW_CONVERSATION_ID])).toBe(true);
  });

  it('settles into a finished turn the real chat projection can render', async () => {
    const { state } = await runOnce();
    const session = buildDemoSession(state, demoBackend(0));
    expect(session.activeWorkspace?.id).toBe(DEMO_NEW_WORKSPACE_ID);
    expect(session.activeConversation?.title).toBe(translate('zh-CN', 'demo.newTitle'));
    expect(session.thinkingConversations[DEMO_NEW_CONVERSATION_ID]).toBe(false);
    expect(session.turnIds[DEMO_NEW_CONVERSATION_ID]).toBeUndefined();
    expect(session.chatDrafts[DEMO_NEW_CONVERSATION_ID]).toBe('');
    expect(session.gitDiffByConversation[DEMO_NEW_CONVERSATION_ID]?.diff).toContain('useForecast');

    const entries = state.timeline.filter((entry) => entry.conversationId === DEMO_NEW_CONVERSATION_ID);
    const items = buildChatRenderItems(entries);
    expect(items.map((item) => item.type)).toEqual(['entry', 'executionGroup', 'entry']);
    const [prompt, trace, reply] = items;
    expect(prompt).toMatchObject({ entry: { kind: 'outgoing', subtitle: translate('zh-CN', 'demo.prompt') } });
    expect(trace.type === 'executionGroup' && trace.entries.map((entry) => entry.category)).toEqual(['reasoning', 'tool', 'tool', 'tool']);
    expect(reply).toMatchObject({ entry: { kind: 'incoming', subtitle: translate('zh-CN', 'demo.reply') } });
  });
});
