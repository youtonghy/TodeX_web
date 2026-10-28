import compression from 'compression';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackendProxy, deploymentConfig, parseBackendList, type BackendProxy, type DeployedBackend } from './backends.js';
import { createReleaseCatalogHandler } from './releases.js';

export type WebServerOptions = {
  clientDirectory?: string;
  releasesHandler?: (request: IncomingMessage, response: ServerResponse) => void;
  /** Backends fixed at deploy time; non-empty turns on the managed mode. */
  backends?: DeployedBackend[];
};

export function createApp(options: WebServerOptions = {}): Express {
  const serverDirectory = fileURLToPath(new URL('.', import.meta.url));
  const clientDirectory = options.clientDirectory ?? resolve(serverDirectory, '../../dist-client');
  const indexPath = resolve(clientDirectory, 'index.html');
  const backends = options.backends ?? [];
  const managed = backends.length > 0;
  const app = express();

  app.disable('x-powered-by');
  // Before compression and helmet: proxied responses (sealed streams) pass
  // through untouched.
  if (managed) app.use(createBackendProxy(backends).handleRequest);
  app.use(compression());
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Shiki compiles its Oniguruma regex engine from WebAssembly.
        scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        // A managed deployment shows only its own and generated images.
        imgSrc: managed ? ["'self'", 'data:', 'blob:'] : ["'self'", 'data:', 'blob:', 'http:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        // A managed deployment reaches its backends only through /backend/<id>.
        connectSrc: managed ? ["'self'"] : ["'self'", 'http:', 'https:', 'ws:', 'wss:'],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        // The landing page embeds the /demo workbench; other origins still cannot frame us.
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
  }));

  app.get('/healthz', (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.json({ status: 'ok' });
  });

  const config = deploymentConfig(backends);
  app.get('/api/config', (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.json(config);
  });

  app.get('/api/releases', options.releasesHandler ?? createReleaseCatalogHandler());

  app.use('/api', (_request, response) => {
    response.status(404).json({ code: 'NOT_FOUND', message: 'TodeX Web has no server-side Backend API.' });
  });

  if (managed) {
    // A self-hosted deployment opens straight into the workbench.
    app.get('/', (_request, response) => response.redirect(302, '/app'));
  }

  const assetsDirectory = resolve(clientDirectory, 'assets');
  app.use(express.static(clientDirectory, {
    etag: true,
    fallthrough: true,
    index: false,
    setHeaders(response, path) {
      // Only Vite's content-hashed build output is immutable; the test runs on
      // the path inside assets/, never on the deployment's own directories.
      const inAssets = relative(assetsDirectory, path);
      if (!inAssets.startsWith('..') && !isAbsolute(inAssets) && /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(inAssets)) {
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  // A missing build asset (e.g. a chunk from an older deploy) is a 404, not
  // the SPA page, which a browser would try to run as a script.
  app.use('/assets', (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.status(404).type('text/plain').send('Not found');
  });

  app.get(/.*/, (_request, response, next) => {
    if (!existsSync(indexPath)) {
      next(new Error('TodeX Web client build is missing. Run pnpm build first.'));
      return;
    }
    response.setHeader('Cache-Control', 'no-store');
    response.sendFile(indexPath);
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    // Never echo error.message: it can carry filesystem paths.
    const status = clientErrorStatus(error);
    if (status) {
      response.status(status).json({ code: 'BAD_REQUEST', message: 'The request could not be processed.' });
      return;
    }
    console.error('[web] request failed:', error);
    response.status(500).json({ code: 'WEB_SERVER_ERROR', message: 'Unexpected server error.' });
  });

  return app;
}

/** The 4xx status an error carries (`status` / `statusCode`, as set by
 * body parsers and `send`), or null for anything else. */
function clientErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  const value = typeof status === 'number' ? status : statusCode;
  return typeof value === 'number' && Number.isInteger(value) && value >= 400 && value < 500 ? value : null;
}

const proxies = new WeakMap<Server, BackendProxy>();

/** The HTTP server for `createApp`, with WebSocket upgrades proxied to the
 * deployed backends (and refused otherwise). */
export function createWebServer(options: WebServerOptions = {}): Server {
  const server = createServer(createApp(options));
  const proxy = createBackendProxy(options.backends ?? []);
  proxies.set(server, proxy);
  server.on('upgrade', (request, socket, head) => {
    if (!proxy.handleUpgrade(request, socket, head)) socket.destroy();
  });
  return server;
}

/**
 * Stops accepting connections, lets in-flight requests finish for
 * `graceMs`, then cuts what is left, including proxied WebSockets (which the
 * HTTP server no longer tracks and would otherwise hold it open forever).
 */
export function shutdownWebServer(server: Server, graceMs = 3_000): Promise<void> {
  return new Promise((resolveClosed) => {
    server.close(() => resolveClosed());
    server.closeIdleConnections();
    setTimeout(() => {
      proxies.get(server)?.destroyUpgradedSockets();
      server.closeAllConnections();
    }, graceMs).unref();
  });
}

if (process.env.NODE_ENV !== 'test') {
  let backends: DeployedBackend[];
  try {
    backends = parseBackendList(process.env.TODEX_BACKENDS);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  const requestedPort = Number.parseInt(process.env.PORT || '4173', 10);
  const port = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65_535 ? requestedPort : 4173;
  const host = process.env.HOST || '0.0.0.0';
  const server = createWebServer({ backends }).listen(port, host, () => {
    console.log(`TodeX Web listening on http://${host}:${port}`);
    for (const backend of backends) console.log(`  backend ${backend.id} (${backend.name}) -> ${backend.target.origin}${backend.target.pathname}`);
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    void shutdownWebServer(server).then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
