/**
 * Authentication Configuration
 *
 * JWT-based authentication configuration.
 *
 * SECURITY: JWT secrets are required from environment variables.
 * The app will fail to start in production without them.
 */

import type { AuthPluginOptions } from '@veloxts/velox';

import { getJwtSecrets, parseUserRoles, tokenStore } from '../utils/auth.js';
import { db } from './database.js';

// ============================================================================
// User Loader
// ============================================================================

async function userLoader(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: parseUserRoles(user.roles),
  };
}

// ============================================================================
// Auth Configuration
// ============================================================================

export function createAuthConfig(): AuthPluginOptions {
  const { jwtSecret, refreshSecret } = getJwtSecrets();

  return {
    jwt: {
      secret: jwtSecret,
      refreshSecret: refreshSecret,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'velox-app',
      audience: 'velox-app-client',
    },
    userLoader,
    isTokenRevoked: async (jti: string) => tokenStore.isRevoked(jti),
    rateLimit: {
      max: 100,
      windowMs: 60000,
    },
  };
}

export const authConfig = createAuthConfig();

// Re-export for convenience
export { parseUserRoles, tokenStore } from '../utils/auth.js';
