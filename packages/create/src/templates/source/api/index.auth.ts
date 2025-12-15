/**
 * Application Entry Point
 */

import 'dotenv/config';

import { authPlugin, databasePlugin, extractRoutes, rest, veloxApp } from '@veloxts/velox';

import { config } from './config/app.js';
import { authConfig } from './config/auth.js';
import { prisma } from './config/database.js';
import { authProcedures } from './procedures/auth.js';
import { healthProcedures } from './procedures/health.js';
import { userProcedures } from './procedures/users.js';

// Procedure collections for routing
const collections = [healthProcedures, authProcedures, userProcedures];

// Router type for frontend type safety
const router = { auth: authProcedures, health: healthProcedures, users: userProcedures };
export type AppRouter = typeof router;

// Route mappings for frontend client - imported directly, no manual duplication needed
export const routes = extractRoutes(collections);

const app = await veloxApp({
  port: config.port,
  host: config.host,
  logger: config.logger,
});

await app.register(databasePlugin({ client: prisma }));
await app.register(authPlugin(authConfig));

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
    await prisma.$disconnect();
  } catch {
    // Ignore disconnect errors during shutdown
  }
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
