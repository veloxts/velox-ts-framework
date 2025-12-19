/**
 * Adapters
 *
 * Provides adapters for integrating VeloxTS with different HTTP layers.
 *
 * @module @veloxts/web/adapters
 */

// Fastify adapter for embedding Fastify in Vinxi
export { createApiHandler, isFastifyInstance } from './fastify-adapter.js';
// H3/Vinxi adapter for RSC server actions
export {
  type AuthenticatedH3ActionContext,
  createH3Action,
  createH3AuthAdapter,
  createH3Context,
  createMockAuthenticatedH3Context,
  createMockH3Context,
  type H3ActionContext,
  type H3AdapterConfig,
  type H3AuthAdapter,
  H3AuthError,
  type H3CookieOptions,
  isAuthenticatedH3Context,
  isH3Context,
} from './h3-adapter.js';
