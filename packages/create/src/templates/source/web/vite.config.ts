import path from 'node:path';

import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Plugin to stub Node.js built-in modules for browser compatibility.
 * This handles imports from node_modules that use node: protocol.
 */
function nodeBuiltinsPlugin(): Plugin {
  const nodeBuiltins = [
    'node:crypto',
    'node:module',
    'node:util',
    'node:fs',
    'node:fs/promises',
    'node:path',
    'node:url',
    'node:buffer',
    'node:stream',
    'node:events',
  ];

  return {
    name: 'stub-node-builtins',
    enforce: 'pre',
    resolveId(id) {
      if (nodeBuiltins.includes(id)) {
        return `\0virtual:${id}`;
      }
      return null;
    },
    load(id) {
      if (id.startsWith('\0virtual:node:')) {
        // Return empty stub module
        return 'export default {}; export const createRequire = () => () => ({});';
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [nodeBuiltinsPlugin(), tanstackRouter(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
      '@veloxts/validation',
      '@prisma/client',
      '@prisma/adapter-better-sqlite3',
      'better-sqlite3',
    ],
  },
  build: {
    rollupOptions: {
      external: [
        /^node:/,
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
