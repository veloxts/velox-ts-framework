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

import { databasePlugin, registerRpc, rest, veloxApp } from '@veloxts/velox';

import { config } from './config/app.js';
import { db } from './config/database.js';
// Import collections for route registration
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
 * Register tRPC routes at /trpc
 *
 * Uses registerRpc() for type-safe tRPC endpoint registration.
 * The router type is inferred from collections for full type safety.
 *
 * Endpoints: /trpc/users.listUsers, /trpc/health.getHealth, etc.
 */
await registerRpc(app, collections, { prefix: '/trpc' });

/**
 * Register REST routes at /api
 *
 * REST endpoints are auto-generated from the same procedure definitions,
 * enabling external API consumers without tRPC clients.
 *
 * Endpoints: GET /api/users, POST /api/users, GET /api/health, etc.
 */
app.routes(rest([...collections], { prefix: config.apiPrefix }));

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
