/**
 * Test server utilities for VeloxTS integration tests
 * @module testing/server
 */

import { setupTestContext } from '@veloxts/core';
import Fastify, {
  type FastifyInstance,
  type FastifyPluginAsync,
  type FastifyPluginOptions,
} from 'fastify';
import fp from 'fastify-plugin';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for creating a test server
 */
export interface TestServerOptions {
  /** Enable logging (default: false) */
  logger?: boolean;
  /** Plugins to register */
  plugins?: Array<{
    plugin: FastifyPluginAsync;
    options?: Record<string, unknown>;
  }>;
  /** Skip context decoration (default: false) */
  skipContext?: boolean;
}

// ============================================================================
// Test Server Factory
// ============================================================================

/**
 * Creates a Fastify server configured for integration testing
 *
 * This sets up:
 * - Request context decoration (mimics VeloxApp behavior)
 * - Logging disabled for cleaner test output
 * - Any additional plugins passed in options
 *
 * @example
 * ```typescript
 * import { createTestServer } from '@veloxts/testing';
 *
 * const server = await createTestServer();
 *
 * // Register routes
 * server.get('/test', async () => ({ ok: true }));
 *
 * await server.ready();
 *
 * // Make requests
 * const response = await server.inject({
 *   method: 'GET',
 *   url: '/test',
 * });
 *
 * // Cleanup
 * await server.close();
 * ```
 */
export async function createTestServer(options: TestServerOptions = {}): Promise<FastifyInstance> {
  const { logger = false, plugins = [], skipContext = false } = options;

  const server = Fastify({ logger });

  // Setup context decoration like VeloxApp does
  if (!skipContext) {
    setupTestContext(server);
  }

  // Register any plugins
  for (const { plugin, options: pluginOptions } of plugins) {
    await server.register(plugin, pluginOptions ?? {});
  }

  return server;
}

/**
 * Wraps a VeloxPlugin-style object for Fastify registration
 *
 * VeloxTS plugins have a { name, version, register } shape.
 * This wraps them for use with server.register().
 *
 * @example
 * ```typescript
 * import { wrapVeloxPlugin } from '@veloxts/testing';
 * import { authPlugin } from '@veloxts/auth';
 *
 * const server = await createTestServer();
 * await server.register(wrapVeloxPlugin(authPlugin(config)), config);
 * ```
 */
export function wrapVeloxPlugin<TOptions extends FastifyPluginOptions>(veloxPlugin: {
  name: string;
  register: (instance: FastifyInstance, options: TOptions) => Promise<void>;
}): FastifyPluginAsync<TOptions> {
  return fp(
    async (instance: FastifyInstance, opts: TOptions) => {
      await veloxPlugin.register(instance, opts);
    },
    { name: veloxPlugin.name }
  );
}
