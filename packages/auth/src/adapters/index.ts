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
 * - **ClerkAdapter** - Integration with Clerk authentication platform
 * - **Auth0Adapter** - Integration with Auth0 identity platform
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
 *
 * @example Clerk Adapter
 * ```typescript
 * import { createClerkAdapter } from '@veloxts/auth/adapters';
 * import { createAuthAdapterPlugin } from '@veloxts/auth';
 * import { createClerkClient } from '@clerk/backend';
 *
 * const clerk = createClerkClient({
 *   secretKey: process.env.CLERK_SECRET_KEY!,
 * });
 *
 * const adapter = createClerkAdapter({
 *   name: 'clerk',
 *   clerk,
 *   authorizedParties: ['http://localhost:3000'],
 * });
 *
 * const plugin = createAuthAdapterPlugin({
 *   adapter,
 *   config: adapter.config,
 * });
 * ```
 *
 * @example Auth0 Adapter
 * ```typescript
 * import { createAuth0Adapter } from '@veloxts/auth/adapters';
 * import { createAuthAdapterPlugin } from '@veloxts/auth';
 *
 * const adapter = createAuth0Adapter({
 *   name: 'auth0',
 *   domain: process.env.AUTH0_DOMAIN!,
 *   audience: process.env.AUTH0_AUDIENCE!,
 *   clientId: process.env.AUTH0_CLIENT_ID, // Optional
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

// ============================================================================
// Clerk Adapter (External)
// ============================================================================

export type {
  ClerkAdapterConfig,
  ClerkClient,
  ClerkSessionClaims,
  ClerkUser,
  ClerkVerificationResult,
} from './clerk.js';
export { ClerkAdapter, createClerkAdapter } from './clerk.js';

// ============================================================================
// Auth0 Adapter (External)
// ============================================================================

export type {
  Auth0AdapterConfig,
  Auth0Claims,
  Auth0User,
  JWKSKey,
  JWKSResponse,
  JwtVerifier,
} from './auth0.js';
export { Auth0Adapter, createAuth0Adapter } from './auth0.js';
