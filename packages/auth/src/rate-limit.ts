/**
 * Authentication-specific rate limiting
 *
 * Provides specialized rate limiters for authentication endpoints with:
 * - Per-email+IP tracking (prevents brute force on specific accounts)
 * - Account lockout detection
 * - Separate limits for login, register, and password reset
 * - Progressive backoff support
 *
 * @module auth/rate-limit
 */

import type { BaseContext } from '@veloxts/core';
import type { MiddlewareFunction } from '@veloxts/router';

import { AuthError } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for auth rate limiting
 */
export interface AuthRateLimitConfig {
  /**
   * Maximum attempts before lockout
   * @default 5
   */
  maxAttempts?: number;

  /**
   * Window duration in milliseconds
   * @default 900000 (15 minutes)
   */
  windowMs?: number;

  /**
   * Lockout duration in milliseconds after max attempts exceeded
   * @default 900000 (15 minutes)
   */
  lockoutDurationMs?: number;

  /**
   * Custom key generator for rate limiting
   * Default uses IP + identifier (email)
   */
  keyGenerator?: (ctx: BaseContext, identifier?: string) => string;

  /**
   * Error message when rate limited
   * @default 'Too many attempts. Please try again later.'
   */
  message?: string;

  /**
   * Enable progressive backoff (double lockout on repeated violations)
   * @default false
   */
  progressiveBackoff?: boolean;
}

/**
 * Rate limit entry tracking attempts and lockout state
 */
interface RateLimitEntry {
  /** Number of attempts in current window */
  attempts: number;
  /** When the current window resets */
  windowResetAt: number;
  /** When lockout expires (if locked out) */
  lockoutUntil: number | null;
  /** Number of times this key has been locked out (for progressive backoff) */
  lockoutCount: number;
}

/**
 * Configuration for the auth rate limiter factory
 */
export interface AuthRateLimiterConfig {
  /**
   * Rate limit for login attempts
   * @default { maxAttempts: 5, windowMs: 900000 }
   */
  login?: AuthRateLimitConfig;

  /**
   * Rate limit for registration attempts
   * @default { maxAttempts: 3, windowMs: 3600000 }
   */
  register?: AuthRateLimitConfig;

  /**
   * Rate limit for password reset requests
   * @default { maxAttempts: 3, windowMs: 3600000 }
   */
  passwordReset?: AuthRateLimitConfig;

  /**
   * Rate limit for token refresh
   * @default { maxAttempts: 10, windowMs: 60000 }
   */
  refresh?: AuthRateLimitConfig;
}

// ============================================================================
// Rate Limit Store
// ============================================================================

/**
 * In-memory rate limit store
 *
 * PRODUCTION NOTE: Replace with Redis for horizontal scaling:
 * ```typescript
 * import Redis from 'ioredis';
 * const redis = new Redis(process.env.REDIS_URL);
 *
 * // Store entry as JSON with TTL
 * await redis.setex(`ratelimit:${key}`, ttlSeconds, JSON.stringify(entry));
 *
 * // Get entry
 * const data = await redis.get(`ratelimit:${key}`);
 * const entry = data ? JSON.parse(data) : null;
 * ```
 */
const authRateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Cleanup interval reference
 */
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start periodic cleanup of expired entries
 */
function startCleanup(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of authRateLimitStore.entries()) {
      // Remove if both window and lockout have expired
      const windowExpired = entry.windowResetAt <= now;
      const lockoutExpired = !entry.lockoutUntil || entry.lockoutUntil <= now;

      if (windowExpired && lockoutExpired) {
        authRateLimitStore.delete(key);
      }
    }
  }, 60000); // Run every minute
}

/**
 * Stop cleanup interval (for testing)
 */
export function stopAuthRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Clear all rate limit entries (for testing)
 */
export function clearAuthRateLimitStore(): void {
  authRateLimitStore.clear();
}

// Start cleanup on module load
startCleanup();

// ============================================================================
// Configuration Helpers
// ============================================================================

/** Time constants for readability */
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

/** IP-only key generator */
const ipOnlyKeyGenerator = (ctx: BaseContext): string => ctx.request.ip ?? 'unknown';

/**
 * Default key generator combining IP and identifier
 */
function defaultKeyGenerator(ctx: BaseContext, identifier?: string): string {
  const ip = ctx.request.ip ?? 'unknown';
  return identifier ? `${ip}:${identifier.toLowerCase()}` : ip;
}

/**
 * Default configurations for each operation type
 */
interface OperationDefaults {
  maxAttempts: number;
  windowMs: number;
  lockoutDurationMs: number;
  keyGenerator: (ctx: BaseContext, identifier?: string) => string;
  message: string;
  progressiveBackoff: boolean;
}

const OPERATION_DEFAULTS: Record<string, OperationDefaults> = {
  login: {
    maxAttempts: 5,
    windowMs: FIFTEEN_MINUTES_MS,
    lockoutDurationMs: FIFTEEN_MINUTES_MS,
    keyGenerator: defaultKeyGenerator,
    message: 'Too many login attempts. Please try again later.',
    progressiveBackoff: true,
  },
  register: {
    maxAttempts: 3,
    windowMs: ONE_HOUR_MS,
    lockoutDurationMs: ONE_HOUR_MS,
    keyGenerator: ipOnlyKeyGenerator,
    message: 'Too many registration attempts. Please try again later.',
    progressiveBackoff: false,
  },
  passwordReset: {
    maxAttempts: 3,
    windowMs: ONE_HOUR_MS,
    lockoutDurationMs: ONE_HOUR_MS,
    keyGenerator: ipOnlyKeyGenerator,
    message: 'Too many password reset attempts. Please try again later.',
    progressiveBackoff: false,
  },
  refresh: {
    maxAttempts: 10,
    windowMs: ONE_MINUTE_MS,
    lockoutDurationMs: ONE_MINUTE_MS,
    keyGenerator: ipOnlyKeyGenerator,
    message: 'Too many token refresh attempts. Please try again later.',
    progressiveBackoff: false,
  },
};

/**
 * Build a complete rate limit config by merging user config with defaults
 */
function buildRateLimitConfig(
  userConfig: AuthRateLimitConfig | undefined,
  operation: keyof typeof OPERATION_DEFAULTS
): Required<AuthRateLimitConfig> {
  const defaults = OPERATION_DEFAULTS[operation];
  return {
    maxAttempts: userConfig?.maxAttempts ?? defaults.maxAttempts,
    windowMs: userConfig?.windowMs ?? defaults.windowMs,
    lockoutDurationMs: userConfig?.lockoutDurationMs ?? defaults.lockoutDurationMs,
    keyGenerator: userConfig?.keyGenerator ?? defaults.keyGenerator,
    message: userConfig?.message ?? defaults.message,
    progressiveBackoff: userConfig?.progressiveBackoff ?? defaults.progressiveBackoff,
  };
}

// ============================================================================
// Auth Rate Limiter
// ============================================================================

/**
 * Creates an authentication rate limiter
 *
 * This factory returns rate limit middlewares configured for different
 * auth operations with sensible defaults.
 *
 * @example
 * ```typescript
 * const authRateLimiter = createAuthRateLimiter({
 *   login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
 *   register: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
 * });
 *
 * // Apply to procedures
 * const login = procedure()
 *   .use(authRateLimiter.login(ctx => ctx.input.email))
 *   .mutation(loginHandler);
 *
 * const register = procedure()
 *   .use(authRateLimiter.register())
 *   .mutation(registerHandler);
 * ```
 */
export function createAuthRateLimiter(config: AuthRateLimiterConfig = {}) {
  // Build configurations using helper
  const loginConfig = buildRateLimitConfig(config.login, 'login');
  const registerConfig = buildRateLimitConfig(config.register, 'register');
  const passwordResetConfig = buildRateLimitConfig(config.passwordReset, 'passwordReset');
  const refreshConfig = buildRateLimitConfig(config.refresh, 'refresh');

  // Config lookup for operations
  const configs: Record<string, Required<AuthRateLimitConfig>> = {
    login: loginConfig,
    register: registerConfig,
    'password-reset': passwordResetConfig,
    refresh: refreshConfig,
  };

  return {
    /**
     * Rate limiter for login attempts
     *
     * @param identifierFn - Function to extract identifier (email) from context
     *
     * @example
     * ```typescript
     * login: procedure()
     *   .use(authRateLimiter.login((ctx) => (ctx.input as { email: string }).email))
     *   .input(LoginSchema)
     *   .mutation(handler)
     * ```
     */
    login: <TInput, TContext extends BaseContext, TOutput>(
      identifierFn?: (ctx: TContext & { input?: unknown }) => string
    ): MiddlewareFunction<TInput, TContext, TContext, TOutput> => {
      return createRateLimitMiddleware(loginConfig, 'login', identifierFn);
    },

    /**
     * Rate limiter for registration attempts
     * Uses IP-only by default (no identifier needed)
     */
    register: <TInput, TContext extends BaseContext, TOutput>(): MiddlewareFunction<
      TInput,
      TContext,
      TContext,
      TOutput
    > => {
      return createRateLimitMiddleware(registerConfig, 'register');
    },

    /**
     * Rate limiter for password reset requests
     *
     * @param identifierFn - Optional function to extract identifier (email)
     */
    passwordReset: <TInput, TContext extends BaseContext, TOutput>(
      identifierFn?: (ctx: TContext & { input?: unknown }) => string
    ): MiddlewareFunction<TInput, TContext, TContext, TOutput> => {
      return createRateLimitMiddleware(passwordResetConfig, 'password-reset', identifierFn);
    },

    /**
     * Rate limiter for token refresh
     */
    refresh: <TInput, TContext extends BaseContext, TOutput>(): MiddlewareFunction<
      TInput,
      TContext,
      TContext,
      TOutput
    > => {
      return createRateLimitMiddleware(refreshConfig, 'refresh');
    },

    /**
     * Record a failed attempt (call after authentication fails)
     *
     * This allows tracking failures even when rate limit hasn't been hit,
     * enabling account lockout after X failed passwords.
     *
     * @param key - Rate limit key (usually IP:email or IP)
     * @param operation - Operation type for key namespacing
     */
    recordFailure: (key: string, operation: 'login' | 'register' | 'password-reset') => {
      const fullKey = `auth:${operation}:${key}`;
      const operationConfig = configs[operation];

      const now = Date.now();
      const entry = authRateLimitStore.get(fullKey);

      if (!entry || entry.windowResetAt <= now) {
        // Start new window
        authRateLimitStore.set(fullKey, {
          attempts: 1,
          windowResetAt: now + operationConfig.windowMs,
          lockoutUntil: null,
          lockoutCount: entry?.lockoutCount ?? 0,
        });
      } else {
        // Increment in current window
        entry.attempts++;

        // Check if lockout should trigger
        if (entry.attempts >= operationConfig.maxAttempts) {
          const lockoutMultiplier = operationConfig.progressiveBackoff
            ? 2 ** entry.lockoutCount
            : 1;
          entry.lockoutUntil = now + operationConfig.lockoutDurationMs * lockoutMultiplier;
          entry.lockoutCount++;
        }
      }
    },

    /**
     * Reset rate limit for a key (call after successful auth)
     */
    resetLimit: (key: string, operation: 'login' | 'register' | 'password-reset') => {
      const fullKey = `auth:${operation}:${key}`;
      authRateLimitStore.delete(fullKey);
    },

    /**
     * Check if a key is currently locked out
     */
    isLockedOut: (key: string, operation: 'login' | 'register' | 'password-reset'): boolean => {
      const fullKey = `auth:${operation}:${key}`;
      const entry = authRateLimitStore.get(fullKey);

      if (!entry || !entry.lockoutUntil) return false;
      if (entry.lockoutUntil <= Date.now()) {
        // Lockout expired
        return false;
      }
      return true;
    },

    /**
     * Get remaining attempts for a key
     */
    getRemainingAttempts: (
      key: string,
      operation: 'login' | 'register' | 'password-reset' | 'refresh'
    ): number => {
      const fullKey = `auth:${operation}:${key}`;
      const operationConfig = configs[operation];

      const entry = authRateLimitStore.get(fullKey);
      if (!entry || entry.windowResetAt <= Date.now()) {
        return operationConfig.maxAttempts;
      }
      return Math.max(0, operationConfig.maxAttempts - entry.attempts);
    },
  };
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Creates the actual rate limit middleware
 */
function createRateLimitMiddleware<TInput, TContext extends BaseContext, TOutput>(
  config: Required<AuthRateLimitConfig>,
  operation: string,
  identifierFn?: (ctx: TContext & { input?: unknown }) => string
): MiddlewareFunction<TInput, TContext, TContext, TOutput> {
  return async ({ ctx, input, next }) => {
    const now = Date.now();

    // Generate rate limit key
    const identifier = identifierFn ? identifierFn({ ...ctx, input }) : undefined;
    const baseKey = config.keyGenerator(ctx, identifier);
    const key = `auth:${operation}:${baseKey}`;

    // Get or create entry
    let entry = authRateLimitStore.get(key);

    // Check if currently locked out
    if (entry?.lockoutUntil && entry.lockoutUntil > now) {
      const retryAfter = Math.ceil((entry.lockoutUntil - now) / 1000);

      // Set headers
      ctx.reply.header('X-RateLimit-Limit', String(config.maxAttempts));
      ctx.reply.header('X-RateLimit-Remaining', '0');
      ctx.reply.header('X-RateLimit-Reset', String(Math.ceil(entry.lockoutUntil / 1000)));
      ctx.reply.header('Retry-After', String(retryAfter));

      throw new AuthError(
        `${config.message} Try again in ${formatDuration(retryAfter * 1000)}.`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    // Clean up expired window
    if (entry && entry.windowResetAt <= now) {
      // Preserve lockout count for progressive backoff
      const lockoutCount = entry.lockoutCount;
      entry = {
        attempts: 0,
        windowResetAt: now + config.windowMs,
        lockoutUntil: null,
        lockoutCount,
      };
      authRateLimitStore.set(key, entry);
    }

    // Initialize if no entry
    if (!entry) {
      entry = {
        attempts: 0,
        windowResetAt: now + config.windowMs,
        lockoutUntil: null,
        lockoutCount: 0,
      };
      authRateLimitStore.set(key, entry);
    }

    // Increment attempt count
    entry.attempts++;

    // Set rate limit headers
    const remaining = Math.max(0, config.maxAttempts - entry.attempts);
    ctx.reply.header('X-RateLimit-Limit', String(config.maxAttempts));
    ctx.reply.header('X-RateLimit-Remaining', String(remaining));
    ctx.reply.header('X-RateLimit-Reset', String(Math.ceil(entry.windowResetAt / 1000)));

    // Check if limit exceeded
    if (entry.attempts > config.maxAttempts) {
      // Apply lockout
      const lockoutMultiplier = config.progressiveBackoff ? 2 ** entry.lockoutCount : 1;
      entry.lockoutUntil = now + config.lockoutDurationMs * lockoutMultiplier;
      entry.lockoutCount++;

      const retryAfter = Math.ceil((entry.lockoutUntil - now) / 1000);
      ctx.reply.header('Retry-After', String(retryAfter));

      throw new AuthError(
        `${config.message} Try again in ${formatDuration(retryAfter * 1000)}.`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    return next();
  };
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;

  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
}

// ============================================================================
// Type Export
// ============================================================================

/**
 * Type for the auth rate limiter instance returned by createAuthRateLimiter
 *
 * Provides rate limiting methods for login, register, password reset, and token refresh.
 * Also includes utility methods for recording failures, resetting limits, and checking lockout status.
 */
export type AuthRateLimiter = ReturnType<typeof createAuthRateLimiter>;

// ============================================================================
// Convenience Export
// ============================================================================

/**
 * Pre-configured auth rate limiter with sensible defaults
 *
 * @example
 * ```typescript
 * import { authRateLimiter } from '@veloxts/auth';
 *
 * const login = procedure()
 *   .use(authRateLimiter.login((ctx) => ctx.input.email))
 *   .mutation(handler);
 * ```
 */
export const authRateLimiter = createAuthRateLimiter();
