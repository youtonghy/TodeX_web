import { describe, expect, it } from 'vitest';
import { attachmentToken, composerTokensInText, expandTextCapsules, liveComposerAttachments, type ComposerAttachmentDraft } from '../../src/renderer/session/helpers';
import { prepareSentAttachments } from '../../src/renderer/session/sentAttachments';
import { uploadPromptFile } from '../../src/renderer/session/promptUploads';
import { PROMPT_UPLOAD_CHUNK_BYTES } from '@todex/protocol/promptUploads';
import type { V2ApiClient } from '@todex/protocol/v2';

function attachment(partial: Partial<ComposerAttachmentDraft>): ComposerAttachmentDraft {
  return { id: 'a', kind: 'file', name: 'a.txt', mimeType: 'text/plain', sizeBytes: 1, dataUrl: '', source: 'clipboard', ...partial };
}

describe('pasted-text capsules', () => {
  const capsule = attachment({ id: 't1', kind: 'text', name: '粘贴的文本', textContent: 'line one\nline two' });
  const file = attachment({ id: 'f1', name: 'report.pdf', mimeType: 'application/pdf', uploadedPath: '/tmp/todex/file/u1/report.pdf' });

  it('are a capsule token of their own kind', () => {
    expect(attachmentToken(capsule)).toBe('[文本:粘贴的文本]');
    expect(composerTokensInText('see [文本:粘贴的文本] now')).toEqual([{ kind: 'text', name: '粘贴的文本', token: '[文本:粘贴的文本]', start: 4 }]);
    expect(liveComposerAttachments('see [文本:粘贴的文本]', [capsule, file])).toEqual([capsule]);
  });

  it('go back into the message where they sit, leaving other attachments', () => {
    const draft = `before ${attachmentToken(capsule)} after ${attachmentToken(file)}`;
    expect(expandTextCapsules(draft, [capsule, file])).toEqual({
      text: 'before line one\nline two after [文件:report.pdf]',
      attachments: [file],
    });
    // A token without its attachment stays as typed.
    expect(expandTextCapsules('[文本:别的]', [capsule]).text).toBe('[文本:别的]');
  });

  it('are sent as file receipts if one ever reaches the receipt list', async () => {
    const [receipt] = await prepareSentAttachments([capsule]);
    expect(receipt).toMatchObject({ kind: 'file', name: '粘贴的文本', textContent: 'line one\nline two' });
  });
});

describe('uploadPromptFile', () => {
  it('stops sending chunks once the conversation is gone', async () => {
    const sent: Array<{ offset: number; conversationId?: string }> = [];
    let wanted = true;
    const api = {
      uploadPromptChunk: async (name: string, offset: number, bytes: Uint8Array, uploadId?: string, _timeout?: number, conversationId?: string) => {
        sent.push({ offset, conversationId });
        // The conversation is deleted while the first chunk is in flight.
        wanted = false;
        return { uploadId: uploadId ?? 'u1', path: `/private/${name}`, name, mimeType: 'text/plain', sizeBytes: offset + bytes.length };
      },
    } as unknown as V2ApiClient;
    const blob = new Blob([new Uint8Array(PROMPT_UPLOAD_CHUNK_BYTES + 10)]);
    await expect(uploadPromptFile(api, 'big.bin', blob, 'conv-private', () => wanted)).rejects.toThrow();
    expect(sent).toEqual([{ offset: 0, conversationId: 'conv-private' }]);
  });

  it('does not start for a conversation that is already gone', async () => {
    const api = { uploadPromptChunk: async () => { throw new Error('must not upload'); } } as unknown as V2ApiClient;
    await expect(uploadPromptFile(api, 'a.txt', new Blob(['hi']), 'conv-private', () => false)).rejects.toThrow(/deleted|删除|削除|삭제/);
  });
});
