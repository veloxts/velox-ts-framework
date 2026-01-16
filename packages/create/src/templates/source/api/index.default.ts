/**
 * Application Entry Point
 */

import 'dotenv/config';

// Side-effect import for declaration merging (extends ctx.db type)
import './types.js';

import { databasePlugin, rest, veloxApp } from '@veloxts/velox';

import { config } from './config/app.js';
import { db } from './config/database.js';
// Import router definition (type-only safe for frontend imports)
import { collections } from './router.js';

// Re-export AppRouter and routes for backward compatibility
// Frontend should import from ./router.js directly for type safety
export type { AppRouter } from './router.js';
export { routes } from './router.js';

const app = await veloxApp({
  port: config.port,
  host: config.host,
  logger: config.logger,
});

await app.register(databasePlugin({ client: db }));

app.routes(
  rest(collections, {
    prefix: config.apiPrefix,
  })
);

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
