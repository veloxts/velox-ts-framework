/**
 * @veloxts/testing - Internal testing utilities for VeloxTS framework
 *
 * This package provides common test utilities used across VeloxTS packages:
 * - Test server factory with VeloxApp-like context setup
 * - HTTP helpers for authorization headers
 * - Test secrets for JWT/session/CSRF testing
 * - User factories and loaders
 *
 * @example
 * ```typescript
 * import {
 *   createTestServer,
 *   wrapVeloxPlugin,
 *   authHeader,
 *   TEST_SECRETS,
 *   createTestUser,
 * } from '@veloxts/testing';
 *
 * // Create a test server
 * const server = await createTestServer();
 *
 * // Register plugins
 * await server.register(wrapVeloxPlugin(myPlugin(config)), config);
 *
 * // Make authenticated requests
 * const response = await server.inject({
 *   method: 'GET',
 *   url: '/protected',
 *   headers: authHeader(token),
 * });
 * ```
 *
 * @module testing
 * @internal This package is for internal use only and is not published to npm
 */

// Server utilities
export { createTestServer, wrapVeloxPlugin } from './server.js';
export type { TestServerOptions } from './server.js';

// Helper utilities
export {
  authHeader,
  createTestUser,
  createUserLoader,
  jsonHeaders,
  TEST_SECRETS,
  wait,
} from './helpers.js';
export type { TestUser } from './helpers.js';
