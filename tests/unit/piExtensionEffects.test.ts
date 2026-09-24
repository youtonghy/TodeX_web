import { describe, expect, it } from 'vitest';
import { createConversationRuntime, applyConversationRuntimeEvents } from '@todex/protocol/conversationRuntime';
import type { ConversationEvent, ConversationReplay } from '@todex/protocol/v2';
import { ConversationRecovery } from '../../src/renderer/session/conversationRecovery';
import { PiExtensionEffects, canApplyPluginDraft } from '../../src/renderer/session/piExtensionEffects';

const event = (sequence: number, method: string, extra = {}): ConversationEvent => ({
  schemaVersion: 1, eventId: `e${sequence}`, conversationId: 'c', sequence, time: '2026-09-11T00:00:00Z',
  type: 'extension.ui', payload: { provider: 'pi', scope: 'session', runtimeId: 'r', method, ...extra },
});
const page = (events: ConversationEvent[]): ConversationReplay => ({ conversationId: 'c', fromSequence: 0,
  nextSequence: events.at(-1)?.sequence ?? 0, hasMore: false, events });

describe('Pi one-shot effects', () => {
  it('rebuilds replay history without showing toasts or changing the draft', () => {
    const effects = new PiExtensionEffects();
    const events = [event(1, 'notify', { message: 'history' }), event(2, 'set_editor_text', { text: 'old' })];
    const { state } = applyConversationRuntimeEvents(createConversationRuntime('c', 'w'), events);
    expect(state.extensionUi.notices).toHaveLength(1);
    expect(events.map(item => effects.consume(item, state))).toEqual([undefined, undefined]);
  });
  it('consumes live delivery once even if duplicate frames arrive later', () => {
    const effects = new PiExtensionEffects(); const notice = event(1, 'notify', { message: 'new' });
    const { state } = applyConversationRuntimeEvents(createConversationRuntime('c', 'w'), [notice]);
    effects.markLive(notice);
    expect(effects.consume(notice, state)).toMatchObject({ kind: 'notice', notice: { message: 'new' } });
    effects.markLive(notice);
    expect(effects.consume(notice, state)).toBeUndefined();
  });
  it('preserves live delivery identity while a journal gap is filled by HTTP', async () => {
    const effects = new PiExtensionEffects(); const seen: string[] = [];
    // The gap sits inside an already loaded runtime; history below the first
    // live event of an unopened conversation is unloaded, not a gap.
    const loaded = event(1, 'notify', { message: 'loaded' });
    const old = event(2, 'notify', { message: 'history' }); const live = event(3, 'notify', { message: 'new' });
    const recovery = new ConversationRecovery(async () => page([old, live]), (state, applied) => {
      for (const item of applied) {
        const effect = effects.consume(item, state);
        if (effect?.kind === 'notice') seen.push(effect.notice.message);
      }
    }, error => { throw new Error(error); });
    recovery.receive('c', 'w', [loaded]);
    effects.markLive(live);
    recovery.receive('c', 'w', [live]);
    await recovery.recover('c', 'w');
    expect(seen).toEqual(['new']);
    expect(recovery.get('c')?.extensionUi.notices).toHaveLength(3);
  });
  it('ignores drafts and notifications from a stopped or replaced instance', () => {
    const effects = new PiExtensionEffects(); const draft = event(1, 'set_editor_text', { text: 'suggestion' });
    const { state } = applyConversationRuntimeEvents(createConversationRuntime('c', 'w'), [draft]);
    effects.markLive(draft);
    expect(effects.consume(draft, { ...state, providerRuntime: { provider: 'pi', runtimeId: 'r', status: 'stopped' } })).toBeUndefined();
    const late = event(2, 'notify', { message: 'late' }); effects.markLive(late);
    expect(effects.consume(late, { ...state, extensionUi: { ...state.extensionUi, runtimeId: 'replacement' } })).toBeUndefined();
  });
  it('only automatically fills an entirely empty draft, preserving whitespace and newer user edits', () => {
    expect(canApplyPluginDraft('')).toBe(true);
    expect(canApplyPluginDraft(' ')).toBe(false);
    expect(canApplyPluginDraft('my draft')).toBe(false);
    const effects = new PiExtensionEffects(); const first = event(1, 'set_editor_text', { text: 'first' });
    const second = event(2, 'set_editor_text', { text: 'second' });
    const { state } = applyConversationRuntimeEvents(createConversationRuntime('c', 'w'), [first, second]);
    effects.markLive(first); effects.markLive(second);
    expect(effects.consume(first, state)).toBeUndefined();
    expect(effects.consume(second, state)).toMatchObject({ kind: 'editor', request: { text: 'second' } });
  });
});
