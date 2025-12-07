/**
 * Integration test setup utilities
 * @module __integration__/setup
 */

import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { createContext, type BaseContext } from '@veloxts/core';

import { authPlugin, type AuthPluginOptions } from '../plugin.js';
import { createTestAuthConfig } from './fixtures.js';

// ============================================================================
// Test Server Factory
// ============================================================================

/**
 * Options for creating a test server
 */
export interface TestServerOptions {
  /** Auth plugin options (defaults to test config) */
  authOptions?: AuthPluginOptions;
  /** Skip auth plugin registration */
  skipAuth?: boolean;
}

/**
 * Creates a Fastify server configured for integration testing
 *
 * This sets up:
 * - Request context decoration (mimics VeloxApp behavior)
 * - Auth plugin with test configuration
 * - Logging disabled for cleaner test output
 */
export async function createTestServer(options: TestServerOptions = {}): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false,
  });

  // Setup context decoration like VeloxApp does
  server.addHook('onRequest', async (request, reply) => {
    (request as { context: BaseContext }).context = createContext(request, reply);
  });

  // Register auth plugin if not skipped
  if (!options.skipAuth) {
    const authOptions = options.authOptions ?? createTestAuthConfig();
    const plugin = authPlugin(authOptions);

    // Register the plugin's register function wrapped with fastify-plugin
    await server.register(
      fp(
        async (instance, opts) => {
          await plugin.register(instance, opts as AuthPluginOptions);
        },
        { name: plugin.name }
      ),
      authOptions
    );
  }

  return server;
}

/**
 * Creates an authorization header with a Bearer token
 */
export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}
