/**
 * Application Entry Point - tRPC Hybrid Template
 *
 * This template showcases VeloxTS's hybrid API architecture:
 * - tRPC for type-safe frontend-backend communication (primary)
 * - REST endpoints auto-generated from the same procedures (external APIs)
 *
 * Both APIs are generated from the same procedure definitions,
 * demonstrating the "define once, expose everywhere" pattern.
 */

import 'dotenv/config';

import {
  veloxApp,
  databasePlugin,
  createTRPC,
  createAppRouter,
  registerTRPCPlugin,
  rest,
} from '@veloxts/velox';
import { config } from './config/app.js';
import { prisma } from './config/database.js';
import { healthProcedures } from './procedures/health.js';
import { userProcedures } from './procedures/users.js';

// ============================================================================
// Router Definition
// ============================================================================

// Procedure collections for routing
const collections = [healthProcedures, userProcedures];

// Create tRPC instance with VeloxTS context
const t = createTRPC();

// Create the app router from procedure collections
const appRouter = createAppRouter(t, collections);

// ============================================================================
// Type Exports for Frontend
// ============================================================================

/**
 * AppRouter type for frontend type safety
 *
 * Import this type in your frontend to get full autocomplete:
 * ```typescript
 * import type { AppRouter } from '../../api/src';
 * import { createVeloxHooks } from '@veloxts/client/react';
 *
 * export const api = createVeloxHooks<AppRouter>();
 * ```
 */
export type AppRouter = typeof appRouter;

// ============================================================================
// Application Bootstrap
// ============================================================================

const app = await veloxApp({
  port: config.port,
  host: config.host,
  logger: config.logger,
});

// Register database plugin
await app.register(databasePlugin({ client: prisma }));

// Register tRPC routes (primary API - for frontend)
// Endpoint: /trpc/{procedureName}
await registerTRPCPlugin(app.server, {
  prefix: '/trpc',
  router: appRouter,
});

// Register REST routes (secondary API - for external consumers)
// Endpoints: /api/users, /api/health, etc.
app.routes(
  rest(collections, {
    prefix: config.apiPrefix,
  })
);

await app.start();
