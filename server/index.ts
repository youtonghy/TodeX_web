import compression from 'compression';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReleaseCatalogHandler } from './releases.js';

export type WebServerOptions = {
  clientDirectory?: string;
  releasesHandler?: (request: IncomingMessage, response: ServerResponse) => void;
};

export function createApp(options: WebServerOptions = {}): Express {
  const serverDirectory = fileURLToPath(new URL('.', import.meta.url));
  const clientDirectory = options.clientDirectory ?? resolve(serverDirectory, '../../dist-client');
  const indexPath = resolve(clientDirectory, 'index.html');
  const app = express();

  app.disable('x-powered-by');
  app.use(compression());
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'http:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'http:', 'https:', 'ws:', 'wss:'],
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

  app.get('/api/releases', options.releasesHandler ?? createReleaseCatalogHandler());

  app.use('/api', (_request, response) => {
    response.status(404).json({ code: 'NOT_FOUND', message: 'TodeX Web has no server-side Backend API.' });
  });

  app.use(express.static(clientDirectory, {
    etag: true,
    fallthrough: true,
    index: false,
    setHeaders(response, path) {
      if (/-[A-Za-z0-9_-]{8,}\./.test(path)) {
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  app.get(/.*/, (_request, response, next) => {
    if (!existsSync(indexPath)) {
      next(new Error('TodeX Web client build is missing. Run pnpm build first.'));
      return;
    }
    response.setHeader('Cache-Control', 'no-store');
    response.sendFile(indexPath);
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _next;
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    response.status(500).json({ code: 'WEB_SERVER_ERROR', message });
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const requestedPort = Number.parseInt(process.env.PORT || '4173', 10);
  const port = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65_535 ? requestedPort : 4173;
  const host = process.env.HOST || '0.0.0.0';
  const server = createApp().listen(port, host, () => {
    console.log(`TodeX Web listening on http://${host}:${port}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
