import type { ConnectionSettings } from '@todex/protocol/todex';
import { backendFetch } from '../session/helpers';

export type WorkspaceTrust = {
  workspacePath: string;
  trusted: boolean;
  trustedAt?: string;
};

async function request<T>(settings: ConnectionSettings, path: string, init: { method?: string; body?: string } = {}): Promise<T> {
  const response = await backendFetch(settings, {
    method: init.method ?? 'GET',
    path,
    headers: init.body
      ? { accept: 'application/json', 'content-type': 'application/json' }
      : { accept: 'application/json' },
    body: init.body,
  });
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const message = typeof body?.message === 'string' ? body.message : `Backend request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export function getWorkspaceTrust(settings: ConnectionSettings, workspaceId: string): Promise<WorkspaceTrust> {
  return request(settings, `/v2/workspaces/${encodeURIComponent(workspaceId)}/trust`);
}

export function setWorkspaceTrust(settings: ConnectionSettings, workspaceId: string, trusted: boolean): Promise<WorkspaceTrust> {
  return request(settings, `/v2/workspaces/${encodeURIComponent(workspaceId)}/trust`, {
    method: 'PUT',
    body: JSON.stringify({ trusted }),
  });
}
