import { describe, expect, it } from 'vitest';
import { attachmentPrompt, attachmentSummary, attachmentTextBlock, liveComposerAttachments, referenceNamesInText, referencePreview, referenceToken, uniqueReferenceName, type ComposerAttachmentDraft } from '../../src/renderer/session/helpers';
import { lineRangeForOffsets, selectionInside, selectionStartOffset } from '../../src/renderer/lib/selection';

function reference(partial: Partial<ComposerAttachmentDraft> = {}): ComposerAttachmentDraft {
  return {
    id: 'ref-1',
    kind: 'reference',
    name: 'App.swift:10-12',
    mimeType: 'text/plain',
    sizeBytes: 42,
    dataUrl: '',
    textContent: 'let value = 1',
    source: 'preview',
    path: '/repo/Sources/App.swift',
    lineStart: 10,
    lineEnd: 12,
    ...partial,
  };
}

describe('attachmentTextBlock reference', () => {
  it('serializes path, line range, and excerpt', () => {
    const block = attachmentTextBlock(reference());
    expect(block).toBe('[引用: /repo/Sources/App.swift:10-12]\nContent:\nlet value = 1');
  });

  it('falls back to the display name without a path', () => {
    const block = attachmentTextBlock(reference({ name: '对话摘录', path: undefined, lineStart: undefined, lineEnd: undefined }));
    expect(block).toBe('[引用: 对话摘录]\nContent:\nlet value = 1');
  });
});

describe('attachmentPrompt / attachmentSummary with references', () => {
  it('uses the reference label when only references are attached', () => {
    expect(attachmentPrompt([reference()])).toBe('请查看这条引用。');
    expect(attachmentPrompt([reference(), reference({ id: 'ref-2' })])).toBe('请查看这 2 条引用。');
  });

  it('labels references in the summary', () => {
    expect(attachmentSummary([reference()])).toContain('引用 App.swift:10-12');
  });
});

describe('reference tokens in the composer', () => {
  it('builds tokens and finds them in draft text', () => {
    expect(referenceToken('App.swift:10-12')).toBe('[引用:App.swift:10-12]');
    expect(referenceNamesInText('改一下 [引用:App.swift:10-12] 和 [引用:对话摘录]')).toEqual(['App.swift:10-12', '对话摘录']);
  });

  it('deduplicates names against attachments and existing tokens', () => {
    expect(uniqueReferenceName('对话摘录', [], '')).toBe('对话摘录');
    expect(uniqueReferenceName('对话摘录', [reference({ name: '对话摘录' })], '')).toBe('对话摘录 2');
    expect(uniqueReferenceName('对话摘录', [], '看看 [引用:对话摘录]')).toBe('对话摘录 2');
    expect(uniqueReferenceName('对话摘录', [reference({ name: '对话摘录' }), reference({ name: '对话摘录 2', id: 'ref-2' })], '')).toBe('对话摘录 3');
  });

  it('keeps only attachments whose capsule token survives in the text', () => {
    const ref = reference();
    const image: ComposerAttachmentDraft = {
      id: 'img-1', kind: 'image', name: 'a.png', mimeType: 'image/png',
      sizeBytes: 10, dataUrl: 'data:image/png;base64,AAAA', source: 'clipboard',
    };
    expect(liveComposerAttachments('看看 [引用:App.swift:10-12] [图片:a.png]', [ref, image])).toEqual([ref, image]);
    expect(liveComposerAttachments('看看 [引用:App.swift:10-12]', [ref, image])).toEqual([ref]);
    expect(liveComposerAttachments('删掉了 token', [ref, image])).toEqual([]);
  });
});

describe('reference preview labels', () => {
  it('takes the first non-empty line, collapses whitespace, truncates at 10 chars', () => {
    expect(referencePreview('')).toBe('');
    expect(referencePreview(undefined)).toBe('');
    expect(referencePreview('\n\n  hello   world  \nsecond')).toBe('hello worl…');
    expect(referencePreview('short')).toBe('short');
    expect(referencePreview('0123456789')).toBe('0123456789');
    expect(referencePreview('0123456789x')).toBe('0123456789…');
  });
});

describe('selection helpers', () => {
  it('maps character offsets to 1-based line ranges', () => {
    const text = 'one\ntwo\nthree';
    expect(lineRangeForOffsets(text, 4, 7)).toEqual({ lineStart: 2, lineEnd: 2 });
    expect(lineRangeForOffsets(text, 0, text.length)).toEqual({ lineStart: 1, lineEnd: 3 });
  });

  it('reads a DOM selection inside a container and its source offset', () => {
    const container = document.createElement('div');
    const code = document.createElement('code');
    code.textContent = 'one\ntwo\nthree';
    container.appendChild(code);
    document.body.appendChild(container);

    const selection = window.getSelection();
    const range = document.createRange();
    const textNode = code.firstChild as Text;
    range.setStart(textNode, 4);
    range.setEnd(textNode, 7);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const info = selectionInside(container);
    expect(info?.text).toBe('two');
    expect(selectionStartOffset(code)).toBe(4);

    selection?.removeAllRanges();
    expect(selectionInside(container)).toBeNull();
    document.body.removeChild(container);
  });

  it('rejects selections outside the container', () => {
    const container = document.createElement('div');
    container.textContent = 'inside';
    const outside = document.createElement('div');
    outside.textContent = 'outside';
    document.body.appendChild(container);
    document.body.appendChild(outside);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(outside);
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(selectionInside(container)).toBeNull();
    selection?.removeAllRanges();
    document.body.removeChild(container);
    document.body.removeChild(outside);
  });
});
