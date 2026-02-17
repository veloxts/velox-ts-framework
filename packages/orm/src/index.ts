/**
 * @veloxts/orm - Laravel-inspired Prisma wrapper for VeloxTS framework
 *
 * Provides type-safe database integration with:
 * - Context-based database access (`ctx.db.user.findUnique(...)`)
 * - VeloxApp plugin integration with automatic lifecycle management
 * - Connection state tracking and error handling
 *
 * @example
 * ```typescript
 * // Setup
 * import { veloxApp } from '@veloxts/core';
 * import { PrismaClient } from '@prisma/client';
 * import { databasePlugin } from '@veloxts/orm';
 *
 * const prisma = new PrismaClient();
 * const app = await veloxApp({ port: 3030 });
 *
 * await app.use(databasePlugin({ client: prisma }));
 * await app.start();
 * ```
 *
 * @example
 * ```typescript
 * // Using ctx.db in procedure handlers
 * getUser: procedure()
 *   .input(z.object({ id: z.string().uuid() }))
 *   .query(async ({ input, ctx }) => {
 *     return ctx.db.user.findUnique({ where: { id: input.id } });
 *   })
 * ```
 *
 * @module @veloxts/orm
 */

import { createRequire } from 'node:module';

// ============================================================================
// Version
// ============================================================================

// Read version from package.json dynamically
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

/** ORM package version */
export const ORM_VERSION: string = packageJson.version ?? '0.0.0-unknown';

// ============================================================================
// Core Types
// ============================================================================

export type {
  ConnectionState,
  ConnectionStatus,
  DatabaseClient,
  DatabaseWrapperConfig,
  InferClientType,
  InferDatabaseClient,
  OrmPluginConfig,
} from './types.js';
export { isDatabaseClient } from './types.js';

// ============================================================================
// Client Wrapper
// ============================================================================

export type { Database } from './client.js';
export { createDatabase } from './client.js';

// ============================================================================
// Prisma Error Handling
// ============================================================================

export { db, handlePrismaError } from './prisma-errors.js';

// ============================================================================
// Plugin
// ============================================================================

export { databasePlugin } from './plugin.js';
