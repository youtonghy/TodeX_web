import { normalizeServerUrl, type BackendConnectionProfile } from '@todex/protocol/todex';
import type { WebDeployment } from '../../preload/index';

const CONFIG_TIMEOUT_MS = 5000;

/** Reads the server's deployment config; null when the server pins no
 * backends or cannot say (the workbench then behaves as on the public site). */
export async function loadWebDeployment(fetchImpl: typeof fetch = fetch): Promise<WebDeployment | null> {
  try {
    const response = await fetchImpl('/api/config', { cache: 'no-store', signal: AbortSignal.timeout(CONFIG_TIMEOUT_MS) });
    if (!response.ok) return null;
    const body = await response.json() as Partial<WebDeployment>;
    const backends = Array.isArray(body.backends)
      ? body.backends.filter((item): item is WebDeployment['backends'][number] => typeof item?.id === 'string' && Boolean(item.id) && typeof item.name === 'string')
      : [];
    return body.managed === true && backends.length ? { managed: true, backends } : null;
  } catch {
    return null;
  }
}

export function managedBackendProfileId(backendId: string): string {
  return `deploy-${backendId}`;
}

/** The address this page reaches a deployed backend at (the server's proxy). */
export function managedBackendUrl(backendId: string, pageOrigin = window.location.origin): string {
  return normalizeServerUrl(`${pageOrigin}/backend/${encodeURIComponent(backendId)}`);
}

/**
 * The backend list of a managed deployment: exactly the deployed backends,
 * in deploy order. A stored profile with the same id and address keeps its
 * device key, transport pin and the user's name/colour; everything else
 * (backends added earlier on this origin, a changed address) is dropped.
 */
export function managedBackendProfiles<Profile extends BackendConnectionProfile>(
  deployment: WebDeployment,
  stored: Profile[],
  template: Profile,
  pageOrigin = window.location.origin,
  now = Date.now(),
): Profile[] {
  return deployment.backends.map((backend) => {
    const id = managedBackendProfileId(backend.id);
    const serverUrl = managedBackendUrl(backend.id, pageOrigin);
    const existing = stored.find((profile) => profile.id === id && normalizeServerUrl(profile.serverUrl) === serverUrl);
    if (existing) return { ...existing, serverUrl };
    return {
      ...template,
      id,
      name: backend.name,
      serverUrl,
      deviceSecret: '',
      encryptionProtocol: 'none',
      encryptionPublicKey: '',
      transportVerified: false,
      createdAt: now,
      updatedAt: now,
    };
  });
}
