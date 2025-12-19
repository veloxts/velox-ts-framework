/**
 * Plugin system for VeloxTS framework
 * Wraps Fastify's plugin architecture with metadata and validation
 * @module plugin
 */

import type { FastifyPluginAsync, FastifyPluginOptions } from 'fastify';

import { VeloxError } from './errors.js';

/**
 * Plugin options type
 * Generic record allowing plugins to define custom options
 */
export type PluginOptions = FastifyPluginOptions;

/**
 * Plugin metadata interface
 *
 * Provides information about the plugin for registration and dependency resolution
 */
export interface PluginMetadata {
  /**
   * Unique plugin name
   * Used for identification and dependency resolution
   */
  name: string;

  /**
   * Plugin version (semantic versioning recommended)
   */
  version: string;

  /**
   * Optional list of plugin names this plugin depends on
   *
   * Fastify handles the ordering - plugins listed here should be
   * registered before this plugin
   *
   * @example
   * ```typescript
   * dependencies: ['@veloxts/orm', '@veloxts/validation']
   * ```
   */
  dependencies?: string[];
}

/**
 * VeloxTS plugin definition
 *
 * Wraps a Fastify plugin with metadata for better developer experience
 *
 * @template Options - Type of options the plugin accepts
 *
 * @example
 * ```typescript
 * interface MyPluginOptions {
 *   apiKey: string;
 *   timeout?: number;
 * }
 *
 * const myPlugin: VeloxPlugin<MyPluginOptions> = {
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   async register(server, options) {
 *     // Plugin implementation
 *     server.get('/api', async () => {
 *       return { message: 'Hello from plugin' };
 *     });
 *   }
 * };
 * ```
 */
export interface VeloxPlugin<Options extends PluginOptions = PluginOptions> extends PluginMetadata {
  /**
   * Plugin registration function
   *
   * Called when the plugin is registered with the VeloxTS app.
   * This is a standard Fastify plugin function.
   *
   * @param server - Fastify server instance
   * @param options - Plugin options provided during registration
   */
  register: FastifyPluginAsync<Options>;
}

/**
 * Defines a VeloxTS plugin with metadata and type-safe options
 *
 * This is a helper function that provides better TypeScript inference
 * and validates plugin metadata at definition time.
 *
 * @template Options - Type of options the plugin accepts
 * @param plugin - Plugin definition with metadata and register function
 * @returns The same plugin object with proper types
 *
 * @throws {VeloxError} If plugin metadata is invalid
 *
 * @example
 * ```typescript
 * export const databasePlugin = definePlugin({
 *   name: '@myapp/database',
 *   version: '1.0.0',
 *   dependencies: ['@veloxts/orm'],
 *   async register(server, options) {
 *     const db = await createDatabase(options.connectionString);
 *
 *     // Decorate server with database client
 *     server.decorate('db', db);
 *
 *     // Add shutdown hook
 *     server.addHook('onClose', async () => {
 *       await db.disconnect();
 *     });
 *   }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Plugin with typed options
 * interface AuthOptions {
 *   secret: string;
 *   expiresIn?: string;
 * }
 *
 * export const authPlugin = definePlugin<AuthOptions>({
 *   name: '@myapp/auth',
 *   version: '1.0.0',
 *   async register(server, options) {
 *     // options is properly typed as AuthOptions
 *     const { secret, expiresIn = '1h' } = options;
 *     // ... implementation
 *   }
 * });
 * ```
 */
export function definePlugin<Options extends PluginOptions = PluginOptions>(
  plugin: VeloxPlugin<Options>
): VeloxPlugin<Options> {
  // Validate plugin metadata
  validatePluginMetadata(plugin);

  return plugin;
}

/**
 * Validates plugin metadata
 *
 * @param plugin - Plugin to validate
 * @throws {VeloxError} If metadata is invalid
 *
 * @internal
 */
export function validatePluginMetadata(
  plugin: Partial<PluginMetadata> & { register?: unknown }
): void {
  if (!plugin.name || typeof plugin.name !== 'string' || plugin.name.trim() === '') {
    throw new VeloxError('Plugin must have a non-empty name', 500, 'INVALID_PLUGIN_METADATA');
  }

  if (!plugin.version || typeof plugin.version !== 'string' || plugin.version.trim() === '') {
    throw new VeloxError(
      `Plugin "${plugin.name}" must have a version`,
      500,
      'INVALID_PLUGIN_METADATA'
    );
  }

  if (!plugin.register || typeof plugin.register !== 'function') {
    throw new VeloxError(
      `Plugin "${plugin.name}" must have a register function`,
      500,
      'INVALID_PLUGIN_METADATA'
    );
  }

  // Validate dependencies array if provided
  if (plugin.dependencies !== undefined) {
    if (!Array.isArray(plugin.dependencies)) {
      throw new VeloxError(
        `Plugin "${plugin.name}" dependencies must be an array`,
        500,
        'INVALID_PLUGIN_METADATA'
      );
    }

    for (const dep of plugin.dependencies) {
      if (typeof dep !== 'string' || dep.trim() === '') {
        throw new VeloxError(
          `Plugin "${plugin.name}" has invalid dependency: dependencies must be non-empty strings`,
          500,
          'INVALID_PLUGIN_METADATA'
        );
      }
    }
  }
}

/**
 * Type guard to check if a value is a valid VeloxPlugin
 *
 * Uses the `in` operator for safe property access without type assertions.
 *
 * @param value - Value to check
 * @returns true if value is a valid VeloxPlugin
 *
 * @example
 * ```typescript
 * if (isVeloxPlugin(someValue)) {
 *   console.log('Plugin name:', someValue.name);
 *   await app.register(someValue);
 * }
 * ```
 */
export function isVeloxPlugin(value: unknown): value is VeloxPlugin {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // Use 'in' operator for safe property access without type assertions
  return (
    'name' in value &&
    'version' in value &&
    'register' in value &&
    typeof value.name === 'string' &&
    typeof value.version === 'string' &&
    typeof value.register === 'function'
  );
}

/**
 * Type guard to check if a value is a Fastify plugin function
 *
 * Fastify plugins are async functions that receive (server, options).
 * This distinguishes them from VeloxPlugin objects.
 *
 * @param value - Value to check
 * @returns true if value is a FastifyPluginAsync function
 *
 * @example
 * ```typescript
 * if (isFastifyPlugin(someValue)) {
 *   await server.register(someValue);
 * }
 * ```
 */
export function isFastifyPlugin<Options extends PluginOptions = PluginOptions>(
  value: unknown
): value is FastifyPluginAsync<Options> {
  return typeof value === 'function';
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Infers the options type from a VeloxPlugin
 *
 * Useful for extracting the options type when you have a plugin instance
 * and need to reference its options type elsewhere.
 *
 * @template T - Plugin type to extract options from
 *
 * @example
 * ```typescript
 * const myPlugin = definePlugin<{ apiKey: string }>({
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   async register(server, options) {
 *     // options is { apiKey: string }
 *   }
 * });
 *
 * // Extract the options type
 * type MyPluginOptions = InferPluginOptions<typeof myPlugin>;
 * // MyPluginOptions = { apiKey: string }
 * ```
 */
export type InferPluginOptions<T> = T extends VeloxPlugin<infer O> ? O : never;
