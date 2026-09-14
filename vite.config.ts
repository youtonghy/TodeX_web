import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
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

export default defineConfig({
  define: {
    __TODEX_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [react(), tailwindcss(), releasesApi],
  resolve: {
    dedupe: ['react', 'react-dom', '@heroui/react', 'react-aria-components'],
    alias: {
      '@renderer': resolve(webRoot, 'src/renderer'),
      '@todex/protocol': resolve(webRoot, '../TodeX_app/src/lib'),
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
