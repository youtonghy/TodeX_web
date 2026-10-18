import { describe, expect, it } from 'vitest';
import { searchConversations } from '../../src/renderer/session/conversationSearch';

const conversations = [
  { id: 'a', workspaceId: 'w1', title: 'Fix login bug' },
  { id: 'b', workspaceId: 'w2', title: 'Login page redesign' },
  { id: 'c', workspaceId: 'w2', title: 'Old login', archived: true },
  { id: 'd', workspaceId: 'w1', title: 'login child', parentConversationId: 'a' },
  { id: 'e', workspaceId: 'w3', title: 'login in a missing directory' },
  { id: 'f', workspaceId: 'w3', title: 'Unrelated' },
];
const titleOf = (conversation: { title: string }) => conversation.title;

describe('searchConversations', () => {
  it('spans every workspace and ignores case', () => {
    expect(searchConversations(conversations, '  LOGIN ', titleOf).map((item) => item.id)).toEqual(['a', 'b', 'e']);
  });

  it('leaves out archived, child and hidden-workspace conversations', () => {
    expect(searchConversations(conversations, 'login', titleOf, new Set(['w3'])).map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('matches nothing for an empty query', () => {
    expect(searchConversations(conversations, '   ', titleOf)).toEqual([]);
  });
});
