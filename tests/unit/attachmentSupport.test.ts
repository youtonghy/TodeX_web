import { describe, expect, it } from 'vitest';
import type { ProviderDescriptor, ProviderKind } from '@todex/protocol/v2';
import { conversationImageInputSupport, type ConversationRecord } from '../../src/renderer/session/helpers';

function conversation(provider?: ProviderKind): ConversationRecord {
  return {
    id: 'conversation-1',
    workspaceId: 'workspace-1',
    title: 'New conversation',
    sessionId: '',
    threadId: '',
    provider,
    v2ConversationId: provider ? 'v2-conversation-1' : undefined,
    createdAt: 1,
    updatedAt: 1,
  };
}

function provider(
  id: ProviderKind,
  imageInput?: boolean,
  imageInputMode?: 'always' | 'model' | 'profile' | 'none',
): ProviderDescriptor {
  return {
    id,
    displayName: id,
    available: true,
    profiles: [],
    capabilities: {
      nativeResume: true,
      cancel: true,
      permissions: true,
      toolEvents: true,
      nativeSkills: true,
      nativeMcp: true,
      managedMcp: true,
      modelSelection: true,
      ...(imageInput === undefined ? {} : { imageInput }),
      ...(imageInputMode === undefined ? {} : { imageInputMode }),
    },
    models: [],
  };
}

describe('conversation image input capability', () => {
  it('keeps the provider-less local Codex path enabled', () => {
    expect(conversationImageInputSupport(conversation(), []).supported).toBe(true);
  });

  it('requires an explicit capability from v2 backends', () => {
    const support = conversationImageInputSupport(conversation('claude-code'), [provider('claude-code')]);
    expect(support.supported).toBe(false);
    expect(support.reason).toContain('升级 Backend');
  });

  it('allows declared providers and explains explicit rejection', () => {
    expect(conversationImageInputSupport(
      conversation('claude-code'),
      [provider('claude-code', true)],
    ).supported).toBe(true);

    const unsupported = conversationImageInputSupport(conversation('acp'), [provider('acp', false)]);
    expect(unsupported.supported).toBe(false);
    expect(unsupported.reason).toContain('ACP 当前不支持图片输入');
  });

  it('uses the selected Pi model image declaration', () => {
    const piConversation = { ...conversation('pi'), model: 'vision' };
    const pi = provider('pi', true, 'model');
    const models = [
      {
        id: 'vision', displayName: 'Vision', description: '', isDefault: true,
        supportedReasoningEfforts: [], imageInput: true,
      },
      {
        id: 'text', displayName: 'Text', description: '', isDefault: false,
        supportedReasoningEfforts: [], imageInput: false,
      },
    ];
    expect(conversationImageInputSupport(piConversation, [pi], { models }).supported).toBe(true);
    expect(conversationImageInputSupport({ ...piConversation, model: 'text' }, [pi], { models }).supported).toBe(false);
  });

  it('waits for and follows the selected ACP profile capability', () => {
    const acp = provider('acp', false, 'profile');
    expect(conversationImageInputSupport(conversation('acp'), [acp]).supported).toBe(false);
    expect(conversationImageInputSupport(conversation('acp'), [acp], {
      profileCapability: { status: 'ready', imageInput: true },
    }).supported).toBe(true);
    expect(conversationImageInputSupport(conversation('acp'), [acp], {
      profileCapability: { status: 'ready', imageInput: false, reason: 'profile says no' },
    }).reason).toBe('profile says no');
  });
});
