import path from 'node:path';

import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Stub for Node.js built-in modules (for browser compatibility)
const nodeBuiltinStub = 'export default {}';

export default defineConfig({
  plugins: [tanstackRouter(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Stub Node.js built-ins that get pulled in via type imports
      'node:crypto': `data:text/javascript,${nodeBuiltinStub}`,
      'node:module': `data:text/javascript,${nodeBuiltinStub}`,
      'node:util': `data:text/javascript,${nodeBuiltinStub}`,
      'node:fs': `data:text/javascript,${nodeBuiltinStub}`,
      'node:path': `data:text/javascript,${nodeBuiltinStub}`,
    },
  },
  // Define process.env for browser compatibility
  define: {
    'process.env': {},
  },
  // Exclude server-side packages from dependency optimization
  optimizeDeps: {
    exclude: [
      'bcrypt',
      '@mapbox/node-pre-gyp',
      'dotenv',
      '@veloxts/velox',
      '@veloxts/auth',
      '@veloxts/router',
      '@veloxts/orm',
      '@veloxts/core',
      '@prisma/client',
      '@prisma/adapter-better-sqlite3',
      'better-sqlite3',
    ],
  },
  // Mark Node.js modules as external for SSR compatibility
  ssr: {
    noExternal: ['@veloxts/client'],
  },
  build: {
    rollupOptions: {
      external: [
        'node:crypto',
        'node:module',
        'node:util',
        'node:fs',
        'node:path',
      ],
    },
  },
  server: {
    port: __WEB_PORT__,
    proxy: {
      '/api': {
        target: 'http://localhost:__API_PORT__',
        changeOrigin: true,
      },
    },
  },
});
