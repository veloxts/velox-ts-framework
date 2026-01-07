/**
 * Auth Utilities
 *
 * Shared utilities for authentication that don't require database access.
 * These are safe to import from procedures without pulling in server-only code.
 */

import { createEnhancedTokenStore, jwtManager } from '@veloxts/auth';

// Re-export from @veloxts/auth for convenience
export { createEnhancedTokenStore, parseUserRoles } from '@veloxts/auth';

// ============================================================================
// Token Store
// ============================================================================

/**
 * In-memory token revocation store.
 *
 * PRODUCTION NOTE: Replace with Redis or database-backed store for:
 * - Persistence across server restarts
 * - Horizontal scaling (multiple server instances)
 */
export const tokenStore = createEnhancedTokenStore();

// ============================================================================
// JWT Configuration Helper
// ============================================================================

/**
 * Gets required JWT secrets from environment variables.
 * Throws a clear error in production if secrets are not configured.
 */
export function getJwtSecrets(): { jwtSecret: string; refreshSecret: string } {
  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (!jwtSecret || !refreshSecret) {
    if (isDevelopment) {
      console.warn(
        '\n' +
          '='.repeat(70) +
          '\n' +
          '  WARNING: JWT secrets not configured!\n' +
          '  Using temporary development secrets. DO NOT USE IN PRODUCTION!\n' +
          '\n' +
          '  To configure secrets, add to .env:\n' +
          '    JWT_SECRET=<generate with: openssl rand -base64 64>\n' +
          '    JWT_REFRESH_SECRET=<generate with: openssl rand -base64 64>\n' +
          '='.repeat(70) +
          '\n'
      );
      return {
        jwtSecret:
          jwtSecret || `dev-only-jwt-secret-${Math.random().toString(36).substring(2).repeat(4)}`,
        refreshSecret:
          refreshSecret ||
          `dev-only-refresh-secret-${Math.random().toString(36).substring(2).repeat(4)}`,
      };
    }

    throw new Error(
      '\n' +
        'CRITICAL: JWT secrets are required but not configured.\n' +
        '\n' +
        'Required environment variables:\n' +
        '  - JWT_SECRET: Secret for signing access tokens (64+ characters)\n' +
        '  - JWT_REFRESH_SECRET: Secret for signing refresh tokens (64+ characters)\n' +
        '\n' +
        'Generate secure secrets with:\n' +
        '  openssl rand -base64 64\n' +
        '\n' +
        'Add them to your environment or .env file before starting the server.\n'
    );
  }

  return { jwtSecret, refreshSecret };
}

// ============================================================================
// JWT Manager Singleton
// ============================================================================

const { jwtSecret, refreshSecret } = getJwtSecrets();

/**
 * Shared JWT manager instance for the application.
 *
 * Use this singleton instead of creating new jwtManager instances.
 * Configured with environment variables via getJwtSecrets().
 */
export const jwt = jwtManager({
  secret: jwtSecret,
  refreshSecret: refreshSecret,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  issuer: 'velox-app',
  audience: 'velox-app-client',
});

// ============================================================================
// Full User Helper
// ============================================================================

/**
 * Fetch full user from database when ctx.user doesn't have all fields.
 *
 * `ctx.user` only contains fields returned by `userLoader` (id, email, name, roles).
 * Use this helper when you need additional fields like `organizationId`.
 *
 * @example
 * ```typescript
 * // In a procedure that needs full user data:
 * .query(async ({ ctx }) => {
 *   // ctx.user has: id, email, name, roles
 *   // For additional fields, fetch full user:
 *   const fullUser = await getFullUser(ctx);
 *   return { organizationId: fullUser.organizationId };
 * })
 * ```
 *
 * @param ctx - The procedure context (must have user.id and db)
 * @returns The full user record from database
 * @throws If user is not found (should not happen for authenticated requests)
 */
export async function getFullUser<
  TDb extends { user: { findUniqueOrThrow: (args: { where: { id: string } }) => Promise<unknown> } },
>(ctx: { user: { id: string }; db: TDb }) {
  return ctx.db.user.findUniqueOrThrow({
    where: { id: ctx.user.id },
  });
}
