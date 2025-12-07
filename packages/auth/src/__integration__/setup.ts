/**
 * Integration test setup utilities
 * @module __integration__/setup
 */

import type { FastifyInstance } from 'fastify';

import { createTestServer as baseCreateTestServer, wrapVeloxPlugin } from '@veloxts/testing';

import { authPlugin, type AuthPluginOptions } from '../plugin.js';
import { createTestAuthConfig } from './fixtures.js';

// Re-export utilities from @veloxts/testing
export { authHeader } from '@veloxts/testing';

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
  const server = await baseCreateTestServer({ logger: false });

  // Register auth plugin if not skipped
  if (!options.skipAuth) {
    const authOptions: AuthPluginOptions = options.authOptions ?? createTestAuthConfig();
    const plugin = authPlugin(authOptions);

    await server.register(wrapVeloxPlugin(plugin), authOptions);
  }

  return server;
}
