import { expect, it } from 'vitest';
import { BackendRequestError, conversationsForWorkspaceSnapshot, readBackendError, workspaceLinkTarget } from '../../src/renderer/session/helpers';
import type { ConversationRecord, WorkspaceRecord } from '../../src/renderer/session/helpers';

const workspace = (id: string) => ({ id, name: id, path: `/${id}`, updatedAt: 1 }) as unknown as WorkspaceRecord;
const conversation = (id: string, workspaceId: string, updatedAt: number) => ({ id, workspaceId, updatedAt, title: id }) as unknown as ConversationRecord;

it('keeps the conversation list itself when a sync changes nothing', () => {
  const list = [conversation('b', 'w1', 2), conversation('a', 'w1', 1)];
  expect(conversationsForWorkspaceSnapshot([workspace('w1')], list)).toBe(list);
});

it('adds drafts only for the workspaces asked for', () => {
  const list = [conversation('a', 'w1', 1)];
  const next = conversationsForWorkspaceSnapshot([workspace('w1'), workspace('w2'), workspace('w3')], list, new Set(['w3']));
  expect(next.map((item) => item.workspaceId).sort()).toEqual(['w1', 'w3']);
});

it('reads the backend error body, flat or nested, with the status', async () => {
  const flat = await readBackendError(new Response(JSON.stringify({ code: 'INVALID_REQUEST', message: 'too many tasks' }), { status: 400 }), 'Sync');
  expect(flat).toBeInstanceOf(BackendRequestError);
  expect(flat).toMatchObject({ status: 400, code: 'INVALID_REQUEST', message: 'Sync: too many tasks' });
  const nested = await readBackendError(new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'no' } }), { status: 401 }), 'Admin');
  expect(nested.unauthenticated).toBe(true);
  const empty = await readBackendError(new Response('', { status: 502 }), 'Sync');
  expect(empty.message).toBe('Sync (HTTP 502)');
});

it('leaves external links to the browser where the host has no browser tab', () => {
  expect(workspaceLinkTarget('https://github.com/x', '/repo')).toBeNull();
  expect(workspaceLinkTarget('http://127.0.0.1:3000/', '/repo')).toBeNull();
  expect(workspaceLinkTarget('src/index.ts', '/repo')).toEqual({ kind: 'file', filePath: '/repo/src/index.ts' });
});
