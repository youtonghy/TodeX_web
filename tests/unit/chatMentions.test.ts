import { describe, expect, it } from 'vitest';
import {
  buildChatMentionSuggestions,
  chatMentionPrefixSuggestion,
  chatMentionQuery,
  findMentionTrigger,
  type ConversationRecord,
} from '../../src/renderer/session/helpers';

function conversation(partial: Partial<ConversationRecord>): ConversationRecord {
  return { id: 'c', workspaceId: 'w', title: '', sessionId: '', threadId: '', ...partial };
}

describe('@chat: mentions', () => {
  it('reads the conversation filter only after the chat: prefix', () => {
    expect(chatMentionQuery(findMentionTrigger('see @chat:build', 15))).toBe('build');
    expect(chatMentionQuery(findMentionTrigger('@Chat:', 6))).toBe('');
    expect(chatMentionQuery(findMentionTrigger('@src/chat:x', 11))).toBeNull();
    expect(chatMentionQuery(null)).toBeNull();
  });

  it('offers chat: while the query is still a prefix of it', () => {
    expect(chatMentionPrefixSuggestion(findMentionTrigger('@', 1), 'hint')?.insertText).toBe('@chat:');
    expect(chatMentionPrefixSuggestion(findMentionTrigger('@ch', 3), 'hint')).not.toBeNull();
    expect(chatMentionPrefixSuggestion(findMentionTrigger('@cx', 3), 'hint')).toBeNull();
    expect(chatMentionPrefixSuggestion(findMentionTrigger('@chat:a', 7), 'hint')).toBeNull();
  });

  it('lists other unarchived conversations of the same workspace, matching titles without spaces', () => {
    const conversations = [
      conversation({ id: 'current', title: 'Fix build' }),
      conversation({ id: 'a', title: 'Fix the Build', preview: 'line one\nline two' }),
      conversation({ id: 'b', title: 'Docs' }),
      conversation({ id: 'c', title: 'Fix build', workspaceId: 'other' }),
      conversation({ id: 'd', title: 'Fix build', archived: true }),
    ];
    expect(buildChatMentionSuggestions('thebuild', conversations, 'w', 'current')).toEqual([
      { id: 'chat-a', title: 'Fix the Build', description: 'line one line two', insertText: '', conversationId: 'a' },
    ]);
    expect(buildChatMentionSuggestions('', conversations, 'w', 'current').map((item) => item.conversationId)).toEqual(['a', 'b']);
  });
});
