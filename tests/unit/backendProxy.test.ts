// @vitest-environment node

import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseBackendList } from '../../server/backends';
import { createWebServer, shutdownWebServer } from '../../server/index';

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((run) => run()));
});

async function listen(server: Server): Promise<string> {
  const sockets = new Set<import('node:net').Socket>();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not bind');
  cleanup.push(() => new Promise<void>((resolve) => {
    // Upgraded sockets are no longer tracked by the HTTP server.
    for (const socket of sockets) socket.destroy();
    server.close(() => resolve());
  }));
  return `http://127.0.0.1:${address.port}`;
}

type Seen = { method?: string; url?: string; headers: IncomingHttpHeaders; body: string };

/** A stand-in backend: echoes REST requests and greets WebSockets. */
async function fakeBackend() {
  const seen: Seen[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      seen.push({ method: request.method, url: request.url, headers: request.headers, body });
      response.writeHead(201, { 'content-type': 'application/json', 'set-cookie': 'leak=1', 'x-backend': 'yes' });
      response.end(JSON.stringify({ path: request.url }));
    });
  });
  server.on('upgrade', (request, socket) => {
    seen.push({ method: request.method, url: request.url, headers: request.headers, body: '' });
    if (request.url?.includes('deny')) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
      return;
    }
    const accept = createHash('sha1')
      .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const payload = Buffer.from('hello');
    socket.write(Buffer.concat([Buffer.from([0x81, payload.length]), payload]));
  });
  return { seen, origin: await listen(server) };
}

async function webServer(backendsEnv: string) {
  const clientDirectory = await mkdtemp(join(tmpdir(), 'todex-web-proxy-'));
  cleanup.push(() => rm(clientDirectory, { recursive: true, force: true }));
  await writeFile(join(clientDirectory, 'index.html'), '<!doctype html><title>TodeX Test</title>');
  return listen(createWebServer({ clientDirectory, backends: parseBackendList(backendsEnv) }));
}

describe('parseBackendList', () => {
  it('reads named and bare entries and derives unique ids', () => {
    const backends = parseBackendList(' Home=http://192.168.1.20:7345/ ,\nhttps://office.lan:7345/api/,Home=wss://h2.lan ');
    expect(backends.map(({ id, name, target }) => [id, name, target.toString()])).toEqual([
      ['home', 'Home', 'http://192.168.1.20:7345/'],
      ['office-lan-7345', 'office.lan:7345', 'https://office.lan:7345/api'],
      ['home-2', 'Home', 'https://h2.lan/'],
    ]);
    expect(parseBackendList(undefined)).toEqual([]);
    expect(parseBackendList(' , ')).toEqual([]);
  });

  it('rejects URLs a deployment should not carry', () => {
    expect(() => parseBackendList('ftp://h')).toThrow(/http, https, ws or wss/);
    expect(() => parseBackendList('http://user:pw@h')).toThrow(/credentials/);
    expect(() => parseBackendList('X=http://h/?token=1')).toThrow(/query/);
    expect(() => parseBackendList('http://[bad')).toThrow(/not a valid URL/);
  });
});

describe('managed deployment', () => {
  it('publishes ids and names only, redirects home and locks connect-src', async () => {
    const backend = await fakeBackend();
    const origin = await webServer(`Home=${backend.origin}`);
    const config = await fetch(`${origin}/api/config`);
    expect(await config.json()).toEqual({ managed: true, backends: [{ id: 'home', name: 'Home' }] });

    const home = await fetch(`${origin}/`, { redirect: 'manual' });
    expect(home.status).toBe(302);
    expect(home.headers.get('location')).toBe('/app');
    const app = await fetch(`${origin}/app`);
    expect(app.headers.get('content-security-policy')).toContain("connect-src 'self';");
  });

  it('proxies REST under the prefix with a fixed non-local Origin', async () => {
    const backend = await fakeBackend();
    const origin = await webServer(`Home=${backend.origin}`);
    const response = await fetch(`${origin}/backend/home/v2/sealed?x=1`, {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        cookie: 'session=1',
        'x-todex-device-id': 'dev',
        'x-forwarded-for': '203.0.113.9',
        'x-real-ip': '203.0.113.9',
        forwarded: 'for=203.0.113.9',
      },
      body: 'sealed-bytes',
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('x-backend')).toBe('yes');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toBe("sandbox; default-src 'none'");
    expect(await response.json()).toEqual({ path: '/v2/sealed?x=1' });
    const [request] = backend.seen;
    expect(request.method).toBe('POST');
    expect(request.body).toBe('sealed-bytes');
    expect(request.headers.origin).toBe('https://todex-web.invalid');
    expect(request.headers.host).toBe(new URL(backend.origin).host);
    expect(request.headers.cookie).toBeUndefined();
    expect(request.headers['x-todex-device-id']).toBe('dev');
    // Client-supplied forwarding headers are replaced by the real peer, so
    // the backend sees a forwarded (never local) request.
    expect(request.headers['x-forwarded-for']).toBe('127.0.0.1');
    expect(request.headers['x-real-ip']).toBeUndefined();
    expect(request.headers.forwarded).toBeUndefined();

    // Same-origin GETs carry no Origin; the proxy still adds the fixed one.
    await fetch(`${origin}/backend/home/health`);
    expect(backend.seen[1].headers.origin).toBe('https://todex-web.invalid');
  });

  it('answers 404 for an unknown backend and 502 when the backend is down', async () => {
    const down = createServer();
    const downOrigin = await listen(down);
    await new Promise<void>((resolve) => down.close(() => resolve()));
    const origin = await webServer(`Down=${downOrigin}`);
    const missing = await fetch(`${origin}/backend/nope/health`);
    expect(missing.status).toBe(404);
    expect((await missing.json()).code).toBe('BACKEND_NOT_FOUND');
    const unreachable = await fetch(`${origin}/backend/down/health`);
    expect(unreachable.status).toBe(502);
    expect((await unreachable.json()).code).toBe('BACKEND_UNREACHABLE');
  });

  it('proxies WebSocket upgrades and relays a refused upgrade', async () => {
    const backend = await fakeBackend();
    const origin = await webServer(`Home=${backend.origin}`);
    const ws = origin.replace(/^http/, 'ws');
    const message = await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(`${ws}/backend/home/v2/ws?tv=2`);
      socket.onmessage = (event) => { resolve(String(event.data)); socket.close(); };
      socket.onerror = () => reject(new Error('socket failed'));
    });
    expect(message).toBe('hello');
    expect(backend.seen[0].url).toBe('/v2/ws?tv=2');
    expect(backend.seen[0].headers.origin).toBe('https://todex-web.invalid');
    expect(backend.seen[0].headers['x-forwarded-for']).toBe('127.0.0.1');

    await expect(new Promise((resolve, reject) => {
      const socket = new WebSocket(`${ws}/backend/home/v2/ws?deny=1`);
      socket.onopen = resolve;
      socket.onerror = () => reject(new Error('refused'));
    })).rejects.toThrow('refused');
    await expect(new Promise((resolve, reject) => {
      const socket = new WebSocket(`${ws}/somewhere-else`);
      socket.onopen = resolve;
      socket.onerror = () => reject(new Error('refused'));
    })).rejects.toThrow('refused');
  });

  it('breaks the client response when the backend fails mid-body', async () => {
    const broken = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/plain', 'content-length': '100' });
      response.write('partial');
      setTimeout(() => response.socket?.destroy(), 20);
    });
    const brokenOrigin = await listen(broken);
    const origin = await webServer(`Broken=${brokenOrigin}`);
    const response = await fetch(`${origin}/backend/broken/stream`);
    expect(response.status).toBe(200);
    await expect(response.text()).rejects.toThrow();
  });

  it('cuts proxied WebSockets when the server shuts down', async () => {
    const backend = await fakeBackend();
    const clientDirectory = await mkdtemp(join(tmpdir(), 'todex-web-proxy-'));
    cleanup.push(() => rm(clientDirectory, { recursive: true, force: true }));
    const server = createWebServer({ clientDirectory, backends: parseBackendList(`Home=${backend.origin}`) });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server did not bind');
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/backend/home/v2/ws?tv=2`);
    await new Promise<void>((resolve, reject) => {
      socket.onmessage = () => resolve();
      socket.onerror = () => reject(new Error('socket failed'));
    });
    const closed = new Promise<void>((resolve) => { socket.onclose = () => resolve(); });
    await shutdownWebServer(server, 10);
    await closed;
    expect(server.listening).toBe(false);
  });
});

describe('unmanaged deployment', () => {
  it('keeps the public site and has no backend proxy', async () => {
    const origin = await webServer('');
    expect(await (await fetch(`${origin}/api/config`)).json()).toEqual({ managed: false, backends: [] });
    const home = await fetch(`${origin}/`, { redirect: 'manual' });
    expect(home.status).toBe(200);
    expect(home.headers.get('content-security-policy')).toContain("connect-src 'self' http: https: ws: wss:");
    const proxied = await fetch(`${origin}/backend/home/health`);
    expect(await proxied.text()).toContain('TodeX Test');
  });
});
