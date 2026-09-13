// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/index';

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function withServer(run: (origin: string) => Promise<void>) {
  const clientDirectory = await mkdtemp(join(tmpdir(), 'todex-web-test-'));
  cleanup.push(clientDirectory);
  await writeFile(join(clientDirectory, 'index.html'), '<!doctype html><title>TodeX Test</title>');
  const server = createServer(createApp({ clientDirectory }));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server did not bind');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
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

      const api = await fetch(`${origin}/api/connections`);
      expect(api.status).toBe(404);
    });
  });
});
