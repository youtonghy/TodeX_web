import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_WARM_INTERVAL_MS,
  isConversationWarmRequestId,
  shouldWarmConversation,
} from '../../src/renderer/session/conversationWarm';

describe('conversation warm', () => {
  it('warms a conversation at most once per interval and never while busy', () => {
    const sent = new Map([['c1', 1_000]]);
    expect(shouldWarmConversation('c2', 1_000, sent, false)).toBe(true);
    expect(shouldWarmConversation('c1', 1_000 + CONVERSATION_WARM_INTERVAL_MS - 1, sent, false)).toBe(false);
    expect(shouldWarmConversation('c1', 1_000 + CONVERSATION_WARM_INTERVAL_MS, sent, false)).toBe(true);
    expect(shouldWarmConversation('c2', 1_000, sent, true)).toBe(false);
    expect(shouldWarmConversation('', 1_000, sent, false)).toBe(false);
  });

  it('recognizes warm request ids only', () => {
    expect(isConversationWarmRequestId('warm-abc-123')).toBe(true);
    expect(isConversationWarmRequestId('watchdog-abc-123')).toBe(false);
    expect(isConversationWarmRequestId(undefined)).toBe(false);
  });
});
