import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const webRoot = import.meta.dirname;

export default defineConfig({
  define: {
    __TODEX_BUILD_VERSION__: JSON.stringify('DEV0.0.0'),
  },
  resolve: {
    alias: {
      '@renderer': resolve(webRoot, 'src/renderer'),
      '@todex/protocol': resolve(webRoot, '../TodeX_app/src/lib'),
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
