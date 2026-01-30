/**
 * VeloxApp plugin for database integration
 *
 * Provides automatic database lifecycle management via the VeloxTS plugin system.
 * Connects on app start, disconnects on app shutdown.
 *
 * @module plugin
 */

import { createRequire } from 'node:module';

import { ConfigurationError, definePlugin } from '@veloxts/core';

import { createDatabase, type Database } from './client.js';
import { registerOrmProviders } from './providers.js';
import { DATABASE } from './tokens.js';
import type { DatabaseClient, OrmPluginConfig } from './types.js';
import { isDatabaseClient } from './types.js';

// Read version from package.json dynamically
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

// ============================================================================
// Context Extension
// ============================================================================

/**
 * BaseContext Extension for Database
 *
 * After registering the database plugin, `ctx.db` will be available
 * in all procedure handlers. To get full type inference for your
 * specific Prisma schema, add this to your app's declaration file:
 *
 * @example
 * ```typescript
 * // In your app's types.d.ts
 * import type { PrismaClient } from '@prisma/client';
 *
 * declare module '@veloxts/core' {
 *   interface BaseContext {
 *     db: PrismaClient;
 *   }
 * }
 * ```
 *
 * This enables full autocomplete for ctx.db in procedure handlers:
 *
 * @example
 * ```typescript
 * getUser: procedure()
 *   .input(z.object({ id: z.string() }))
 *   .query(async ({ input, ctx }) => {
 *     // ctx.db is typed as your PrismaClient with all models
 *     return ctx.db.user.findUnique({ where: { id: input.id } });
 *   })
 * ```
 *
 * NOTE: We intentionally do NOT declare `db: DatabaseClient` on BaseContext
 * here, as that would conflict with user type declarations. The user's
 * declaration merging should be the authoritative source for the `db` type.
 */

// ============================================================================
// Plugin Implementation
// ============================================================================

/**
 * Version of the ORM plugin (read from package.json)
 */
const ORM_PLUGIN_VERSION = packageJson.version ?? '0.0.0-unknown';

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
 * import { veloxApp } from '@veloxts/core';
 * import { PrismaClient } from '@prisma/client';
 * import { databasePlugin } from '@veloxts/orm';
 *
 * const prisma = new PrismaClient();
 * const app = await veloxApp({ port: 3030 });
 *
 * // Register the database plugin
 * await app.use(databasePlugin({ client: prisma }));
 *
 * // Start the app (database connects automatically)
 * await app.start();
 * ```
 *
 * @example
 * ```typescript
 * // With DI container
 * import { Container } from '@veloxts/core';
 * import { databasePlugin, DATABASE } from '@veloxts/orm';
 *
 * const container = new Container();
 * await app.use(databasePlugin({ client: prisma, container }));
 *
 * // Resolve from container
 * const db = container.resolve(DATABASE);
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
export function databasePlugin<TClient extends DatabaseClient>(config: OrmPluginConfig<TClient>) {
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
  const { container } = config;

  // Plugin state - holds the database wrapper
  const state: PluginState<TClient> = {
    database: null,
  };

  return definePlugin({
    name: pluginName,
    version: ORM_PLUGIN_VERSION,

    async register(server) {
      if (container) {
        // DI-enabled path: Register providers and resolve from container
        registerOrmProviders(container, config);
        state.database = container.resolve(DATABASE) as Database<TClient>;
      } else {
        // Legacy path: Direct instantiation (backward compatible)
        state.database = createDatabase({ client: config.client });
      }

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
