/**
 * Server Entry Point Template
 *
 * This file is the entry point for server-side rendering.
 * It's referenced in defineVeloxApp() configuration.
 *
 * When scaffolding a new VeloxTS full-stack project, this template
 * is copied to src/entry.server.tsx and customized for the project.
 *
 * @module @veloxts/web/templates/entry.server
 */

import { createFileRouter, createSsrRouter, type FileRouter, renderToStream } from '../index.js';

/**
 * Lazy-initialized file router.
 *
 * The file router scans the pages directory and creates routes
 * based on the file structure using Laravel-inspired conventions.
 *
 * Initialized on first request to avoid top-level await issues
 * with some bundlers.
 */
let fileRouter: FileRouter | null = null;

async function getFileRouter(): Promise<FileRouter> {
  if (!fileRouter) {
    fileRouter = await createFileRouter({
      pagesDir: 'app/pages',
      layoutsDir: 'app/layouts',
    });
  }
  return fileRouter;
}

/**
 * Export the SSR handler for Vinxi.
 *
 * This handler:
 * 1. Receives incoming requests from Vinxi's SSR router
 * 2. Matches the URL to a page component using the file router
 * 3. Renders the matched page to a streaming HTML response
 * 4. Returns 404 for unmatched routes
 *
 * @example
 * ```typescript
 * // In app.config.ts (Vinxi configuration)
 * export default defineVeloxApp({
 *   routers: [
 *     // ... other routers
 *     {
 *       name: 'ssr',
 *       type: 'http',
 *       handler: './src/entry.server.tsx',
 *     },
 *   ],
 * });
 * ```
 */
export default createSsrRouter({
  /**
   * Resolve a URL path to a route match.
   * Uses lazy-initialized FileRouter for dynamic route support.
   * Returns null if no route matches (404).
   */
  resolveRoute: async (pathname) => {
    const router = await getFileRouter();
    return router.match(pathname);
  },

  /**
   * Render a matched route to a streaming HTML response.
   */
  render: async (match, request) => {
    return renderToStream(match, request, {
      bootstrapScripts: ['/_build/client.js'],
    });
  },

  /**
   * Enable request logging in development.
   */
  logging: process.env.NODE_ENV !== 'production',
});
