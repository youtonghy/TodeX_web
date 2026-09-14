import type { IncomingMessage, ServerResponse } from 'node:http';

export type ReleaseAsset = { name: string; url: string; size: number };
export type Release = { version: string; url: string; assets: ReleaseAsset[] };
export type ReleaseCatalog = { checkedAt: string; stale: boolean; desktop: Release[]; backend: Release[] };
export type ReleaseCatalogOptions = {
  fetch?: typeof fetch;
  token?: string;
  ttlMs?: number;
  timeoutMs?: number;
  now?: () => number;
};

const products = ['desktop', 'backend'] as const;
const repositories: Record<(typeof products)[number], string> = {
  desktop: 'youtonghy/TodeX_desktop',
  backend: 'youtonghy/TodeX_backend',
};

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 10_000;
const STABLE_TAG = /^v\d+\.\d+\.\d+$/;

type GitHubAsset = { name: string; browser_download_url: string; size: number };
type GitHubRelease = { tag_name: string; html_url: string; draft: boolean; prerelease: boolean; assets: GitHubAsset[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Validates the GitHub API payload at runtime so a malformed response can never
// turn into a partially broken download catalog.
function parseReleases(payload: unknown, repository: string): GitHubRelease[] {
  if (!Array.isArray(payload)) throw new Error(`${repository}: GitHub returned a non-array releases payload`);
  return payload.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`${repository}: release ${index} is not an object`);
    const { tag_name, html_url, draft, prerelease, assets } = entry;
    if (typeof tag_name !== 'string' || typeof html_url !== 'string' || typeof draft !== 'boolean'
      || typeof prerelease !== 'boolean' || !Array.isArray(assets)) {
      throw new Error(`${repository}: release ${index} has an unexpected shape`);
    }
    const parsedAssets = assets.map((asset, assetIndex): GitHubAsset => {
      if (!isRecord(asset) || typeof asset.name !== 'string' || typeof asset.browser_download_url !== 'string'
        || typeof asset.size !== 'number' || !Number.isFinite(asset.size)) {
        throw new Error(`${repository}: asset ${assetIndex} of ${tag_name} has an unexpected shape`);
      }
      return { name: asset.name, browser_download_url: asset.browser_download_url, size: asset.size };
    });
    return { tag_name, html_url, draft, prerelease, assets: parsedAssets };
  });
}

// Fetches the published stable releases for both products from the GitHub API.
// Throws a descriptive error on any HTTP, network, or schema failure.
export async function fetchReleaseCatalog(options: ReleaseCatalogOptions = {}): Promise<ReleaseCatalog> {
  const fetchImpl = options.fetch ?? fetch;
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'TodeX-website',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const catalog: ReleaseCatalog = { checkedAt: new Date().toISOString(), stale: false, desktop: [], backend: [] };
  for (const product of products) {
    const repository = repositories[product];
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/releases?per_page=100`, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`${repository}: GitHub returned ${response.status}`);
    const releases = parseReleases(await response.json(), repository)
      .filter((release) => !release.draft && !release.prerelease && STABLE_TAG.test(release.tag_name))
      .sort((a, b) => b.tag_name.localeCompare(a.tag_name, undefined, { numeric: true }))
      .map((release): Release => ({
        version: release.tag_name,
        url: release.html_url,
        assets: release.assets.map((asset) => {
          if (!asset.browser_download_url.startsWith(`https://github.com/${repository}/releases/download/`)) {
            throw new Error(`Unexpected asset URL for ${asset.name}`);
          }
          return { name: asset.name, url: asset.browser_download_url, size: asset.size };
        }),
      }));
    if (!releases.length) throw new Error(`No stable releases for ${repository}`);
    catalog[product] = releases;
  }
  return catalog;
}

// Serves GET /api/releases with an in-memory cache. Cold or expired requests
// share one in-flight GitHub fetch; a failed refresh falls back to the last
// good catalog flagged as stale, or to 503 when nothing was ever fetched.
export function createReleaseCatalogHandler(options: ReleaseCatalogOptions = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now ?? Date.now;
  const fetchOptions: ReleaseCatalogOptions = {
    fetch: options.fetch,
    token: options.token,
    timeoutMs: options.timeoutMs,
    now: options.now,
  };
  let cache: { catalog: ReleaseCatalog; expiresAt: number } | null = null;
  let inFlight: Promise<ReleaseCatalog> | null = null;

  const refresh = (): Promise<ReleaseCatalog> => {
    inFlight ??= fetchReleaseCatalog(fetchOptions).finally(() => { inFlight = null; });
    return inFlight;
  };

  const send = (response: ServerResponse, status: number, body: unknown, cacheControl: string, head: boolean): void => {
    const payload = JSON.stringify(body);
    response.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      'Cache-Control': cacheControl,
    });
    response.end(head ? undefined : payload);
  };

  return (request: IncomingMessage, response: ServerResponse): void => {
    const head = request.method === 'HEAD';
    if (request.method !== 'GET' && !head) {
      send(response, 405, { code: 'METHOD_NOT_ALLOWED', message: 'Only GET and HEAD are supported.' }, 'no-store', false);
      return;
    }
    const cached = cache;
    if (cached && cached.expiresAt > now()) {
      send(response, 200, { ...cached.catalog, stale: false }, 'public, max-age=300', head);
      return;
    }
    void refresh().then((catalog) => {
      cache = { catalog, expiresAt: now() + ttlMs };
      send(response, 200, { ...catalog, stale: false }, 'public, max-age=300', head);
    }).catch((error: unknown) => {
      if (cached) {
        console.warn('[releases] refresh failed, serving the last good catalog:', error instanceof Error ? error.message : error);
        send(response, 200, { ...cached.catalog, stale: true }, 'no-store', head);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unexpected release catalog error';
      send(response, 503, { code: 'RELEASES_UNAVAILABLE', message }, 'no-store', head);
    });
  };
}
