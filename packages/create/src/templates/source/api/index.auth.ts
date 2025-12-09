/**
 * Application Entry Point
 */

import 'dotenv/config';

import {
  veloxApp,
  VELOX_VERSION,
  databasePlugin,
  authPlugin,
  rest,
  getRouteSummary,
} from '@veloxts/velox';

import { authConfig, config } from './config/index.js';
import { prisma } from './database/index.js';
import { authProcedures } from './procedures/auth.js';
import { healthProcedures } from './procedures/health.js';
import { userProcedures } from './procedures/users.js';

// ============================================================================
// Application Bootstrap
// ============================================================================

async function createApp() {
  const app = await veloxApp({
    port: config.port,
    host: config.host,
    logger: config.logger,
  });

  // Register database plugin
  await app.register(databasePlugin({ client: prisma }));

  // Register auth plugin
  await app.register(authPlugin(authConfig));
  console.log('[Auth] JWT authentication enabled');

  // Register all procedures
  const collections = [healthProcedures, authProcedures, userProcedures];
  app.routes(rest(collections, { prefix: config.apiPrefix }));

  return { app, collections };
}

function printBanner(collections: Parameters<typeof getRouteSummary>[0]) {
  const divider = '═'.repeat(50);

  console.log(`\n${divider}`);
  console.log(`  VeloxTS API v${VELOX_VERSION}`);
  console.log(`  Environment: ${config.env}`);
  console.log(divider);

  const routes = getRouteSummary(collections);
  console.log('\n📍 Registered Routes:\n');

  for (const route of routes) {
    const method = route.method.padEnd(6);
    const path = route.path.padEnd(25);
    console.log(`   ${method} ${path} → ${route.namespace}.${route.procedure}`);
  }

  console.log(`\n${divider}`);
  console.log(`  API: http://localhost:${config.port}${config.apiPrefix}`);
  console.log(`${divider}\n`);
}

async function main() {
  try {
    const { app, collections } = await createApp();
    await app.start();
    printBanner(collections);
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();
