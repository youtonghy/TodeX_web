import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  completionNotificationBody,
  shouldNotifyCompletion,
} from '../../src/renderer/session/completionNotifications';
import type { TimelineEntry } from '../../src/renderer/session/helpers';

function entry(kind: TimelineEntry['kind'], subtitle: string): TimelineEntry {
  return { id: `e-${subtitle}`, kind, title: '', subtitle, raw: '', at: 0 };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shouldNotifyCompletion', () => {
  const granted = { permission: 'granted' };

  it('stays silent while the user is watching the completing conversation', () => {
    vi.stubGlobal('Notification', granted);
    expect(shouldNotifyCompletion({ enabled: true, supported: true, viewingConversation: true })).toBe(false);
    expect(shouldNotifyCompletion({ enabled: true, supported: true, viewingConversation: false })).toBe(true);
  });

  it('requires the preference and platform support', () => {
    vi.stubGlobal('Notification', granted);
    expect(shouldNotifyCompletion({ enabled: false, supported: true, viewingConversation: false })).toBe(false);
    expect(shouldNotifyCompletion({ enabled: true, supported: false, viewingConversation: false })).toBe(false);
  });

  it('respects a denied or default system permission', () => {
    vi.stubGlobal('Notification', { permission: 'denied' });
    expect(shouldNotifyCompletion({ enabled: true, supported: true, viewingConversation: false })).toBe(false);
    vi.stubGlobal('Notification', { permission: 'default' });
    expect(shouldNotifyCompletion({ enabled: true, supported: true, viewingConversation: false })).toBe(false);
    vi.stubGlobal('Notification', granted);
    expect(shouldNotifyCompletion({ enabled: true, supported: true, viewingConversation: false })).toBe(true);
  });
});

describe('completionNotificationBody', () => {
  it('uses the newest incoming reply, normalized to one line', () => {
    const body = completionNotificationBody([
      entry('system', 'tool noise'),
      entry('incoming', '第一行\n\n第二行'),
      entry('incoming', '更早的回复'),
    ]);
    expect(body).toBe('第一行 第二行');
  });

  it('falls back when no reply text exists', () => {
    expect(completionNotificationBody([entry('system', 'done')])).toBe('任务已完成，点击查看回复。');
    expect(completionNotificationBody([])).toBe('任务已完成，点击查看回复。');
  });

  it('truncates long replies', () => {
    const body = completionNotificationBody([entry('incoming', 'x'.repeat(300))]);
    expect(body).toHaveLength(161);
    expect(body.endsWith('…')).toBe(true);
  });
});
