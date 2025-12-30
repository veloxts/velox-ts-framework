/**
 * API Handler
 *
 * This creates the Fastify API handler that gets embedded in Vinxi.
 * All routes under /api/* are handled by this Fastify instance.
 *
 * IMPORTANT:
 * - Vinxi HTTP routers expect h3 event handlers as default export
 * - We use lazy initialization (factory function) to avoid Vite SSR module issues
 * - createH3ApiHandler handles the Fastify app lifecycle and initialization
 */

import { veloxApp } from '@veloxts/core';
import { databasePlugin } from '@veloxts/orm';
import { rest } from '@veloxts/router';
import { createH3ApiHandler } from '@veloxts/web/adapters';

import { db } from './database.js';
import { healthProcedures } from './procedures/health.js';
import { postProcedures } from './procedures/posts.js';
import { userProcedures } from './procedures/users.js';

// Export router type for frontend type safety
const router = { health: healthProcedures, users: userProcedures, posts: postProcedures };
export type AppRouter = typeof router;

/**
 * Export the h3 event handler for Vinxi embedding.
 *
 * We use a factory function for lazy initialization to avoid
 * Vite trying to evaluate the Fastify app during build time.
 * The app is initialized on the first HTTP request.
 */
export default createH3ApiHandler({
  app: async () => {
    const app = await veloxApp();

    // Register database plugin
    await app.register(databasePlugin({ client: db }));

    // Register REST routes from procedures
    app.routes(
      rest([healthProcedures, userProcedures, postProcedures], {
        prefix: '', // No prefix - Vinxi handles /api/*
      })
    );

    // Return the underlying Fastify instance for the h3 adapter
    // The adapter will call ready() on it
    return app.server;
  },
  basePath: '/api',
});
