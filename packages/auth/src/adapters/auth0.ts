/**
 * Auth0 Adapter for @veloxts/auth
 *
 * Integrates Auth0 (https://auth0.com) with VeloxTS's pluggable
 * authentication system. Auth0 is an identity platform providing
 * authentication and authorization services.
 *
 * This adapter uses JWKS (JSON Web Key Sets) for JWT verification,
 * allowing secure token validation without sharing secrets.
 *
 * @module auth/adapters/auth0
 *
 * @example
 * ```typescript
 * import { createAuthAdapterPlugin } from '@veloxts/auth';
 * import { createAuth0Adapter } from '@veloxts/auth/adapters/auth0';
 *
 * const adapter = createAuth0Adapter({
 *   domain: process.env.AUTH0_DOMAIN!,
 *   audience: process.env.AUTH0_AUDIENCE!,
 *   clientId: process.env.AUTH0_CLIENT_ID,
 * });
 *
 * // Simplified API - just pass the adapter
 * const authPlugin = createAuthAdapterPlugin(adapter);
 *
 * app.use(authPlugin);
 * ```
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { AdapterRoute, AdapterSessionResult, AuthAdapterConfig } from '../adapter.js';
import { AuthAdapterError, BaseAuthAdapter } from '../adapter.js';
import { extractBearerToken, validateNonEmptyString } from './utils.js';

// ============================================================================
// Constants
// ============================================================================

/** Default clock tolerance in seconds for JWT validation */
const DEFAULT_CLOCK_TOLERANCE_SECONDS = 5;

/** Default JWKS cache TTL in milliseconds (1 hour) */
const DEFAULT_JWKS_CACHE_TTL_MS = 3600000;

/** Minimum interval between JWKS refresh attempts in milliseconds (5 seconds) */
const MIN_JWKS_REFRESH_INTERVAL_MS = 5000;

// ============================================================================
// Auth0 Types
// ============================================================================

/**
 * Auth0 JWT claims (standard + custom)
 *
 * Represents the claims in a verified Auth0 JWT.
 */
export interface Auth0Claims {
  /** Subject (user ID - Auth0's user_id) */
  sub: string;
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
  /** Not before timestamp */
  nbf?: number;
  /** Issuer (Auth0 domain) */
  iss: string;
  /** Audience */
  aud: string | string[];
  /** Authorized party */
  azp?: string;
  /** Token scope */
  scope?: string;
  /** Token permissions (RBAC) */
  permissions?: string[];
  /** Organization ID (Auth0 Organizations) */
  org_id?: string;
  /** Organization name */
  org_name?: string;
  /** Email (if included in token) */
  email?: string;
  /** Email verified status */
  email_verified?: boolean;
  /** User name */
  name?: string;
  /** User nickname */
  nickname?: string;
  /** Profile picture URL */
  picture?: string;
  /** Updated at timestamp */
  updated_at?: string;
}

/**
 * Auth0 Management API user object
 *
 * Full user profile from Auth0's Management API.
 */
export interface Auth0User {
  /** User ID */
  user_id: string;
  /** Email address */
  email?: string;
  /** Whether email is verified */
  email_verified?: boolean;
  /** Display name */
  name?: string;
  /** Nickname */
  nickname?: string;
  /** First name */
  given_name?: string;
  /** Last name */
  family_name?: string;
  /** Profile picture URL */
  picture?: string;
  /** Last login timestamp */
  last_login?: string;
  /** Login count */
  logins_count?: number;
  /** Account creation timestamp */
  created_at?: string;
  /** Account update timestamp */
  updated_at?: string;
  /** User metadata (writable by user) */
  user_metadata?: Record<string, unknown>;
  /** App metadata (writable by app) */
  app_metadata?: Record<string, unknown>;
  /** Identity providers linked to this user */
  identities?: Array<{
    connection: string;
    provider: string;
    user_id: string;
    isSocial: boolean;
  }>;
}

/**
 * JWKS Key object
 *
 * JSON Web Key from Auth0's JWKS endpoint.
 */
export interface JWKSKey {
  /** Key type (always 'RSA' for Auth0) */
  kty: string;
  /** Key ID */
  kid: string;
  /** Algorithm (RS256) */
  alg: string;
  /** Key use (signature) */
  use: string;
  /** RSA modulus */
  n: string;
  /** RSA exponent */
  e: string;
  /** X.509 certificate chain */
  x5c?: string[];
  /** X.509 thumbprint */
  x5t?: string;
}

/**
 * JWKS response from Auth0
 */
export interface JWKSResponse {
  keys: JWKSKey[];
}

/**
 * JWT verifier interface
 *
 * For custom JWT verification implementations.
 * The adapter provides a default implementation using jose library.
 */
export interface JwtVerifier {
  /**
   * Verify a JWT token
   *
   * @param token - JWT token to verify
   * @returns Decoded claims if valid, throws if invalid
   */
  verify(token: string): Promise<Auth0Claims>;
}

// ============================================================================
// Adapter Configuration
// ============================================================================

/**
 * Auth0 adapter configuration
 *
 * @example
 * ```typescript
 * const config: Auth0AdapterConfig = {
 *   name: 'auth0',
 *   domain: 'your-tenant.auth0.com',
 *   audience: 'https://your-api.example.com',
 *   clientId: 'your-client-id', // Optional for additional validation
 *   debug: true,
 * };
 * ```
 */
export interface Auth0AdapterConfig extends AuthAdapterConfig {
  /**
   * Auth0 domain
   *
   * Your Auth0 tenant domain (e.g., 'your-tenant.auth0.com').
   * Can be the custom domain if configured.
   */
  domain: string;

  /**
   * API audience
   *
   * The identifier for your API in Auth0.
   * Tokens must have this audience to be valid.
   */
  audience: string;

  /**
   * Client ID (optional)
   *
   * If provided, validates the authorized party (azp) claim.
   * Useful for ensuring tokens were issued for your specific client.
   */
  clientId?: string;

  /**
   * Custom JWT verifier (optional)
   *
   * Provide a custom JWT verification implementation.
   * If not provided, uses the default JWKS-based verifier.
   */
  jwtVerifier?: JwtVerifier;

  /**
   * JWKS cache TTL in milliseconds
   *
   * How long to cache the JWKS keys before fetching fresh ones.
   *
   * @default 3600000 (1 hour)
   */
  jwksCacheTtl?: number;

  /**
   * Clock tolerance in seconds
   *
   * Tolerance for clock skew when validating exp/iat/nbf claims.
   *
   * @default 5
   */
  clockTolerance?: number;

  /**
   * Custom header name for the authorization token
   *
   * @default 'authorization'
   */
  authHeader?: string;

  /**
   * Token issuer (optional)
   *
   * Override the expected issuer. By default, constructs from domain.
   * Useful for custom domains.
   */
  issuer?: string;
}

// ============================================================================
// JWKS Cache
// ============================================================================

/**
 * Simple in-memory JWKS cache
 *
 * Caches the JWKS keys to avoid fetching them on every request.
 *
 * @internal
 */
/**
 * Logger function type for JWKS cache warnings
 */
type JWKSLogger = (message: string) => void;

class JWKSCache {
  private keys: Map<string, JWKSKey> = new Map();
  private lastFetch: number = 0;
  private lastRefreshAttempt: number = 0;
  private refreshPromise: Promise<void> | null = null;
  private readonly ttl: number;
  private readonly jwksUrl: string;
  private readonly logger?: JWKSLogger;

  constructor(jwksUrl: string, ttl: number = DEFAULT_JWKS_CACHE_TTL_MS, logger?: JWKSLogger) {
    this.jwksUrl = jwksUrl;
    this.ttl = ttl;
    this.logger = logger;
  }

  async getKey(kid: string): Promise<JWKSKey | null> {
    const now = Date.now();

    // Refresh cache if expired, but rate limit refresh attempts
    const needsRefresh = now - this.lastFetch > this.ttl || this.keys.size === 0;
    const canRefresh = now - this.lastRefreshAttempt > MIN_JWKS_REFRESH_INTERVAL_MS;

    if (needsRefresh && canRefresh) {
      // Use promise-based locking to prevent concurrent refreshes
      if (!this.refreshPromise) {
        this.lastRefreshAttempt = now;
        this.refreshPromise = this.refresh().finally(() => {
          this.refreshPromise = null;
        });
      }
      await this.refreshPromise;
    }

    return this.keys.get(kid) ?? null;
  }

  private async refresh(): Promise<void> {
    try {
      const response = await fetch(this.jwksUrl);
      if (!response.ok) {
        throw new Error(`JWKS fetch failed: ${response.status}`);
      }

      const data = (await response.json()) as JWKSResponse;
      this.keys.clear();

      for (const key of data.keys) {
        if (key.kid) {
          this.keys.set(key.kid, key);
        }
      }

      this.lastFetch = Date.now();
    } catch (error) {
      // If we have cached keys, don't fail completely
      if (this.keys.size > 0) {
        this.logger?.('JWKS refresh failed, using cached keys');
        return;
      }
      throw error;
    }
  }
}

// ============================================================================
// Default JWT Verifier
// ============================================================================

/**
 * Create a default JWT verifier using JWKS
 *
 * This implementation uses Web Crypto API for JWT verification
 * to avoid external dependencies like 'jose'.
 *
 * @internal
 */
function createDefaultVerifier(
  domain: string,
  audience: string,
  issuer: string,
  clockTolerance: number,
  cacheTtl: number,
  logger?: JWKSLogger
): JwtVerifier {
  const jwksUrl = `https://${domain}/.well-known/jwks.json`;
  const cache = new JWKSCache(jwksUrl, cacheTtl, logger);

  return {
    async verify(token: string): Promise<Auth0Claims> {
      // Parse the JWT
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // Decode and validate header structure
      const headerJson = base64UrlDecode(parts[0]);
      const header = parseAndValidateHeader(headerJson);

      if (header.alg !== 'RS256') {
        throw new Error(`Unsupported algorithm: ${header.alg}`);
      }

      if (!header.kid) {
        throw new Error('Missing kid in token header');
      }

      // Get the signing key from JWKS
      const key = await cache.getKey(header.kid);
      if (!key) {
        throw new Error(`Unknown signing key: ${header.kid}`);
      }

      // Verify signature using Web Crypto
      const isValid = await verifyRS256Signature(token, key);
      if (!isValid) {
        throw new Error('Invalid token signature');
      }

      // Decode and validate claims structure
      const payloadJson = base64UrlDecode(parts[1]);
      const claims = parseAndValidateClaims(payloadJson);

      const now = Math.floor(Date.now() / 1000);

      // Validate expiration
      if (claims.exp && claims.exp + clockTolerance < now) {
        throw new Error('Token has expired');
      }

      // Validate not before
      if (claims.nbf && claims.nbf - clockTolerance > now) {
        throw new Error('Token not yet valid');
      }

      // Validate issuer
      if (claims.iss !== issuer) {
        throw new Error(`Invalid issuer: expected ${issuer}, got ${claims.iss}`);
      }

      // Validate audience
      const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (!audiences.includes(audience)) {
        throw new Error(`Invalid audience: expected ${audience}`);
      }

      return claims;
    },
  };
}

/**
 * Base64URL decode
 *
 * @internal
 */
function base64UrlDecode(str: string): string {
  // Replace URL-safe characters
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  // Pad if necessary
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  // Decode
  return Buffer.from(padded, 'base64').toString('utf-8');
}

/**
 * JWT header structure
 *
 * @internal
 */
interface JwtHeader {
  alg: string;
  kid: string;
  typ?: string;
}

/**
 * Parse and validate JWT header structure
 *
 * @param headerJson - JSON string of the JWT header
 * @returns Validated JWT header
 * @throws Error if header is malformed or missing required fields
 *
 * @internal
 */
function parseAndValidateHeader(headerJson: string): JwtHeader {
  let parsed: unknown;
  try {
    parsed = JSON.parse(headerJson);
  } catch {
    throw new Error('Invalid JWT format - malformed header JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid JWT format - header must be an object');
  }

  const header = parsed as Record<string, unknown>;

  if (typeof header.alg !== 'string') {
    throw new Error('Invalid JWT format - missing or invalid alg in header');
  }

  if (typeof header.kid !== 'string') {
    throw new Error('Invalid JWT format - missing or invalid kid in header');
  }

  return {
    alg: header.alg,
    kid: header.kid,
    typ: typeof header.typ === 'string' ? header.typ : undefined,
  };
}

/**
 * Parse and validate JWT claims structure
 *
 * Validates that required Auth0 JWT claims are present and have correct types.
 *
 * @param payloadJson - JSON string of the JWT payload
 * @returns Validated Auth0 claims
 * @throws Error if payload is malformed or missing required fields
 *
 * @internal
 */
function parseAndValidateClaims(payloadJson: string): Auth0Claims {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    throw new Error('Invalid JWT format - malformed payload JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid JWT format - payload must be an object');
  }

  const payload = parsed as Record<string, unknown>;

  // Validate required claims
  if (typeof payload.sub !== 'string') {
    throw new Error('Invalid JWT claims - missing or invalid sub');
  }

  if (typeof payload.iat !== 'number') {
    throw new Error('Invalid JWT claims - missing or invalid iat');
  }

  if (typeof payload.exp !== 'number') {
    throw new Error('Invalid JWT claims - missing or invalid exp');
  }

  if (typeof payload.iss !== 'string') {
    throw new Error('Invalid JWT claims - missing or invalid iss');
  }

  if (payload.aud !== undefined && typeof payload.aud !== 'string' && !Array.isArray(payload.aud)) {
    throw new Error('Invalid JWT claims - invalid aud format');
  }

  // Build validated claims object
  const claims: Auth0Claims = {
    sub: payload.sub,
    iat: payload.iat,
    exp: payload.exp,
    iss: payload.iss,
    aud: payload.aud as string | string[],
  };

  // Add optional claims if present and valid
  if (typeof payload.nbf === 'number') {
    claims.nbf = payload.nbf;
  }
  if (typeof payload.azp === 'string') {
    claims.azp = payload.azp;
  }
  if (typeof payload.scope === 'string') {
    claims.scope = payload.scope;
  }
  if (Array.isArray(payload.permissions)) {
    claims.permissions = payload.permissions as string[];
  }
  if (typeof payload.org_id === 'string') {
    claims.org_id = payload.org_id;
  }
  if (typeof payload.org_name === 'string') {
    claims.org_name = payload.org_name;
  }
  if (typeof payload.email === 'string') {
    claims.email = payload.email;
  }
  if (typeof payload.email_verified === 'boolean') {
    claims.email_verified = payload.email_verified;
  }
  if (typeof payload.name === 'string') {
    claims.name = payload.name;
  }
  if (typeof payload.nickname === 'string') {
    claims.nickname = payload.nickname;
  }
  if (typeof payload.picture === 'string') {
    claims.picture = payload.picture;
  }
  if (typeof payload.updated_at === 'string') {
    claims.updated_at = payload.updated_at;
  }

  return claims;
}

/**
 * Verify RS256 signature using Web Crypto API
 *
 * @internal
 */
async function verifyRS256Signature(token: string, jwk: JWKSKey): Promise<boolean> {
  const parts = token.split('.');
  const signatureInput = `${parts[0]}.${parts[1]}`;
  const signature = base64UrlToArrayBuffer(parts[2]);

  // Import the public key
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
      alg: 'RS256',
      use: 'sig',
    },
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['verify']
  );

  // Verify the signature
  const encoder = new TextEncoder();
  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signature,
    encoder.encode(signatureInput)
  );
}

/**
 * Convert base64url string to ArrayBuffer
 *
 * @internal
 */
function base64UrlToArrayBuffer(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = Buffer.from(padded, 'base64');
  return binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
}

// ============================================================================
// Auth0 Adapter Implementation
// ============================================================================

/**
 * Auth0 Adapter
 *
 * Integrates Auth0 with VeloxTS by:
 * - Verifying Auth0 JWTs using JWKS
 * - Extracting user data from token claims
 * - Supporting Auth0 Organizations and RBAC
 *
 * @example
 * ```typescript
 * const adapter = new Auth0Adapter();
 * const plugin = createAuthAdapterPlugin({
 *   adapter,
 *   config: {
 *     name: 'auth0',
 *     domain: 'your-tenant.auth0.com',
 *     audience: 'https://your-api.example.com',
 *   },
 * });
 * ```
 */
export class Auth0Adapter extends BaseAuthAdapter<Auth0AdapterConfig> {
  private verifier: JwtVerifier | null = null;
  private domain: string = '';
  private clientId?: string;
  private authHeader: string = 'authorization';

  constructor() {
    super('auth0', '1.0.0');
  }

  /**
   * Initialize the adapter with Auth0 configuration
   */
  override async initialize(fastify: FastifyInstance, config: Auth0AdapterConfig): Promise<void> {
    await super.initialize(fastify, config);

    // Validate required configuration using shared utility
    try {
      this.domain = validateNonEmptyString(config.domain, 'Auth0 domain');
    } catch {
      throw new AuthAdapterError(
        'Auth0 domain is required and cannot be empty',
        500,
        'ADAPTER_NOT_CONFIGURED'
      );
    }

    let audience: string;
    try {
      audience = validateNonEmptyString(config.audience, 'Auth0 audience');
    } catch {
      throw new AuthAdapterError(
        'Auth0 audience is required and cannot be empty',
        500,
        'ADAPTER_NOT_CONFIGURED'
      );
    }

    this.clientId = config.clientId;
    this.authHeader = config.authHeader ?? 'authorization';

    // Construct issuer URL
    const issuer = config.issuer ?? `https://${this.domain}/`;

    // Use custom verifier or create default
    // Pass bound debug method directly to avoid closure overhead
    this.verifier =
      config.jwtVerifier ??
      createDefaultVerifier(
        this.domain,
        audience,
        issuer,
        config.clockTolerance ?? DEFAULT_CLOCK_TOLERANCE_SECONDS,
        config.jwksCacheTtl ?? DEFAULT_JWKS_CACHE_TTL_MS,
        this.debug.bind(this)
      );

    this.debug(`Initialized with domain: ${this.domain}`);
  }

  /**
   * Get session from Auth0 JWT
   *
   * Extracts the Bearer token from the Authorization header
   * and verifies it using JWKS.
   */
  override async getSession(request: FastifyRequest): Promise<AdapterSessionResult | null> {
    if (!this.verifier) {
      throw new AuthAdapterError('Auth0 adapter not initialized', 500, 'ADAPTER_NOT_CONFIGURED');
    }

    // Extract token from Authorization header
    const authHeaderValue = request.headers[this.authHeader];
    if (!authHeaderValue || typeof authHeaderValue !== 'string') {
      this.debug('No authorization header found');
      return null;
    }

    // Extract Bearer token
    const token = extractBearerToken(authHeaderValue);
    if (!token) {
      this.debug('No Bearer token found in authorization header');
      return null;
    }

    try {
      // Verify the token
      const claims = await this.verifier.verify(token);

      this.debug(`Token verified for user: ${claims.sub}`);

      // Validate azp if clientId is configured
      if (this.clientId && claims.azp && claims.azp !== this.clientId) {
        this.debug(`Invalid authorized party: expected ${this.clientId}, got ${claims.azp}`);
        return null;
      }

      // Transform to VeloxTS format
      return transformAuth0Session(claims);
    } catch (error) {
      // Token verification failed
      if (error instanceof Error) {
        this.debug(`Token verification failed: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Get routes for Auth0
   *
   * Auth0 handles auth on the client side via their SDK.
   * Server only needs to verify tokens, not handle auth routes.
   *
   * If you need to handle Auth0 webhooks or Actions callbacks,
   * override this method.
   */
  override getRoutes(): AdapterRoute[] {
    return [];
  }

  /**
   * Clean up adapter resources
   */
  override async cleanup(): Promise<void> {
    await super.cleanup();
    this.verifier = null;
    this.debug('Adapter cleaned up');
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform Auth0 claims to VeloxTS format
 *
 * @param claims - Verified JWT claims
 * @returns VeloxTS adapter session result
 *
 * @internal
 */
function transformAuth0Session(claims: Auth0Claims): AdapterSessionResult {
  // Generate a synthetic session ID from sub and iat
  const sessionId = `${claims.sub}:${claims.iat}`;

  return {
    user: {
      id: claims.sub,
      email: claims.email ?? 'unknown',
      name: claims.name ?? claims.nickname,
      emailVerified: claims.email_verified,
      image: claims.picture,
      providerData: {
        // Include permissions (RBAC)
        ...(claims.permissions && { permissions: claims.permissions }),
        // Include scopes
        ...(claims.scope && { scope: claims.scope.split(' ') }),
        // Include organization data if present
        ...(claims.org_id && { organizationId: claims.org_id }),
        ...(claims.org_name && { organizationName: claims.org_name }),
        // Include other useful claims
        ...(claims.nickname && { nickname: claims.nickname }),
        ...(claims.updated_at && { updatedAt: claims.updated_at }),
      },
    },
    session: {
      sessionId,
      userId: claims.sub,
      expiresAt: claims.exp * 1000, // Convert to Unix ms
      isActive: true,
      providerData: {
        issuedAt: claims.iat * 1000,
        issuer: claims.iss,
        ...(claims.azp && { authorizedParty: claims.azp }),
        ...(claims.aud && { audience: claims.aud }),
      },
    },
  };
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an Auth0 adapter
 *
 * This is the recommended way to create an Auth0 adapter.
 * It returns an adapter instance with the configuration attached.
 *
 * @param config - Adapter configuration
 * @returns Auth0 adapter with configuration
 *
 * @example
 * ```typescript
 * import { createAuth0Adapter } from '@veloxts/auth/adapters/auth0';
 * import { createAuthAdapterPlugin } from '@veloxts/auth';
 *
 * const adapter = createAuth0Adapter({
 *   domain: process.env.AUTH0_DOMAIN!,
 *   audience: process.env.AUTH0_AUDIENCE!,
 *   clientId: process.env.AUTH0_CLIENT_ID, // Optional
 *   debug: process.env.NODE_ENV === 'development',
 * });
 *
 * // Simplified API - just pass the adapter
 * const authPlugin = createAuthAdapterPlugin(adapter);
 *
 * app.use(authPlugin);
 * ```
 */
export function createAuth0Adapter(
  config: Auth0AdapterConfig
): Auth0Adapter & { config: Auth0AdapterConfig } {
  const adapter = new Auth0Adapter();

  // Attach config for easy access when creating plugin
  return Object.assign(adapter, { config });
}

// ============================================================================
// Re-exports
// ============================================================================

export { AuthAdapterError } from '../adapter.js';
