/**
 * CSRF (Cross-Site Request Forgery) Protection for @veloxts/auth
 *
 * Implements the Signed Double Submit Cookie Pattern:
 * - Stateless design (no server-side session storage)
 * - HMAC-signed tokens prevent cookie tampering
 * - Horizontally scalable across server instances
 *
 * @module auth/csrf
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { BaseContext } from '@veloxts/core';
import type { MiddlewareFunction } from '@veloxts/router';
import type { FastifyReply, FastifyRequest } from 'fastify';

// Cookie plugin types (from @fastify/cookie)
interface CookieSerializeOptions {
  domain?: string;
  path?: string;
  sameSite?: 'strict' | 'lax' | 'none' | boolean;
  secure?: boolean;
  httpOnly?: boolean;
  maxAge?: number;
  expires?: Date;
}

interface FastifyReplyWithCookies extends FastifyReply {
  cookie(name: string, value: string, options?: CookieSerializeOptions): FastifyReply;
  clearCookie(name: string, options?: CookieSerializeOptions): FastifyReply;
}

interface FastifyRequestWithCookies extends FastifyRequest {
  cookies: Record<string, string | undefined>;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TOKEN_BYTES = 32;
const DEFAULT_EXPIRES_IN = 3600; // 1 hour
const DEFAULT_HEADER_NAME = 'x-csrf-token';
const DEFAULT_BODY_FIELD = '_csrf';
const DEFAULT_COOKIE_NAME = 'velox.csrf';
const MIN_SECRET_LENGTH = 32;
const CSRF_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

// ============================================================================
// Error Types
// ============================================================================

/**
 * CSRF validation failure codes
 */
export type CsrfErrorCode =
  | 'CSRF_MISSING_TOKEN'
  | 'CSRF_MISSING_COOKIE'
  | 'CSRF_TOKEN_MISMATCH'
  | 'CSRF_INVALID_SIGNATURE'
  | 'CSRF_TOKEN_EXPIRED'
  | 'CSRF_ORIGIN_MISMATCH'
  | 'CSRF_INVALID_FORMAT';

/**
 * CSRF-specific error class
 */
export class CsrfError extends Error {
  readonly statusCode: number = 403;
  readonly code: CsrfErrorCode;

  constructor(message: string, code: CsrfErrorCode) {
    super(message);
    this.name = 'CsrfError';
    this.code = code;
    Error.captureStackTrace?.(this, CsrfError);
  }
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Cookie configuration for CSRF tokens
 */
export interface CsrfCookieConfig {
  /**
   * Cookie name for the CSRF token
   * @default 'velox.csrf'
   */
  name?: string;

  /**
   * Cookie path
   * @default '/'
   */
  path?: string;

  /**
   * SameSite policy
   * - 'strict': Only same-site requests (most secure)
   * - 'lax': Same-site + top-level navigation from external sites
   * - 'none': All requests (requires Secure; use only with CORS)
   * @default 'lax'
   */
  sameSite?: 'strict' | 'lax' | 'none';

  /**
   * Require HTTPS (should be true in production)
   * @default process.env.NODE_ENV === 'production'
   */
  secure?: boolean;

  /**
   * HttpOnly flag - set to false for header-based CSRF
   * When false: JavaScript can read token for header submission
   * When true: Use hidden form fields only
   * @default false
   */
  httpOnly?: boolean;

  /**
   * Domain for the cookie (optional)
   */
  domain?: string;
}

/**
 * Token generation and validation configuration
 */
export interface CsrfTokenConfig {
  /**
   * Token entropy in bytes (random portion)
   * @default 32 (256 bits)
   */
  tokenBytes?: number;

  /**
   * Token expiration in seconds (0 for no expiration)
   * @default 3600 (1 hour)
   */
  expiresIn?: number;

  /**
   * Secret key for HMAC signature
   * Minimum length: 32 characters
   */
  secret: string;
}

/**
 * Request validation configuration
 */
export interface CsrfValidationConfig {
  /**
   * Header name to check for token
   * @default 'x-csrf-token'
   */
  headerName?: string;

  /**
   * Body field name to check for token
   * @default '_csrf'
   */
  bodyFieldName?: string;

  /**
   * Query parameter name (disabled by default)
   */
  queryFieldName?: string;

  /**
   * HTTP methods to validate
   * @default ['POST', 'PUT', 'PATCH', 'DELETE']
   */
  methods?: ReadonlyArray<string>;

  /**
   * Paths to exclude from CSRF validation
   * @example [/^\/api\/webhooks\//, '/health']
   */
  excludePaths?: ReadonlyArray<RegExp | string>;

  /**
   * Validate Origin/Referer headers
   * @default true
   */
  checkOrigin?: boolean;

  /**
   * Allowed origins for validation
   */
  allowedOrigins?: ReadonlyArray<string>;
}

/**
 * Complete CSRF configuration
 */
export interface CsrfConfig {
  /**
   * Enable CSRF protection
   * @default true
   */
  enabled?: boolean;

  /**
   * Cookie configuration
   */
  cookie?: CsrfCookieConfig;

  /**
   * Token configuration
   */
  token: CsrfTokenConfig;

  /**
   * Validation configuration
   */
  validation?: CsrfValidationConfig;
}

// ============================================================================
// Token Types
// ============================================================================

/**
 * Parsed CSRF token structure
 */
export interface CsrfTokenData {
  /** Random token value (base64url encoded) */
  value: string;
  /** Token creation timestamp (Unix seconds) */
  issuedAt: number;
  /** Token expiration timestamp (Unix seconds) */
  expiresAt: number;
  /** HMAC signature (base64url encoded) */
  signature: string;
}

/**
 * Token generation result
 */
export interface CsrfTokenResult {
  /** Complete signed token string */
  token: string;
  /** Token expiration timestamp */
  expiresAt: number;
}

// ============================================================================
// CSRF Manager Interface
// ============================================================================

/**
 * CSRF token manager for generating and validating tokens
 */
export interface CsrfManager {
  /** Generate a new CSRF token */
  generateToken(reply: FastifyReplyWithCookies): CsrfTokenResult;
  /** Validate a CSRF token from request */
  validateToken(request: FastifyRequestWithCookies): void;
  /** Extract token from request */
  extractToken(request: FastifyRequest): string | null;
  /** Parse token string into components */
  parseToken(token: string): CsrfTokenData | null;
  /** Verify token signature */
  verifySignature(token: string): boolean;
  /** Clear the CSRF cookie */
  clearCookie(reply: FastifyReplyWithCookies): void;
}

/**
 * CSRF middleware options for procedures
 */
export interface CsrfMiddlewareOptions {
  /**
   * Skip CSRF validation for this procedure
   * @default false
   */
  skip?: boolean;

  /**
   * Override excluded paths for this middleware instance
   */
  excludePaths?: ReadonlyArray<RegExp | string>;
}

/**
 * Extended context with CSRF capabilities
 */
export interface CsrfContext {
  csrf: {
    /** Generate a new token */
    generateToken: () => CsrfTokenResult;
    /** Current token from request (if valid) */
    token?: string;
  };
}

// ============================================================================
// Context Declaration Merging
// ============================================================================

declare module '@veloxts/core' {
  interface BaseContext {
    csrf?: CsrfContext['csrf'];
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    csrfToken?: string;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Base64url encode
 */
function base64urlEncode(data: Buffer): string {
  return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ============================================================================
// CSRF Manager Implementation
// ============================================================================

/**
 * Creates a CSRF token manager
 *
 * @example
 * ```typescript
 * const csrfManager = createCsrfManager({
 *   token: { secret: process.env.CSRF_SECRET! },
 *   cookie: { secure: true, sameSite: 'strict' },
 * });
 *
 * // Generate token
 * const { token } = csrfManager.generateToken(reply);
 *
 * // Validate token
 * csrfManager.validateToken(request); // Throws on failure
 * ```
 */
export function createCsrfManager(config: CsrfConfig): CsrfManager {
  // Validate secret
  const secret = config.token.secret;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `CSRF secret must be at least ${MIN_SECRET_LENGTH} characters. ` +
        'Generate with: openssl rand -base64 32'
    );
  }

  // Resolve configuration with defaults
  const tokenBytes = config.token.tokenBytes ?? DEFAULT_TOKEN_BYTES;
  const expiresIn = config.token.expiresIn ?? DEFAULT_EXPIRES_IN;
  const headerName = (config.validation?.headerName ?? DEFAULT_HEADER_NAME).toLowerCase();
  const bodyFieldName = config.validation?.bodyFieldName ?? DEFAULT_BODY_FIELD;
  const queryFieldName = config.validation?.queryFieldName;
  const methods = config.validation?.methods ?? CSRF_METHODS;
  const checkOrigin = config.validation?.checkOrigin ?? true;
  const allowedOrigins = config.validation?.allowedOrigins ?? [];
  const excludePaths = config.validation?.excludePaths ?? [];

  // Cookie config
  const cookieName = config.cookie?.name ?? DEFAULT_COOKIE_NAME;
  const cookiePath = config.cookie?.path ?? '/';
  const cookieSameSite = config.cookie?.sameSite ?? 'lax';
  const cookieSecure = config.cookie?.secure ?? process.env.NODE_ENV === 'production';
  const cookieHttpOnly = config.cookie?.httpOnly ?? false;
  const cookieDomain = config.cookie?.domain;

  // Security validation: SameSite=none requires Secure flag
  // Per RFC 6265bis, cookies with SameSite=none must be Secure
  if (cookieSameSite === 'none' && !cookieSecure) {
    throw new Error(
      'CSRF cookie with SameSite=none requires Secure flag. ' +
        'Set cookie.secure: true or use a different SameSite policy.'
    );
  }

  /**
   * Create HMAC signature for token data
   */
  function createSignature(value: string, issuedAt: number, expiresAt: number): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(`${value}.${issuedAt}.${expiresAt}`);
    return base64urlEncode(hmac.digest());
  }

  /**
   * Generate a new CSRF token
   */
  function generateToken(reply: FastifyReplyWithCookies): CsrfTokenResult {
    const value = base64urlEncode(randomBytes(tokenBytes));
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = expiresIn > 0 ? issuedAt + expiresIn : 0;
    const signature = createSignature(value, issuedAt, expiresAt);

    // Token format: value.issuedAt.expiresAt.signature
    const token = `${value}.${issuedAt}.${expiresAt}.${signature}`;

    // Set cookie using Fastify's cookie API
    reply.cookie(cookieName, token, {
      path: cookiePath,
      sameSite: cookieSameSite,
      secure: cookieSecure,
      httpOnly: cookieHttpOnly,
      domain: cookieDomain,
      maxAge: expiresIn > 0 ? expiresIn : undefined,
    });

    return { token, expiresAt };
  }

  /**
   * Parse token string into components
   */
  function parseToken(token: string): CsrfTokenData | null {
    const parts = token.split('.');
    if (parts.length !== 4) {
      return null;
    }

    const [value, issuedAtStr, expiresAtStr, signature] = parts;
    const issuedAt = parseInt(issuedAtStr, 10);
    const expiresAt = parseInt(expiresAtStr, 10);

    if (Number.isNaN(issuedAt) || Number.isNaN(expiresAt)) {
      return null;
    }

    return { value, issuedAt, expiresAt, signature };
  }

  /**
   * Verify token signature using timing-safe comparison
   */
  function verifySignature(token: string): boolean {
    const parsed = parseToken(token);
    if (!parsed) {
      return false;
    }

    const expectedSignature = createSignature(parsed.value, parsed.issuedAt, parsed.expiresAt);

    const sigBuffer = Buffer.from(parsed.signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  }

  /**
   * Extract token from request (header, body, or query)
   */
  function extractToken(request: FastifyRequest): string | null {
    // 1. Check header
    const headerToken = request.headers[headerName];
    if (typeof headerToken === 'string' && headerToken.length > 0) {
      return headerToken;
    }

    // 2. Check body
    const body = request.body as Record<string, unknown> | undefined;
    if (body && typeof body[bodyFieldName] === 'string') {
      return body[bodyFieldName] as string;
    }

    // 3. Check query (if enabled)
    if (queryFieldName) {
      const query = request.query as Record<string, unknown> | undefined;
      if (query && typeof query[queryFieldName] === 'string') {
        return query[queryFieldName] as string;
      }
    }

    return null;
  }

  /**
   * Validate Origin/Referer headers
   */
  function validateOrigin(request: FastifyRequest): void {
    if (!checkOrigin) {
      return;
    }

    const origin = request.headers.origin;
    const referer = request.headers.referer;
    const host = request.headers.host;

    // If no origin or referer, might be same-origin
    if (!origin && !referer) {
      return;
    }

    let requestOrigin: string | null = null;
    if (origin) {
      requestOrigin = origin;
    } else if (referer) {
      try {
        requestOrigin = new URL(referer).origin;
      } catch {
        // Invalid referer URL
      }
    }

    if (!requestOrigin) {
      return;
    }

    // Check against host
    const protocol = request.protocol ?? 'http';
    const expectedOrigin = `${protocol}://${host}`;
    if (requestOrigin === expectedOrigin) {
      return;
    }

    // Check against allowed origins
    if (allowedOrigins.includes(requestOrigin)) {
      return;
    }

    throw new CsrfError(`Origin mismatch: ${requestOrigin} not allowed`, 'CSRF_ORIGIN_MISMATCH');
  }

  /**
   * Check if path should be excluded
   */
  function isPathExcluded(path: string): boolean {
    for (const pattern of excludePaths) {
      if (typeof pattern === 'string') {
        if (path === pattern) return true;
      } else if (pattern.test(path)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Full token validation
   */
  function validateToken(request: FastifyRequestWithCookies): void {
    // Skip non-mutating methods
    const method = request.method.toUpperCase();
    if (!methods.includes(method)) {
      return;
    }

    // Check excluded paths
    const path = request.url.split('?')[0];
    if (isPathExcluded(path)) {
      return;
    }

    // Validate origin first
    validateOrigin(request);

    // Get cookie token
    const cookieToken = request.cookies[cookieName];

    if (!cookieToken) {
      throw new CsrfError('CSRF cookie not found', 'CSRF_MISSING_COOKIE');
    }

    // Get request token
    const requestToken = extractToken(request);
    if (!requestToken) {
      throw new CsrfError('CSRF token not found in request', 'CSRF_MISSING_TOKEN');
    }

    // Tokens must match (double-submit validation)
    // Use timing-safe comparison to prevent timing attacks
    const cookieBuffer = Buffer.from(cookieToken, 'utf8');
    const requestBuffer = Buffer.from(requestToken, 'utf8');
    if (
      cookieBuffer.length !== requestBuffer.length ||
      !timingSafeEqual(cookieBuffer, requestBuffer)
    ) {
      throw new CsrfError('CSRF token mismatch', 'CSRF_TOKEN_MISMATCH');
    }

    // Verify signature
    if (!verifySignature(requestToken)) {
      throw new CsrfError('Invalid CSRF token signature', 'CSRF_INVALID_SIGNATURE');
    }

    // Check expiration
    const parsed = parseToken(requestToken);
    if (parsed && parsed.expiresAt > 0) {
      const now = Math.floor(Date.now() / 1000);
      if (parsed.expiresAt < now) {
        throw new CsrfError('CSRF token has expired', 'CSRF_TOKEN_EXPIRED');
      }
    }
  }

  /**
   * Clear CSRF cookie
   */
  function clearCookie(reply: FastifyReplyWithCookies): void {
    reply.clearCookie(cookieName, {
      path: cookiePath,
      domain: cookieDomain,
    });
  }

  return {
    generateToken,
    validateToken,
    extractToken,
    parseToken,
    verifySignature,
    clearCookie,
  };
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Creates CSRF protection middleware for procedures (succinct API)
 *
 * @example
 * ```typescript
 * const csrf = csrfMiddleware({
 *   token: { secret: process.env.CSRF_SECRET! },
 * });
 *
 * // Protect mutations
 * const createPost = procedure()
 *   .use(auth.requireAuth())
 *   .use(csrf.protect())
 *   .input(CreatePostSchema)
 *   .mutation(async ({ input, ctx }) => {
 *     return db.post.create({ data: input });
 *   });
 *
 * // Provide token for forms
 * const getForm = procedure()
 *   .use(csrf.provide())
 *   .query(async ({ ctx }) => {
 *     return { csrfToken: ctx.csrf.generateToken().token };
 *   });
 * ```
 */
export function csrfMiddleware(config: CsrfConfig) {
  const manager = createCsrfManager(config);

  /**
   * Middleware that validates CSRF tokens on mutations
   */
  function protect<TInput, TContext extends BaseContext, TOutput>(
    options: CsrfMiddlewareOptions = {}
  ): MiddlewareFunction<TInput, TContext, TContext & CsrfContext, TOutput> {
    return async ({ ctx, next }) => {
      const reply = ctx.reply as unknown as FastifyReplyWithCookies;
      const request = ctx.request as unknown as FastifyRequestWithCookies;

      if (options.skip) {
        return next({
          ctx: {
            ...ctx,
            csrf: {
              generateToken: () => manager.generateToken(reply),
              token: undefined,
            },
          },
        });
      }

      // Validate token (throws CsrfError on failure)
      manager.validateToken(request);

      const token = manager.extractToken(ctx.request) ?? undefined;

      // Continue with CSRF context
      return next({
        ctx: {
          ...ctx,
          csrf: {
            generateToken: () => manager.generateToken(reply),
            token,
          },
        },
      });
    };
  }

  /**
   * Middleware that only provides token generation (no validation)
   * Use for query procedures where you need to provide tokens
   */
  function provide<TInput, TContext extends BaseContext, TOutput>(): MiddlewareFunction<
    TInput,
    TContext,
    TContext & CsrfContext,
    TOutput
  > {
    return async ({ ctx, next }) => {
      const reply = ctx.reply as unknown as FastifyReplyWithCookies;

      return next({
        ctx: {
          ...ctx,
          csrf: {
            generateToken: () => manager.generateToken(reply),
            token: manager.extractToken(ctx.request) ?? undefined,
          },
        },
      });
    };
  }

  return {
    /** CSRF manager instance */
    manager,
    /** Protection middleware (validates tokens) */
    protect,
    /** Provider middleware (generates tokens only) */
    provide,
    /** Generate token directly */
    generateToken: (reply: FastifyReplyWithCookies) => manager.generateToken(reply),
    /** Validate token directly */
    validateToken: (request: FastifyRequestWithCookies) => manager.validateToken(request),
    /** Clear CSRF cookie */
    clearCookie: (reply: FastifyReplyWithCookies) => manager.clearCookie(reply),
  };
}

/**
 * Creates CSRF protection middleware for procedures
 *
 * @deprecated Use `csrfMiddleware()` instead. Will be removed in v0.9.
 */
export const createCsrfMiddleware = csrfMiddleware;
