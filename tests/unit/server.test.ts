// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, type WebServerOptions } from '../../server/index';
import { createReleaseCatalogHandler } from '../../server/releases';

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function withServer(run: (origin: string) => Promise<void>, options: WebServerOptions = {}, prepare?: (clientDirectory: string) => Promise<void>) {
  const clientDirectory = await mkdtemp(join(tmpdir(), 'todex-web-test-'));
  cleanup.push(clientDirectory);
  if (prepare) await prepare(clientDirectory);
  else await writeFile(join(clientDirectory, 'index.html'), '<!doctype html><title>TodeX Test</title>');
  const server = createServer(createApp({ clientDirectory, ...options }));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server did not bind');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function githubRelease(repository: string, tag: string, overrides: Record<string, unknown> = {}) {
  return {
    tag_name: tag,
    html_url: `https://github.com/${repository}/releases/tag/${tag}`,
    draft: false,
    prerelease: false,
    assets: [
      {
        name: `app-${tag}.tar.gz`,
        browser_download_url: `https://github.com/${repository}/releases/download/${tag}/app-${tag}.tar.gz`,
        size: 1024,
      },
    ],
    ...overrides,
  };
}

function githubResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('Node static server', () => {
  it('serves health, SPA fallback, and security headers without a Backend API', async () => {
    await withServer(async (origin) => {
      const health = await fetch(`${origin}/healthz`);
      expect(await health.json()).toEqual({ status: 'ok' });
      expect(health.headers.get('cache-control')).toBe('no-store');

      const page = await fetch(`${origin}/conversation/example`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('TodeX Test');
      expect(page.headers.get('content-security-policy')).toContain("script-src 'self'");
      expect(page.headers.get('content-security-policy')).not.toContain('upgrade-insecure-requests');
      // Only the landing page may frame the /demo workbench.
      expect(page.headers.get('content-security-policy')).toContain("frame-ancestors 'self'");
      expect(page.headers.get('x-frame-options')).toBe('SAMEORIGIN');

      const api = await fetch(`${origin}/api/connections`);
      expect(api.status).toBe(404);
    });
  });

  it('allows WebAssembly compilation and narrows images in a managed deployment', async () => {
    await withServer(async (origin) => {
      const csp = (await fetch(`${origin}/app`)).headers.get('content-security-policy');
      expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
      expect(csp).toContain("img-src 'self' data: blob: http: https:");
    });
    await withServer(async (origin) => {
      const csp = (await fetch(`${origin}/app`)).headers.get('content-security-policy');
      expect(csp).toContain("img-src 'self' data: blob:;");
    }, { backends: [{ id: 'home', name: 'Home', target: new URL('http://127.0.0.1:9') }] });
  });

  it('answers 404 for missing build assets and caches only hashed assets forever', async () => {
    await withServer(async (origin) => {
      const missing = await fetch(`${origin}/assets/index-DEADBEEF1.js`);
      expect(missing.status).toBe(404);
      expect(await missing.text()).not.toContain('TodeX Test');

      const hashed = await fetch(`${origin}/assets/index-AbCdEf123.js`);
      expect(hashed.status).toBe(200);
      expect(hashed.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
      const named = await fetch(`${origin}/images/logo-12345678.png`);
      expect(named.status).toBe(200);
      expect(named.headers.get('cache-control')).not.toContain('immutable');

      const page = await fetch(`${origin}/app`);
      expect(page.headers.get('cache-control')).toBe('no-store');
    }, {}, async (clientDirectory) => {
      await writeFile(join(clientDirectory, 'index.html'), '<!doctype html><title>TodeX Test</title>');
      await mkdir(join(clientDirectory, 'assets'));
      await writeFile(join(clientDirectory, 'assets', 'index-AbCdEf123.js'), 'export {};');
      await mkdir(join(clientDirectory, 'images'));
      await writeFile(join(clientDirectory, 'images', 'logo-12345678.png'), 'png');
    });
  });

  it('reports server errors without leaking their message', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // No client build: the SPA fallback fails with a message naming the build step.
      await withServer(async (origin) => {
        const response = await fetch(`${origin}/app`);
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ code: 'WEB_SERVER_ERROR', message: 'Unexpected server error.' });
      }, {}, async () => {});
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe('GET /api/releases', () => {
  it('filters unstable releases, sorts versions descending, and caches the response', async () => {
    const desktop = 'youtonghy/TodeX_desktop';
    const backend = 'youtonghy/TodeX_backend';
    const mockFetch = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes(desktop)) {
        return githubResponse([
          githubRelease(desktop, 'v1.9.0'),
          githubRelease(desktop, 'v2.0.0'),
          githubRelease(desktop, 'v9.9.9', { draft: true }),
          githubRelease(desktop, 'v2.1.0-rc.1', { prerelease: true }),
          githubRelease(desktop, 'latest'),
        ]);
      }
      return githubResponse([githubRelease(backend, 'v2.0.1')]);
    });
    const releasesHandler = createReleaseCatalogHandler({ fetch: mockFetch as unknown as typeof fetch, now: () => 1_000, ttlMs: 60_000 });
    await withServer(async (origin) => {
      const response = await fetch(`${origin}/api/releases`);
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('public, max-age=300');
      const catalog = await response.json();
      expect(catalog.stale).toBe(false);
      expect(typeof catalog.checkedAt).toBe('string');
      expect(catalog.desktop.map((release: { version: string }) => release.version)).toEqual(['v2.0.0', 'v1.9.0']);
      expect(catalog.desktop[0].assets).toEqual([{
        name: 'app-v2.0.0.tar.gz',
        url: `https://github.com/${desktop}/releases/download/v2.0.0/app-v2.0.0.tar.gz`,
        size: 1024,
      }]);
      expect(catalog.backend.map((release: { version: string }) => release.version)).toEqual(['v2.0.1']);

      // A second request inside the TTL is served from memory.
      const again = await fetch(`${origin}/api/releases`);
      expect(again.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2); // one call per product
    }, { releasesHandler });
  });

  it('serves the last good catalog with stale:true when a refresh fails', async () => {
    const desktop = 'youtonghy/TodeX_desktop';
    const backend = 'youtonghy/TodeX_backend';
    let failing = false;
    const mockFetch = vi.fn(async (input: unknown) => {
      if (failing) throw new Error('network down');
      const url = String(input);
      return githubResponse([githubRelease(url.includes(desktop) ? desktop : backend, 'v1.0.0')]);
    });
    let now = 0;
    const releasesHandler = createReleaseCatalogHandler({ fetch: mockFetch as unknown as typeof fetch, now: () => now, ttlMs: 60_000 });
    await withServer(async (origin) => {
      const first = await fetch(`${origin}/api/releases`);
      expect(first.status).toBe(200);

      now += 61_000;
      failing = true;
      const second = await fetch(`${origin}/api/releases`);
      expect(second.status).toBe(200);
      expect(second.headers.get('cache-control')).toBe('no-store');
      const catalog = await second.json();
      expect(catalog.stale).toBe(true);
      expect(catalog.desktop[0].version).toBe('v1.0.0');
    }, { releasesHandler });
  });

  it('returns 503 RELEASES_UNAVAILABLE when the first fetch fails', async () => {
    const mockFetch = vi.fn(async () => { throw new Error('network down'); });
    const releasesHandler = createReleaseCatalogHandler({ fetch: mockFetch as unknown as typeof fetch });
    await withServer(async (origin) => {
      const response = await fetch(`${origin}/api/releases`);
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect((await response.json()).code).toBe('RELEASES_UNAVAILABLE');

      const api = await fetch(`${origin}/api/connections`);
      expect(api.status).toBe(404);
    }, { releasesHandler });
  });
});
