import { expect, it, vi } from 'vitest';
import { LegacyEventRecovery } from '../../src/renderer/session/legacyEventRecovery';

it('replays gaps once and projects events in contiguous order without duplicates', () => {
  const recovery = new LegacyEventRecovery<string>();
  let cursor = 0;
  const output: string[] = [];
  const replay = vi.fn(() => true);
  const receive = (sequence: number) => recovery.receive('s', sequence, `${sequence}`, () => cursor,
    (event) => output.push(event), (next) => { cursor = next; }, replay);
  receive(3); receive(4); receive(1); receive(2); receive(3);
  expect(output).toEqual(['1', '2', '3', '4']);
  expect(cursor).toBe(4);
  expect(replay).toHaveBeenCalledExactlyOnceWith(0);
});

it('does not advance the cursor when projection fails', () => {
  const recovery = new LegacyEventRecovery<string>();
  let cursor = 0;
  expect(() => recovery.receive('s', 1, 'event', () => cursor,
    () => { throw new Error('projection failed'); }, (next) => { cursor = next; }, () => true)).toThrow('projection failed');
  expect(cursor).toBe(0);
  const project = vi.fn();
  recovery.receive('s', 1, 'event', () => cursor, project, (next) => { cursor = next; }, () => true);
  expect(project).toHaveBeenCalledOnce();
  expect(cursor).toBe(1);
});
