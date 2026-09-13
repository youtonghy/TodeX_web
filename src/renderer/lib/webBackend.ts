import { buildHttpUrl, type ConnectionSettings } from '@todex/protocol/todex';

export type WorkspaceTrust = {
  workspacePath: string;
  trusted: boolean;
  trustedAt?: string;
};

async function request<T>(settings: ConnectionSettings, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (settings.authToken) headers.set('Authorization', `Bearer ${settings.authToken}`);
  const response = await fetch(buildHttpUrl(settings.serverUrl, path), { ...init, headers });
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
