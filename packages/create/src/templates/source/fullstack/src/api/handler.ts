/**
 * API Handler
 *
 * This creates the Fastify API handler that gets embedded in Vinxi.
 * All routes under /api/* are handled by this Fastify instance.
 */

import { createVeloxApp } from '@veloxts/core';
import { databasePlugin } from '@veloxts/orm';
import { rest } from '@veloxts/router';
import { createApiHandler } from '@veloxts/web';

import { prisma } from './database.js';
import { healthProcedures } from './procedures/health.js';
import { userProcedures } from './procedures/users.js';

// Export router type for frontend type safety
const router = { health: healthProcedures, users: userProcedures };
export type AppRouter = typeof router;

/**
 * Create the Fastify app for API routes
 */
const app = createVeloxApp({
  fastify: {
    logger: process.env.NODE_ENV !== 'production',
  },
});

// Register database plugin
app.register(databasePlugin({ client: prisma }));

// Register REST routes from procedures
rest([healthProcedures, userProcedures], {
  prefix: '', // No prefix - Vinxi handles /api/*
})(app);

/**
 * Export the API handler for Vinxi embedding
 */
export default createApiHandler({ app, basePath: '/api' });
