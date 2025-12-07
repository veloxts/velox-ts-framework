/**
 * VeloxTS Playground Application
 *
 * Development testing application for validating framework features
 * and demonstrating usage patterns.
 *
 * Directory Structure:
 * ```
 * src/
 * ├── config/          # Application configuration
 * ├── database/        # Database client and migrations
 * ├── procedures/      # API procedures (business logic)
 * ├── schemas/         # Zod validation schemas
 * └── index.ts         # Application entry point
 * ```
 */

import 'dotenv/config';

import path from 'node:path';

import fastifyStatic from '@fastify/static';
import { authPlugin } from '@veloxts/auth';
import { createVeloxApp, VELOX_VERSION } from '@veloxts/core';
import { createDatabasePlugin } from '@veloxts/orm';
import { createRoutesRegistrar, getRouteSummary, registerTRPCPlugin } from '@veloxts/router';

import { authConfig, config } from './config/index.js';
import { createMockPrismaClient, prisma } from './database/index.js';
import { authProcedures, healthProcedures, userProcedures } from './procedures/index.js';
import { appRouter } from './trpc/index.js';

// ============================================================================
// Database Mode
// ============================================================================

/**
 * Set USE_MOCK_DB=true to use in-memory mock database
 * Set USE_MOCK_DB=false (or omit) to use real Prisma/SQLite database
 */
const USE_MOCK_DB = process.env.USE_MOCK_DB === 'true';

// ============================================================================
// Application Bootstrap
// ============================================================================

/**
 * Creates and configures the VeloxTS application
 */
async function createApp() {
  // Create the VeloxTS app with configuration
  const app = await createVeloxApp({
    port: config.port,
    host: config.host,
    logger: config.logger,
  });

  // Register database plugin
  // Use mock database for testing or real Prisma for development
  const dbClient = USE_MOCK_DB ? createMockPrismaClient() : prisma;
  await app.use(createDatabasePlugin({ client: dbClient }));

  console.log(`[Database] Using ${USE_MOCK_DB ? 'mock in-memory' : 'Prisma SQLite'} database`);

  // Register auth plugin
  await app.use(authPlugin(authConfig));
  console.log('[Auth] JWT authentication enabled');

  // Register static file serving for frontend demo
  await app.server.register(fastifyStatic, {
    root: path.join(process.cwd(), 'public'),
    prefix: '/',
  });

  // Register tRPC routes at /trpc
  await registerTRPCPlugin(app.server, {
    prefix: '/trpc',
    router: appRouter,
  });

  console.log('[tRPC] Registered at /trpc');

  // Register REST API routes at /api
  const collections = [authProcedures, userProcedures, healthProcedures];
  app.routes(createRoutesRegistrar(collections, { prefix: config.apiPrefix }));

  return { app, collections };
}

/**
 * Prints startup banner with route information
 */
function printBanner(collections: Parameters<typeof getRouteSummary>[0]) {
  const divider = '═'.repeat(50);

  console.log(`\n${divider}`);
  console.log(`  VeloxTS Playground v${VELOX_VERSION}`);
  console.log(`  Environment: ${config.env}`);
  console.log(divider);

  // Print registered routes
  const routes = getRouteSummary(collections);
  console.log('\n📍 Registered Routes:\n');

  for (const route of routes) {
    const method = route.method.padEnd(6);
    const path = route.path.padEnd(25);
    console.log(`   ${method} ${path} → ${route.namespace}.${route.procedure}`);
  }

  console.log(`\n${divider}`);
  console.log(`  Frontend: http://localhost:${config.port}`);
  console.log(`  REST API: http://localhost:${config.port}${config.apiPrefix}`);
  console.log(`  tRPC:     http://localhost:${config.port}/trpc`);
  console.log(`${divider}\n`);

  // Print example curl commands
  console.log('📝 Example requests:\n');
  console.log('   # Health check');
  console.log(`   curl http://localhost:${config.port}${config.apiPrefix}/health`);
  console.log('');
  console.log('   # Public user endpoints');
  console.log(`   curl http://localhost:${config.port}${config.apiPrefix}/users`);
  console.log(
    `   curl http://localhost:${config.port}${config.apiPrefix}/users/550e8400-e29b-41d4-a716-446655440001`
  );
  console.log('');
  console.log('   # Authentication');
  console.log(`   curl -X POST http://localhost:${config.port}${config.apiPrefix}/auth/register \\`);
  console.log('        -H "Content-Type: application/json" \\');
  console.log('        -d \'{"name":"John Doe","email":"john@example.com","password":"secret123"}\'');
  console.log('');
  console.log(`   curl -X POST http://localhost:${config.port}${config.apiPrefix}/auth/login \\`);
  console.log('        -H "Content-Type: application/json" \\');
  console.log('        -d \'{"email":"john@example.com","password":"secret123"}\'');
  console.log('');
  console.log('   # Protected endpoint (use token from login response)');
  console.log(`   curl http://localhost:${config.port}${config.apiPrefix}/auth/me \\`);
  console.log('        -H "Authorization: Bearer <your-access-token>"');
  console.log('');
}

/**
 * Main entry point
 */
async function main() {
  try {
    const { app, collections } = await createApp();

    await app.start();

    printBanner(collections);
  } catch (error) {
    console.error('Failed to start playground:', error);
    process.exit(1);
  }
}

// ============================================================================
// Exports
// ============================================================================

// Re-export for external usage and testing
export { createApp, main };

// Export types for client type inference
// The AppRouter type from tRPC is what clients need for full type safety
export type { AppRouter } from './trpc/index.js';

// Run if executed directly
main();
