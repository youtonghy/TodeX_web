// Mirror of the shapes served by the Node server's GET /api/releases
// (server/releases.ts). Kept as a separate declaration because the renderer
// and server compile under different tsconfigs.
export type ReleaseAsset = { name: string; url: string; size: number };
export type Release = { version: string; url: string; assets: ReleaseAsset[] };
export type ReleaseCatalog = { checkedAt: string; stale: boolean; desktop: Release[]; backend: Release[] };

export async function loadReleaseCatalog(signal?: AbortSignal): Promise<ReleaseCatalog> {
  const response = await fetch('/api/releases', { signal });
  if (!response.ok) throw new Error(`Release catalog request failed with status ${response.status}`);
  return (await response.json()) as ReleaseCatalog;
}
