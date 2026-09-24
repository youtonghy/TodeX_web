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
