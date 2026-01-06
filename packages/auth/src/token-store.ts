/**
 * Enhanced Token Store for JWT Revocation
 *
 * Provides an enhanced in-memory token store with:
 * - Token revocation with expiry
 * - Refresh token reuse detection
 * - Automatic cleanup of expired entries
 *
 * @module auth/token-store
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Enhanced token store interface
 *
 * Extends basic token revocation with refresh token reuse detection
 * and automatic cleanup capabilities.
 */
export interface EnhancedTokenStore {
  /** Revoke a token with optional expiry time */
  revoke(jti: string, expiresInMs?: number): void;
  /** Check if token is revoked */
  isRevoked(jti: string): boolean;
  /** Mark refresh token as used (for reuse detection) */
  markRefreshTokenUsed(jti: string, userId: string): void;
  /** Check if refresh token was already used, returns userId if reused */
  isRefreshTokenUsed(jti: string): string | undefined;
  /** Revoke all tokens for a user (placeholder for production implementation) */
  revokeAllUserTokens(userId: string): void;
  /** Clear all entries (useful for testing) */
  clear(): void;
  /** Stop cleanup interval and release resources */
  destroy(): void;
}

/**
 * Options for creating an enhanced token store
 */
export interface EnhancedTokenStoreOptions {
  /** Interval for cleanup of expired entries (default: 5 minutes) */
  cleanupIntervalMs?: number;
  /** Default expiry for revoked tokens (default: 7 days) */
  defaultExpiryMs?: number;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Creates an enhanced in-memory token store
 *
 * Provides token revocation with expiry tracking and refresh token
 * reuse detection for security.
 *
 * **WARNING: NOT suitable for production!**
 * Use Redis or database-backed store for:
 * - Persistence across server restarts
 * - Horizontal scaling (multiple server instances)
 * - Proper token revocation across deployments
 *
 * @example
 * ```typescript
 * import { createEnhancedTokenStore } from '@veloxts/auth';
 *
 * // Create store with defaults
 * const tokenStore = createEnhancedTokenStore();
 *
 * // Revoke token on logout
 * tokenStore.revoke(accessTokenJti);
 *
 * // Detect refresh token reuse (security measure)
 * const previousUser = tokenStore.isRefreshTokenUsed(refreshJti);
 * if (previousUser) {
 *   // Potential token theft - revoke all user tokens
 *   tokenStore.revokeAllUserTokens(previousUser);
 *   throw new SecurityError('Token reuse detected');
 * }
 * tokenStore.markRefreshTokenUsed(refreshJti, userId);
 *
 * // Clean up on shutdown
 * process.on('SIGTERM', () => tokenStore.destroy());
 * ```
 */
export function createEnhancedTokenStore(options?: EnhancedTokenStoreOptions): EnhancedTokenStore {
  const { cleanupIntervalMs = 5 * 60 * 1000, defaultExpiryMs = 7 * 24 * 60 * 60 * 1000 } =
    options ?? {};

  const revokedTokens = new Map<string, number>();
  const usedRefreshTokens = new Map<string, string>();
  // Track pending timeouts to prevent memory leaks on destroy()
  const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

  const cleanup = () => {
    const now = Date.now();
    for (const [jti, expiry] of revokedTokens.entries()) {
      if (now > expiry) {
        revokedTokens.delete(jti);
      }
    }
  };

  const cleanupInterval = setInterval(cleanup, cleanupIntervalMs);

  return {
    revoke(jti: string, expiresInMs = defaultExpiryMs): void {
      revokedTokens.set(jti, Date.now() + expiresInMs);
    },

    isRevoked(jti: string): boolean {
      const expiry = revokedTokens.get(jti);
      if (!expiry) return false;
      if (Date.now() > expiry) {
        revokedTokens.delete(jti);
        return false;
      }
      return true;
    },

    markRefreshTokenUsed(jti: string, userId: string): void {
      usedRefreshTokens.set(jti, userId);
      // Auto-expire after default expiry, track timeout for cleanup
      const timeout = setTimeout(() => {
        usedRefreshTokens.delete(jti);
        pendingTimeouts.delete(timeout);
      }, defaultExpiryMs);
      pendingTimeouts.add(timeout);
    },

    isRefreshTokenUsed(jti: string): string | undefined {
      return usedRefreshTokens.get(jti);
    },

    revokeAllUserTokens(userId: string): void {
      // Placeholder - in production, implement proper user->token mapping
      console.warn(
        `[Security] Token reuse detected for user ${userId}. ` +
          'All tokens should be revoked. Implement proper user->token mapping for production.'
      );
    },

    clear(): void {
      // Clear pending timeouts since we're clearing the tokens they reference
      for (const timeout of pendingTimeouts) {
        clearTimeout(timeout);
      }
      pendingTimeouts.clear();
      revokedTokens.clear();
      usedRefreshTokens.clear();
    },

    destroy(): void {
      clearInterval(cleanupInterval);
      // Clear all pending timeouts to prevent memory leaks
      for (const timeout of pendingTimeouts) {
        clearTimeout(timeout);
      }
      pendingTimeouts.clear();
      revokedTokens.clear();
      usedRefreshTokens.clear();
    },
  };
}

/**
 * Default allowed roles for role parsing
 */
export const DEFAULT_ALLOWED_ROLES = ['user', 'admin', 'moderator', 'editor'] as const;

/**
 * Parses JSON-encoded roles string to array
 *
 * Safely parses a JSON array of role strings, filtering to only allowed roles.
 * Returns default ['user'] role if parsing fails or no valid roles found.
 *
 * @param rolesJson - JSON string of roles (e.g., '["admin", "user"]')
 * @param allowedRoles - Optional list of valid roles (defaults to DEFAULT_ALLOWED_ROLES)
 * @returns Array of valid roles, defaults to ['user'] if parsing fails
 *
 * @example
 * ```typescript
 * import { parseUserRoles } from '@veloxts/auth';
 *
 * const roles = parseUserRoles(user.roles);
 * // Input: '["admin", "user"]' -> Output: ['admin', 'user']
 * // Input: null -> Output: ['user']
 * // Input: 'invalid' -> Output: ['user']
 *
 * // With custom allowed roles
 * const roles = parseUserRoles(user.roles, ['admin', 'superadmin']);
 * ```
 */
export function parseUserRoles(
  rolesJson: string | null,
  allowedRoles: readonly string[] = DEFAULT_ALLOWED_ROLES
): string[] {
  if (!rolesJson) return ['user'];

  try {
    const parsed: unknown = JSON.parse(rolesJson);

    if (!Array.isArray(parsed)) {
      return ['user'];
    }

    const validRoles = parsed
      .filter((role): role is string => typeof role === 'string')
      .filter((role) => allowedRoles.includes(role));

    return validRoles.length > 0 ? validRoles : ['user'];
  } catch {
    return ['user'];
  }
}
