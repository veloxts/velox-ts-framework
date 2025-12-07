/**
 * Authentication Configuration
 *
 * JWT-based authentication configuration for the playground app.
 *
 * SECURITY: JWT secrets are required from environment variables.
 * The app will fail to start without them configured.
 */

import type { AuthPluginOptions } from '@veloxts/auth';

import { prisma } from '../database/index.js';

// ============================================================================
// Environment Variable Validation
// ============================================================================

/**
 * Gets required JWT secrets from environment variables.
 * Throws a clear error if secrets are not configured.
 *
 * @throws Error if JWT_SECRET or JWT_REFRESH_SECRET are not set
 */
function getRequiredSecrets(): { jwtSecret: string; refreshSecret: string } {
  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  // Allow development mode to use generated secrets
  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (!jwtSecret || !refreshSecret) {
    if (isDevelopment) {
      // In development, generate temporary secrets and warn
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

    // In production, fail fast with clear instructions
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

  // Validate minimum secret length (64 characters for HMAC-SHA512)
  if (jwtSecret.length < 64 || refreshSecret.length < 64) {
    console.warn('WARNING: JWT secrets should be at least 64 characters for HMAC-SHA512 security.');
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
 * - Proper memory management
 *
 * Example Redis implementation:
 * ```typescript
 * import Redis from 'ioredis';
 * const redis = new Redis(process.env.REDIS_URL);
 *
 * export const tokenStore = {
 *   revoke: async (jti: string, expiresInMs: number) => {
 *     await redis.set(`revoked:${jti}`, '1', 'PX', expiresInMs);
 *   },
 *   isRevoked: async (jti: string) => {
 *     return (await redis.exists(`revoked:${jti}`)) === 1;
 *   },
 * };
 * ```
 */
class InMemoryTokenStore {
  private revokedTokens: Map<string, number> = new Map(); // jti -> expiration timestamp
  private usedRefreshTokens: Map<string, string> = new Map(); // jti -> userId (for rotation)
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired tokens every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Revoke a token by its JTI (JWT ID)
   * @param jti - The unique token identifier
   * @param expiresInMs - How long to keep the revocation record (token's remaining lifetime)
   */
  revoke(jti: string, expiresInMs: number = 7 * 24 * 60 * 60 * 1000): void {
    this.revokedTokens.set(jti, Date.now() + expiresInMs);
  }

  /**
   * Check if a token has been revoked
   */
  isRevoked(jti: string): boolean {
    const expiry = this.revokedTokens.get(jti);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.revokedTokens.delete(jti);
      return false;
    }
    return true;
  }

  /**
   * Mark a refresh token as used (for rotation)
   * @param jti - The refresh token's JTI
   * @param userId - The user who owns this token
   */
  markRefreshTokenUsed(jti: string, userId: string): void {
    this.usedRefreshTokens.set(jti, userId);
    // Auto-cleanup after 7 days (refresh token lifetime)
    setTimeout(() => this.usedRefreshTokens.delete(jti), 7 * 24 * 60 * 60 * 1000);
  }

  /**
   * Check if a refresh token has already been used
   * @returns The userId if token was used, undefined otherwise
   */
  isRefreshTokenUsed(jti: string): string | undefined {
    return this.usedRefreshTokens.get(jti);
  }

  /**
   * Revoke all tokens for a user (used when token reuse is detected)
   * Note: With in-memory store, this is a no-op since we can't track all user tokens.
   * A proper implementation would store user -> token mappings.
   */
  revokeAllUserTokens(userId: string): void {
    // In a real implementation, this would revoke all tokens for the user
    console.warn(
      `[Security] Token reuse detected for user ${userId}. ` +
        'All tokens should be revoked. Implement proper user->token mapping for production.'
    );
  }

  /**
   * Clean up expired revocation records
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [jti, expiry] of this.revokedTokens.entries()) {
      if (now > expiry) {
        this.revokedTokens.delete(jti);
      }
    }
  }

  /**
   * Destroy the store (cleanup interval)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton token store for use in auth procedures
export const tokenStore = new InMemoryTokenStore();

// ============================================================================
// User Loader
// ============================================================================

/**
 * Allowed roles whitelist for validation
 */
const ALLOWED_ROLES = ['user', 'admin', 'moderator', 'editor'] as const;

/**
 * Safely parse user roles from JSON string with validation
 *
 * @param rolesJson - JSON string of roles from database
 * @returns Array of validated role strings
 */
export function parseUserRoles(rolesJson: string | null): string[] {
  if (!rolesJson) return ['user'];

  try {
    const parsed: unknown = JSON.parse(rolesJson);

    // Validate it's an array
    if (!Array.isArray(parsed)) {
      console.warn('[Security] Invalid roles format: not an array', { rolesJson });
      return ['user'];
    }

    // Filter to valid string roles only
    const validRoles = parsed
      .filter((role): role is string => typeof role === 'string')
      .filter((role) => ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number]));

    if (validRoles.length === 0) {
      return ['user'];
    }

    // Warn if some roles were filtered out
    if (validRoles.length !== parsed.length) {
      console.warn('[Security] Some invalid roles were filtered out', {
        original: parsed,
        valid: validRoles,
      });
    }

    return validRoles;
  } catch {
    console.error('[Security] Failed to parse user roles', { rolesJson });
    return ['user'];
  }
}

/**
 * Loads user from database by ID
 * Called on every authenticated request to populate ctx.user
 */
async function userLoader(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

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
      issuer: 'velox-playground',
      audience: 'velox-playground-app',
    },
    userLoader,
    // Token revocation check
    isTokenRevoked: async (jti: string) => {
      return tokenStore.isRevoked(jti);
    },
    rateLimit: {
      max: 100,
      windowMs: 60000, // 1 minute
    },
  };
}

export const authConfig = createAuthConfig();
