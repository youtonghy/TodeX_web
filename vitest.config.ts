import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const webRoot = import.meta.dirname;

export default defineConfig({
  define: {
    __TODEX_BUILD_VERSION__: JSON.stringify('DEV0.0.0'),
  },
  resolve: {
    alias: {
      // BoardUI components import through '@/…'.
      '@': resolve(webRoot, 'src/renderer'),
      '@renderer': resolve(webRoot, 'src/renderer'),
      '@todex/protocol': resolve(webRoot, '../TodeX_protocol/src'),
      // Protocol sources import @noble/*: resolve them from this app (as the
      // desktop does), never a second copy under ../TodeX_protocol/node_modules.
      '@noble/ciphers': resolve(webRoot, 'node_modules/@noble/ciphers'),
      '@noble/curves': resolve(webRoot, 'node_modules/@noble/curves'),
      '@noble/hashes': resolve(webRoot, 'node_modules/@noble/hashes'),
      '@noble/post-quantum': resolve(webRoot, 'node_modules/@noble/post-quantum'),
      '@react-native-community/netinfo': resolve(webRoot, 'src/renderer/stubs/netinfo.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
