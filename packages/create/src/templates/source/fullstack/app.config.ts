/**
 * Vinxi Application Configuration
 *
 * This configures the VeloxTS full-stack application with:
 * - RSC (React Server Components) rendering
 * - File-based routing under app/pages/
 * - API routes embedded via Fastify
 * - Server actions support
 */

import { defineVeloxApp } from '@veloxts/web';

export default defineVeloxApp({
  // Server configuration
  server: {
    port: __API_PORT__,
  },

  // File-based routing configuration
  routing: {
    pagesDir: 'app/pages',
    layoutsDir: 'app/layouts',
  },

  // API configuration (embedded Fastify)
  api: {
    prefix: '/api',
    handlerPath: './src/api/handler',
  },

  // Build configuration
  build: {
    outDir: 'dist',
  },
});
