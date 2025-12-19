/**
 * Authentication Configuration
 *
 * JWT-based authentication configuration.
 *
 * SECURITY: JWT secrets are required from environment variables.
 * The app will fail to start in production without them.
 */

import type { AuthPluginOptions } from '@veloxts/velox';

import { db } from './database.js';

// ============================================================================
// Environment Variable Validation
// ============================================================================

/**
 * Gets required JWT secrets from environment variables.
 * Throws a clear error in production if secrets are not configured.
 */
function getRequiredSecrets(): { jwtSecret: string; refreshSecret: string } {
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
// Token Revocation Store
// ============================================================================

/**
 * In-memory token revocation store.
 *
 * PRODUCTION NOTE: Replace with Redis or database-backed store for:
 * - Persistence across server restarts
 * - Horizontal scaling (multiple server instances)
 */
class InMemoryTokenStore {
  private revokedTokens: Map<string, number> = new Map();
  private usedRefreshTokens: Map<string, string> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  revoke(jti: string, expiresInMs: number = 7 * 24 * 60 * 60 * 1000): void {
    this.revokedTokens.set(jti, Date.now() + expiresInMs);
  }

  isRevoked(jti: string): boolean {
    const expiry = this.revokedTokens.get(jti);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.revokedTokens.delete(jti);
      return false;
    }
    return true;
  }

  markRefreshTokenUsed(jti: string, userId: string): void {
    this.usedRefreshTokens.set(jti, userId);
    setTimeout(() => this.usedRefreshTokens.delete(jti), 7 * 24 * 60 * 60 * 1000);
  }

  isRefreshTokenUsed(jti: string): string | undefined {
    return this.usedRefreshTokens.get(jti);
  }

  revokeAllUserTokens(userId: string): void {
    console.warn(
      `[Security] Token reuse detected for user ${userId}. ` +
        'All tokens should be revoked. Implement proper user->token mapping for production.'
    );
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [jti, expiry] of this.revokedTokens.entries()) {
      if (now > expiry) {
        this.revokedTokens.delete(jti);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const tokenStore = new InMemoryTokenStore();

// ============================================================================
// Role Parsing
// ============================================================================

const ALLOWED_ROLES = ['user', 'admin', 'moderator', 'editor'] as const;

export function parseUserRoles(rolesJson: string | null): string[] {
  if (!rolesJson) return ['user'];

  try {
    const parsed: unknown = JSON.parse(rolesJson);

    if (!Array.isArray(parsed)) {
      return ['user'];
    }

    const validRoles = parsed
      .filter((role): role is string => typeof role === 'string')
      .filter((role) => ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number]));

    return validRoles.length > 0 ? validRoles : ['user'];
  } catch {
    return ['user'];
  }
}

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
  const { jwtSecret, refreshSecret } = getRequiredSecrets();

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
