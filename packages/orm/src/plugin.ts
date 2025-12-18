/**
 * VeloxApp plugin for database integration
 *
 * Provides automatic database lifecycle management via the VeloxTS plugin system.
 * Connects on app start, disconnects on app shutdown.
 *
 * @module plugin
 */

import { ConfigurationError, definePlugin } from '@veloxts/core';

import { createDatabase, type Database } from './client.js';
import type { DatabaseClient, OrmPluginConfig } from './types.js';
import { isDatabaseClient } from './types.js';

// ============================================================================
// Context Extension
// ============================================================================

/**
 * Extend BaseContext to include the database client
 *
 * After registering the database plugin, `ctx.db` will be available
 * in all procedure handlers with full type information.
 *
 * @example
 * ```typescript
 * // In your app setup
 * import { PrismaClient } from '@prisma/client';
 * import { createDatabasePlugin } from '@veloxts/orm';
 *
 * const prisma = new PrismaClient();
 * await app.use(createDatabasePlugin({ client: prisma }));
 *
 * // In your procedure handlers
 * getUser: procedure()
 *   .input(z.object({ id: z.string() }))
 *   .query(async ({ input, ctx }) => {
 *     // ctx.db is typed as your PrismaClient
 *     return ctx.db.user.findUnique({ where: { id: input.id } });
 *   })
 * ```
 *
 * To get full type inference for your specific Prisma schema,
 * add this to your app's declaration file:
 *
 * @example
 * ```typescript
 * // In your app's types.d.ts or similar
 * import type { PrismaClient } from '@prisma/client';
 *
 * declare module '@veloxts/core' {
 *   interface BaseContext {
 *     db: PrismaClient;
 *   }
 * }
 * ```
 */
declare module '@veloxts/core' {
  interface BaseContext {
    /**
     * Database client for executing queries
     *
     * This property is added by the @veloxts/orm plugin.
     * The actual type depends on your Prisma schema.
     */
    db: DatabaseClient;
  }
}

// ============================================================================
// Plugin Implementation
// ============================================================================

/**
 * Version of the ORM plugin
 */
const ORM_PLUGIN_VERSION = '0.1.0';

/**
 * Default plugin name
 */
const DEFAULT_PLUGIN_NAME = '@veloxts/orm';

/**
 * Storage for the database wrapper instance
 *
 * This allows access to the wrapper from the plugin hooks
 * without storing it directly in module scope.
 */
interface PluginState<TClient extends DatabaseClient> {
  database: Database<TClient> | null;
}

/**
 * Creates a database plugin for VeloxApp integration
 *
 * This plugin:
 * - Wraps your Prisma client with connection management
 * - Automatically connects when the app starts
 * - Automatically disconnects during graceful shutdown
 * - Adds `db` to the request context for use in procedure handlers
 *
 * @template TClient - Type of the Prisma client
 * @param config - Plugin configuration with Prisma client
 * @returns A VeloxPlugin that can be registered with `app.use()`
 *
 * @throws {ConfigurationError} If config is invalid or client is missing
 *
 * @example
 * ```typescript
 * import { createVeloxApp } from '@veloxts/core';
 * import { PrismaClient } from '@prisma/client';
 * import { createDatabasePlugin } from '@veloxts/orm';
 *
 * const prisma = new PrismaClient();
 * const app = await createVeloxApp({ port: 3030 });
 *
 * // Register the database plugin
 * await app.use(createDatabasePlugin({ client: prisma }));
 *
 * // Start the app (database connects automatically)
 * await app.start();
 * ```
 *
 * @example
 * ```typescript
 * // Using ctx.db in procedures
 * import { defineProcedures, procedure } from '@veloxts/router';
 * import { z } from '@veloxts/validation';
 *
 * export const userProcedures = defineProcedures('users', {
 *   getUser: procedure()
 *     .input(z.object({ id: z.string().uuid() }))
 *     .query(async ({ input, ctx }) => {
 *       // ctx.db is your Prisma client
 *       const user = await ctx.db.user.findUnique({
 *         where: { id: input.id }
 *       });
 *       return user;
 *     }),
 *
 *   createUser: procedure()
 *     .input(z.object({ name: z.string(), email: z.string().email() }))
 *     .mutation(async ({ input, ctx }) => {
 *       return ctx.db.user.create({ data: input });
 *     }),
 * });
 * ```
 */
export function createDatabasePlugin<TClient extends DatabaseClient>(
  config: OrmPluginConfig<TClient>
) {
  // Validate configuration at plugin creation time
  if (!config || typeof config !== 'object') {
    throw new ConfigurationError('Database plugin configuration is required');
  }

  if (!config.client) {
    throw new ConfigurationError(
      'Database client is required. Provide a Prisma client instance in config.client'
    );
  }

  if (!isDatabaseClient(config.client)) {
    throw new ConfigurationError(
      'Database client must implement $connect and $disconnect methods. ' +
        'Ensure you are passing a valid Prisma client instance.'
    );
  }

  const pluginName = config.name ?? DEFAULT_PLUGIN_NAME;

  // Plugin state - holds the database wrapper
  const state: PluginState<TClient> = {
    database: null,
  };

  return definePlugin({
    name: pluginName,
    version: ORM_PLUGIN_VERSION,

    async register(server) {
      // Create the database wrapper
      state.database = createDatabase({ client: config.client });

      // Connect to the database
      await state.database.connect();

      // Add database client to request context via onRequest hook
      server.addHook('onRequest', async (request) => {
        // The context should be created by @veloxts/core's onRequest hook
        // which runs before this hook (due to plugin registration order)
        if (request.context) {
          // Extend the context with the database client using Object.defineProperty
          // for proper property definition without type assertion side effects
          Object.defineProperty(request.context, 'db', {
            value: config.client,
            writable: false,
            enumerable: true,
            configurable: true, // Allow redefinition for testing
          });
        }
      });

      // Register shutdown hook using Fastify's onClose hook
      // This ensures the database disconnects during graceful shutdown
      server.addHook('onClose', async () => {
        if (state.database?.isConnected) {
          try {
            await state.database.disconnect();
            server.log.info('Database disconnected successfully during shutdown');
          } catch (error) {
            // Log error but don't rethrow - allow graceful shutdown to continue
            server.log.error(
              { err: error instanceof Error ? error : new Error(String(error)) },
              'Failed to disconnect database during shutdown'
            );
          }
        }
      });

      // Log successful registration
      server.log.info(`Database plugin "${pluginName}" registered successfully`);
    },
  });
}

/**
 * Creates a database plugin for VeloxApp integration (succinct API)
 *
 * This is the preferred, shorter form of `createDatabasePlugin`.
 *
 * @template TClient - Type of the Prisma client
 * @param config - Plugin configuration with Prisma client
 * @returns A VeloxPlugin that can be registered with `app.register()`
 *
 * @example
 * ```typescript
 * import { veloxApp } from '@veloxts/core';
 * import { PrismaClient } from '@prisma/client';
 * import { databasePlugin } from '@veloxts/orm';
 *
 * const prisma = new PrismaClient();
 * const app = await veloxApp({ port: 3030 });
 *
 * await app.register(databasePlugin({ client: prisma }));
 * await app.start();
 * ```
 */
export const databasePlugin = createDatabasePlugin;
