import { beforeEach, expect, it, vi } from 'vitest';
import {
  addKanbanTask,
  attachKanbanTask,
  getKanbanTasks,
  kanbanTasksForWorkspace,
  removeKanbanTask,
  renameKanbanTask,
  resetKanbanTasksForTests,
  setKanbanTaskStatus,
} from '../../src/renderer/session/kanbanTasks';
import {
  mergeKanbanTasks,
  normalizeKanbanTask,
  parseKanbanSyncResponse,
  prepareKanbanSyncPayload,
} from '@todex/protocol/todex';
import { KANBAN_TASKS_STORAGE_KEY } from '../../src/renderer/session/helpers';

const disk = new Map<string, unknown>();

beforeEach(() => {
  resetKanbanTasksForTests();
  disk.clear();
  Object.assign(window, {
    todexWeb: {
      store: {
        get: vi.fn(async (key: string) => disk.get(key)),
        set: vi.fn(async (key: string, value: unknown) => { disk.set(key, JSON.parse(JSON.stringify(value))); }),
      },
    },
  });
});

async function persisted() {
  await new Promise(resolve => setTimeout(resolve, 0));
  return disk.get(KANBAN_TASKS_STORAGE_KEY) as unknown[];
}

it('creates trimmed planned tasks per workspace and persists them', async () => {
  const task = addKanbanTask('w1', '  Fix the thing  ');
  expect(task).toMatchObject({ workspaceId: 'w1', title: 'Fix the thing', status: 'planned' });
  expect(getKanbanTasks()).toHaveLength(1);
  const saved = await persisted();
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ title: 'Fix the thing', status: 'planned' });
});

it('rejects empty titles and missing workspace instead of storing noise', () => {
  expect(addKanbanTask('w1', '   ')).toBeNull();
  expect(addKanbanTask('', 'real')).toBeNull();
  expect(getKanbanTasks()).toHaveLength(0);
});

it('moves tasks through planned, in-progress and done with updated timestamps', async () => {
  const task = addKanbanTask('w1', 'ship it')!;
  setKanbanTaskStatus(task.id, 'in-progress');
  expect(getKanbanTasks()[0].status).toBe('in-progress');
  setKanbanTaskStatus(task.id, 'done');
  expect(getKanbanTasks()[0].status).toBe('done');
  setKanbanTaskStatus(task.id, 'bogus' as never);
  expect(getKanbanTasks()[0].status).toBe('done');
  expect((await persisted())[0]).toMatchObject({ status: 'done' });
});

it('attaches a task to a conversation and cleanly detaches it', () => {
  const task = addKanbanTask('w1', 'review me')!;
  attachKanbanTask(task.id, 'conv-1');
  expect(getKanbanTasks()[0].conversationId).toBe('conv-1');
  attachKanbanTask(task.id, undefined);
  expect(getKanbanTasks()[0]).not.toHaveProperty('conversationId');
});

it('renames non-empty titles and ignores blank input', () => {
  const task = addKanbanTask('w1', 'old name')!;
  renameKanbanTask(task.id, '   ');
  expect(getKanbanTasks()[0].title).toBe('old name');
  renameKanbanTask(task.id, '  new name ');
  expect(getKanbanTasks()[0].title).toBe('new name');
});

it('removes tasks into tombstones hidden from workspace columns', async () => {
  const first = addKanbanTask('w1', 'first')!;
  addKanbanTask('w2', 'other workspace');
  addKanbanTask('w1', 'second');
  removeKanbanTask(first.id);
  const w1 = kanbanTasksForWorkspace(getKanbanTasks(), 'w1');
  expect(w1.map(task => task.title)).toEqual(['second']);
  expect(kanbanTasksForWorkspace(getKanbanTasks(), 'w2')).toHaveLength(1);
  expect(kanbanTasksForWorkspace(getKanbanTasks(), 'gone')).toEqual([]);
  // The tombstone stays in the record list so sync can propagate the delete.
  expect(getKanbanTasks().find(task => task.id === first.id)?.deletedAt).toBeGreaterThan(0);
  expect((await persisted()).length).toBe(3);
});

it('scopes visible tasks to the owning backend connection', () => {
  const task = addKanbanTask('w1', 'mine')!;
  const all = getKanbanTasks().map(item => item.id === task.id
    ? { ...item, backendConnectionId: 'conn-a' }
    : item);
  expect(kanbanTasksForWorkspace(all, 'w1', 'conn-a')).toHaveLength(1);
  expect(kanbanTasksForWorkspace(all, 'w1', 'conn-b')).toHaveLength(0);
  // Untagged legacy records stay visible on every connection.
  const legacy = addKanbanTask('w1', 'legacy')!;
  expect(legacy.backendConnectionId).toBeNull();
  expect(kanbanTasksForWorkspace(getKanbanTasks(), 'w1', 'conn-b').map(task => task.title))
    .toContain('legacy');
});

it('merges remote tasks by updatedAt with tombstone deletes winning', () => {
  const local = addKanbanTask('w1', 'local title')!;
  const newerRemote = {
    ...local,
    title: 'remote title',
    status: 'done' as const,
    updatedAt: local.updatedAt + 1000,
    backendConnectionId: 'conn-a',
  };
  const merged = mergeKanbanTasks(getKanbanTasks(), [newerRemote]);
  expect(merged[0].title).toBe('remote title');
  expect(merged[0].backendConnectionId).toBe('conn-a');

  const staleRemote = { ...local, title: 'stale', updatedAt: local.updatedAt - 1000 };
  expect(mergeKanbanTasks(getKanbanTasks(), [staleRemote])[0].title).toBe('local title');

  const tombstone = { ...local, deletedAt: local.updatedAt + 1, updatedAt: local.updatedAt + 1 };
  const deleted = mergeKanbanTasks(getKanbanTasks(), [tombstone]);
  expect(deleted[0].deletedAt).toBeGreaterThan(0);
  expect(kanbanTasksForWorkspace(deleted, 'w1')).toHaveLength(0);
});

it('sync payload strips local connection tags and parses snake or camel records', () => {
  addKanbanTask('w1', 'sync me', { dueDate: '2026-10-01' });
  const payload = prepareKanbanSyncPayload(getKanbanTasks());
  expect(payload).toHaveLength(1);
  // The wire payload drops the local-only connection tag.
  expect(JSON.parse(JSON.stringify(payload[0]))).not.toHaveProperty('backendConnectionId');
  expect(payload[0].dueDate).toBe('2026-10-01');

  const parsed = parseKanbanSyncResponse({
    tasks: [{
      id: 'task-remote',
      workspace_id: 'w1',
      title: 'from server',
      status: 'in-progress',
      created_at: 1,
      updated_at: 2,
      deleted_at: 3,
    }],
  });
  expect(parsed).toHaveLength(1);
  expect(parsed[0]).toMatchObject({ workspaceId: 'w1', status: 'in-progress', deletedAt: 3 });

  expect(normalizeKanbanTask({ id: '', workspaceId: 'w1', title: 'x' })).toBeNull();
  expect(normalizeKanbanTask({ id: 't', workspaceId: 'w1', title: 'x', status: 'bogus' })?.status).toBe('planned');
});
