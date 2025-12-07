/**
 * Authentication middleware for @veloxts/auth
 * @module auth/middleware
 */

import type { BaseContext } from '@veloxts/core';
import type { MiddlewareFunction } from '@veloxts/router';

import { executeGuards } from './guards.js';
import { JwtManager } from './jwt.js';
import type {
  AuthConfig,
  AuthContext,
  AuthMiddlewareOptions,
  GuardDefinition,
  TokenPayload,
  User,
} from './types.js';
import { AuthError } from './types.js';

// ============================================================================
// Auth Middleware Factory
// ============================================================================

/**
 * Creates an authentication middleware for procedures (succinct API)
 *
 * This middleware:
 * 1. Extracts JWT from Authorization header
 * 2. Verifies the token
 * 3. Loads user from database (if userLoader provided)
 * 4. Adds user and auth context to ctx
 * 5. Runs guards if specified
 *
 * @example
 * ```typescript
 * const auth = authMiddleware(authConfig);
 *
 * // Use in procedures
 * const getProfile = procedure()
 *   .use(auth.middleware())
 *   .query(async ({ ctx }) => {
 *     return ctx.user; // Guaranteed to exist
 *   });
 *
 * // Optional auth (user may be undefined)
 * const getPosts = procedure()
 *   .use(auth.middleware({ optional: true }))
 *   .query(async ({ ctx }) => {
 *     // ctx.user may be undefined
 *     return fetchPosts(ctx.user?.id);
 *   });
 *
 * // With guards
 * const adminOnly = procedure()
 *   .use(auth.middleware({ guards: [hasRole('admin')] }))
 *   .query(async ({ ctx }) => {
 *     // Only admins get here
 *   });
 * ```
 */
export function authMiddleware(config: AuthConfig) {
  const jwt = new JwtManager(config.jwt);

  /**
   * Creates the actual middleware function
   */
  function middleware<TInput, TContext extends BaseContext, TOutput>(
    options: AuthMiddlewareOptions = {}
  ): MiddlewareFunction<TInput, TContext, TContext & { user?: User; auth: AuthContext }, TOutput> {
    return async ({ ctx, next }) => {
      const request = ctx.request;

      // Extract token from header
      const authHeader = request.headers.authorization;
      const token = jwt.extractFromHeader(authHeader);

      // No token handling
      if (!token) {
        if (options.optional) {
          // Optional auth - continue without user
          const authContext: AuthContext = {
            user: undefined,
            token: undefined,
            isAuthenticated: false,
          };

          return next({
            ctx: {
              ...ctx,
              auth: authContext,
              user: undefined,
            },
          });
        }

        // Required auth - reject
        throw new AuthError('Authorization header required', 401);
      }

      // Verify token
      let payload: TokenPayload;
      try {
        payload = jwt.verifyToken(token);
      } catch (error) {
        if (options.optional) {
          // Invalid token with optional auth - continue without user
          const authContext: AuthContext = {
            user: undefined,
            token: undefined,
            isAuthenticated: false,
          };

          return next({
            ctx: {
              ...ctx,
              auth: authContext,
              user: undefined,
            },
          });
        }

        throw new AuthError(error instanceof Error ? error.message : 'Invalid token', 401);
      }

      // Check if token is revoked
      if (config.isTokenRevoked && payload.jti) {
        const revoked = await config.isTokenRevoked(payload.jti);
        if (revoked) {
          throw new AuthError('Token has been revoked', 401, 'TOKEN_REVOKED');
        }
      }

      // Load user from database
      let user: User | null = null;
      if (config.userLoader) {
        user = await config.userLoader(payload.sub);
        if (!user && !options.optional) {
          throw new AuthError('User not found', 401, 'USER_NOT_FOUND');
        }
      } else {
        // No user loader - create minimal user from token
        user = {
          id: payload.sub,
          email: payload.email,
        };
      }

      // Create auth context
      const authContext: AuthContext = {
        user: user ?? undefined,
        token: payload,
        isAuthenticated: !!user,
      };

      // Build extended context
      const extendedCtx = {
        ...ctx,
        auth: authContext,
        user: user ?? undefined,
      };

      // Run guards if specified
      if (options.guards && options.guards.length > 0) {
        // Validate that all guards are GuardDefinition objects (strings are not supported)
        const guardDefs = options.guards.map((g) => {
          if (typeof g === 'string') {
            throw new AuthError(
              `String guard references are not supported. Use a GuardDefinition object instead of "${g}"`,
              500,
              'INVALID_GUARD'
            );
          }
          return g;
        }) as GuardDefinition<typeof extendedCtx>[];

        const result = await executeGuards(guardDefs, extendedCtx, request, ctx.reply);

        if (!result.passed) {
          throw new AuthError(
            result.message ?? `Guard failed: ${result.failedGuard}`,
            result.statusCode ?? 403,
            'GUARD_FAILED'
          );
        }
      }

      // Continue to next middleware/handler
      return next({ ctx: extendedCtx });
    };
  }

  /**
   * Shorthand for required authentication
   */
  function requireAuth<TInput, TContext extends BaseContext, TOutput>(
    guards?: Array<GuardDefinition | string>
  ): MiddlewareFunction<TInput, TContext, TContext & { user: User; auth: AuthContext }, TOutput> {
    return middleware({ optional: false, guards }) as MiddlewareFunction<
      TInput,
      TContext,
      TContext & { user: User; auth: AuthContext },
      TOutput
    >;
  }

  /**
   * Shorthand for optional authentication
   */
  function optionalAuth<TInput, TContext extends BaseContext, TOutput>(): MiddlewareFunction<
    TInput,
    TContext,
    TContext & { user?: User; auth: AuthContext },
    TOutput
  > {
    return middleware({ optional: true });
  }

  return {
    middleware,
    requireAuth,
    optionalAuth,
    jwt,
  };
}

/**
 * Creates an authentication middleware for procedures
 *
 * @deprecated Use `authMiddleware()` instead. Will be removed in v0.9.
 */
export const createAuthMiddleware = authMiddleware;

// ============================================================================
// Error Helpers
// ============================================================================

// AuthError is now imported from types.ts

// ============================================================================
// Rate Limiting Middleware
// ============================================================================

/**
 * Simple in-memory rate limiter
 * For production, use Redis-based rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Creates a rate limiting middleware (succinct API)
 *
 * @example
 * ```typescript
 * const rateLimit = rateLimitMiddleware({
 *   max: 100,
 *   windowMs: 60000, // 1 minute
 * });
 *
 * const login = procedure()
 *   .use(rateLimit)
 *   .input(LoginSchema)
 *   .mutation(handler);
 * ```
 */
export function rateLimitMiddleware<TInput, TContext extends BaseContext, TOutput>(options: {
  max?: number;
  windowMs?: number;
  keyGenerator?: (ctx: TContext) => string;
  message?: string;
}): MiddlewareFunction<TInput, TContext, TContext, TOutput> {
  const max = options.max ?? 100;
  const windowMs = options.windowMs ?? 60000;
  const keyGenerator = options.keyGenerator ?? ((ctx) => ctx.request.ip ?? 'unknown');
  const message = options.message ?? 'Too many requests, please try again later';

  return async ({ ctx, next }) => {
    const key = keyGenerator(ctx);
    const now = Date.now();

    let record = rateLimitStore.get(key);

    // Clean up expired record
    if (record && record.resetAt <= now) {
      rateLimitStore.delete(key);
      record = undefined;
    }

    if (!record) {
      // First request in window
      record = { count: 1, resetAt: now + windowMs };
      rateLimitStore.set(key, record);
    } else {
      // Increment count
      record.count++;
    }

    // Add rate limit headers (always, even on 429 responses)
    ctx.reply.header('X-RateLimit-Limit', String(max));
    ctx.reply.header('X-RateLimit-Remaining', String(Math.max(0, max - record.count)));
    ctx.reply.header('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

    // Check limit (after setting headers so they're included in 429 response)
    if (record.count > max) {
      throw new AuthError(message, 429, 'RATE_LIMIT_EXCEEDED');
    }

    return next();
  };
}

/**
 * Creates a rate limiting middleware
 *
 * @deprecated Use `rateLimitMiddleware()` instead. Will be removed in v0.9.
 */
export const createRateLimitMiddleware = rateLimitMiddleware;

/**
 * Clears rate limit store (useful for testing)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
