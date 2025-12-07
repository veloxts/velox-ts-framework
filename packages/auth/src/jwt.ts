/**
 * JWT token utilities for @veloxts/auth
 * @module auth/jwt
 */

import { createHmac, randomBytes } from 'node:crypto';

import type { JwtConfig, TokenPair, TokenPayload, User } from './types.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ACCESS_EXPIRY = '15m';
const DEFAULT_REFRESH_EXPIRY = '7d';

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
    if (!config.secret || config.secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
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

    // Verify signature
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createSignature(signatureInput, this.config.secret);

    if (signature !== expectedSignature) {
      throw new Error('Invalid token signature');
    }

    // Decode payload
    let payload: TokenPayload;
    try {
      payload = JSON.parse(base64urlDecode(encodedPayload)) as TokenPayload;
    } catch {
      throw new Error('Invalid token payload');
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('Token has expired');
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
   */
  createTokenPair(user: User, additionalClaims?: Record<string, unknown>): TokenPair {
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
 * Creates a new JWT manager instance
 */
export function createJwtManager(config: JwtConfig): JwtManager {
  return new JwtManager(config);
}
