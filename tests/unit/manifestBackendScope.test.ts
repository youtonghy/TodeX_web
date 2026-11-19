import { expect, it } from 'vitest';
import type { ConversationManifest } from '@todex/protocol/v2';
import { mergeManifestConversations, type ConversationRecord, type WorkspaceRecord } from '../../src/renderer/session/helpers';

// Two backends each own a workspace at the same path; a manifest list fetched
// from one backend must never touch the other backend's records.
const workspaceA = { id: 'wa', name: 'Repo A', path: '/repo', tenantId: 'local', model: '', approvalPolicy: 'on-request',
  sandboxMode: 'workspace-write', createdAt: 1, updatedAt: 1, backendConnectionId: 'a' } as WorkspaceRecord;
const workspaceB = { ...workspaceA, id: 'wb', name: 'Repo B', backendConnectionId: 'b' } as WorkspaceRecord;
const conversation = (id: string, workspaceId: string): ConversationRecord => ({
  id, workspaceId, title: id, sessionId: `v2_${id}`, threadId: '', provider: 'codex', v2ConversationId: id,
  createdAt: 1, updatedAt: 1,
} as ConversationRecord);
const manifest = (id: string, workspaceId?: string): ConversationManifest => ({
  schemaVersion: 1, id, provider: 'codex', ownerId: 'o', workspace: '/repo', workspaceId, title: id,
  status: 'idle', lastSequence: 0, createdAt: '1970-01-01T00:00:00.001Z', updatedAt: '1970-01-01T00:00:00.001Z',
});

it('keeps conversations owned by another backend', () => {
  const current = [conversation('ca', 'wa'), conversation('cb', 'wb')];
  const merged = mergeManifestConversations(current, [manifest('ca', 'wa')], [workspaceA, workspaceB], 'a');
  expect(merged.map((item) => item.id).sort()).toEqual(['ca', 'cb']);
});

it('drops in-scope conversations missing from the manifest list', () => {
  const current = [conversation('ca', 'wa'), conversation('gone', 'wa'), conversation('cb', 'wb')];
  const merged = mergeManifestConversations(current, [manifest('ca', 'wa')], [workspaceA, workspaceB], 'a');
  expect(merged.map((item) => item.id).sort()).toEqual(['ca', 'cb']);
});

it('attaches path-only manifests to the listing backend workspace', () => {
  const merged = mergeManifestConversations([], [manifest('new')], [workspaceB, workspaceA], 'a');
  expect(merged).toHaveLength(1);
  expect(merged[0].workspaceId).toBe('wa');
});

it('carries legacyPlaintext from manifests onto new and existing records', () => {
  const legacy = { ...manifest('old', 'wa'), legacyPlaintext: true };
  const [created] = mergeManifestConversations([], [legacy], [workspaceA], 'a');
  expect(created.legacyPlaintext).toBe(true);
  const [plain] = mergeManifestConversations([], [manifest('new', 'wa')], [workspaceA], 'a');
  expect('legacyPlaintext' in plain).toBe(false);
  // An already listed conversation picks the flag up on the next listing.
  const current = [conversation('ca', 'wa')];
  const [updated] = mergeManifestConversations(current, [{ ...manifest('ca', 'wa'), legacyPlaintext: true }], [workspaceA], 'a');
  expect(updated.legacyPlaintext).toBe(true);
});

it('fixes run modes only on records it creates', () => {
  const initial = () => ({ permissionMode: 'auto' as const });
  const [created] = mergeManifestConversations([], [manifest('new', 'wa')], [workspaceA], 'a', initial);
  expect(created.permissionMode).toBe('auto');
  // An existing record keeps its own mode, and an unchanged list keeps the array.
  const current = mergeManifestConversations([], [manifest('ca', 'wa')], [workspaceA], 'a');
  const existing = [{ ...current[0], permissionMode: 'ask' as const }];
  const merged = mergeManifestConversations(existing, [manifest('ca', 'wa')], [workspaceA], 'a', initial);
  expect(merged).toBe(existing);
  expect(merged[0].permissionMode).toBe('ask');
});

it('keeps another backend\'s conversations of a workspace with the same id', () => {
  // Same path on two backends: the backends give both workspaces one id.
  const sameA = { ...workspaceA, id: 'ws' } as WorkspaceRecord;
  const sameB = { ...workspaceB, id: 'ws' } as WorkspaceRecord;
  let current = mergeManifestConversations([], [manifest('ca', 'ws')], [sameA, sameB], 'a');
  current = mergeManifestConversations(current, [manifest('cb', 'ws')], [sameA, sameB], 'b');
  expect(current.map((item) => [item.id, item.backendConnectionId]).sort()).toEqual([['ca', 'a'], ['cb', 'b']]);
  // Each backend's next listing leaves the other's conversation alone.
  const afterA = mergeManifestConversations(current, [manifest('ca', 'ws')], [sameA, sameB], 'a');
  expect(afterA.map((item) => item.id).sort()).toEqual(['ca', 'cb']);
  const afterB = mergeManifestConversations(afterA, [manifest('cb', 'ws')], [sameA, sameB], 'b');
  expect(afterB.map((item) => item.id).sort()).toEqual(['ca', 'cb']);
  // An untagged record picks its backend up from the listing that has it.
  const [tagged] = mergeManifestConversations([conversation('cb', 'ws')], [manifest('cb', 'ws')], [sameB], 'b');
  expect(tagged.backendConnectionId).toBe('b');
});
