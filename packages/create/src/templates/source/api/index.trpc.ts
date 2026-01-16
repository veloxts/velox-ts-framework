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

// Side-effect import for declaration merging (extends ctx.db type)
import './types.js';

import { databasePlugin, serve, veloxApp } from '@veloxts/velox';

import { config } from './config/app.js';
import { db } from './config/database.js';
// Import router definition (type-only safe for frontend imports)
import { collections } from './router.js';

// Re-export AppRouter for backward compatibility
// Frontend should import from ./router.js directly for type safety
export type { AppRouter } from './router.js';

// ============================================================================
// Application Bootstrap
// ============================================================================

const app = await veloxApp({
  port: config.port,
  host: config.host,
  logger: config.logger,
});

await app.register(databasePlugin({ client: db }));

// ============================================================================
// API Registration
// ============================================================================

/**
 * Serve procedures as both REST and tRPC endpoints
 *
 * - REST: /api/users, /api/health
 * - tRPC: /trpc/users.getUser, /trpc/health.getHealth
 */
await serve(app, collections, {
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
    await db.$disconnect();
  } catch {
    // Ignore disconnect errors during shutdown
  }
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
