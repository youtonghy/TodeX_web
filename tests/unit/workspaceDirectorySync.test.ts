import { expect, it } from 'vitest';
import type { WorkspaceRecord, WorkspaceTombstone } from '@todex/protocol/todex';
import { ManifestEpochs, mergeWorkspaceDirectory } from '../../src/renderer/session/workspaceDirectorySync';

const workspace = (id: string, path: string, extra: Partial<WorkspaceRecord> = {}) => ({
  id, name: id, path, tenantId: 'local', model: '', approvalPolicy: 'on-request', sandboxMode: 'workspace-write',
  createdAt: 1, updatedAt: 1, ...extra,
}) as WorkspaceRecord;

it('merges one backend and leaves the others and None alone', () => {
  const none = workspace('__none__', '', { backendConnectionId: undefined });
  const other = workspace('o', '/o', { backendConnectionId: 'b' });
  const merge = mergeWorkspaceDirectory({
    backendId: 'a', remote: [workspace('r1', '/r1', { updatedAt: 5 })], rejections: [],
    workspaces: [other, workspace('l1', '/r1', { backendConnectionId: 'a' }), none], tombstones: [],
  });
  expect(merge.nextWorkspaces.find((item) => item.id === 'o')).toBe(other);
  expect(merge.nextWorkspaces.at(-1)?.id).toBe(none.id);
  expect(merge.nextScoped.every((item) => item.backendConnectionId === 'a')).toBe(true);
  expect(merge.localScoped.map((item) => item.id)).toEqual(['l1']);
});

it('keeps deleted workspaces out and deletes them on the backend again', () => {
  const tombstone = { id: 'gone', path: '/gone', backendConnectionId: 'a', deletedAt: 1 } as WorkspaceTombstone;
  const merge = mergeWorkspaceDirectory({
    backendId: 'a', remote: [workspace('gone', '/gone'), workspace('kept', '/kept')], rejections: [],
    workspaces: [], tombstones: [tombstone],
  });
  expect(merge.keptRemote.map((item) => item.id)).toEqual(['kept']);
  expect(merge.staleRemoteIds).toEqual(['gone']);
  // The backend still lists it: the tombstone stays.
  expect(merge.survivingTombstones).toBeNull();
  const after = mergeWorkspaceDirectory({ backendId: 'a', remote: [workspace('kept', '/kept')], rejections: [], workspaces: [], tombstones: [tombstone] });
  expect(after.survivingTombstones).toEqual([]);
});

it('flags paths the backend reported missing', () => {
  const merge = mergeWorkspaceDirectory({
    backendId: 'a', remote: [workspace('r', '/missing')], rejections: [{ path: '/missing', code: 'NOT_FOUND' } as never],
    workspaces: [], tombstones: [],
  });
  expect(merge.nextWorkspaces[0].pathMissing).toBe(true);
});

it('counts epochs per backend', () => {
  const epochs = new ManifestEpochs();
  const before = epochs.current('a');
  epochs.bump('a');
  expect(epochs.current('a')).toBe(before + 1);
  expect(epochs.current('b')).toBe(0);
});
