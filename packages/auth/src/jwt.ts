/**
 * JWT token utilities for @veloxts/auth
 * @module auth/jwt
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { JwtConfig, TokenPair, TokenPayload, User } from './types.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ACCESS_EXPIRY = '15m';
const DEFAULT_REFRESH_EXPIRY = '7d';

/**
 * Minimum JWT secret length (64 characters = 512 bits)
 * HS256 requires at least 256 bits, but we require 512 for extra security margin
 */
const MIN_SECRET_LENGTH = 64;

/**
 * Minimum unique characters in secret for entropy validation
 */
const MIN_SECRET_ENTROPY_CHARS = 16;

/**
 * Reserved JWT claims that cannot be overridden via additionalClaims
 */
const RESERVED_JWT_CLAIMS = new Set([
  'sub',
  'iss',
  'aud',
  'exp',
  'iat',
  'jti',
  'nbf',
  'type',
  'email',
]);

// ============================================================================
// JWT Implementation
// ============================================================================

/**
 * Parses time string to seconds
 * Supports: '15m', '1h', '7d', '30d', etc.
 */
export function parseTimeToSeconds(time: string): number {
  const match = time.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid time format: ${time}. Use format like '15m', '1h', '7d'`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}

/**
 * Base64url encode
 */
function base64urlEncode(data: string | Buffer): string {
  const base64 = Buffer.from(data).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64url decode
 */
function base64urlDecode(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

/**
 * Create HMAC-SHA256 signature
 */
function createSignature(data: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(data);
  return base64urlEncode(hmac.digest());
}

/**
 * Generate a unique token ID
 */
export function generateTokenId(): string {
  return randomBytes(16).toString('hex');
}

// ============================================================================
// JWT Manager Class
// ============================================================================

/**
 * JWT token manager
 *
 * Handles token creation, verification, and refresh.
 * Uses HS256 (HMAC-SHA256) algorithm.
 *
 * @example
 * ```typescript
 * const jwt = new JwtManager({
 *   secret: process.env.JWT_SECRET!,
 *   accessTokenExpiry: '15m',
 *   refreshTokenExpiry: '7d',
 * });
 *
 * // Create tokens for user
 * const tokens = jwt.createTokenPair(user);
 *
 * // Verify access token
 * const payload = jwt.verifyToken(tokens.accessToken);
 *
 * // Refresh tokens
 * const newTokens = jwt.refreshTokens(tokens.refreshToken);
 * ```
 */
export class JwtManager {
  private readonly config: Required<
    Pick<JwtConfig, 'secret' | 'accessTokenExpiry' | 'refreshTokenExpiry'>
  > &
    JwtConfig;

  constructor(config: JwtConfig) {
    // Validate secret length (Critical Fix #1)
    if (!config.secret || config.secret.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `JWT secret must be at least ${MIN_SECRET_LENGTH} characters long (512 bits). ` +
          'Generate with: openssl rand -base64 64'
      );
    }

    // Validate secret entropy - check for sufficient unique characters
    const uniqueChars = new Set(config.secret).size;
    if (uniqueChars < MIN_SECRET_ENTROPY_CHARS) {
      throw new Error(
        `JWT secret has insufficient entropy (only ${uniqueChars} unique characters). ` +
          'Use cryptographically random data with at least 16 unique characters.'
      );
    }

    this.config = {
      ...config,
      accessTokenExpiry: config.accessTokenExpiry ?? DEFAULT_ACCESS_EXPIRY,
      refreshTokenExpiry: config.refreshTokenExpiry ?? DEFAULT_REFRESH_EXPIRY,
    };
  }

  /**
   * Creates a JWT token with the given payload
   */
  createToken(
    payload: Omit<TokenPayload, 'iat' | 'exp'> & {
      sub: string;
      email: string;
      type: TokenPayload['type'];
    },
    expiresIn: string
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + parseTimeToSeconds(expiresIn);

    const fullPayload: TokenPayload = {
      ...payload,
      iat: now,
      exp,
    };

    // Create header
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));

    // Create signature
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = createSignature(signatureInput, this.config.secret);

    return `${signatureInput}.${signature}`;
  }

  /**
   * Verifies a JWT token and returns the payload
   *
   * @throws Error if token is invalid or expired
   */
  verifyToken(token: string): TokenPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Critical Fix #2: Validate algorithm BEFORE signature verification
    // This prevents algorithm confusion attacks (CVE-2015-9235)
    let header: { alg: string; typ: string };
    try {
      header = JSON.parse(base64urlDecode(encodedHeader)) as { alg: string; typ: string };
    } catch {
      throw new Error('Invalid token header');
    }

    // Only allow HS256 - reject "none", RS256, and other algorithms
    if (header.alg !== 'HS256') {
      throw new Error(`Invalid algorithm: ${header.alg}. Only HS256 is supported.`);
    }

    if (header.typ !== 'JWT') {
      throw new Error('Invalid token type in header');
    }

    // Verify signature using timing-safe comparison to prevent timing attacks
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createSignature(signatureInput, this.config.secret);

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      throw new Error('Invalid token signature');
    }

    // Decode payload
    let payload: TokenPayload;
    try {
      const decoded = JSON.parse(base64urlDecode(encodedPayload)) as Record<string, unknown>;

      // Validate required fields
      if (
        typeof decoded.sub !== 'string' ||
        typeof decoded.email !== 'string' ||
        typeof decoded.iat !== 'number' ||
        typeof decoded.exp !== 'number' ||
        (decoded.type !== 'access' && decoded.type !== 'refresh')
      ) {
        throw new Error('Missing required token fields');
      }

      payload = decoded as TokenPayload;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Invalid token payload');
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('Token has expired');
    }

    // Check not-before claim if present (Medium Fix #10)
    if (typeof payload.nbf === 'number' && payload.nbf > now) {
      throw new Error('Token not yet valid');
    }

    // Verify issuer if configured
    if (this.config.issuer && payload.iss !== this.config.issuer) {
      throw new Error('Invalid token issuer');
    }

    // Verify audience if configured
    if (this.config.audience && payload.aud !== this.config.audience) {
      throw new Error('Invalid token audience');
    }

    return payload;
  }

  /**
   * Creates an access/refresh token pair for a user
   *
   * @param user - The user to create tokens for
   * @param additionalClaims - Custom claims to include (cannot override reserved claims)
   * @throws Error if additionalClaims contains reserved JWT claims
   */
  createTokenPair(user: User, additionalClaims?: Record<string, unknown>): TokenPair {
    // Critical Fix #3: Validate additionalClaims don't contain reserved claims
    if (additionalClaims) {
      for (const key of Object.keys(additionalClaims)) {
        if (RESERVED_JWT_CLAIMS.has(key)) {
          throw new Error(
            `Cannot override reserved JWT claim: ${key}. ` +
              `Reserved claims are: ${[...RESERVED_JWT_CLAIMS].join(', ')}`
          );
        }
      }
    }

    const tokenId = generateTokenId();

    const basePayload = {
      sub: user.id,
      email: user.email,
      jti: tokenId,
      ...(this.config.issuer && { iss: this.config.issuer }),
      ...(this.config.audience && { aud: this.config.audience }),
      ...additionalClaims,
    };

    const accessToken = this.createToken(
      { ...basePayload, type: 'access' },
      this.config.accessTokenExpiry
    );

    const refreshToken = this.createToken(
      { ...basePayload, type: 'refresh' },
      this.config.refreshTokenExpiry
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: parseTimeToSeconds(this.config.accessTokenExpiry),
      tokenType: 'Bearer',
    };
  }

  /**
   * Refreshes tokens using a valid refresh token
   *
   * @throws Error if refresh token is invalid or not a refresh token
   */
  refreshTokens(
    refreshToken: string,
    userLoader?: (userId: string) => Promise<User | null>
  ): Promise<TokenPair>;
  refreshTokens(refreshToken: string): TokenPair;
  refreshTokens(
    refreshToken: string,
    userLoader?: (userId: string) => Promise<User | null>
  ): TokenPair | Promise<TokenPair> {
    const payload = this.verifyToken(refreshToken);

    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type: expected refresh token');
    }

    // If userLoader provided, fetch fresh user data
    if (userLoader) {
      return userLoader(payload.sub).then((user) => {
        if (!user) {
          throw new Error('User not found');
        }
        return this.createTokenPair(user);
      });
    }

    // Otherwise, create new tokens from payload data
    const user: User = {
      id: payload.sub,
      email: payload.email,
    };

    return this.createTokenPair(user);
  }

  /**
   * Decodes a token without verification
   * Useful for extracting payload from expired tokens
   */
  decodeToken(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      return JSON.parse(base64urlDecode(parts[1])) as TokenPayload;
    } catch {
      return null;
    }
  }

  /**
   * Extracts token from Authorization header
   * Supports 'Bearer <token>' format
   */
  extractFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return null;
    }

    return parts[1];
  }
}

/**
 * Creates a new JWT manager instance (succinct API)
 */
export function jwtManager(config: JwtConfig): JwtManager {
  return new JwtManager(config);
}

/**
 * Creates a new JWT manager instance
 *
 * @deprecated Use `jwtManager()` instead. Will be removed in v0.9.
 */
export const createJwtManager = jwtManager;

// ============================================================================
// Token Revocation Store (Critical Fix #4)
// ============================================================================

/**
 * Token store interface for revocation management
 */
export interface TokenStore {
  /** Revoke a token by its ID (jti) */
  revoke: (tokenId: string) => void | Promise<void>;
  /** Check if a token is revoked */
  isRevoked: (tokenId: string) => boolean | Promise<boolean>;
  /** Clear all revoked tokens (useful for testing) */
  clear: () => void;
}

/**
 * Creates an in-memory token store for development and testing
 *
 * ⚠️ WARNING: NOT suitable for production!
 * - Does not persist across server restarts
 * - Does not work across multiple server instances
 * - No automatic cleanup of expired token IDs
 *
 * For production, use Redis or database-backed storage:
 * - upstash/redis for serverless
 * - ioredis for traditional servers
 * - Database table for audit trail
 *
 * @example
 * ```typescript
 * // Development/Testing
 * const tokenStore = createInMemoryTokenStore();
 *
 * const authConfig: AuthConfig = {
 *   jwt: { secret: process.env.JWT_SECRET! },
 *   isTokenRevoked: tokenStore.isRevoked,
 * };
 *
 * // Revoke on logout
 * app.post('/logout', async (req) => {
 *   const tokenId = req.auth.token.jti;
 *   tokenStore.revoke(tokenId);
 * });
 * ```
 */
export function createInMemoryTokenStore(): TokenStore {
  const revokedTokens = new Set<string>();

  return {
    revoke: (tokenId: string) => {
      revokedTokens.add(tokenId);
    },
    isRevoked: (tokenId: string) => revokedTokens.has(tokenId),
    clear: () => {
      revokedTokens.clear();
    },
  };
}
