import { describe, expect, it } from 'vitest';
import { attachmentToken, composerTokensInText, expandTextCapsules, liveComposerAttachments, type ComposerAttachmentDraft } from '../../src/renderer/session/helpers';
import { prepareSentAttachments } from '../../src/renderer/session/sentAttachments';

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
