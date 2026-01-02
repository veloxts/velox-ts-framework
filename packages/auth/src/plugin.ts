/**
 * VeloxTS Auth Plugin
 * Fastify plugin that integrates authentication with VeloxApp
 * @module auth/plugin
 */

import { createRequire } from 'node:module';

import type { Container, VeloxPlugin } from '@veloxts/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { PasswordHasher } from './hash.js';
import { JwtManager } from './jwt.js';
import { authMiddleware } from './middleware.js';
import { registerAuthProviders } from './providers.js';
import { AUTH_SERVICE } from './tokens.js';
import type { AuthConfig, AuthContext, TokenPair, User } from './types.js';

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

  /**
   * DI container for service registration and resolution (optional)
   *
   * When provided, auth services are registered with the container and can be:
   * - Resolved from the container directly
   * - Mocked in tests by overriding registrations
   * - Managed alongside other application services
   *
   * When not provided, services are created directly (legacy behavior).
   *
   * @example
   * ```typescript
   * import { Container } from '@veloxts/core';
   * import { authPlugin, JWT_MANAGER } from '@veloxts/auth';
   *
   * const container = new Container();
   * app.register(authPlugin({
   *   jwt: { secret: '...' },
   *   container,
   * }));
   *
   * // Services now available from container
   * const jwt = container.resolve(JWT_MANAGER);
   * ```
   */
  container?: Container;
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
   * Creates a token pair for a user
   */
  createTokens(user: User, additionalClaims?: Record<string, unknown>): TokenPair;

  /**
   * Verifies an access token and returns the auth context
   */
  verifyToken(token: string): AuthContext;

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
 * Creates the VeloxTS auth plugin (succinct API)
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
    // No explicit dependencies - works with any Fastify instance
    // The plugin decorates Fastify with auth functionality

    async register(server: FastifyInstance, _opts: AuthPluginOptions) {
      const config = { ...options, ..._opts };
      const { debug = false, container } = config;

      if (debug) {
        server.log.info('Registering @veloxts/auth plugin');
      }

      let authService: AuthService;

      if (container) {
        // DI-enabled path: Register providers and resolve from container
        if (debug) {
          server.log.info('Using DI container for auth services');
        }

        registerAuthProviders(container, config);
        authService = container.resolve(AUTH_SERVICE);
      } else {
        // Legacy path: Direct instantiation (backward compatible)
        const jwt = new JwtManager(config.jwt);
        const hasher = new PasswordHasher(config.hash);
        const authMw = authMiddleware(config);

        authService = {
          jwt,
          hasher,

          createTokens(user: User, additionalClaims?: Record<string, unknown>): TokenPair {
            return jwt.createTokenPair(user, additionalClaims);
          },

          verifyToken(token: string): AuthContext {
            const payload = jwt.verifyToken(token);
            return {
              user: {
                id: payload.sub,
                email: payload.email,
              },
              token: payload,
              isAuthenticated: true,
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
      }

      // Decorate server with auth service
      server.decorate('auth', authService);

      // Decorate requests with auth context (undefined initial value)
      server.decorateRequest('auth', undefined);
      server.decorateRequest('user', undefined);

      // Add preHandler hook to extract auth from headers (optional)
      if (config.autoExtract !== false) {
        server.addHook('preHandler', async (request: FastifyRequest) => {
          const authHeader = request.headers.authorization;
          const token = authService.jwt.extractFromHeader(authHeader);

          if (token) {
            try {
              const payload = authService.jwt.verifyToken(token);

              // Check if token is revoked
              if (config.isTokenRevoked && payload.jti) {
                const revoked = await config.isTokenRevoked(payload.jti);
                if (revoked) {
                  // Token revoked - don't set auth context
                  return;
                }
              }

              // Load user if loader provided
              let user: User | null = null;
              if (config.userLoader) {
                user = await config.userLoader(payload.sub);
              } else {
                user = {
                  id: payload.sub,
                  email: payload.email,
                };
              }

              if (user) {
                request.auth = {
                  user,
                  token: payload,
                  isAuthenticated: true,
                };
                request.user = user;
              }
            } catch {
              // Invalid token - silently ignore (optional auth)
              if (debug) {
                server.log.debug('Invalid auth token in request');
              }
            }
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
