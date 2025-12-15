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
// Type Exports for Frontend
// ============================================================================

/**
 * AppRouter type for frontend type safety
 *
 * Constructed from procedure collections to preserve full type information.
 * This enables type-safe API calls with full autocomplete.
 *
 * @example
 * ```typescript
 * import type { AppRouter } from '../../api/src';
 * import { createVeloxHooks } from '@veloxts/client/react';
 *
 * export const api = createVeloxHooks<AppRouter>();
 * ```
 */
export type AppRouter = {
  health: typeof healthProcedures;
  users: typeof userProcedures;
};

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
 * - tRPC: /trpc/users.getUser, /trpc/health.getHealth
 */
await serve(app, [healthProcedures, userProcedures], {
  api: config.apiPrefix,
  rpc: '/trpc',
});

await app.start();

// Send ready signal to CLI for accurate HMR timing
// process.send is only available when spawned via child_process with IPC channel
if (process.send) {
  process.send({ type: 'velox:ready' });
}

// Graceful shutdown - disconnect Prisma to prevent connection pool leaks
let isShuttingDown = false;

const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    await prisma.$disconnect();
  } catch {
    // Ignore disconnect errors during shutdown
  }
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
