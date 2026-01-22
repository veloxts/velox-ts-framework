/**
 * Application Entry Point - tRPC Template
 *
 * VeloxTS tRPC-only API architecture:
 * - tRPC at /trpc for type-safe frontend communication
 * - No REST endpoints (use --default template for REST)
 *
 * Frontend imports types directly from router.ts for full type safety.
 */

import 'dotenv/config';

// Side-effect import for declaration merging (extends ctx.db type)
import './types.js';

import { databasePlugin, registerRpc, veloxApp } from '@veloxts/velox';

import { config } from './config/app.js';
import { db } from './config/database.js';
import { collections } from './router.js';

// Re-export AppRouter for frontend type imports
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
// tRPC Registration
// ============================================================================

/**
 * Register tRPC routes at /trpc
 *
 * Endpoints: /trpc/users.listUsers, /trpc/health.getHealth, etc.
 *
 * No REST endpoints - this template is for internal TypeScript clients only.
 * For REST + tRPC hybrid, use the --default template and add registerRpc().
 */
await registerRpc(app, collections, { prefix: '/trpc' });

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
