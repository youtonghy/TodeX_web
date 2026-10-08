/** One-time migration of the candidate messages older builds kept in the
 * browser (`todex.queued-follow-ups.v1`). The backend queue is the only store
 * now; this file only reads the legacy data and hands it over. */

/** Storage key of the legacy candidate queue. */
export const LEGACY_QUEUED_FOLLOW_UPS_KEY = 'todex.queued-follow-ups.v1';

type LegacyItem = { id: string; text: string; attachments: unknown[]; skills: unknown[] };

/** Storage shape of `todex.queued-follow-ups.v1`. Version 1 stored the
 * conversation → candidates map alone and is still read (as unpaused). */
type StoredQueuedFollowUps<T> = { version: 2; queues: Record<string, T[]>; paused: string[] };

/** What is left of the legacy data, in the version 2 shape. */
export function serializeQueuedFollowUps<T>(queues: Record<string, T[]>, paused: Iterable<string>): StoredQueuedFollowUps<T> {
  // A pause only matters while candidates wait behind it.
  return { version: 2, queues, paused: [...new Set(paused)].filter((id) => (queues[id]?.length ?? 0) > 0) };
}

export function restoreQueuedFollowUps<T extends LegacyItem>(value: unknown): {
  queues: Record<string, T[]>;
  paused: string[];
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { queues: {}, paused: [] };
  const stored = value as Partial<StoredQueuedFollowUps<unknown>>;
  const versioned = stored.version === 2;
  const queues = restoreQueues<T>(versioned ? stored.queues : value);
  const paused = versioned && Array.isArray(stored.paused)
    ? [...new Set(stored.paused.filter((id): id is string => typeof id === 'string' && id in queues))] : [];
  return { queues, paused };
}

function restoreQueues<T extends LegacyItem>(value: unknown): Record<string, T[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([id, items]) => {
    if (!Array.isArray(items)) return [];
    const valid = items.filter((item): item is T => item && typeof item === 'object'
      && typeof item.id === 'string' && typeof item.text === 'string'
      && Array.isArray(item.attachments) && Array.isArray(item.skills)).slice(0, 32);
    return valid.length ? [[id, valid]] : [];
  }));
}

/** Where a conversation with legacy candidates stands right now:
 * - `wait`: not decidable yet (other backend, providers not loaded, no v2 id,
 *   or the backend lacks the queue) — keep the local copy;
 * - `gone` / `readOnly`: the candidates can never be sent — discard them;
 * - `ready`: the backend takes them; `control` says whether it can also take
 *   the first one paused (`backendQueueControl`). */
export type LegacyConversationState = 'wait' | 'gone' | 'readOnly' | { control: boolean };
/** `added` and `discard` finish an item; `transient` keeps it for the next connection. */
export type LegacyAddResult = 'added' | 'transient' | 'discard';

export type LegacyMigrationHost<T> = {
  state: (conversationId: string) => LegacyConversationState;
  /** Adds the item to the backend queue under its original id (idempotent). */
  add: (conversationId: string, item: T, paused: boolean) => Promise<LegacyAddResult>;
  /** Finished items leave the local copy right away. */
  settle: (conversationId: string, remaining: T[]) => void;
  /** Items dropped for good, to tell the user what was discarded. */
  discarded: (conversationId: string, items: T[]) => void;
};

/** Hands each conversation's legacy candidates to the backend queue in order.
 * A paused conversation keeps its pause: its items go in paused (so a retry
 * after a partial run cannot start one); without `backendQueueControl` it
 * stays local, since an unpaused add could start it. Returns the data still to migrate. */
export async function migrateLegacyFollowUps<T extends LegacyItem>(
  legacy: { queues: Record<string, T[]>; paused: string[] },
  host: LegacyMigrationHost<T>,
): Promise<{ queues: Record<string, T[]>; paused: string[] }> {
  const queues = { ...legacy.queues };
  for (const [id, items] of Object.entries(legacy.queues)) {
    const state = host.state(id);
    if (state === 'wait') continue;
    if (state === 'gone' || state === 'readOnly') {
      host.discarded(id, items);
      delete queues[id];
      host.settle(id, []);
      continue;
    }
    const wasPaused = legacy.paused.includes(id);
    if (wasPaused && !state.control) continue;
    let remaining = items;
    while (remaining.length) {
      const result = await host.add(id, remaining[0], wasPaused);
      if (result === 'transient') break;
      if (result === 'discard') { host.discarded(id, remaining); remaining = []; host.settle(id, remaining); break; }
      remaining = remaining.slice(1);
      host.settle(id, remaining);
    }
    if (remaining.length) queues[id] = remaining; else delete queues[id];
  }
  return { queues, paused: legacy.paused.filter((id) => id in queues) };
}
