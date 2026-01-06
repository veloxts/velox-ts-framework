/**
 * JWT Authentication Adapter for @veloxts/auth
 *
 * Implements the AuthAdapter interface using JWT tokens.
 * This allows JWT auth to follow the same pattern as external providers,
 * enabling easy swapping between authentication strategies.
 *
 * @module auth/adapters/jwt-adapter
 *
 * @example
 * ```typescript
 * import { createAuthAdapterPlugin } from '@veloxts/auth';
 * import { createJwtAdapter, jwtAuth } from '@veloxts/auth/adapters/jwt-adapter';
 *
 * // Option 1: Using createJwtAdapter + createAuthAdapterPlugin
 * const { adapter, config } = createJwtAdapter({
 *   jwt: {
 *     secret: process.env.JWT_SECRET!,
 *     accessTokenExpiry: '15m',
 *     refreshTokenExpiry: '7d',
 *   },
 *   userLoader: async (userId) => db.user.findUnique({ where: { id: userId } }),
 * });
 *
 * const authPlugin = createAuthAdapterPlugin({ adapter, config });
 * app.use(authPlugin);
 *
 * // Option 2: Using jwtAuth convenience function (recommended)
 * import { jwtAuth } from '@veloxts/auth';
 *
 * app.use(jwtAuth({
 *   jwt: {
 *     secret: process.env.JWT_SECRET!,
 *     accessTokenExpiry: '15m',
 *     refreshTokenExpiry: '7d',
 *   },
 *   userLoader: async (userId) => db.user.findUnique({ where: { id: userId } }),
 * }));
 * ```
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AdapterRoute, AdapterSessionResult, AuthAdapterConfig } from '../adapter.js';
import { AuthAdapterError, BaseAuthAdapter } from '../adapter.js';
import type { TokenStore } from '../jwt.js';
import { createInMemoryTokenStore, JwtManager } from '../jwt.js';
import type { JwtConfig, TokenPair, TokenPayload, User } from '../types.js';

// ============================================================================
// JWT Adapter Configuration
// ============================================================================

/**
 * JWT adapter configuration
 *
 * Extends the base AuthAdapterConfig with JWT-specific options.
 *
 * @example
 * ```typescript
 * const config: JwtAdapterConfig = {
 *   name: 'jwt',
 *   jwt: {
 *     secret: process.env.JWT_SECRET!,
 *     accessTokenExpiry: '15m',
 *     refreshTokenExpiry: '7d',
 *   },
 *   userLoader: async (userId) => db.user.findUnique({ where: { id: userId } }),
 *   enableRoutes: true,
 *   routePrefix: '/api/auth',
 * };
 * ```
 */
export interface JwtAdapterConfig extends AuthAdapterConfig {
  /**
   * JWT configuration (secret, expiry, etc.)
   *
   * This is passed directly to JwtManager.
   */
  jwt: JwtConfig;

  /**
   * Token store for revocation tracking
   *
   * Used to check if tokens have been revoked (e.g., on logout).
   * Defaults to in-memory store (not suitable for production).
   *
   * For production, use Redis or database-backed storage.
   */
  tokenStore?: TokenStore;

  /**
   * Load user by ID
   *
   * Called when verifying tokens to load the full user object.
   * If not provided, a minimal user object is created from token claims.
   *
   * @param userId - The user ID from the token's `sub` claim
   * @returns The user object or null if not found
   */
  userLoader?: (userId: string) => Promise<User | null>;

  /**
   * Enable built-in auth routes
   *
   * When true, mounts routes for token refresh and logout:
   * - POST `${routePrefix}/refresh` - Refresh access token
   * - POST `${routePrefix}/logout` - Revoke current token
   *
   * @default true
   */
  enableRoutes?: boolean;

  /**
   * Base path for auth routes
   *
   * Only used when `enableRoutes` is true.
   *
   * @default '/api/auth'
   */
  routePrefix?: string;
}

// ============================================================================
// JWT Adapter Implementation
// ============================================================================

/**
 * JWT Authentication Adapter
 *
 * Implements the AuthAdapter interface using JWT tokens.
 * Provides session loading from Authorization headers and
 * optional routes for token refresh and logout.
 *
 * @example
 * ```typescript
 * const adapter = new JwtAdapter();
 * await adapter.initialize(fastify, {
 *   name: 'jwt',
 *   jwt: { secret: process.env.JWT_SECRET! },
 * });
 *
 * // Get session from request
 * const session = await adapter.getSession(request);
 * if (session) {
 *   console.log('User:', session.user.email);
 * }
 * ```
 */
export class JwtAdapter extends BaseAuthAdapter<JwtAdapterConfig> {
  private jwt: JwtManager | null = null;
  private tokenStore: TokenStore | null = null;
  private userLoader?: (userId: string) => Promise<User | null>;
  private enableRoutes: boolean = true;
  private routePrefix: string = '/api/auth';

  constructor() {
    super('jwt', '1.0.0');
  }

  /**
   * Initialize the adapter with JWT configuration
   *
   * Sets up the JwtManager, token store, and configuration options.
   * Also exposes `jwtManager` and `tokenStore` on the Fastify instance.
   */
  override async initialize(fastify: FastifyInstance, config: JwtAdapterConfig): Promise<void> {
    await super.initialize(fastify, config);

    if (!config.jwt) {
      throw new AuthAdapterError(
        'JWT configuration is required in adapter config',
        500,
        'ADAPTER_NOT_CONFIGURED'
      );
    }

    // Initialize JWT manager
    this.jwt = new JwtManager(config.jwt);

    /**
     * Initialize token store (default: in-memory with warning)
     *
     * @example Production Redis store passed in config:
     * ```typescript
     * import { createRedisTokenStore } from '@veloxts/auth/redis';
     * …
     * tokenStore: createRedisTokenStore({ url: process.env.REDIS_URL })
     * ```
     */
    this.tokenStore = config.tokenStore ?? createInMemoryTokenStore();
    if (!config.tokenStore) {
      this.debug('Using in-memory token store. Use Redis in production.');
    }

    this.userLoader = config.userLoader;
    this.enableRoutes = config.enableRoutes ?? true;
    this.routePrefix = config.routePrefix ?? '/api/auth';

    // Expose JWT manager and token store on fastify for direct access
    if (!fastify.hasDecorator('jwtManager')) {
      fastify.decorate('jwtManager', this.jwt);
    }
    if (!fastify.hasDecorator('tokenStore')) {
      fastify.decorate('tokenStore', this.tokenStore);
    }

    this.info('JWT adapter initialized');
  }

  /**
   * Get session from JWT token in Authorization header
   *
   * Extracts and verifies the JWT token, checks revocation status,
   * and loads the user if a userLoader is configured.
   *
   * @returns Session result with user and session data, or null if not authenticated
   */
  override async getSession(request: FastifyRequest): Promise<AdapterSessionResult | null> {
    if (!this.jwt || !this.tokenStore) {
      throw new AuthAdapterError('JWT adapter not initialized', 500, 'ADAPTER_NOT_CONFIGURED');
    }

    // Extract token from Authorization header
    const authHeader = request.headers.authorization;
    const token = this.jwt.extractFromHeader(authHeader);

    if (!token) {
      return null;
    }

    try {
      // Verify token
      const payload = this.jwt.verifyToken(token);

      // Check for access token type
      if (payload.type !== 'access') {
        this.debug('Non-access token in Authorization header');
        return null;
      }

      // Check if token is revoked
      if (payload.jti) {
        const isRevoked = await this.tokenStore.isRevoked(payload.jti);
        if (isRevoked) {
          this.debug('Token has been revoked');
          return null;
        }
      }

      // Load user if loader provided
      let user: User | null;
      if (this.userLoader) {
        user = await this.userLoader(payload.sub);
        if (!user) {
          this.debug('User not found for token');
          return null;
        }
      } else {
        user = { id: payload.sub, email: payload.email };
      }

      // Store token and payload on request for middleware access
      // Using type assertion to avoid modifying Fastify types
      const requestWithJwt = request as FastifyRequest & {
        __jwtToken?: string;
        __jwtPayload?: TokenPayload;
      };
      requestWithJwt.__jwtToken = token;
      requestWithJwt.__jwtPayload = payload;

      return {
        user: {
          id: user.id,
          email: user.email,
          name: (user as User & { name?: string }).name,
          emailVerified: user.emailVerified,
          providerData: { roles: user.roles, permissions: user.permissions },
        },
        session: {
          sessionId: payload.jti ?? `jwt-${payload.sub}`,
          userId: payload.sub,
          expiresAt: payload.exp * 1000, // Convert to ms
          isActive: true,
          providerData: { token, payload },
        },
      };
    } catch (error) {
      this.debug(
        `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }
  }

  /**
   * Get routes for token refresh and logout
   *
   * Returns routes only if `enableRoutes` is true in config.
   */
  override getRoutes(): AdapterRoute[] {
    if (!this.enableRoutes) {
      return [];
    }

    return [
      // Refresh token endpoint
      {
        path: `${this.routePrefix}/refresh`,
        methods: ['POST'],
        handler: this.handleRefresh.bind(this),
        description: 'Refresh access token using refresh token',
      },
      // Logout endpoint (revoke token)
      {
        path: `${this.routePrefix}/logout`,
        methods: ['POST'],
        handler: this.handleLogout.bind(this),
        description: 'Revoke current access token',
      },
    ];
  }

  /**
   * Handle token refresh requests
   *
   * Expects `refreshToken` in request body.
   * Returns new token pair on success.
   */
  private async handleRefresh(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.jwt) {
      throw new AuthAdapterError('JWT adapter not initialized', 500, 'ADAPTER_NOT_CONFIGURED');
    }

    const body = request.body as { refreshToken?: string } | undefined;
    const refreshToken = body?.refreshToken;

    if (!refreshToken) {
      reply.status(400).send({ error: 'Missing refreshToken in request body' });
      return;
    }

    try {
      const tokens = await this.jwt.refreshTokens(refreshToken, this.userLoader);
      reply.send(tokens);
    } catch (error) {
      reply.status(401).send({
        error: error instanceof Error ? error.message : 'Token refresh failed',
      });
    }
  }

  /**
   * Handle logout requests
   *
   * Revokes the current access token by adding its JTI to the token store.
   * The token is extracted from the Authorization header.
   */
  private async handleLogout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.tokenStore) {
      throw new AuthAdapterError('JWT adapter not initialized', 500, 'ADAPTER_NOT_CONFIGURED');
    }

    // Get payload from request (set during getSession in preHandler)
    const requestWithJwt = request as FastifyRequest & { __jwtPayload?: TokenPayload };
    const payload = requestWithJwt.__jwtPayload;

    if (payload?.jti) {
      await this.tokenStore.revoke(payload.jti);
      this.debug(`Token ${payload.jti} revoked`);
    }

    reply.status(200).send({ success: true });
  }

  /**
   * Clean up adapter resources
   */
  override async cleanup(): Promise<void> {
    await super.cleanup();
    this.jwt = null;
    this.tokenStore = null;
    this.userLoader = undefined;
    this.info('JWT adapter cleaned up');
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Create a token pair for a user
   *
   * Convenience method that delegates to the underlying JwtManager.
   * Can be accessed via `fastify.jwtManager.createTokenPair()` as well.
   *
   * @param user - The user to create tokens for
   * @param additionalClaims - Custom claims to include in the token
   * @returns Token pair with access and refresh tokens
   *
   * @example
   * ```typescript
   * const tokens = adapter.createTokenPair(user);
   * // { accessToken, refreshToken, expiresIn, tokenType }
   * ```
   */
  createTokenPair(user: User, additionalClaims?: Record<string, unknown>): TokenPair {
    if (!this.jwt) {
      throw new AuthAdapterError('JWT adapter not initialized', 500, 'ADAPTER_NOT_CONFIGURED');
    }
    return this.jwt.createTokenPair(user, additionalClaims);
  }

  /**
   * Get the underlying JwtManager instance
   *
   * Useful for advanced token operations.
   */
  getJwtManager(): JwtManager {
    if (!this.jwt) {
      throw new AuthAdapterError('JWT adapter not initialized', 500, 'ADAPTER_NOT_CONFIGURED');
    }
    return this.jwt;
  }

  /**
   * Get the token store instance
   *
   * Useful for manual token revocation.
   */
  getTokenStore(): TokenStore {
    if (!this.tokenStore) {
      throw new AuthAdapterError('JWT adapter not initialized', 500, 'ADAPTER_NOT_CONFIGURED');
    }
    return this.tokenStore;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a JWT auth adapter
 *
 * This is the recommended way to create a JWT adapter for use with
 * createAuthAdapterPlugin. Returns both the adapter instance and
 * the configuration for convenience.
 *
 * @param config - JWT adapter configuration (without name, which is auto-set to 'jwt')
 * @returns Object with adapter and config
 *
 * @example
 * ```typescript
 * import { createJwtAdapter } from '@veloxts/auth/adapters/jwt-adapter';
 * import { createAuthAdapterPlugin } from '@veloxts/auth';
 *
 * const { adapter, config } = createJwtAdapter({
 *   jwt: {
 *     secret: process.env.JWT_SECRET!,
 *     accessTokenExpiry: '15m',
 *     refreshTokenExpiry: '7d',
 *   },
 *   userLoader: async (userId) => db.user.findUnique({ where: { id: userId } }),
 * });
 *
 * const authPlugin = createAuthAdapterPlugin({ adapter, config });
 * app.use(authPlugin);
 * ```
 */
export function createJwtAdapter(config: Omit<JwtAdapterConfig, 'name'>): {
  adapter: JwtAdapter;
  config: JwtAdapterConfig;
} {
  const adapter = new JwtAdapter();
  const fullConfig: JwtAdapterConfig = {
    name: 'jwt',
    ...config,
  };
  return { adapter, config: fullConfig };
}

// ============================================================================
// Fastify Type Extensions
// ============================================================================

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * JWT manager instance (from JwtAdapter)
     *
     * Available after registering the JWT adapter plugin.
     * Use for creating tokens, verifying tokens, etc.
     */
    jwtManager?: JwtManager;

    /**
     * Token store instance (from JwtAdapter)
     *
     * Available after registering the JWT adapter plugin.
     * Use for manual token revocation.
     */
    tokenStore?: TokenStore;
  }
}

// ============================================================================
// Re-exports
// ============================================================================

export { AuthAdapterError } from '../adapter.js';
