import { describe, expect, it } from 'vitest';
import {
  bindSentAttachmentEvents, prepareSentAttachments, projectSentAttachments, pruneSentAttachmentRecords,
  type SentAttachmentRecord,
} from '../../src/renderer/session/sentAttachments';
import type { ConversationEvent } from '@todex/protocol/v2';
import { classifyV2ConversationEvent } from '@todex/protocol/mobileParity';
import { buildChatRenderItems } from '../../src/renderer/components/conversationTimeline';

const record = (requestId = 'r1', conversationId = 'c'): SentAttachmentRecord => ({
  conversationId, requestId, text: 'same prompt',
  attachments: [{ id: requestId, kind: 'image', name: `${requestId}.png`, mimeType: 'image/png', sizeBytes: 12 }],
});
const event = (eventId = 'e1', requestId = 'r1'): ConversationEvent => ({
  schemaVersion: 1, eventId, conversationId: 'server-c', sequence: 1, time: '2026-09-09T00:00:00Z',
  type: 'message.created', payload: { role: 'user', clientRequestId: requestId, turnId: 't1' },
});
const entry = (id = 'e1') => ({ id, kind: 'outgoing', conversationId: 'c', subtitle: 'same prompt', turnId: 't1' });

describe('sent attachment identity', () => {
  it('survives real event projection, grouping, and later turn events', () => {
    const userEvent = event();
    const classified = classifyV2ConversationEvent(userEvent, 'workspace')!;
    const bound = bindSentAttachmentEvents([record()], 'c', [userEvent]);
    const later: ConversationEvent[] = [
      { ...event('assistant'), type: 'message.completed', sequence: 2, payload: { role: 'assistant', content: 'done', turnId: 't1' } },
      { ...event('terminal'), type: 'turn.completed', sequence: 3, payload: { turnId: 't1' } },
    ];
    const rebound = bindSentAttachmentEvents(bound, 'c', later);
    expect(rebound).toBe(bound);
    const projected = projectSentAttachments([{ ...classified, conversationId: 'c' }], rebound, 'c');
    const rendered = buildChatRenderItems(projected);
    expect(JSON.stringify(rendered)).toContain('r1.png');
    expect(projected[0].sentAttachments).toEqual(record().attachments);
  });
  it('binds the journal event and projects the original text and attachment after replay', () => {
    const source = { ...record(), text: 'original' };
    const bound = bindSentAttachmentEvents([source], 'c', [event()]);
    expect(bound[0]).toMatchObject({ eventId: 'e1', turnId: 't1' });
    const restored = JSON.parse(JSON.stringify(bound)) as SentAttachmentRecord[];
    expect(projectSentAttachments([entry()], restored, 'c')[0]).toMatchObject({
      subtitle: 'original', sentAttachments: source.attachments,
    });
    expect(source.eventId).toBeUndefined();
  });
  it('does not confuse repeated prompt text or same-turn user messages', () => {
    const bound = bindSentAttachmentEvents([record('r1'), record('r2')], 'c', [event('e1', 'r1'), event('e2', 'r2')]);
    const result = projectSentAttachments([entry('e1'), entry('e2'), entry('other')], bound, 'c');
    expect(result.map(item => item.sentAttachments?.[0].id)).toEqual(['r1', 'r2', undefined]);
    expect(projectSentAttachments([entry()], [{ ...record(), turnId: 't1' }], 'c')[0].sentAttachments).toBeUndefined();
  });
  it('supports explicit request identity and legacy outgoing request IDs', () => {
    const result = projectSentAttachments([{ ...entry(), requestId: 'r1' }, entry('r1')], [record()], 'c');
    expect(result.every(item => item.sentAttachments?.[0].id === 'r1')).toBe(true);
  });
  it('does not attach receipts to another conversation or assistant message', () => {
    const rows = [{ ...entry('r1'), conversationId: 'other' }, { ...entry('r1'), kind: 'incoming' }];
    expect(projectSentAttachments(rows, [record()], 'c').every(item => !item.sentAttachments)).toBe(true);
    expect(bindSentAttachmentEvents([record('r1', 'other')], 'c', [event()])[0].eventId).toBeUndefined();
    expect(bindSentAttachmentEvents([record()], 'c', [{ ...event(), payload: { role: 'assistant', clientRequestId: 'r1' } }])[0].eventId).toBeUndefined();
  });
  it('ignores unrelated events and supports requestId alias', () => {
    expect(bindSentAttachmentEvents([record()], 'c', [{ ...event(), type: 'turn.started' }])[0].eventId).toBeUndefined();
    expect(bindSentAttachmentEvents([record()], 'c', [{ ...event(), payload: { role: 'human', requestId: 'r1' } }])[0].eventId).toBe('e1');
  });
  it('preserves the array identity when no binding changes', () => {
    const records = [record()];
    expect(bindSentAttachmentEvents(records, 'c', [])).toBe(records);
    expect(bindSentAttachmentEvents(records, 'c', [event('other', 'unrelated')])).toBe(records);
    const bound = bindSentAttachmentEvents(records, 'c', [event()]);
    expect(bindSentAttachmentEvents(bound, 'c', [event()])).toBe(bound);
  });
});

describe('bounded attachment receipts', () => {
  it('retains metadata when an image cannot be decoded and never keeps its source data', async () => {
    const result = await prepareSentAttachments([
      { ...record().attachments[0], dataUrl: 'not-an-image' },
      { ...record().attachments[0], id: 'file', kind: 'file', dataUrl: 'data:text/plain;base64,Zm9v' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(record().attachments[0]);
    expect(result.every(item => !('dataUrl' in item) && !item.previewUrl)).toBe(true);
  });
  it('keeps the latest 150 records and drops older previews before newer ones', () => {
    const records = Array.from({ length: 151 }, (_, index) => ({
      ...record(String(index)), attachments: [{ ...record(String(index)).attachments[0], previewUrl: 'data:image/webp;base64,' + 'a'.repeat(99 * 1024) }],
    }));
    const pruned = pruneSentAttachmentRecords(records);
    expect(pruned).toHaveLength(150);
    expect(pruned[0].requestId).toBe('1');
    expect(pruned[0].attachments[0]).not.toHaveProperty('previewUrl');
    expect(pruned.at(-1)?.attachments[0].previewUrl).toBeDefined();
    expect(pruned.reduce((sum, item) => sum + item.attachments.reduce((total, attachment) => total + (attachment.previewUrl?.length ?? 0), 0), 0)).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(records[1].attachments[0].previewUrl).toBeDefined();
  });
  it('ignores corrupt records and strips invalid or remote preview URLs', () => {
    const dirty = [null, {}, { ...record(), attachments: null }, {
      ...record(), attachments: [null, {}, { ...record().attachments[0], previewUrl: 'https://example.com/private.png' }],
    }] as unknown as SentAttachmentRecord[];
    expect(pruneSentAttachmentRecords(dirty)).toEqual([record()]);
  });
});

describe('legacy message attachment recovery', () => {
  const imageUrl = 'data:image/png;base64,aGVsbG8=';
  const content = [{ type: 'image', url: imageUrl }, { type: 'text', text: '[附件: notes.txt]\nfile content' }];
  it('recovers native history image and file attachments from that exact message', () => {
    const message = { ...entry('native-user-item'), raw: JSON.stringify({ type: 'userMessage', content }) };
    const result = projectSentAttachments([message], [record()], 'c')[0];
    expect(result.sentAttachments).toEqual([
      { id: 'native-user-item:attachment:0', kind: 'image', name: '图片 1', mimeType: 'image/png', sizeBytes: null, previewUrl: imageUrl },
      { id: 'native-user-item:attachment:1', kind: 'file', name: 'notes.txt', mimeType: 'text/plain', sizeBytes: null },
    ]);
    expect(result.subtitle).toBe(message.subtitle);
    expect(result.raw).toBe(message.raw);
  });
  it('recovers live legacy request input without requiring a cache record', () => {
    const message = { ...entry(), raw: JSON.stringify({ type: 'codex.local.turn', payload: { input: content } }) };
    expect(projectSentAttachments([message], [], 'c')[0].sentAttachments).toHaveLength(2);
  });
  it('does not infer attachments from malformed raw data or ordinary text', () => {
    const rows = [
      { ...entry('bad-json'), raw: '{bad' },
      { ...entry('ordinary'), raw: JSON.stringify({ type: 'userMessage', content: [{ type: 'text', text: 'please read [附件: notes.txt]\ntext' }] }) },
      { ...entry('other-type'), raw: JSON.stringify({ type: 'assistantMessage', content }) },
      { ...entry('remote'), raw: JSON.stringify({ type: 'userMessage', content: [{ type: 'image', url: 'https://example.com/image.png' }] }) },
    ];
    expect(projectSentAttachments(rows, [], 'c').every(item => !item.sentAttachments)).toBe(true);
  });
});
