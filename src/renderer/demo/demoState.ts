import type { WorkspaceRecord } from '@todex/protocol/todex';
import type { WorkbenchTab } from '../lib/panels';
import {
  terminalIdForConversation,
  type ConversationContextUsage,
  type ConversationRecord,
  type GitDiffState,
  type TerminalClientState,
  type TerminalOutputEntry,
  type TimelineEntry,
} from '../session/helpers';
import { t } from '../i18n';
import {
  DEMO_TERMINAL_TAB_ID,
  DemoEventStream,
  HERO_DIFF,
  commandItem,
  demoConversation,
  demoTerminal,
  demoWorkspace,
  diffState,
  fileChangeItem,
  terminalLines,
} from './demoData';

export const DEMO_NEW_WORKSPACE_ID = 'demo-ws-weather';
export const DEMO_NEW_CONVERSATION_ID = 'demo-conv-weather';
export const DEMO_NEW_WORKSPACE_NAME = 'weather-app';

export type DemoModalState = { name: string; path: string };

/** The slice of session state the demo animates; everything else is static. */
export type DemoState = {
  workspaces: WorkspaceRecord[];
  conversations: ConversationRecord[];
  activeWorkspaceId: string;
  activeConversationId: string;
  timeline: TimelineEntry[];
  chatDrafts: Record<string, string>;
  thinkingConversations: Record<string, boolean>;
  turnIds: Record<string, string>;
  submissionStatusByConversation: Record<string, 'sending' | 'running' | 'unknown' | undefined>;
  gitDiffByConversation: Record<string, GitDiffState>;
  terminalById: Record<string, TerminalClientState>;
  contextUsageByConversation: Record<string, ConversationContextUsage>;
  workbenchTab: WorkbenchTab;
  modal: DemoModalState | null;
};

function withTerminal(state: Pick<DemoState, 'terminalById'>, conversation: ConversationRecord, workspace: WorkspaceRecord, output: TerminalOutputEntry[], now: number) {
  const terminal = demoTerminal(conversation, workspace, output, now);
  return { ...state.terminalById, [terminal.terminalId]: terminal };
}

function historyTimeline(workspaceId: string, conversationId: string, startAt: number): TimelineEntry[] {
  const stream = new DemoEventStream(workspaceId, conversationId, startAt);
  const turn = 'turn-history';
  return [
    stream.userMessage(turn, t('demo.historyPrompt')),
    stream.reasoning(turn, 'reasoning-1', t('demo.historyReasoning'), 'completed'),
    stream.tool(turn, 'tool-search', commandItem('rg -n "hero" src/site', 'src/site/Hero.tsx:14:    <section className="hero py-24">'), 'completed'),
    stream.tool(turn, 'tool-edit', fileChangeItem(['src/site/Hero.tsx', 'src/site/hero.css']), 'completed'),
    stream.tool(turn, 'tool-test', commandItem('pnpm test', '✓ 38 passed (2.1s)'), 'completed'),
    stream.reply(turn, 'reply', t('demo.historyReply'), 'completed'),
  ].filter((entry): entry is TimelineEntry => entry !== null);
}

export function initialDemoState(now: number): DemoState {
  const web = demoWorkspace('demo-ws-web', 'todex-web', now, 0);
  const gateway = demoWorkspace('demo-ws-gateway', 'api-gateway', now, 1);
  const design = demoWorkspace('demo-ws-design', 'design-system', now, 2);
  const hero = demoConversation('demo-conv-hero', web.id, t('demo.historyTitle'), 'codex', now - 60_000);
  const conversations = [
    hero,
    demoConversation('demo-conv-e2e', web.id, t('demo.conversationE2e'), 'claude-code', now - 3_600_000),
    demoConversation('demo-conv-structure', web.id, t('demo.conversationStructure'), 'pi', now - 7_200_000),
    demoConversation('demo-conv-auth', gateway.id, t('demo.conversationAuth'), 'codex', now - 86_400_000),
  ];
  return {
    workspaces: [web, gateway, design],
    conversations,
    activeWorkspaceId: web.id,
    activeConversationId: hero.id,
    timeline: historyTimeline(web.id, hero.id, now - 600_000),
    chatDrafts: {},
    thinkingConversations: {},
    turnIds: {},
    submissionStatusByConversation: {},
    gitDiffByConversation: { [hero.id]: diffState(HERO_DIFF, now) },
    terminalById: withTerminal({ terminalById: {} }, hero, web, [
      terminalLines('input', '$ pnpm test', now),
      terminalLines('stdout', ' ✓ src/site/Hero.test.tsx (6 tests)', now),
      terminalLines('stdout', ' Test Files  9 passed (9)\n      Tests  38 passed (38)', now),
    ], now),
    contextUsageByConversation: {
      [hero.id]: { usedTokens: 48_200, contextWindow: 400_000, inputTokens: 41_000, outputTokens: 7_200, cachedInputTokens: 30_500, cacheWriteTokens: 0, model: 'gpt-5.5', updatedAt: now },
    },
    workbenchTab: 'git-diff',
    modal: null,
  };
}

export function openWorkspaceModal(state: DemoState, path: string): DemoState {
  return { ...state, modal: { name: '', path } };
}

export function updateWorkspaceModal(state: DemoState, patch: Partial<DemoModalState>): DemoState {
  return state.modal ? { ...state, modal: { ...state.modal, ...patch } } : state;
}

export function createDemoWorkspace(state: DemoState, now: number): DemoState {
  const workspace = demoWorkspace(DEMO_NEW_WORKSPACE_ID, DEMO_NEW_WORKSPACE_NAME, now, state.workspaces.length);
  return {
    ...state,
    workspaces: [...state.workspaces.filter((item) => item.id !== workspace.id), workspace],
    activeWorkspaceId: workspace.id,
    activeConversationId: '',
    modal: null,
  };
}

export function createDemoConversation(state: DemoState, now: number): DemoState {
  const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
  if (!workspace) return state;
  const conversation = { ...demoConversation(DEMO_NEW_CONVERSATION_ID, workspace.id, t('chat.newConversation'), 'codex', now), lastCompletedAt: undefined };
  return {
    ...state,
    conversations: [conversation, ...state.conversations.filter((item) => item.id !== conversation.id)],
    activeConversationId: conversation.id,
    terminalById: withTerminal(state, conversation, workspace, [], now),
  };
}

export function setDemoDraft(state: DemoState, conversationId: string, draft: string): DemoState {
  return { ...state, chatDrafts: { ...state.chatDrafts, [conversationId]: draft } };
}

/** Replaces entries by id so streamed blocks grow in place, like live deltas. */
export function upsertDemoEntries(state: DemoState, entries: Array<TimelineEntry | null>): DemoState {
  let timeline = state.timeline;
  for (const entry of entries) {
    if (!entry) continue;
    const index = timeline.findIndex((item) => item.id === entry.id);
    timeline = index < 0 ? [...timeline, entry] : timeline.map((item, position) => position === index ? entry : item);
  }
  return { ...state, timeline };
}

export function setDemoRun(state: DemoState, conversationId: string, run: { turnId?: string; submission?: 'sending' | 'running' }): DemoState {
  const { [conversationId]: _turn, ...turnIds } = state.turnIds;
  return {
    ...state,
    thinkingConversations: { ...state.thinkingConversations, [conversationId]: run.submission === 'running' },
    turnIds: run.turnId ? { ...turnIds, [conversationId]: run.turnId } : turnIds,
    submissionStatusByConversation: { ...state.submissionStatusByConversation, [conversationId]: run.submission },
  };
}

export function appendDemoTerminal(state: DemoState, conversationId: string, lines: TerminalOutputEntry[]): DemoState {
  const terminalId = terminalIdForConversation(conversationId, DEMO_TERMINAL_TAB_ID);
  const terminal = state.terminalById[terminalId];
  if (!terminal) return state;
  return { ...state, terminalById: { ...state.terminalById, [terminalId]: { ...terminal, output: [...terminal.output, ...lines] } } };
}

export function setDemoDiff(state: DemoState, conversationId: string, diff: GitDiffState): DemoState {
  return { ...state, gitDiffByConversation: { ...state.gitDiffByConversation, [conversationId]: diff } };
}

export function finishDemoTurn(state: DemoState, conversationId: string, title: string, usage: ConversationContextUsage): DemoState {
  const settled = setDemoRun(state, conversationId, {});
  return {
    ...settled,
    conversations: settled.conversations.map((item) => item.id === conversationId
      ? { ...item, title, lastCompletedAt: usage.updatedAt, lastReadAt: usage.updatedAt, updatedAt: usage.updatedAt }
      : item),
    contextUsageByConversation: { ...settled.contextUsageByConversation, [conversationId]: usage },
  };
}
