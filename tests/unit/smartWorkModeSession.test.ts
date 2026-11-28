import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '../../src/renderer/components/ui/toast-store';
import { useTodeXSession, type TodeXSession } from '../../src/renderer/session/useTodeXSession';
import { loadJson } from '../../src/renderer/lib/storage';
import { defaultSettings, SETTINGS_STORAGE_KEY, WORKSPACES_STORAGE_KEY, CONVERSATIONS_STORAGE_KEY,
  ACTIVE_SELECTION_STORAGE_KEY } from '../../src/renderer/session/helpers';

vi.mock('../../src/renderer/lib/storage', () => ({
  loadJson: vi.fn(), loadSecret: vi.fn().mockResolvedValue(''),
  saveJson: vi.fn().mockResolvedValue(undefined), saveSecret: vi.fn().mockResolvedValue(undefined),
}));
// Loopback profiles without a pinned key: plaintext, policy check skipped.
vi.mock('@todex/protocol/secureTransport', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/secureTransport')>(), verifyTransportPolicy: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@todex/protocol/connectionProbe', async importOriginal => ({
  ...await importOriginal<typeof import('@todex/protocol/connectionProbe')>(),
  probeBackendConnection: vi.fn(async () => ({ ok: true, error: null, providers: [provider], version: null })),
}));

const provider = { id: 'claude-code', displayName: 'Claude Code', available: true, profiles: [], models: [], capabilities: {
  nativeResume: true, cancel: true, permissions: true, toolEvents: true, nativeSkills: true, nativeMcp: false,
  managedMcp: false, modelSelection: true, claudeRegionPreflight: true, controlActions: ['cancel'],
  permissionConfig: { modes: ['ask', 'auto'], defaultMode: 'ask', supportsPlan: true },
} };
const models = [
  { id: 'claude-fable-5-2', displayName: 'Fable 5.2', description: '', isDefault: false, supportedReasoningEfforts: ['low', 'medium', 'high'] },
  { id: 'claude-opus-5-5', displayName: 'Opus 5.5', description: '', isDefault: true, supportedReasoningEfforts: ['low', 'medium', 'high'] },
];
const skill = (name: string) => ({ resourceId: `skill-${name}`, name, description: '', scope: 'user', source: 'shared-user', active: true, valid: true });
const workspace = { id: 'w', name: 'Workspace', path: '/workspace', tenantId: 'local', model: '',
  approvalPolicy: 'on-request', sandboxMode: 'workspace-write', createdAt: 1, updatedAt: 1 };
const conversation = { id: 'c', workspaceId: 'w', title: 'Smart test', sessionId: 'v2_c', threadId: '', preview: 'earlier',
  provider: 'claude-code', v2ConversationId: 'c', permissionMode: 'ask' as const, mode: 'implement' as const, createdAt: 1, updatedAt: 1 };

let storedConversation: Record<string, unknown> = conversation;
let journal: object[] = [];
let planSkill = 'planner';

function event(sequence: number, type: string, payload: Record<string, unknown>) {
  return { schemaVersion: 2, eventId: `e${sequence}`, conversationId: 'c', sequence, time: '2026-11-14T00:00:00Z', type, payload };
}
function reentered(sequence: number, turnId: string) {
  return event(sequence, 'provider.event', { turnId, provider: 'claude-code', providerMethod: 'plan_reentered', metadata: {
    workMode: 'plan', model: 'claude-fable-5-2', reasoningEffort: 'medium' } });
}
/** `applied: 'next_turn'`: the plan turn only approves the plan and the
 * execution runs with the next message. */
function handoff(sequence: number, turnId: string, applied: 'now' | 'next_turn' = 'now') {
  return event(sequence, 'provider.event', { turnId, provider: 'claude-code', providerMethod: 'plan_handoff', metadata: {
    workMode: 'implement', model: 'claude-opus-5-5', reasoningEffort: 'medium', permissionMode: 'auto', applied, reason: 'plan_approved' } });
}
const record = () => session.conversations.find((item) => item.id === 'c');

class TestSocket {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 0;
  onopen: (() => unknown) | null = null;
  onmessage: ((event: { data: string }) => unknown) | null = null;
  onerror: (() => unknown) | null = null;
  onclose: ((event: { code: number; reason: string }) => unknown) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.onclose?.({ code: 1000, reason: '' }); });
  constructor(public url: string) { TestSocket.instances.push(this); }
  open() { this.readyState = 1; void this.onopen?.(); }
  reply(frame: object) { this.onmessage?.({ data: JSON.stringify(frame) }); }
}
let root: Root;
let container: HTMLDivElement;
let session: TodeXSession;
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); });
beforeEach(() => {
  vi.useFakeTimers();
  delete (provider.capabilities.permissionConfig as { supportsReplan?: boolean }).supportsReplan;
  storedConversation = conversation;
  journal = [];
  planSkill = 'planner';
  TestSocket.instances = [];
  vi.stubGlobal('WebSocket', TestSocket);
  for (const kind of ['warning', 'danger', 'info', 'success'] as const) vi.spyOn(toast, kind).mockReturnValue(`toast-${kind}`);
  vi.mocked(loadJson).mockImplementation(async (key, fallback) => {
    if (key.endsWith('.smartWorkMode.v1')) {
      return { plan: { model: 'claude-fable-5-2', reasoningEffort: 'medium', skill: planSkill },
        execute: { model: 'claude-opus-5-5', reasoningEffort: 'high' } } as never;
    }
    return ({
      [SETTINGS_STORAGE_KEY]: { ...defaultSettings, serverUrl: 'http://127.0.0.3' },
      [WORKSPACES_STORAGE_KEY]: [workspace], [CONVERSATIONS_STORAGE_KEY]: [storedConversation],
      [ACTIVE_SELECTION_STORAGE_KEY]: { workspaceId: 'w', conversationId: 'c' },
    }[key] ?? fallback) as never;
  });
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    let result: unknown;
    if (url.pathname.endsWith('/events')) {
      const after = Number(url.searchParams.get('afterSequence') ?? 0);
      const events = journal.filter((item) => (item as { sequence: number }).sequence > after);
      result = { conversationId: 'c', events, nextSequence: journal.length + 1, hasMore: false };
    } else if (url.pathname === '/v2/providers') result = { providers: [provider] };
    else if (url.pathname === '/v2/conversations') result = { conversations: [{ schemaVersion: 2, id: 'c', provider: 'claude-code',
      ownerId: 'owner', workspace: '/workspace', workspaceId: 'w', title: 'Smart test', status: 'idle',
      lastSequence: journal.length, createdAt: '2026-11-14T00:00:00Z', updatedAt: '2026-11-14T00:00:00Z' }] };
    else if (url.pathname === '/v2/workspaces') result = { workspaces: [workspace] };
    else if (url.pathname === '/v2/providers/models') result = { provider: 'claude-code', models };
    else if (url.pathname === '/v2/catalog/skills') result = { provider: 'claude-code', skills: [skill('planner'), skill('reviewer')] };
    else if (url.pathname === '/v2/catalog/mcp') result = { provider: 'claude-code', servers: [] };
    else if (url.pathname === '/health' || url.pathname === '/v2/version') result = { name: 'test', version: '1' };
    else return new Promise(() => {});
    return new Response(JSON.stringify(result), { status: 200 });
  }));
});
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function mount() {
  function Harness() { session = useTodeXSession(() => {}); return null; }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(createElement(Harness)); });
  await act(async () => { session.connect(); });
  const socket = TestSocket.instances.at(-1)!;
  await act(async () => { socket.open(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(session.connectionState).toBe('open');
  expect(session.smartWorkModeHydrated).toBe(true);
  return socket;
}
function framesOf(socket: TestSocket, type: string) {
  return socket.send.mock.calls.map(([data]) => JSON.parse(String(data))).filter((frame) => frame.type === type);
}
async function deliver(socket: TestSocket, ...events: object[]) {
  await act(async () => {
    for (const item of events) socket.reply({ type: 'conversation.event', delivery: 'live', payload: item });
    await vi.advanceTimersByTimeAsync(50);
  });
}
let nextSequence = 1;
/** Sends `text` and runs its turn to completion; `during` lands inside the turn. */
async function sendTurn(socket: TestSocket, text: string, during: (sequence: number, turnId: string) => object[] = () => []) {
  await act(async () => { session.setConversationChatDraft('c', text); });
  await act(async () => { session.submitChat('c'); await vi.advanceTimersByTimeAsync(10); });
  const prompt = framesOf(socket, 'conversation.prompt').at(-1)!;
  const turnId = `t-${prompt.payload.clientRequestId}`;
  await act(async () => {
    socket.reply({ id: prompt.id, type: 'server.result', payload: { conversationId: 'c', turnId } });
    await vi.advanceTimersByTimeAsync(10);
  });
  const start = nextSequence;
  const inner = during(start + 1, turnId);
  nextSequence = start + inner.length + 2;
  await deliver(socket,
    event(start, 'turn.started', { turnId, clientRequestId: prompt.payload.clientRequestId }),
    ...inner,
    event(nextSequence - 1, 'turn.completed', { turnId }));
  return prompt.payload;
}
beforeEach(() => { nextSequence = 1; });

it('a smart plan prompt plans with the plan stage, attaches the plan skill and says what runs after the plan', async () => {
  const socket = await mount();
  let selected = false;
  await act(async () => { selected = await session.applyConversationWorkMode('c', 'smart'); });
  expect(selected).toBe(true);
  expect(session.conversations.find((item) => item.id === 'c')).toMatchObject({ mode: 'smart', smartPhase: 'plan' });
  const payload = await sendTurn(socket, 'plan the refactor');
  expect(payload).toMatchObject({
    workMode: 'plan', model: 'claude-fable-5-2', reasoningEffort: 'medium', permissionMode: 'ask',
    afterPlan: { model: 'claude-opus-5-5', reasoningEffort: 'high', permissionMode: 'auto' },
    skills: [{ resourceId: 'skill-planner', name: 'planner' }],
  });
  // Automatic smart choices are not remembered as the agent's run modes.
  let created: ReturnType<TodeXSession['createConversation']> = null;
  await act(async () => { created = session.createConversation('w', { fresh: true }); });
  expect(created?.mode).toBe('implement');
});

it('a plan skill the catalog lacks is left out with one notice', async () => {
  planSkill = 'missing-skill';
  const socket = await mount();
  await act(async () => { await session.applyConversationWorkMode('c', 'smart'); });
  const first = await sendTurn(socket, 'plan one');
  const second = await sendTurn(socket, 'plan two');
  for (const payload of [first, second]) {
    expect(payload.workMode).toBe('plan');
    expect(payload.skills).toBeUndefined();
  }
  expect(vi.mocked(toast.warning)).toHaveBeenCalledTimes(1);
});

it('Smart is one-shot: a turn that executes the approved plan sends the conversation back to Implement', async () => {
  const socket = await mount();
  await act(async () => { await session.applyConversationWorkMode('c', 'smart'); });
  await sendTurn(socket, 'plan it', (sequence, turnId) => [handoff(sequence, turnId)]);
  expect(record()).toMatchObject({ mode: 'implement' });
  expect(record()?.smartPhase).toBeUndefined();

  const plain = await sendTurn(socket, 'one more thing');
  expect(plain).toMatchObject({ workMode: 'implement', permissionMode: 'ask' });
  expect(plain.afterPlan).toBeUndefined();

  // Choosing Smart again starts over with a plan.
  await act(async () => { await session.applyConversationWorkMode('c', 'smart'); });
  expect(record()).toMatchObject({ mode: 'smart', smartPhase: 'plan' });
  const plan = await sendTurn(socket, 'next feature');
  expect(plan).toMatchObject({ workMode: 'plan', model: 'claude-fable-5-2', afterPlan: { permissionMode: 'auto' } });
});

it('a handoff applied from the next turn keeps Smart until that execution turn completes', async () => {
  const socket = await mount();
  await act(async () => { await session.applyConversationWorkMode('c', 'smart'); });
  await sendTurn(socket, 'plan it', (sequence, turnId) => [handoff(sequence, turnId, 'next_turn')]);
  expect(record()).toMatchObject({ mode: 'smart', smartPhase: 'execute' });

  const execute = await sendTurn(socket, 'go ahead');
  expect(execute).toMatchObject({ workMode: 'implement', model: 'claude-opus-5-5', reasoningEffort: 'high', permissionMode: 'auto' });
  expect(execute.afterPlan).toBeUndefined();
  expect(execute.skills).toBeUndefined();
  // A backend without supportsReplan would reject the field.
  expect(execute.replan).toBeUndefined();
  expect(record()).toMatchObject({ mode: 'implement' });
});

it('an execution turn that does not complete keeps Smart executing', async () => {
  const socket = await mount();
  await act(async () => { await session.applyConversationWorkMode('c', 'smart'); });
  await act(async () => { session.setConversationChatDraft('c', 'plan it'); });
  await act(async () => { session.submitChat('c'); await vi.advanceTimersByTimeAsync(10); });
  const prompt = framesOf(socket, 'conversation.prompt').at(-1)!;
  await act(async () => {
    socket.reply({ id: prompt.id, type: 'server.result', payload: { conversationId: 'c', turnId: 't-x' } });
    await vi.advanceTimersByTimeAsync(10);
  });
  await deliver(socket,
    event(1, 'turn.started', { turnId: 't-x', clientRequestId: prompt.payload.clientRequestId }),
    handoff(2, 't-x'),
    event(3, 'turn.cancelled', { turnId: 't-x' }));
  expect(record()).toMatchObject({ mode: 'smart', smartPhase: 'execute' });
});

it('a replayed handoff older than the last manual Smart choice does not move the phase', async () => {
  journal = [
    event(1, 'turn.started', { turnId: 't1' }),
    handoff(2, 't1'),
    event(3, 'turn.completed', { turnId: 't1' }),
  ];
  // Smart was chosen again at sequence 3, after the handoff.
  storedConversation = { ...conversation, mode: 'smart', smartPhase: 'plan', smartPhaseSequence: 3 };
  await mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(session.conversationRuntimeById.c?.appliedSequence).toBe(3);
  expect(session.conversations.find((item) => item.id === 'c')).toMatchObject({ mode: 'smart', smartPhase: 'plan', smartPhaseSequence: 3 });
});

it('a replayed handoff newer than the phase moves it to execution', async () => {
  journal = [
    event(1, 'turn.started', { turnId: 't1' }),
    handoff(2, 't1', 'next_turn'),
    event(3, 'turn.completed', { turnId: 't1' }),
  ];
  // Smart was chosen before the plan turn; the app was closed during it.
  storedConversation = { ...conversation, mode: 'smart', smartPhase: 'plan', smartPhaseSequence: 0 };
  await mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(session.conversationRuntimeById.c?.appliedSequence).toBe(3);
  expect(record()).toMatchObject({ mode: 'smart', smartPhase: 'execute', smartPhaseSequence: 2 });
});

it('a replayed completed execution turn sends the conversation back to Implement', async () => {
  journal = [
    event(1, 'turn.started', { turnId: 't1' }),
    handoff(2, 't1'),
    event(3, 'turn.completed', { turnId: 't1' }),
  ];
  // Smart was chosen before the plan turn; the app was closed during it.
  storedConversation = { ...conversation, mode: 'smart', smartPhase: 'plan', smartPhaseSequence: 0 };
  await mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(session.conversationRuntimeById.c?.appliedSequence).toBe(3);
  expect(record()).toMatchObject({ mode: 'implement' });
});

it('an execute prompt says what to plan with when the backend supports replan', async () => {
  Object.assign(provider.capabilities.permissionConfig, { supportsReplan: true });
  const socket = await mount();
  await act(async () => { await session.applyConversationWorkMode('c', 'smart'); });
  await sendTurn(socket, 'plan it', (sequence, turnId) => [handoff(sequence, turnId, 'next_turn')]);
  const execute = await sendTurn(socket, 'one more thing');
  expect(execute).toMatchObject({ workMode: 'implement', model: 'claude-opus-5-5', permissionMode: 'auto',
    replan: { model: 'claude-fable-5-2', reasoningEffort: 'medium' } });
});

it('Claude re-entering Plan mode moves an executing conversation back to planning', async () => {
  Object.assign(provider.capabilities.permissionConfig, { supportsReplan: true });
  const socket = await mount();
  await act(async () => { await session.applyConversationWorkMode('c', 'smart'); });
  await sendTurn(socket, 'plan it', (sequence, turnId) => [handoff(sequence, turnId, 'next_turn')]);
  await sendTurn(socket, 'a bigger task', (sequence, turnId) => [reentered(sequence, turnId)]);
  expect(session.conversations.find((item) => item.id === 'c')?.smartPhase).toBe('plan');
  const plan = await sendTurn(socket, 'go on planning');
  expect(plan).toMatchObject({ workMode: 'plan', model: 'claude-fable-5-2', afterPlan: { model: 'claude-opus-5-5', permissionMode: 'auto' } });
  expect(plan.replan).toBeUndefined();

  // Approving that plan executes within the same turn, which ends the smart run.
  await sendTurn(socket, 'a third task', (sequence, turnId) => [reentered(sequence, turnId), handoff(sequence + 1, turnId)]);
  expect(record()).toMatchObject({ mode: 'implement' });
});

it('attaching another skill while executing still executes, and ends the smart run', async () => {
  const socket = await mount();
  await act(async () => { await session.applyConversationWorkMode('c', 'smart'); });
  await sendTurn(socket, 'plan it', (sequence, turnId) => [handoff(sequence, turnId, 'next_turn')]);
  await act(async () => {
    session.setConversationSelectedSkills('c', [{ name: 'reviewer', path: '', displayName: 'reviewer', resourceId: 'skill-reviewer' }]);
  });
  const other = await sendTurn(socket, 'review this');
  expect(other).toMatchObject({ workMode: 'implement', permissionMode: 'auto' });
  expect(record()).toMatchObject({ mode: 'implement' });
});

it('attaching the plan skill while executing plans that message and the ones after it', async () => {
  const socket = await mount();
  await act(async () => { await session.applyConversationWorkMode('c', 'smart'); });
  await sendTurn(socket, 'plan it', (sequence, turnId) => [handoff(sequence, turnId, 'next_turn')]);
  await act(async () => {
    session.setConversationSelectedSkills('c', [{ name: 'planner', path: '', displayName: 'planner', resourceId: 'skill-planner' }]);
  });
  const plan = await sendTurn(socket, 'a complex new task');
  expect(plan).toMatchObject({ workMode: 'plan', model: 'claude-fable-5-2', afterPlan: { model: 'claude-opus-5-5' },
    skills: [{ resourceId: 'skill-planner', name: 'planner' }] });
  expect(session.conversations.find((item) => item.id === 'c')?.smartPhase).toBe('plan');
  const next = await sendTurn(socket, 'more detail');
  expect(next.workMode).toBe('plan');
});
