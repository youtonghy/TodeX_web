import type { ConversationRuntime } from '@todex/protocol/conversationRuntime';
import { createConversationStores } from '../../../src/renderer/session/conversationStore';
import type { TimelineEntry } from '../../../src/renderer/session/helpers';

/** A fake session with the stores the real one exposes, filled from its
 * plain `timeline` and `conversationRuntimeById`. */
export function withStores<Session extends object>(session: Session): Session {
  const plain = session as { timeline?: unknown[]; conversationRuntimeById?: Record<string, unknown> };
  const stores = createConversationStores();
  stores.timeline.set((plain.timeline ?? []) as TimelineEntry[]);
  stores.runtime.set((plain.conversationRuntimeById ?? {}) as Record<string, ConversationRuntime>);
  return Object.assign(session, { stores });
}
