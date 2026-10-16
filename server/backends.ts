import { request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { Duplex } from 'node:stream';

/** A TodeX backend fixed at deploy time (`TODEX_BACKENDS`), reached only
 * through this server at `/backend/<id>/…`. */
export type DeployedBackend = { id: string; name: string; target: URL };

/** What the browser learns about the deployment: never the target URLs. */
export type DeploymentConfig = { managed: boolean; backends: { id: string; name: string }[] };

export const BACKEND_PROXY_PREFIX = '/backend/';

// Sent as `Origin` on every proxied request. The backend grants anonymous
// (no device auth) access only to a loopback Host plus a loopback or absent
// Origin; a fixed non-local Origin keeps a deployment behind this proxy from
// ever reaching that path, whatever headers the caller sends.
const PROXY_ORIGIN = 'https://todex-web.invalid';

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'origin', 'cookie', 'forwarded',
  'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip',
]);
const MAX_NAME_LENGTH = 80;

function slug(value: string): string {
  return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/**
 * Parses `TODEX_BACKENDS`: entries separated by commas or newlines, each
 * `Name=URL` or just `URL` (named after its host). Throws on anything that is
 * not a plain http(s)/ws(s) URL so a misconfigured deployment fails at start.
 */
export function parseBackendList(raw: string | undefined): DeployedBackend[] {
  const backends: DeployedBackend[] = [];
  const used = new Set<string>();
  for (const entry of (raw ?? '').split(/[,\n]/).map((item) => item.trim()).filter(Boolean)) {
    const separator = entry.indexOf('=');
    const named = separator > 0 && !entry.slice(0, separator).includes('://');
    const address = (named ? entry.slice(separator + 1) : entry).trim();
    let target: URL;
    try {
      target = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(address) ? address : `http://${address}`);
    } catch {
      throw new Error(`TODEX_BACKENDS: "${address}" is not a valid URL`);
    }
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(target.protocol)) {
      throw new Error(`TODEX_BACKENDS: "${address}" must use http, https, ws or wss`);
    }
    if (target.username || target.password || target.search || target.hash) {
      throw new Error(`TODEX_BACKENDS: "${address}" must not carry credentials, a query or a fragment`);
    }
    target.protocol = target.protocol === 'wss:' || target.protocol === 'https:' ? 'https:' : 'http:';
    target.pathname = target.pathname.replace(/\/+$/, '');
    const name = (named ? entry.slice(0, separator).trim() : '') || target.host;
    if (name.length > MAX_NAME_LENGTH) throw new Error(`TODEX_BACKENDS: name "${name}" is longer than ${MAX_NAME_LENGTH} characters`);
    const base = slug(name) || 'backend';
    let id = base;
    for (let index = 2; used.has(id); index += 1) id = `${base}-${index}`;
    used.add(id);
    backends.push({ id, name, target });
  }
  return backends;
}

export function deploymentConfig(backends: DeployedBackend[]): DeploymentConfig {
  return { managed: backends.length > 0, backends: backends.map(({ id, name }) => ({ id, name })) };
}

function forwardedHeaders(headers: IncomingHttpHeaders, target: URL, keepUpgrade: boolean): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || HOP_BY_HOP.has(name)) continue;
    out[name] = value;
  }
  out.host = target.host;
  out.origin = PROXY_ORIGIN;
  if (keepUpgrade) {
    out.connection = 'Upgrade';
    out.upgrade = typeof headers.upgrade === 'string' ? headers.upgrade : 'websocket';
  }
  return out;
}

function responseHeaders(headers: IncomingHttpHeaders): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || name === 'set-cookie' || (HOP_BY_HOP.has(name) && name !== 'upgrade')) continue;
    out[name] = value;
  }
  return out;
}

export type BackendProxy = {
  /** Express-style middleware: answers `/backend/<id>/…`, passes the rest on. */
  handleRequest(request: IncomingMessage, response: ServerResponse, next: () => void): void;
  /** `upgrade` listener: proxies WebSockets under `/backend/<id>/`; returns
   * false (leaving the socket alone) for any other path. */
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean;
};

export function createBackendProxy(backends: DeployedBackend[]): BackendProxy {
  const byId = new Map(backends.map((backend) => [backend.id, backend]));

  const resolve = (url: string | undefined): { backend: DeployedBackend | null; path: string } | null => {
    if (!url?.startsWith(BACKEND_PROXY_PREFIX)) return null;
    const rest = url.slice(BACKEND_PROXY_PREFIX.length);
    const end = rest.search(/[/?]/);
    const id = end === -1 ? rest : rest.slice(0, end);
    const remainder = end === -1 ? '' : rest.slice(end);
    let backend: DeployedBackend | null = null;
    try {
      backend = byId.get(decodeURIComponent(id)) ?? null;
    } catch {
      // Malformed escapes name no backend.
    }
    const path = remainder.startsWith('/') ? remainder : `/${remainder}`;
    return { backend, path: backend ? `${backend.target.pathname.replace(/\/$/, '')}${path}` : path };
  };

  const send = (backend: DeployedBackend, path: string, request: IncomingMessage, upgrade: boolean) => {
    const issue = backend.target.protocol === 'https:' ? httpsRequest : httpRequest;
    return issue({
      protocol: backend.target.protocol,
      hostname: backend.target.hostname.replace(/^\[|\]$/g, ''),
      port: backend.target.port || undefined,
      method: request.method,
      path,
      headers: forwardedHeaders(request.headers, backend.target, upgrade),
    });
  };

  const json = (response: ServerResponse, status: number, code: string, message: string) => {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ code, message }));
  };

  return {
    handleRequest(request, response, next) {
      const resolved = resolve(request.url);
      if (!resolved) {
        next();
        return;
      }
      if (!resolved.backend) {
        json(response, 404, 'BACKEND_NOT_FOUND', 'This deployment has no such backend.');
        return;
      }
      const upstream = send(resolved.backend, resolved.path, request, false);
      upstream.on('response', (answer) => {
        response.writeHead(answer.statusCode ?? 502, responseHeaders(answer.headers));
        answer.pipe(response);
      });
      upstream.on('error', () => {
        if (response.headersSent) response.destroy();
        else json(response, 502, 'BACKEND_UNREACHABLE', 'The backend did not answer.');
      });
      response.on('close', () => {
        if (!response.writableFinished) upstream.destroy();
      });
      request.pipe(upstream);
    },

    handleUpgrade(request, socket, head) {
      const resolved = resolve(request.url);
      if (!resolved) return false;
      if (!resolved.backend) {
        socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
        return true;
      }
      const upstream = send(resolved.backend, resolved.path, request, true);
      const fail = () => {
        if (socket.writable) socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
        else socket.destroy();
      };
      upstream.on('error', fail);
      socket.on('error', () => upstream.destroy());
      upstream.on('upgrade', (answer, upstreamSocket, upstreamHead) => {
        const lines = [`HTTP/1.1 ${answer.statusCode ?? 101} ${answer.statusMessage ?? 'Switching Protocols'}`];
        for (const [name, value] of Object.entries(responseHeaders(answer.headers))) {
          for (const item of Array.isArray(value) ? value : [value]) lines.push(`${name}: ${item}`);
        }
        lines.push('Connection: Upgrade');
        socket.write(`${lines.join('\r\n')}\r\n\r\n`);
        if (upstreamHead.length) socket.write(upstreamHead);
        if (head.length) upstreamSocket.write(head);
        upstreamSocket.on('error', () => socket.destroy());
        socket.on('close', () => upstreamSocket.destroy());
        upstreamSocket.on('close', () => socket.destroy());
        upstreamSocket.pipe(socket);
        socket.pipe(upstreamSocket);
      });
      upstream.on('response', (answer) => {
        // The backend refused the upgrade (e.g. 401): relay its answer and close.
        const lines = [`HTTP/1.1 ${answer.statusCode ?? 502} ${answer.statusMessage ?? ''}`];
        for (const [name, value] of Object.entries(responseHeaders(answer.headers))) {
          for (const item of Array.isArray(value) ? value : [value]) lines.push(`${name}: ${item}`);
        }
        lines.push('Connection: close');
        socket.write(`${lines.join('\r\n')}\r\n\r\n`);
        answer.pipe(socket);
      });
      upstream.end();
      return true;
    },
  };
}
