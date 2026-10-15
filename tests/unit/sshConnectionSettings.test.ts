import { describe, expect, it } from 'vitest';
import { SSH_SERVER_ALIVE_COUNT_MAX_RANGE, SSH_SERVER_ALIVE_INTERVAL_RANGE } from '@todex/protocol/ssh';
import { parseBoundedInteger } from '../../src/renderer/components/settings/SshConnectionSettings';

describe('parseBoundedInteger', () => {
  it('accepts whole numbers inside the backend ranges', () => {
    expect(parseBoundedInteger('5', SSH_SERVER_ALIVE_INTERVAL_RANGE)).toBe(5);
    expect(parseBoundedInteger(' 600 ', SSH_SERVER_ALIVE_INTERVAL_RANGE)).toBe(600);
    expect(parseBoundedInteger('10', SSH_SERVER_ALIVE_COUNT_MAX_RANGE)).toBe(10);
  });

  it('rejects values the backend would refuse', () => {
    for (const text of ['', '4', '601', '15.5', '-1', '1e2', '0x10', 'abc']) {
      expect(parseBoundedInteger(text, SSH_SERVER_ALIVE_INTERVAL_RANGE), text).toBeUndefined();
    }
    expect(parseBoundedInteger('0', SSH_SERVER_ALIVE_COUNT_MAX_RANGE)).toBeUndefined();
    expect(parseBoundedInteger('11', SSH_SERVER_ALIVE_COUNT_MAX_RANGE)).toBeUndefined();
  });
});
