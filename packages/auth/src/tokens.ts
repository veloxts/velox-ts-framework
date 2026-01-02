/**
 * DI Tokens for @veloxts/auth
 *
 * Symbol-based tokens for type-safe dependency injection.
 * These tokens allow services to be registered, resolved, and mocked via the DI container.
 *
 * @module auth/tokens
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { JWT_MANAGER, JWT_CONFIG, registerAuthProviders } from '@veloxts/auth';
 *
 * const container = new Container();
 * registerAuthProviders(container, { jwt: { secret: '...' } });
 *
 * const jwt = container.resolve(JWT_MANAGER);
 * ```
 */

import { token } from '@veloxts/core';

import type { CsrfConfig } from './csrf.js';
import type { PasswordHasher } from './hash.js';
import type { JwtManager, TokenStore } from './jwt.js';
import type { AuthService } from './plugin.js';
import type { AuthRateLimiter, AuthRateLimiterConfig } from './rate-limit.js';
import type { SessionConfig, SessionStore } from './session.js';
import type { AuthConfig, HashConfig, JwtConfig } from './types.js';

// ============================================================================
// Configuration Tokens
// ============================================================================

/**
 * Main auth configuration token
 *
 * Contains JWT config, hash config, and other auth settings.
 */
export const AUTH_CONFIG = token.symbol<AuthConfig>('AUTH_CONFIG');

/**
 * JWT configuration token
 *
 * Used to configure JwtManager (secret, expiry times, issuer, etc.)
 */
export const JWT_CONFIG = token.symbol<JwtConfig>('JWT_CONFIG');

/**
 * Password hashing configuration token
 *
 * Used to configure PasswordHasher (algorithm, rounds, etc.)
 */
export const HASH_CONFIG = token.symbol<HashConfig>('HASH_CONFIG');

/**
 * Session configuration token
 *
 * Used to configure SessionManager (store, cookie settings, expiration)
 */
export const SESSION_CONFIG = token.symbol<SessionConfig>('SESSION_CONFIG');

/**
 * CSRF protection configuration token
 *
 * Used to configure CsrfManager (cookie settings, validation rules)
 */
export const CSRF_CONFIG = token.symbol<CsrfConfig>('CSRF_CONFIG');

/**
 * Auth rate limiter configuration token
 *
 * Used to configure per-endpoint rate limits (login, register, reset, refresh)
 */
export const RATE_LIMIT_CONFIG = token.symbol<AuthRateLimiterConfig>('RATE_LIMIT_CONFIG');

// ============================================================================
// Service Tokens
// ============================================================================

/**
 * JWT manager service token
 *
 * Provides token creation, verification, and refresh capabilities.
 *
 * @example
 * ```typescript
 * const jwt = container.resolve(JWT_MANAGER);
 * const tokens = jwt.createTokenPair({ id: '1', email: 'user@example.com' });
 * ```
 */
export const JWT_MANAGER = token.symbol<JwtManager>('JWT_MANAGER');

/**
 * Password hasher service token
 *
 * Provides secure password hashing and verification.
 *
 * @example
 * ```typescript
 * const hasher = container.resolve(PASSWORD_HASHER);
 * const hash = await hasher.hash('password123');
 * const valid = await hasher.verify('password123', hash);
 * ```
 */
export const PASSWORD_HASHER = token.symbol<PasswordHasher>('PASSWORD_HASHER');

/**
 * Auth service composite token
 *
 * Aggregates JWT manager, password hasher, and middleware into a single service.
 * This is the main service attached to Fastify by the auth plugin.
 */
export const AUTH_SERVICE = token.symbol<AuthService>('AUTH_SERVICE');

/**
 * Auth rate limiter service token
 *
 * Provides per-endpoint rate limiting for authentication operations.
 * Includes login, register, password reset, and refresh endpoints.
 *
 * @example
 * ```typescript
 * const rateLimiter = container.resolve(AUTH_RATE_LIMITER);
 * // Use in procedures:
 * procedure().use(rateLimiter.login((ctx) => ctx.input.email))
 * ```
 */
export const AUTH_RATE_LIMITER = token.symbol<AuthRateLimiter>('AUTH_RATE_LIMITER');

// ============================================================================
// Store Tokens (Pluggable Backends)
// ============================================================================

/**
 * Session store token
 *
 * Pluggable backend for session storage.
 * Default: in-memory store (use Redis for production)
 */
export const SESSION_STORE = token.symbol<SessionStore>('SESSION_STORE');

/**
 * Token store token
 *
 * Pluggable backend for token revocation tracking.
 * Used for JWT blacklist functionality.
 */
export const TOKEN_STORE = token.symbol<TokenStore>('TOKEN_STORE');
