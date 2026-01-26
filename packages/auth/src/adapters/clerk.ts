/**
 * Clerk Adapter for @veloxts/auth
 *
 * Integrates Clerk (https://clerk.com) with VeloxTS's pluggable
 * authentication system. Clerk is a complete user management platform
 * with authentication, user profiles, and organization management.
 *
 * @module auth/adapters/clerk
 *
 * @example
 * ```typescript
 * import { createAuthAdapterPlugin } from '@veloxts/auth';
 * import { createClerkAdapter } from '@veloxts/auth/adapters/clerk';
 * import { createClerkClient } from '@clerk/backend';
 *
 * // Create Clerk client
 * const clerk = createClerkClient({
 *   secretKey: process.env.CLERK_SECRET_KEY!,
 *   publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
 * });
 *
 * // Create adapter
 * const adapter = createClerkAdapter({
 *   name: 'clerk',
 *   clerk,
 * });
 *
 * // Create plugin and register
 * const authPlugin = createAuthAdapterPlugin({
 *   adapter,
 *   config: adapter.config,
 * });
 *
 * app.use(authPlugin);
 * ```
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { AdapterRoute, AdapterSessionResult, AuthAdapterConfig } from '../adapter.js';
import { AuthAdapterError, BaseAuthAdapter } from '../adapter.js';
import { extractBearerToken } from './utils.js';

// ============================================================================
// Clerk Types
// ============================================================================

/**
 * Clerk user data
 *
 * Represents the user data returned by Clerk's backend API.
 */
export interface ClerkUser {
  /** Unique user ID */
  id: string;
  /** Primary email address */
  primaryEmailAddressId: string | null;
  /** Email addresses associated with the user */
  emailAddresses: Array<{
    id: string;
    emailAddress: string;
    verification: {
      status: string;
    } | null;
  }>;
  /** User's first name */
  firstName: string | null;
  /** User's last name */
  lastName: string | null;
  /** Full name (computed) */
  fullName: string | null;
  /** Profile image URL */
  imageUrl: string;
  /** Whether the user has a profile image */
  hasImage: boolean;
  /** Account creation timestamp (Unix ms) */
  createdAt: number;
  /** Account update timestamp (Unix ms) */
  updatedAt: number;
  /** Whether user has completed onboarding */
  publicMetadata: Record<string, unknown>;
  /** Private metadata (server-side only) */
  privateMetadata: Record<string, unknown>;
  /** Unsafe metadata (can be set by client) */
  unsafeMetadata: Record<string, unknown>;
}

/**
 * Clerk session claims from JWT
 *
 * Represents the claims in a verified Clerk JWT.
 */
export interface ClerkSessionClaims {
  /** Subject (user ID) */
  sub: string;
  /** Session ID */
  sid: string;
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
  /** Not before timestamp */
  nbf: number;
  /** Issuer */
  iss: string;
  /** Audience */
  aud?: string;
  /** Authorized parties */
  azp?: string;
  /** Organization ID (if using organizations) */
  org_id?: string;
  /** Organization role */
  org_role?: string;
  /** Organization slug */
  org_slug?: string;
  /** Organization permissions */
  org_permissions?: string[];
}

/**
 * Clerk verification result
 *
 * Result from verifying a Clerk JWT token.
 */
export interface ClerkVerificationResult {
  /** Verified session claims */
  sessionClaims: ClerkSessionClaims;
  /** Session ID */
  sessionId: string;
}

/**
 * Clerk client interface
 *
 * Minimal interface for the Clerk backend client.
 * We don't import the actual types to avoid requiring @clerk/backend
 * as a dependency - it's a peer dependency.
 */
export interface ClerkClient {
  /** Verify a session token */
  verifyToken: (
    token: string,
    options?: {
      authorizedParties?: string[];
      audiences?: string | string[];
      clockSkewInMs?: number;
    }
  ) => Promise<ClerkSessionClaims>;

  /** Get user by ID */
  users: {
    getUser: (userId: string) => Promise<ClerkUser>;
  };
}

// ============================================================================
// Adapter Configuration
// ============================================================================

/**
 * Clerk adapter configuration
 *
 * @example
 * ```typescript
 * const config: ClerkAdapterConfig = {
 *   name: 'clerk',
 *   clerk: createClerkClient({ secretKey: '...' }),
 *   authorizedParties: ['http://localhost:3000'],
 *   debug: true,
 * };
 * ```
 */
export interface ClerkAdapterConfig extends AuthAdapterConfig {
  /**
   * Clerk client instance
   *
   * Created using `createClerkClient()` from '@clerk/backend'.
   */
  clerk: ClerkClient;

  /**
   * Authorized parties for token verification
   *
   * List of origins that are allowed to use the token.
   * Should match your application's origins.
   *
   * @example ['http://localhost:3000', 'https://myapp.com']
   */
  authorizedParties?: string[];

  /**
   * Expected audience for token verification
   *
   * If set, tokens must contain this audience claim.
   */
  audiences?: string | string[];

  /**
   * Clock skew tolerance in milliseconds
   *
   * Allows for slight differences in server clocks.
   *
   * @default 5000
   */
  clockSkewInMs?: number;

  /**
   * Custom header name for the authorization token
   *
   * @default 'authorization'
   */
  authHeader?: string;

  /**
   * Whether to fetch full user data from Clerk API
   *
   * When true, makes an additional API call to get full user profile.
   * When false, only uses data from the JWT claims.
   *
   * @default true
   */
  fetchUserData?: boolean;
}

// ============================================================================
// Clerk Adapter Implementation
// ============================================================================

/**
 * Clerk Adapter
 *
 * Integrates Clerk with VeloxTS by:
 * - Verifying Clerk JWTs from the Authorization header
 * - Loading user data from Clerk's API (optional)
 * - Transforming Clerk's user/session to VeloxTS format
 *
 * @example
 * ```typescript
 * const adapter = new ClerkAdapter();
 * const plugin = createAuthAdapterPlugin({
 *   adapter,
 *   config: {
 *     name: 'clerk',
 *     clerk: createClerkClient({ secretKey: '...' }),
 *   },
 * });
 * ```
 */
export class ClerkAdapter extends BaseAuthAdapter<ClerkAdapterConfig> {
  private clerk: ClerkClient | null = null;
  private authorizedParties?: string[];
  private audiences?: string | string[];
  private clockSkewInMs: number = 5000;
  private authHeader: string = 'authorization';
  private fetchUserData: boolean = true;

  constructor() {
    super('clerk', '1.0.0');
  }

  /**
   * Initialize the adapter with Clerk client
   */
  override async initialize(fastify: FastifyInstance, config: ClerkAdapterConfig): Promise<void> {
    await super.initialize(fastify, config);

    if (!config.clerk) {
      throw new AuthAdapterError(
        'Clerk client is required in adapter config',
        500,
        'ADAPTER_NOT_CONFIGURED'
      );
    }

    this.clerk = config.clerk;
    this.authorizedParties = config.authorizedParties;
    this.audiences = config.audiences;
    this.clockSkewInMs = config.clockSkewInMs ?? 5000;
    this.authHeader = config.authHeader ?? 'authorization';
    this.fetchUserData = config.fetchUserData ?? true;

    this.debug(`Initialized with fetchUserData: ${this.fetchUserData}`);
  }

  /**
   * Get session from Clerk JWT
   *
   * Extracts the Bearer token from the Authorization header,
   * verifies it with Clerk, and optionally fetches user data.
   */
  override async getSession(request: FastifyRequest): Promise<AdapterSessionResult | null> {
    if (!this.clerk) {
      throw new AuthAdapterError('Clerk adapter not initialized', 500, 'ADAPTER_NOT_CONFIGURED');
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
      // Verify the token with Clerk
      const claims = await this.clerk.verifyToken(token, {
        authorizedParties: this.authorizedParties,
        audiences: this.audiences,
        clockSkewInMs: this.clockSkewInMs,
      });

      this.debug(`Token verified for user: ${claims.sub}`);

      // Optionally fetch full user data
      let user: ClerkUser | null = null;
      if (this.fetchUserData) {
        try {
          user = await this.clerk.users.getUser(claims.sub);
          this.debug(`User data fetched for: ${user.id}`);
        } catch (fetchError) {
          this.error(
            'Failed to fetch user data',
            fetchError instanceof Error ? fetchError : undefined
          );
          // Continue without full user data - we still have claims
        }
      }

      // Transform to VeloxTS format
      return transformClerkSession(claims, user);
    } catch (error) {
      // Token verification failed - this is expected for invalid/expired tokens
      if (error instanceof Error) {
        this.debug(`Token verification failed: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Get routes for Clerk handler
   *
   * Clerk doesn't typically need server-side routes - authentication
   * is handled client-side via Clerk's SDK. Return empty array.
   *
   * If you need to handle Clerk webhooks, override this method.
   */
  override getRoutes(): AdapterRoute[] {
    // Clerk handles auth on the client side via their SDK
    // Server only needs to verify tokens, not handle auth routes
    return [];
  }

  /**
   * Clean up adapter resources
   */
  override async cleanup(): Promise<void> {
    await super.cleanup();
    this.clerk = null;
    this.debug('Adapter cleaned up');
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get primary email from Clerk user
 *
 * @param user - Clerk user object
 * @returns Primary email address or 'unknown' if not found
 *
 * @internal
 */
function getPrimaryEmail(user: ClerkUser | null): string {
  if (!user) {
    return 'unknown';
  }

  if (user.primaryEmailAddressId && user.emailAddresses.length > 0) {
    const primary = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);
    if (primary) {
      return primary.emailAddress;
    }
  }

  // Fallback to first email
  if (user.emailAddresses.length > 0) {
    return user.emailAddresses[0].emailAddress;
  }

  return 'unknown';
}

/**
 * Check if user email is verified
 *
 * @param user - Clerk user object
 * @returns Whether the primary email is verified
 *
 * @internal
 */
function isEmailVerified(user: ClerkUser | null): boolean {
  if (!user) {
    return false;
  }

  if (user.primaryEmailAddressId && user.emailAddresses.length > 0) {
    const primary = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);
    if (primary?.verification?.status === 'verified') {
      return true;
    }
  }

  return false;
}

/**
 * Get display name from Clerk user
 *
 * @param user - Clerk user object
 * @returns Display name or undefined
 *
 * @internal
 */
function getDisplayName(user: ClerkUser | null): string | undefined {
  if (!user) {
    return undefined;
  }

  if (user.fullName) {
    return user.fullName;
  }

  if (user.firstName || user.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }

  return undefined;
}

/**
 * Transform Clerk session to VeloxTS format
 *
 * @param claims - Verified JWT claims
 * @param user - Optional full user data from Clerk API
 * @returns VeloxTS adapter session result
 *
 * @internal
 */
function transformClerkSession(
  claims: ClerkSessionClaims,
  user: ClerkUser | null
): AdapterSessionResult {
  return {
    user: {
      id: claims.sub,
      email: getPrimaryEmail(user),
      name: getDisplayName(user),
      emailVerified: isEmailVerified(user),
      image: user?.imageUrl,
      providerData: {
        // Include organization data if present
        ...(claims.org_id && { organizationId: claims.org_id }),
        ...(claims.org_role && { organizationRole: claims.org_role }),
        ...(claims.org_slug && { organizationSlug: claims.org_slug }),
        ...(claims.org_permissions && { organizationPermissions: claims.org_permissions }),
        // Include metadata if user data was fetched
        ...(user && {
          publicMetadata: user.publicMetadata,
          privateMetadata: user.privateMetadata,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }),
      },
    },
    session: {
      sessionId: claims.sid,
      userId: claims.sub,
      expiresAt: claims.exp * 1000, // Convert to Unix ms
      isActive: true,
      providerData: {
        issuedAt: claims.iat * 1000,
        notBefore: claims.nbf * 1000,
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
 * Create a Clerk adapter
 *
 * This is the recommended way to create a Clerk adapter.
 * It returns an adapter instance with the configuration attached.
 *
 * @param config - Adapter configuration
 * @returns Clerk adapter with configuration
 *
 * @example
 * ```typescript
 * import { createClerkAdapter } from '@veloxts/auth/adapters/clerk';
 * import { createAuthAdapterPlugin } from '@veloxts/auth';
 * import { createClerkClient } from '@clerk/backend';
 *
 * const clerk = createClerkClient({
 *   secretKey: process.env.CLERK_SECRET_KEY!,
 * });
 *
 * const adapter = createClerkAdapter({
 *   name: 'clerk',
 *   clerk,
 *   authorizedParties: ['http://localhost:3000'],
 *   debug: process.env.NODE_ENV === 'development',
 * });
 *
 * const authPlugin = createAuthAdapterPlugin({
 *   adapter,
 *   config: adapter.config,
 * });
 *
 * app.use(authPlugin);
 * ```
 */
export function createClerkAdapter(
  config: ClerkAdapterConfig
): ClerkAdapter & { config: ClerkAdapterConfig } {
  const adapter = new ClerkAdapter();

  // Attach config for easy access when creating plugin
  return Object.assign(adapter, { config });
}

// ============================================================================
// Re-exports
// ============================================================================

export { AuthAdapterError } from '../adapter.js';
