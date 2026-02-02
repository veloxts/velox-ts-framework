/**
 * VeloxTS Auth Plugin
 *
 * Unified authentication using the adapter pattern internally.
 * This plugin provides a convenient API while using JwtAdapter under the hood.
 *
 * @module auth/plugin
 */

import { createRequire } from 'node:module';

import type { VeloxPlugin } from '@veloxts/core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AdapterUser, AuthAdapterError, AuthAdapterPluginOptions } from './adapter.js';
import { createAuthAdapterPlugin } from './adapter.js';
import type { JwtAdapterConfig } from './adapters/jwt-adapter.js';
import { createJwtAdapter } from './adapters/jwt-adapter.js';
import { checkDoubleRegistration, decorateAuth } from './decoration.js';
import { PasswordHasher } from './hash.js';
import type { JwtManager, TokenStore } from './jwt.js';
import { authMiddleware } from './middleware.js';
import type { AdapterAuthContext, AuthConfig, JwtConfig, TokenPair, User } from './types.js';

// Read version from package.json dynamically
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

/** Auth package version */
export const AUTH_VERSION: string = packageJson.version ?? '0.0.0-unknown';

// ============================================================================
// Auth Plugin Options
// ============================================================================

/**
 * Options for the auth plugin
 */
export interface AuthPluginOptions extends AuthConfig {
  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

// ============================================================================
// Auth Service
// ============================================================================

/**
 * Auth service instance attached to Fastify
 * Provides authentication utilities for the application
 */
export interface AuthService {
  /**
   * JWT manager for token operations
   */
  jwt: JwtManager;

  /**
   * Password hasher for secure password storage
   */
  hasher: PasswordHasher;

  /**
   * Token store for revocation (if configured)
   */
  tokenStore?: TokenStore;

  /**
   * Creates a token pair for a user
   */
  createTokens(user: User, additionalClaims?: Record<string, unknown>): TokenPair;

  /**
   * Verifies an access token and returns the auth context
   */
  verifyToken(token: string): AdapterAuthContext;

  /**
   * Refreshes tokens using a refresh token
   */
  refreshTokens(refreshToken: string): Promise<TokenPair> | TokenPair;

  /**
   * Gets the auth middleware factory
   */
  middleware: ReturnType<typeof authMiddleware>;
}

// ============================================================================
// Fastify Type Extensions
// ============================================================================

import type { AuthContext } from './types.js';

declare module 'fastify' {
  interface FastifyInstance {
    auth: AuthService;
  }

  interface FastifyRequest {
    auth?: AuthContext;
    user?: User;
  }
}

// ============================================================================
// Auth Plugin
// ============================================================================

/**
 * Wraps isTokenRevoked callback as a TokenStore interface
 * @internal
 */
function createCallbackTokenStore(
  isTokenRevoked: (tokenId: string) => boolean | Promise<boolean>
): TokenStore {
  return {
    revoke: () => {
      // No-op: callback-based stores don't support revocation
      // Users must implement their own revocation mechanism
    },
    isRevoked: isTokenRevoked,
    clear: () => {
      // No-op
    },
  };
}

/**
 * Creates the VeloxTS auth plugin
 *
 * **Internally uses the JwtAdapter** for unified architecture.
 * All authentication in VeloxTS uses the adapter pattern.
 *
 * This plugin provides:
 * - JWT token management (access + refresh tokens)
 * - Password hashing (bcrypt/argon2)
 * - Request decorations for auth context
 * - Auth middleware factory for procedures
 *
 * @example
 * ```typescript
 * import { authPlugin } from '@veloxts/auth';
 *
 * const auth = authPlugin({
 *   jwt: {
 *     secret: process.env.JWT_SECRET!,
 *     accessTokenExpiry: '15m',
 *     refreshTokenExpiry: '7d',
 *   },
 *   hash: {
 *     algorithm: 'bcrypt',
 *     bcryptRounds: 12,
 *   },
 *   userLoader: async (userId) => {
 *     return db.user.findUnique({ where: { id: userId } });
 *   },
 * });
 *
 * // Register with VeloxApp
 * await app.register(auth);
 *
 * // Use in procedures
 * const { middleware, requireAuth } = app.auth.middleware;
 *
 * const getProfile = procedure()
 *   .use(requireAuth())
 *   .query(async ({ ctx }) => ctx.user);
 * ```
 */
export function authPlugin(options: AuthPluginOptions): VeloxPlugin<AuthPluginOptions> {
  return {
    name: '@veloxts/auth',
    version: AUTH_VERSION,

    async register(server: FastifyInstance, _opts: AuthPluginOptions) {
      const config = { ...options, ..._opts };
      const { debug = false } = config;

      // Prevent double-registration of auth systems
      checkDoubleRegistration(server, 'authPlugin');

      if (debug) {
        server.log.info('Registering @veloxts/auth plugin (adapter-based)');
      }

      // Convert isTokenRevoked callback to TokenStore if provided
      const tokenStore = config.isTokenRevoked
        ? createCallbackTokenStore(config.isTokenRevoked)
        : undefined;

      // Create the JWT adapter
      const { adapter, config: adapterConfig } = createJwtAdapter({
        jwt: config.jwt,
        userLoader: config.userLoader,
        tokenStore,
        enableRoutes: false, // authPlugin manages its own API
        debug,
      });

      // Initialize adapter
      await adapter.initialize(server, adapterConfig);

      // Decorate requests with auth context
      decorateAuth(server);

      // Get JWT manager from adapter
      const jwt = adapter.getJwtManager();
      const hasher = new PasswordHasher(config.hash);
      const authMw = authMiddleware(config);

      // Build AuthService from adapter
      const authService: AuthService = {
        jwt,
        hasher,
        tokenStore: adapter.getTokenStore(),

        createTokens(user: User, additionalClaims?: Record<string, unknown>): TokenPair {
          return jwt.createTokenPair(user, additionalClaims);
        },

        verifyToken(token: string): AdapterAuthContext {
          const payload = jwt.verifyToken(token);
          return {
            authMode: 'adapter',
            user: {
              id: payload.sub,
              email: payload.email,
            },
            isAuthenticated: true,
            providerId: 'jwt',
            session: { token, payload },
          };
        },

        refreshTokens(refreshToken: string): Promise<TokenPair> | TokenPair {
          if (config.userLoader) {
            return jwt.refreshTokens(refreshToken, config.userLoader);
          }
          return jwt.refreshTokens(refreshToken);
        },

        middleware: authMw,
      };

      // Decorate server with auth service
      server.decorate('auth', authService);

      // Add preHandler hook for session loading (using adapter)
      if (config.autoExtract !== false) {
        server.addHook('preHandler', async (request) => {
          const session = await adapter.getSession(request);
          if (session) {
            const user: User = {
              id: session.user.id,
              email: session.user.email,
              ...(session.user.emailVerified !== undefined && {
                emailVerified: session.user.emailVerified,
              }),
              ...session.user.providerData,
            };

            const authContext: AdapterAuthContext = {
              authMode: 'adapter',
              isAuthenticated: true,
              user,
              providerId: 'jwt',
              session: session.session.providerData,
            };

            request.auth = authContext;
            request.user = user;
          }
        });
      }

      // Add shutdown hook for cleanup
      server.addHook('onClose', async () => {
        if (debug) {
          server.log.info('Shutting down @veloxts/auth plugin');
        }
      });

      if (debug) {
        server.log.info('@veloxts/auth plugin registered successfully');
      }
    },
  };
}

/**
 * Default auth plugin with minimal configuration
 *
 * Uses environment variables for configuration:
 * - `JWT_SECRET` (required): Secret for signing JWT tokens
 *
 * @throws {Error} If JWT_SECRET environment variable is not set
 *
 * @example
 * ```typescript
 * import { defaultAuthPlugin } from '@veloxts/auth';
 *
 * // Requires JWT_SECRET environment variable
 * await app.register(defaultAuthPlugin());
 * ```
 */
export function defaultAuthPlugin(): VeloxPlugin<AuthPluginOptions> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required for auth plugin. ' +
        'Set it to a secure random string of at least 32 characters.'
    );
  }

  return authPlugin({
    jwt: { secret },
  });
}

// ============================================================================
// JWT Auth (Adapter-based)
// ============================================================================

/**
 * Options for jwtAuth convenience function
 *
 * Explicit interface for better discoverability (name is auto-set to 'jwt').
 */
export interface JwtAuthOptions {
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
   */
  tokenStore?: TokenStore;

  /**
   * Load user by ID
   *
   * Called when verifying tokens to load the full user object.
   * If not provided, a minimal user object is created from token claims.
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

  /**
   * Enable debug logging
   *
   * @default false
   */
  debug?: boolean;

  /**
   * Transform adapter user to VeloxTS User
   *
   * Override to customize how token claims are transformed to User.
   */
  transformUser?: (adapterUser: AdapterUser) => User;

  /**
   * Routes to exclude from automatic session loading
   */
  excludeRoutes?: string[];

  /**
   * Custom error handler for adapter errors
   */
  onError?: (
    error: AuthAdapterError,
    request: FastifyRequest,
    reply: FastifyReply
  ) => void | Promise<void>;
}

/**
 * Creates JWT auth using the adapter pattern directly
 *
 * This is an alternative to `authPlugin` that gives you more control over
 * adapter-specific features like built-in routes and route prefixes.
 *
 * **Note:** Both `authPlugin` and `jwtAuth` now use the adapter pattern internally.
 * Choose based on your needs:
 *
 * **Use `authPlugin` when:**
 * - You need the `authMiddleware` factory for fine-grained procedure control
 * - You're using DI container integration
 * - You want the familiar VeloxTS auth API (`fastify.auth.createTokens()`, etc.)
 *
 * **Use `jwtAuth` when:**
 * - You want built-in `/api/auth/refresh` and `/api/auth/logout` routes
 * - You're building a pure adapter-based setup
 * - You want direct access to adapter features
 *
 * @param options - JWT adapter configuration
 * @returns VeloxPlugin ready for registration
 *
 * @example
 * ```typescript
 * import { jwtAuth } from '@veloxts/auth';
 *
 * // With built-in routes
 * app.use(jwtAuth({
 *   jwt: {
 *     secret: process.env.JWT_SECRET!,
 *     accessTokenExpiry: '15m',
 *     refreshTokenExpiry: '7d',
 *   },
 *   userLoader: async (userId) => {
 *     return db.user.findUnique({ where: { id: userId } });
 *   },
 *   enableRoutes: true, // Mount /api/auth/refresh and /api/auth/logout
 *   routePrefix: '/api/auth',
 * }));
 *
 * // Access JWT utilities via fastify
 * const tokens = fastify.jwtManager!.createTokenPair(user);
 * await fastify.tokenStore!.revoke(tokenId);
 * ```
 */
export function jwtAuth(
  options: JwtAuthOptions
): VeloxPlugin<AuthAdapterPluginOptions<JwtAdapterConfig>> {
  const { adapter, config } = createJwtAdapter(options);
  return createAuthAdapterPlugin({ adapter, config });
}
