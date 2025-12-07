/**
 * Auth Adapters - External authentication provider integrations
 *
 * This module exports adapters for integrating external authentication
 * providers with VeloxTS. Each adapter implements the AuthAdapter interface
 * and can be used with createAuthAdapterPlugin.
 *
 * @module auth/adapters
 *
 * @example
 * ```typescript
 * import { createBetterAuthAdapter } from '@veloxts/auth/adapters';
 * import { createAuthAdapterPlugin } from '@veloxts/auth';
 *
 * const adapter = createBetterAuthAdapter({
 *   name: 'better-auth',
 *   auth: betterAuth({ ... }),
 * });
 *
 * const plugin = createAuthAdapterPlugin({
 *   adapter,
 *   config: adapter.config,
 * });
 * ```
 */

export type {
  BetterAuthAdapterConfig,
  BetterAuthApi,
  BetterAuthHandler,
  BetterAuthInstance,
  BetterAuthSession,
  BetterAuthSessionResult,
  BetterAuthUser,
} from './better-auth.js';
// BetterAuth Adapter
export {
  AuthAdapterError,
  BetterAuthAdapter,
  createBetterAuthAdapter,
} from './better-auth.js';
