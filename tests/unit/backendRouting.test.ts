import { expect, it } from 'vitest';
import {
  ownerBackendId,
  resolveNoWorkspaceBackendId,
  tagLegacyBackendRecords,
  workspaceRemovalScope,
} from '../../src/renderer/session/backendRouting';

const profiles = [
  { id: 'b2', createdAt: 20 },
  { id: 'b1', createdAt: 10 },
];

it('the no-workspace backend is the chosen one, else the first added', () => {
  expect(resolveNoWorkspaceBackendId(profiles, 'b2')).toBe('b2');
  expect(resolveNoWorkspaceBackendId(profiles, '')).toBe('b1');
  // A removed choice falls back to the first added backend.
  expect(resolveNoWorkspaceBackendId(profiles, 'gone')).toBe('b1');
  expect(resolveNoWorkspaceBackendId([], 'b1')).toBe('');
});

it('the None row in view wins over the Settings default while it exists', () => {
  expect(resolveNoWorkspaceBackendId(profiles, 'b1', 'b2')).toBe('b1');
  expect(resolveNoWorkspaceBackendId(profiles, null, 'gone', 'b2')).toBe('b2');
  expect(resolveNoWorkspaceBackendId(profiles, 'gone', '')).toBe('b1');
});

it('a conversation belongs to its own tag, then its workspace, then the no-workspace backend', () => {
  expect(ownerBackendId({ workspaceId: 'w', backendConnectionId: 'b2' }, { id: 'w', backendConnectionId: 'b1' }, 'b9')).toBe('b2');
  expect(ownerBackendId({ workspaceId: 'w' }, { id: 'w', backendConnectionId: 'b1' }, 'b9')).toBe('b1');
  expect(ownerBackendId({ workspaceId: 'workspace-none' }, { id: 'workspace-none', backendConnectionId: null }, 'b9')).toBe('b9');
  expect(ownerBackendId(undefined, undefined, 'b9')).toBe('b9');
});

it('legacy records are tagged with the backend that was active', () => {
  const none = { id: 'workspace-none', backendConnectionId: null };
  const tagged = { id: 'w1', backendConnectionId: 'b2' };
  const untagged = { id: 'w2' };
  const records = {
    workspaces: [tagged, untagged, none],
    conversations: [
      { workspaceId: 'w2', v2ConversationId: 'c1' },
      { workspaceId: 'workspace-none', v2ConversationId: 'c2' },
      { workspaceId: 'workspace-none' },
      { workspaceId: 'workspace-none', v2ConversationId: 'c3', backendConnectionId: 'b2' },
    ],
    tombstones: [{ backendConnectionId: null }, { backendConnectionId: 'b2' }],
  };
  const result = tagLegacyBackendRecords(records, 'b1');
  expect(result.workspaces.map((item) => item.backendConnectionId)).toEqual(['b2', 'b1', null]);
  // Conversations in a workspace follow it; None-workspace conversations on
  // a backend get its tag; local None drafts stay untagged.
  expect(result.conversations.map((item) => item.backendConnectionId)).toEqual([undefined, 'b1', undefined, 'b2']);
  expect(result.tombstones.map((item) => item.backendConnectionId)).toEqual(['b1', 'b2']);
  expect(result.workspaces[0]).toBe(tagged);
});

it('tagging keeps the inputs when nothing is untagged', () => {
  const records = { workspaces: [{ id: 'w1', backendConnectionId: 'b1' }], conversations: [], tombstones: [] };
  const result = tagLegacyBackendRecords(records, 'b1');
  expect(result.workspaces).toBe(records.workspaces);
  expect(tagLegacyBackendRecords(records, '').workspaces).toBe(records.workspaces);
});


it('scopes a workspace deletion to its backend when two backends share the id', () => {
  // Backends name workspaces after their path: /repo on a and b is `ws`.
  const workspaces = [{ id: 'ws', backendConnectionId: 'a' }, { id: 'ws', backendConnectionId: 'b' }, { id: 'other', backendConnectionId: 'a' }];
  const conversations = [
    { id: 'ca', workspaceId: 'ws', backendConnectionId: 'a' },
    { id: 'cb', workspaceId: 'ws', backendConnectionId: 'b' },
    // Untagged: follows the first workspace with its id (backend a).
    { id: 'legacy', workspaceId: 'ws' },
    { id: 'elsewhere', workspaceId: 'other', backendConnectionId: 'a' },
  ];
  const scope = workspaceRemovalScope(workspaces, conversations, 'ws', 'b', 'a');
  expect(workspaces.filter(scope.workspace)).toEqual([{ id: 'ws', backendConnectionId: 'b' }]);
  expect(scope.conversationIds).toEqual(['cb']);
  expect(scope.terminal({ workspaceId: 'ws', conversationId: '', backendConnectionId: 'b' })).toBe(true);
  expect(scope.terminal({ workspaceId: 'ws', conversationId: '', backendConnectionId: 'a' })).toBe(false);
  expect(scope.terminal({ workspaceId: '', conversationId: 'cb' })).toBe(true);
  const first = workspaceRemovalScope(workspaces, conversations, 'ws', 'a', 'a');
  expect(first.conversationIds).toEqual(['ca', 'legacy']);
  expect(workspaces.filter(first.workspace)).toEqual([{ id: 'ws', backendConnectionId: 'a' }]);
});
