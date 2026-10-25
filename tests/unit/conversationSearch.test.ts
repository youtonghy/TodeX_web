import { describe, expect, it } from 'vitest';
import { searchConversations, searchSnippet } from '../../src/renderer/session/conversationSearch';

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
    expect(searchConversations(conversations, '  LOGIN ', titleOf).map((hit) => hit.conversation.id)).toEqual(['a', 'b', 'e']);
  });

  it('leaves out archived, child and hidden-workspace conversations', () => {
    expect(searchConversations(conversations, 'login', titleOf, new Set(['w3'])).map((hit) => hit.conversation.id)).toEqual(['a', 'b']);
  });

  it('matches nothing for an empty query', () => {
    expect(searchConversations(conversations, '   ', titleOf)).toEqual([]);
  });

  it('puts content matches after title matches, with a snippet', () => {
    const texts: Record<string, string[]> = { f: ['The login\nform crashes on submit'], c: ['login'] };
    const hits = searchConversations(conversations, 'LOGIN', titleOf, new Set(), (conversation) => texts[conversation.id] ?? []);
    expect(hits.map((hit) => [hit.conversation.id, hit.snippet])).toEqual([
      ['a', undefined], ['b', undefined], ['e', undefined], ['f', 'The login form crashes on submit'],
    ]);
  });
});

describe('searchSnippet', () => {
  it('cuts the text around the match', () => {
    const snippet = searchSnippet(`${'x'.repeat(40)} needle ${'y'.repeat(100)}`, 'needle') ?? '';
    expect(snippet.startsWith('…') && snippet.endsWith('…')).toBe(true);
    expect(snippet).toContain('needle');
    expect(searchSnippet('nothing here', 'needle')).toBeUndefined();
  });
});
