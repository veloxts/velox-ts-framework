/**
 * Auth Adapters - Authentication provider integrations
 *
 * This module exports adapters for integrating authentication providers
 * with VeloxTS. Each adapter implements the AuthAdapter interface and
 * can be used with createAuthAdapterPlugin.
 *
 * Available adapters:
 * - **JwtAdapter** - Built-in JWT authentication using the adapter pattern
 * - **BetterAuthAdapter** - Integration with BetterAuth library
 *
 * @module auth/adapters
 *
 * @example JWT Adapter
 * ```typescript
 * import { createJwtAdapter } from '@veloxts/auth/adapters';
 * import { createAuthAdapterPlugin } from '@veloxts/auth';
 *
 * const { adapter, config } = createJwtAdapter({
 *   jwt: { secret: process.env.JWT_SECRET! },
 *   userLoader: async (userId) => db.user.findUnique({ where: { id: userId } }),
 * });
 *
 * const plugin = createAuthAdapterPlugin({ adapter, config });
 * app.use(plugin);
 * ```
 *
 * @example BetterAuth Adapter
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

// ============================================================================
// JWT Adapter (Built-in)
// ============================================================================

export type { JwtAdapterConfig } from './jwt-adapter.js';
export { AuthAdapterError, createJwtAdapter, JwtAdapter } from './jwt-adapter.js';

// ============================================================================
// BetterAuth Adapter (External)
// ============================================================================

export type {
  BetterAuthAdapterConfig,
  BetterAuthApi,
  BetterAuthHandler,
  BetterAuthInstance,
  BetterAuthSession,
  BetterAuthSessionResult,
  BetterAuthUser,
} from './better-auth.js';
export { BetterAuthAdapter, createBetterAuthAdapter } from './better-auth.js';
