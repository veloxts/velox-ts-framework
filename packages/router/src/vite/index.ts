/**
 * Vite Plugin for VeloxTS Router
 *
 * Provides browser-compatible stubs for Node.js built-in modules.
 * This is necessary because Vite scans the entire import graph during
 * development and production builds, including type-only imports that
 * lead to @veloxts packages using Node.js modules.
 *
 * @example
 * ```typescript
 * // vite.config.ts
 * import { veloxNodeStubs } from '@veloxts/router/vite';
 *
 * export default defineConfig({
 *   plugins: [veloxNodeStubs(), react()],
 * });
 * ```
 *
 * @module @veloxts/router/vite
 */

import type { Plugin } from 'vite';

/**
 * Vite plugin that stubs Node.js built-in modules for browser builds.
 *
 * When the frontend imports types from the API (e.g., AppRouter), Vite follows
 * the import chain and encounters Node.js modules from @veloxts/* packages.
 * This plugin provides empty stubs so the build completes.
 *
 * **Important:** These stubs never execute in the browser - they only exist to
 * satisfy Vite/Rollup's bundle analysis. The actual code paths using these
 * modules are server-only.
 *
 * @returns Vite plugin configuration
 *
 * @example
 * ```typescript
 * import { veloxNodeStubs } from '@veloxts/router/vite';
 * import react from '@vitejs/plugin-react';
 * import { defineConfig } from 'vite';
 *
 * export default defineConfig({
 *   plugins: [
 *     veloxNodeStubs(), // Must be first
 *     react(),
 *   ],
 * });
 * ```
 */
export function veloxNodeStubs(): Plugin {
  // Stub implementations for Node.js built-ins
  // These are minimal stubs that satisfy module resolution
  // They never execute in the browser
  const stubs: Record<string, string> = {
    // Prefixed versions (node:*)
    'node:util': `
      export const promisify = (fn) => fn;
      export const deprecate = (fn) => fn;
      export default {};
    `,
    'node:crypto': `
      export const randomBytes = () => new Uint8Array(0);
      export const scrypt = () => {};
      export const timingSafeEqual = () => true;
      export const createHmac = () => ({ update: () => ({ digest: () => "" }) });
      export const createHash = () => ({ update: () => ({ digest: () => "" }) });
      export default {};
    `,
    'node:module': `
      export const createRequire = () => () => ({});
      export default {};
    `,
    'node:fs': `
      export const readFileSync = () => "";
      export const existsSync = () => false;
      export const promises = {};
      export default {};
    `,
    'node:path': `
      export const join = (...args) => args.join("/");
      export const resolve = (...args) => args.join("/");
      export const dirname = (p) => p;
      export const basename = (p) => p;
      export const extname = (p) => "";
      export const parse = (p) => ({ root: "", dir: "", base: "", ext: "", name: "" });
      export default { join, resolve, dirname, basename, extname, parse };
    `,
    'node:url': `
      export const fileURLToPath = (u) => u;
      export const pathToFileURL = (p) => new URL("file://" + p);
      export const URL = globalThis.URL;
      export default {};
    `,
    'node:os': `
      export const homedir = () => "/";
      export const tmpdir = () => "/tmp";
      export const platform = () => "browser";
      export default {};
    `,
  };

  // Create non-prefixed aliases (for packages like dotenv, bcrypt)
  const nonPrefixedStubs: Record<string, string> = {};
  for (const key of Object.keys(stubs)) {
    if (key.startsWith('node:')) {
      nonPrefixedStubs[key.replace('node:', '')] = stubs[key];
    }
  }

  // Merge both prefixed and non-prefixed
  const allStubs = { ...stubs, ...nonPrefixedStubs };

  return {
    name: 'velox-node-stubs',
    enforce: 'pre',

    config() {
      // Provide process.env stub for packages like dotenv that check it
      return {
        define: {
          'process.env': '{}',
          'process.platform': '"browser"',
          'process.version': '"v0.0.0"',
        },
      };
    },

    resolveId(id) {
      if (id in allStubs) {
        return `\0velox-virtual:${id}`;
      }
      return null;
    },

    load(id) {
      if (id.startsWith('\0velox-virtual:')) {
        const moduleName = id.replace('\0velox-virtual:', '');
        return allStubs[moduleName] ?? 'export default {};';
      }
      return null;
    },
  };
}

// Re-export for convenience
export { veloxNodeStubs as nodeStubs };
