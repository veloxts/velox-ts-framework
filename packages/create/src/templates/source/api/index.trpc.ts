/**
 * Application Entry Point - tRPC Hybrid Template
 *
 * VeloxTS hybrid API architecture:
 * - tRPC at /trpc for type-safe frontend communication
 * - REST at /api for external consumers
 *
 * Both APIs generated from the same procedure definitions.
 */

import 'dotenv/config';

import { databasePlugin, serve, veloxApp } from '@veloxts/velox';

import { config } from './config/app.js';
import { prisma } from './config/database.js';
import { healthProcedures } from './procedures/health.js';
import { userProcedures } from './procedures/users.js';

// ============================================================================
// Application Bootstrap
// ============================================================================

const app = await veloxApp({
  port: config.port,
  host: config.host,
  logger: config.logger,
});

await app.register(databasePlugin({ client: prisma }));

// ============================================================================
// API Registration
// ============================================================================

/**
 * Serve procedures as both REST and tRPC endpoints
 *
 * - REST: /api/users, /api/health
 * - tRPC: /trpc/users.getUser, /trpc/health.check
 */
const router = await serve(app, [healthProcedures, userProcedures], {
  api: config.apiPrefix,
  rpc: '/trpc',
});

// ============================================================================
// Type Exports for Frontend
// ============================================================================

/**
 * AppRouter type for frontend type safety
 *
 * @example
 * ```typescript
 * import type { AppRouter } from '../../api/src';
 * import { createVeloxHooks } from '@veloxts/client/react';
 *
 * export const api = createVeloxHooks<AppRouter>();
 * ```
 */
export type AppRouter = typeof router;

await app.start();
