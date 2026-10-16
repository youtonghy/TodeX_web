import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { createBackendProxy, deploymentConfig, parseBackendList } from './server/backends';
import { createReleaseCatalogHandler } from './server/releases';

const webRoot = import.meta.dirname;
const buildVersion = process.env.TODEX_BUILD_VERSION?.trim() || 'DEV0.0.0';

// Serves the same /api/releases catalog as the production Node server so
// `pnpm dev` exercises the live downloads flow.
const releasesApi: Plugin = {
  name: 'todex-releases-api',
  configureServer(server) {
    const handler = createReleaseCatalogHandler();
    server.middlewares.use('/api/releases', (req, res) => handler(req, res));
  },
};

// Mirrors the production server's managed mode: `TODEX_BACKENDS=… pnpm dev`
// serves /api/config and proxies /backend/<id>/ (REST and WebSocket).
const deploymentApi: Plugin = {
  name: 'todex-deployment-api',
  configureServer(server) {
    const backends = parseBackendList(process.env.TODEX_BACKENDS);
    const config = deploymentConfig(backends);
    server.middlewares.use('/api/config', (_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.setHeader('cache-control', 'no-store');
      res.end(JSON.stringify(config));
    });
    if (!backends.length) return;
    const proxy = createBackendProxy(backends);
    server.middlewares.use((req, res, next) => proxy.handleRequest(req, res, next));
    server.httpServer?.on('upgrade', (req, socket, head) => {
      proxy.handleUpgrade(req, socket, head);
    });
  },
};

export default defineConfig({
  define: {
    __TODEX_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [react(), tailwindcss(), releasesApi, deploymentApi],
  resolve: {
    dedupe: ['react', 'react-dom', '@heroui/react', 'react-aria-components'],
    alias: {
      // BoardUI components import through '@/…'.
      '@': resolve(webRoot, 'src/renderer'),
      '@renderer': resolve(webRoot, 'src/renderer'),
      '@todex/protocol': resolve(webRoot, '../TodeX_protocol/src'),
      '@react-native-community/netinfo': resolve(webRoot, 'src/renderer/stubs/netinfo.ts'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    outDir: 'dist-client',
    sourcemap: false,
  },
});
