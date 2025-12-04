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
 * import { createVeloxApp } from '@veloxts/core';
 * import { PrismaClient } from '@prisma/client';
 * import { createDatabasePlugin } from '@veloxts/orm';
 *
 * const prisma = new PrismaClient();
 * const app = await createVeloxApp({ port: 3000 });
 *
 * await app.use(createDatabasePlugin({ client: prisma }));
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

// ============================================================================
// Version
// ============================================================================

/**
 * Package version
 */
export const ORM_VERSION = '0.1.0' as const;

// ============================================================================
// Core Types
// ============================================================================

export type {
  /**
   * Connection state enum values
   */
  ConnectionState,
  /**
   * Connection status information
   */
  ConnectionStatus,
  /**
   * Base interface for Prisma clients
   */
  DatabaseClient,
  /**
   * Configuration for database wrapper
   */
  DatabaseWrapperConfig,
  /**
   * Infer client type from config
   */
  InferClientType,
  /**
   * Infer database client type
   */
  InferDatabaseClient,
  /**
   * Plugin configuration options
   */
  OrmPluginConfig,
} from './types.js';
export { isDatabaseClient } from './types.js';

// ============================================================================
// Client Wrapper
// ============================================================================

export type {
  /**
   * Database wrapper interface with lifecycle management
   */
  Database,
} from './client.js';
export {
  /**
   * Create a database wrapper with connection lifecycle management
   *
   * Use this for manual connection management. For automatic lifecycle
   * management with VeloxApp, use `createDatabasePlugin` instead.
   *
   * @example
   * ```typescript
   * const db = createDatabase({ client: new PrismaClient() });
   * await db.connect();
   *
   * const users = await db.client.user.findMany();
   *
   * await db.disconnect();
   * ```
   */
  createDatabase,
} from './client.js';

// ============================================================================
// Plugin
// ============================================================================

export {
  /**
   * Create a database plugin for VeloxApp integration
   *
   * This is the recommended way to integrate Prisma with VeloxTS.
   * The plugin automatically:
   * - Connects to the database when the app starts
   * - Disconnects during graceful shutdown
   * - Adds `ctx.db` to procedure handlers
   *
   * @example
   * ```typescript
   * import { createVeloxApp } from '@veloxts/core';
   * import { PrismaClient } from '@prisma/client';
   * import { createDatabasePlugin } from '@veloxts/orm';
   *
   * const prisma = new PrismaClient();
   * const app = await createVeloxApp({ port: 3000 });
   *
   * await app.use(createDatabasePlugin({ client: prisma }));
   * await app.start();
   * ```
   */
  createDatabasePlugin,
} from './plugin.js';
