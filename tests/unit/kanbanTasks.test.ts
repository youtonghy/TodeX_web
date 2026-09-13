import { beforeEach, expect, it, vi } from 'vitest';
import {
  addKanbanTask,
  attachKanbanTask,
  getKanbanTasks,
  kanbanTasksForWorkspace,
  removeKanbanTask,
  renameKanbanTask,
  setKanbanTaskStatus,
} from '../../src/renderer/session/kanbanTasks';
import { KANBAN_TASKS_STORAGE_KEY } from '../../src/renderer/session/helpers';

const disk = new Map<string, unknown>();

beforeEach(() => {
  for (const task of getKanbanTasks()) removeKanbanTask(task.id);
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

it('removes tasks and groups the remainder by workspace in stable order', () => {
  const first = addKanbanTask('w1', 'first')!;
  addKanbanTask('w2', 'other workspace');
  addKanbanTask('w1', 'second');
  removeKanbanTask(first.id);
  const w1 = kanbanTasksForWorkspace(getKanbanTasks(), 'w1');
  expect(w1.map(task => task.title)).toEqual(['second']);
  expect(kanbanTasksForWorkspace(getKanbanTasks(), 'w2')).toHaveLength(1);
  expect(kanbanTasksForWorkspace(getKanbanTasks(), 'gone')).toEqual([]);
});
