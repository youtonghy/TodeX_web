import type { TodeXSession } from '../session/useTodeXSession';
import { defaultConnectionHealth } from '../session/helpers';
import type { CodexModelCatalogItem } from '@todex/protocol/todex';
import { DEMO_PROVIDERS, DEMO_SETTINGS, demoBackend } from './demoData';
import type { DemoState } from './demoState';

// The demo is watched, not operated: the iframe ignores pointer input, so
// every command is an inert stub. Module-level constants keep their identity
// stable across renders, which the real panels rely on for effect deps.
const noop = () => {};
/** Commands that report whether they were sent; the demo never sends. */
const rejected = () => false;
const resolved = async () => {};
const resolvedFalse = async () => false;
const noEntries = async () => ({ entries: [] });
const noCatalog = () => undefined;

const modelCatalog: CodexModelCatalogItem[] = [{
  id: 'gpt-5.5', model: 'gpt-5.5', displayName: 'GPT-5.5', description: '', hidden: false, isDefault: true,
  supportedReasoningEfforts: [{ reasoningEffort: 'low', description: '' }, { reasoningEffort: 'medium', description: '' }, { reasoningEffort: 'high', description: '' }],
  defaultReasoningEffort: 'high', serviceTiers: [],
}];

const connectionHealth = { ...defaultConnectionHealth, status: 'online' as const, latencyMs: 18, lastCheckedAt: 0 };
const providerModels = Object.fromEntries(DEMO_PROVIDERS.map((provider) => [provider.id, provider.models]));

/** Projects the animated demo state onto the session surface the real
 * sidebar, chat and workbench panels read. */
export function buildDemoSession(state: DemoState, backend: ReturnType<typeof demoBackend>): TodeXSession {
  const activeWorkspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId) ?? null;
  const activeConversation = state.conversations.find((item) => item.id === state.activeConversationId) ?? null;
  const session = {
    hydrated: true,
    directorySyncStatus: 'ready',
    settings: DEMO_SETTINGS,
    backendConnections: [backend],
    activeBackendConnectionId: backend.id,
    workspaces: state.workspaces,
    conversations: state.conversations,
    activeWorkspaceId: state.activeWorkspaceId,
    activeConversationId: state.activeConversationId,
    activeWorkspace,
    activeConversation,
    connectionState: 'open',
    connectionHealth,
    modelCatalog,
    lastError: '',
    timeline: state.timeline,
    chatDrafts: state.chatDrafts,
    queuedChatDrafts: {},
    queuePausedByConversation: {},
    controlStatusByConversation: {},
    composerAttachments: {},
    composerSelections: {},
    selectedSkills: {},
    turnIds: state.turnIds,
    thinkingConversations: state.thinkingConversations,
    gitDiffByConversation: state.gitDiffByConversation,
    terminalById: state.terminalById,
    v2Providers: DEMO_PROVIDERS,
    capabilityCatalogs: {},
    providerModels,
    providerImageInput: {},
    pendingPluginDrafts: {},
    stoppingProviderRuntimes: {},
    contextUsageByConversation: state.contextUsageByConversation,
    compactionByConversation: {},
    subagentsByConversation: {},
    conversationRuntimeById: {},
    recoveringConversations: {},
    earlierHistory: {},
    submissionStatusByConversation: state.submissionStatusByConversation,
    usageRecords: [],
    pendingRequests: [],
    getProviderCommandCatalog: noCatalog,
    fetchWorkspaceEntries: noEntries,
    hydrateProcessGroup: resolvedFalse,
    loadEarlierHistory: resolvedFalse,
    recoverConversation: resolved,
    reconcilePendingSubmission: resolved,
    controlConversation: resolvedFalse,
    resumeQueuedFollowUps: resolved,
    stopProviderRuntime: resolved,
    applyConversationPermissionMode: resolvedFalse,
    applyConversationWorkMode: resolvedFalse,
    requestGitDiff: resolvedFalse,
    refreshProviderCommands: noop,
    removeQueuedFollowUp: noop,
    handlePluginDraft: noop,
    applyConversationModelSelection: noop,
    toggleFastServiceTier: rejected,
    toggleCatalogSkill: noop,
    switchConversationAgent: noop,
    sendApprovalResponse: rejected,
    sendSlashCommand: noop,
    submitChat: noop,
    stopThinking: noop,
    setConversationChatDraft: noop,
    setConversationAttachments: noop,
    setConversationComposerSelection: noop,
    setConversationSelectedSkills: noop,
    openPanel: noop,
    selectWorkspace: noop,
    selectConversation: noop,
    renameWorkspace: noop,
    removeWorkspace: noop,
    updateWorkspace: noop,
    renameConversation: noop,
    forkConversation: () => null,
    removeConversation: noop,
    setConversationLabelColor: noop,
    requestTerminalStatus: rejected,
    startTerminalSession: rejected,
    stopTerminalSession: rejected,
    sendTerminalInput: rejected,
  } satisfies Partial<TodeXSession>;
  return session as unknown as TodeXSession;
}
