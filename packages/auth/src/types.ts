/**
 * Type definitions for @veloxts/auth
 * @module auth/types
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Authentication/Authorization error class
 *
 * Provides structured error information with HTTP status code and error code.
 *
 * @example
 * ```typescript
 * throw new AuthError('Token has expired', 401);
 * throw new AuthError('Access denied', 403, 'FORBIDDEN');
 * ```
 */
export class AuthError extends Error {
  /** HTTP status code for the error response */
  readonly statusCode: number;

  /** Error code for programmatic error handling */
  readonly code: string;

  constructor(message: string, statusCode: number, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace?.(this, AuthError);
  }
}

// ============================================================================
// User Types
// ============================================================================

/**
 * Base user interface available on `ctx.user` after authentication.
 *
 * **IMPORTANT:** `ctx.user` is NOT the raw database user. It only contains
 * fields explicitly returned by your `userLoader` function passed to `authPlugin()`.
 *
 * ## How ctx.user Gets Populated
 *
 * 1. JWT token is validated from cookie/header
 * 2. User ID is extracted from token payload
 * 3. Your `userLoader(userId)` function is called
 * 4. Only fields returned by `userLoader` are available on `ctx.user`
 *
 * ## Default Fields
 *
 * The scaffolded templates return:
 * - `id`: User's unique identifier
 * - `email`: User's email address
 * - `name`: User's display name
 * - `roles`: Array of role names
 *
 * ## Adding Custom Fields
 *
 * To add fields like `organizationId` to `ctx.user`:
 *
 * 1. Update your `userLoader` to return the field:
 * ```typescript
 * async function userLoader(userId: string) {
 *   const user = await db.user.findUnique({ where: { id: userId } });
 *   return {
 *     id: user.id,
 *     email: user.email,
 *     organizationId: user.organizationId, // Add field here
 *   };
 * }
 * ```
 *
 * 2. Extend this interface via declaration merging:
 * ```typescript
 * declare module '@veloxts/auth' {
 *   interface User {
 *     organizationId: string;
 *   }
 * }
 * ```
 *
 * ## Common Mistake
 *
 * ```typescript
 * // ❌ WRONG - undefined if not returned by userLoader
 * const orgId = ctx.user.organizationId;
 *
 * // ✅ CORRECT - After adding to userLoader
 * const orgId = ctx.user.organizationId;
 *
 * // ✅ ALTERNATIVE - Fetch full user when needed
 * const fullUser = await db.user.findUnique({ where: { id: ctx.user.id } });
 * ```
 *
 * This approach provides:
 * - Full type safety (no implicit `unknown` properties)
 * - Better IDE autocomplete
 * - Compile-time errors for typos
 *
 * @see userLoader option in authPlugin configuration
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User email address */
  email: string;
  /** Whether the user's email has been verified */
  emailVerified?: boolean;
  /** User roles for authorization */
  roles?: string[];
  /** User permissions for fine-grained access control */
  permissions?: string[];
}

/**
 * Payload stored in JWT tokens
 */
export interface TokenPayload {
  /** User ID */
  sub: string;
  /** User email */
  email: string;
  /** Token type */
  type: 'access' | 'refresh';
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
  /** Token ID (for revocation) */
  jti?: string;
  /** Token issuer */
  iss?: string;
  /** Token audience */
  aud?: string;
  /** Not before timestamp - token is invalid before this time */
  nbf?: number;
  /** Tenant ID for multi-tenancy (optional) */
  tenantId?: string;
  /** Additional claims */
  [key: string]: unknown;
}

/**
 * Token pair returned after authentication
 */
export interface TokenPair {
  /** Short-lived access token */
  accessToken: string;
  /** Long-lived refresh token */
  refreshToken: string;
  /** Access token expiration in seconds */
  expiresIn: number;
  /** Token type (always 'Bearer') */
  tokenType: 'Bearer';
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * JWT configuration options
 */
export interface JwtConfig {
  /** Secret key for signing tokens (required) */
  secret: string;
  /**
   * Separate secret for signing refresh tokens (optional)
   * If not provided, the main `secret` will be used for both token types.
   * Using a separate secret adds an extra layer of security.
   */
  refreshSecret?: string;
  /** Access token expiration (default: '15m') */
  accessTokenExpiry?: string;
  /** Refresh token expiration (default: '7d') */
  refreshTokenExpiry?: string;
  /** Token issuer (optional) */
  issuer?: string;
  /** Token audience (optional) */
  audience?: string;
}

/**
 * Password hashing configuration
 */
export interface HashConfig {
  /** Hashing algorithm: 'bcrypt' or 'argon2' (default: 'bcrypt') */
  algorithm?: 'bcrypt' | 'argon2';
  /** bcrypt rounds (default: 12) */
  bcryptRounds?: number;
  /** argon2 memory cost in KB (default: 65536) */
  argon2MemoryCost?: number;
  /** argon2 time cost (default: 3) */
  argon2TimeCost?: number;
  /** argon2 parallelism (default: 4) */
  argon2Parallelism?: number;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per window (default: 100) */
  max?: number;
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number;
  /** Key generator function (default: IP-based) */
  keyGenerator?: (request: FastifyRequest) => string;
  /** Skip function - return true to bypass rate limiting */
  skip?: (request: FastifyRequest) => boolean;
  /** Custom error message */
  message?: string;
}

/**
 * Main auth plugin configuration
 */
export interface AuthConfig {
  /** JWT configuration (required) */
  jwt: JwtConfig;
  /** Password hashing configuration */
  hash?: HashConfig;
  /** Rate limiting configuration */
  rateLimit?: RateLimitConfig;
  /**
   * User loader function - fetches user from database by ID.
   *
   * Called on every authenticated request to populate `ctx.user`.
   *
   * **IMPORTANT:** Only fields you return here will be available on `ctx.user`.
   * The returned object is NOT the raw database user - you control exactly
   * which fields are exposed.
   *
   * @example
   * ```typescript
   * userLoader: async (userId) => {
   *   const user = await db.user.findUnique({ where: { id: userId } });
   *   if (!user) return null;
   *
   *   return {
   *     id: user.id,
   *     email: user.email,
   *     name: user.name,
   *     roles: parseUserRoles(user.roles),
   *     // Add custom fields here to make them available on ctx.user
   *     organizationId: user.organizationId,
   *   };
   * }
   * ```
   *
   * @see User interface for extending the type via declaration merging
   */
  userLoader?: (userId: string) => Promise<User | null>;
  /**
   * Token blacklist checker - check if token is revoked
   * Called on every authenticated request
   * @deprecated Use `tokenStore` with TokenStore interface instead
   */
  isTokenRevoked?: (tokenId: string) => Promise<boolean>;
  /**
   * Automatically extract auth context from Authorization header
   * Sets request.auth and request.user on every request
   * @default true
   */
  autoExtract?: boolean;
}

// ============================================================================
// Guard Types
// ============================================================================

/**
 * Guard function type
 * Returns true if access is allowed, false otherwise
 */
export type GuardFunction<TContext = unknown> = (
  ctx: TContext,
  request: FastifyRequest,
  reply: FastifyReply
) => boolean | Promise<boolean>;

/**
 * Named guard configuration
 */
export interface GuardDefinition<TContext = unknown> {
  /** Guard name for error messages */
  name: string;
  /** Guard check function */
  check: GuardFunction<TContext>;
  /** Custom error message (optional) */
  message?: string;
  /** HTTP status code on failure (default: 403) */
  statusCode?: number;
}

// ============================================================================
// Policy Types
// ============================================================================

/**
 * Policy action handler
 * Returns true if user can perform action on resource
 */
export type PolicyAction<TUser = User, TResource = unknown> = (
  user: TUser,
  resource: TResource
) => boolean | Promise<boolean>;

/**
 * Policy definition with named actions
 */
export interface PolicyDefinition<TUser = User, TResource = unknown> {
  /** View action - can user read this resource? */
  view?: PolicyAction<TUser, TResource>;
  /** Create action - can user create this resource? */
  create?: PolicyAction<TUser, TResource>;
  /** Update action - can user modify this resource? */
  update?: PolicyAction<TUser, TResource>;
  /** Delete action - can user remove this resource? */
  delete?: PolicyAction<TUser, TResource>;
  /** Custom actions */
  [action: string]: PolicyAction<TUser, TResource> | undefined;
}

// ============================================================================
// Middleware Types
// ============================================================================

/**
 * Auth middleware options
 */
export interface AuthMiddlewareOptions {
  /** Allow unauthenticated requests (default: false) */
  optional?: boolean;
  /** Guards to apply after authentication */
  guards?: Array<GuardDefinition | string>;
}

// ============================================================================
// Auth Context Types (Discriminated Union)
// ============================================================================

/**
 * Base auth context shared by all auth modes
 */
export interface BaseAuthContext {
  /** Whether the request is authenticated */
  isAuthenticated: boolean;
}

/**
 * Auth context for native JWT authentication (authPlugin)
 *
 * This context is set when using the built-in authPlugin with JWT tokens.
 * Provides access to the decoded token payload.
 */
export interface NativeAuthContext extends BaseAuthContext {
  /** Discriminant for native JWT auth mode */
  authMode: 'native';
  /** Authenticated user (undefined if optional auth and no token) */
  user?: User;
  /** Raw JWT token string (if extracted from request) */
  token?: string;
  /** Decoded token payload */
  payload?: TokenPayload;
}

/**
 * Auth context for external authentication adapters
 *
 * This context is set when using an AuthAdapter (BetterAuth, Clerk, Auth0, etc.).
 * Provides access to the provider's session data.
 */
export interface AdapterAuthContext extends BaseAuthContext {
  /** Discriminant for adapter auth mode */
  authMode: 'adapter';
  /** Authenticated user (undefined if not authenticated) */
  user?: User;
  /** Provider identifier (e.g., 'better-auth', 'clerk', 'auth0') */
  providerId: string;
  /** Provider-specific session data */
  session?: unknown;
}

/**
 * Authenticated request context extension
 *
 * This is a discriminated union based on `authMode`:
 * - `'native'`: Built-in JWT authentication via authPlugin
 * - `'adapter'`: External provider via AuthAdapter
 *
 * Use the `authMode` discriminant for type-safe access to mode-specific properties:
 *
 * @example
 * ```typescript
 * if (ctx.auth?.authMode === 'native') {
 *   // Access JWT-specific properties
 *   console.log(ctx.auth.payload?.sub);
 * } else if (ctx.auth?.authMode === 'adapter') {
 *   // Access adapter-specific properties
 *   console.log(ctx.auth.providerId);
 * }
 * ```
 */
export type AuthContext = NativeAuthContext | AdapterAuthContext;

// ============================================================================
// Context Declaration Merging
// ============================================================================

declare module '@veloxts/core' {
  interface BaseContext {
    /** Auth context - available when auth middleware is used */
    auth?: AuthContext;
    /** Shortcut to authenticated user */
    user?: User;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Auth context on request */
    auth?: AuthContext;
    /** Shortcut to authenticated user */
    user?: User;
  }
}
