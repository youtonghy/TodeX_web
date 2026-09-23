import { classifyV2ConversationEvent } from '@todex/protocol/mobileParity';
import type { ConversationEvent, ProviderDescriptor, ProviderKind, ProviderModelDescriptor } from '@todex/protocol/v2';
import type { BackendConnectionProfile } from '../session/backendColors';
import {
  defaultSettings,
  terminalIdForConversation,
  type ConversationRecord,
  type GitDiffState,
  type TerminalClientState,
  type TerminalOutputEntry,
  type TimelineEntry,
} from '../session/helpers';
import type { ConnectionSettings, WorkspaceRecord } from '@todex/protocol/todex';
import { t } from '../i18n';

// Everything here is fixture data for the landing-page demo. Ids are fixed so
// the script can address records without reading state back.

export const DEMO_BACKEND_ID = 'demo-backend';
export const DEMO_TERMINAL_TAB_ID = 'terminal-demo';
export const DEMO_DIFF_TAB_ID = 'git-diff-demo';

export const DEMO_SETTINGS: ConnectionSettings = {
  ...defaultSettings,
  defaultWorkspacePath: '~/code',
  defaultModel: 'gpt-5.5',
};

const models: ProviderModelDescriptor[] = [
  { id: 'gpt-5.5', displayName: 'GPT-5.5', description: '', isDefault: true, supportedReasoningEfforts: ['low', 'medium', 'high'], defaultReasoningEffort: 'high', contextWindow: 400_000 },
];

function provider(id: ProviderKind, displayName: string): ProviderDescriptor {
  return {
    id,
    displayName,
    available: true,
    profiles: [],
    models: id === 'codex' ? models : [],
    capabilities: {
      nativeResume: true, cancel: true, permissions: true, toolEvents: true, nativeSkills: true,
      nativeMcp: true, managedMcp: false, modelSelection: true, streaming: true,
      permissionConfig: { modes: ['ask', 'auto', 'full-access'], defaultMode: 'auto', supportsPlan: true },
    },
  };
}

export const DEMO_PROVIDERS: ProviderDescriptor[] = [provider('codex', 'Codex'), provider('claude-code', 'Claude Code'), provider('pi', 'Pi')];

export function demoBackend(now: number): BackendConnectionProfile {
  return {
    id: DEMO_BACKEND_ID, name: t('demo.backendName'), serverUrl: DEMO_SETTINGS.serverUrl, deviceSecret: '',
    tenantId: DEMO_SETTINGS.tenantId, encryptionProtocol: 'x25519', encryptionPublicKey: '', createdAt: now, updatedAt: now,
  };
}

export function demoWorkspace(id: string, name: string, now: number, sortOrder: number): WorkspaceRecord {
  return {
    id, name, path: `~/code/${name}`, backendConnectionId: DEMO_BACKEND_ID, sessionId: `session-${id}`,
    tenantId: DEMO_SETTINGS.tenantId, threadId: '', model: 'gpt-5.5', reasoningEffort: 'high',
    approvalPolicy: 'on-request', sandboxMode: 'workspace-write', createdAt: now, updatedAt: now, sortOrder,
  };
}

export function demoConversation(id: string, workspaceId: string, title: string, providerId: ProviderKind, now: number): ConversationRecord {
  return {
    id, workspaceId, backendConnectionId: DEMO_BACKEND_ID, title, sessionId: `session-${id}`, threadId: '',
    provider: providerId, model: providerId === 'codex' ? 'gpt-5.5' : undefined, reasoningEffort: providerId === 'codex' ? 'high' : null,
    permissionMode: 'auto', mode: 'implement', createdAt: now, updatedAt: now, lastCompletedAt: now, lastReadAt: now,
  };
}

/** Builds timeline entries through the same classifier the live session uses. */
export class DemoEventStream {
  private sequence = 0;

  constructor(private readonly workspaceId: string, private readonly conversationId: string, private readonly startAt: number) {}

  entry(type: string, payload: Record<string, unknown>): TimelineEntry | null {
    this.sequence += 1;
    const event: ConversationEvent = {
      schemaVersion: 1,
      eventId: `${this.conversationId}-event-${this.sequence}`,
      conversationId: this.conversationId,
      sequence: this.sequence,
      time: new Date(this.startAt + this.sequence * 1000).toISOString(),
      type,
      provider: 'codex',
      payload,
    };
    return classifyV2ConversationEvent(event, this.workspaceId);
  }

  userMessage(turnId: string, text: string) {
    return this.entry('message.created', { turnId, role: 'user', content: [{ type: 'text', text }] });
  }

  reasoning(turnId: string, blockId: string, text: string, phase: 'delta' | 'completed') {
    return this.entry('thought.delta', { turnId, thought: text, block: { id: blockId, turnId, category: 'reasoning', phase } });
  }

  tool(turnId: string, blockId: string, item: Record<string, unknown>, phase: 'started' | 'completed') {
    return this.entry(phase === 'started' ? 'tool.started' : 'tool.completed', { turnId, item, block: { id: blockId, turnId, category: 'tool', phase } });
  }

  reply(turnId: string, blockId: string, text: string, phase: 'delta' | 'completed') {
    return this.entry(phase === 'completed' ? 'message.completed' : 'message.delta', { turnId, text, block: { id: blockId, turnId, category: 'assistant_final', phase } });
  }
}

export function commandItem(command: string, output?: string) {
  return output === undefined
    ? { type: 'commandExecution', command, status: 'inProgress' }
    : { type: 'commandExecution', command, status: 'completed', exitCode: 0, aggregatedOutput: output };
}

export function fileChangeItem(paths: string[]) {
  return { type: 'fileChange', status: 'completed', changes: paths.map((path) => ({ path, kind: 'add' })) };
}

export function diffState(diff: string, now: number): GitDiffState {
  return { status: 'ready', diff, sha: 'demo', error: '', updatedAt: now };
}

let terminalLine = 0;
export function terminalLines(kind: TerminalOutputEntry['kind'], text: string, now: number): TerminalOutputEntry {
  terminalLine += 1;
  return { id: `demo-line-${terminalLine}`, kind, text, at: now };
}

export function demoTerminal(conversation: ConversationRecord, workspace: WorkspaceRecord, output: TerminalOutputEntry[], now: number): TerminalClientState {
  return {
    terminalId: terminalIdForConversation(conversation.id, DEMO_TERMINAL_TAB_ID), workspaceId: workspace.id, conversationId: conversation.id,
    tenantId: workspace.tenantId, cwd: workspace.path, shell: 'zsh', rows: 24, cols: 80, status: 'running', output, error: '', pid: 4242, updatedAt: now,
  };
}

export const HERO_DIFF = `diff --git a/src/site/Hero.tsx b/src/site/Hero.tsx
@@ -12,9 +12,11 @@ export function Hero() {
-    <section className="hero py-24">
+    <section className="hero py-16 md:py-20">
       <h1>{title}</h1>
-      <a className="button" href="#downloads">
+      <a className="button button--accent" href="#downloads">
         {cta}
       </a>
+      <p className="hero-note">{note}</p>
     </section>`;

export const WEATHER_DIFF = `diff --git a/src/App.tsx b/src/App.tsx
@@ -1,5 +1,12 @@
-export default function App() {
-  return <main>Hello</main>;
+import { CurrentConditions } from './components/CurrentConditions';
+import { ForecastList } from './components/ForecastList';
+import { useForecast } from './hooks/useForecast';
+
+export default function App() {
+  const forecast = useForecast('Shanghai');
+  return (
+    <main className="dashboard">
+      <CurrentConditions now={forecast.current} />
+      <ForecastList days={forecast.daily.slice(0, 7)} />
+    </main>
+  );
 }
diff --git a/src/hooks/useForecast.ts b/src/hooks/useForecast.ts
new file mode 100644
@@ -0,0 +1,9 @@
+export function useForecast(city: string) {
+  const { data } = useQuery(['forecast', city], () => fetchForecast(city));
+  return data ?? emptyForecast;
+}`;
