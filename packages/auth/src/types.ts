/**
 * Type definitions for @veloxts/auth
 * @module auth/types
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

// ============================================================================
// User Types
// ============================================================================

/**
 * Base user interface for authenticated requests
 *
 * Applications should extend this via declaration merging:
 * @example
 * ```typescript
 * declare module '@veloxts/auth' {
 *   interface User {
 *     role: 'admin' | 'user';
 *     permissions: string[];
 *   }
 * }
 * ```
 */
export interface User {
  id: string;
  email: string;
  [key: string]: unknown;
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
 * Session configuration
 */
export interface SessionConfig {
  /** Cookie name (default: 'velox.session') */
  cookieName?: string;
  /** Session expiration in seconds (default: 86400 = 24h) */
  maxAge?: number;
  /** Cookie path (default: '/') */
  path?: string;
  /** HTTP only flag (default: true) */
  httpOnly?: boolean;
  /** Secure flag - use HTTPS only (default: true in production) */
  secure?: boolean;
  /** SameSite policy (default: 'lax') */
  sameSite?: 'strict' | 'lax' | 'none';
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
  /** Session configuration */
  session?: SessionConfig;
  /** Rate limiting configuration */
  rateLimit?: RateLimitConfig;
  /**
   * User loader function - fetches user from database by ID
   * Called on every authenticated request to populate ctx.user
   */
  userLoader?: (userId: string) => Promise<User | null>;
  /**
   * Token blacklist checker - check if token is revoked
   * Called on every authenticated request
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

/**
 * Authenticated request context extension
 */
export interface AuthContext {
  /** Authenticated user (undefined if optional auth and no token) */
  user?: User;
  /** Decoded token payload */
  token?: TokenPayload;
  /** Check if user is authenticated */
  isAuthenticated: boolean;
}

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
