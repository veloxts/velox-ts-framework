import path from 'node:path';

import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Plugin to stub Node.js built-ins for browser builds.
 *
 * When the frontend imports types from the API (e.g., AppRouter), Vite follows
 * the import chain and encounters Node.js modules from @veloxts/* packages.
 * This plugin provides empty stubs so the build completes.
 *
 * NOTE: These stubs never execute in the browser - they only exist to satisfy
 * Rollup's bundle analysis. The actual code paths using these are server-only.
 */
function nodeBuiltinsPlugin(): Plugin {
  const stubs: Record<string, string> = {
    'node:util': 'export const promisify = (fn) => fn; export const deprecate = (fn) => fn; export default {};',
    'node:crypto': 'export const randomBytes = () => new Uint8Array(0); export const scrypt = () => {}; export const timingSafeEqual = () => true; export const createHmac = () => ({ update: () => ({ digest: () => "" }) }); export const createHash = () => ({ update: () => ({ digest: () => "" }) }); export default {};',
    'node:module': 'export const createRequire = () => () => ({}); export default {};',
    'node:fs': 'export const readFileSync = () => ""; export const existsSync = () => false; export default {};',
    'node:path': 'export const join = (...args) => args.join("/"); export const resolve = (...args) => args.join("/"); export const dirname = (p) => p; export default {};',
    'node:url': 'export const fileURLToPath = (u) => u; export default {};',
  };

  return {
    name: 'stub-node-builtins',
    enforce: 'pre',
    resolveId(id) {
      if (id in stubs) {
        return `\0virtual:${id}`;
      }
      return null;
    },
    load(id) {
      if (id.startsWith('\0virtual:node:')) {
        const moduleName = id.replace('\0virtual:', '');
        return stubs[moduleName] ?? 'export default {};';
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
  build: {
    rollupOptions: {
      external: [/^node:/],
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
