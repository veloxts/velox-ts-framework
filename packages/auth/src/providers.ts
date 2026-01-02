/**
 * DI Providers for @veloxts/auth
 *
 * Factory provider functions for registering auth services with the DI container.
 * These providers allow services to be managed by the container for testability and flexibility.
 *
 * @module auth/providers
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerAuthProviders, JWT_MANAGER } from '@veloxts/auth';
 *
 * const container = new Container();
 * registerAuthProviders(container, {
 *   jwt: { secret: process.env.JWT_SECRET! }
 * });
 *
 * const jwt = container.resolve(JWT_MANAGER);
 * ```
 */

import { type Container, type FactoryProvider, Scope } from '@veloxts/core';

import { PasswordHasher } from './hash.js';
import { JwtManager } from './jwt.js';
import { authMiddleware } from './middleware.js';
import type { AuthService } from './plugin.js';
import {
  AUTH_CONFIG,
  AUTH_SERVICE,
  HASH_CONFIG,
  JWT_CONFIG,
  JWT_MANAGER,
  PASSWORD_HASHER,
} from './tokens.js';
import type { AuthConfig, AuthContext, HashConfig, JwtConfig, TokenPair, User } from './types.js';

// ============================================================================
// Service Providers
// ============================================================================

/**
 * Creates a factory provider for JwtManager
 *
 * Requires JWT_CONFIG to be registered in the container.
 *
 * @example
 * ```typescript
 * container.register({ provide: JWT_CONFIG, useValue: { secret: '...' } });
 * container.register(jwtManagerProvider());
 * const jwt = container.resolve(JWT_MANAGER);
 * ```
 */
export function jwtManagerProvider(): FactoryProvider<JwtManager> {
  return {
    provide: JWT_MANAGER,
    useFactory: (config: JwtConfig) => new JwtManager(config),
    inject: [JWT_CONFIG],
    scope: Scope.SINGLETON,
  };
}

/**
 * Creates a factory provider for PasswordHasher
 *
 * Uses HASH_CONFIG if available, otherwise uses default config.
 *
 * @example
 * ```typescript
 * // With config
 * container.register({ provide: HASH_CONFIG, useValue: { algorithm: 'argon2' } });
 * container.register(passwordHasherProvider());
 *
 * // Or without config (uses defaults)
 * container.register(passwordHasherProviderWithDefaults());
 * ```
 */
export function passwordHasherProvider(): FactoryProvider<PasswordHasher> {
  return {
    provide: PASSWORD_HASHER,
    useFactory: (config?: HashConfig) => new PasswordHasher(config),
    inject: [HASH_CONFIG],
    scope: Scope.SINGLETON,
  };
}

/**
 * Creates a factory provider for PasswordHasher with default config
 *
 * Use this when you don't need custom hash configuration.
 */
export function passwordHasherProviderWithDefaults(): FactoryProvider<PasswordHasher> {
  return {
    provide: PASSWORD_HASHER,
    useFactory: () => new PasswordHasher(),
    inject: [],
    scope: Scope.SINGLETON,
  };
}

/**
 * Creates a factory provider for the composite AuthService
 *
 * Requires JWT_MANAGER, PASSWORD_HASHER, and AUTH_CONFIG to be registered.
 *
 * @example
 * ```typescript
 * registerAuthProviders(container, config);
 * const auth = container.resolve(AUTH_SERVICE);
 * const tokens = auth.createTokens(user);
 * ```
 */
export function authServiceProvider(): FactoryProvider<AuthService> {
  return {
    provide: AUTH_SERVICE,
    useFactory: (jwt: JwtManager, hasher: PasswordHasher, config: AuthConfig): AuthService => {
      const authMw = authMiddleware(config);

      return {
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
    },
    inject: [JWT_MANAGER, PASSWORD_HASHER, AUTH_CONFIG],
    scope: Scope.SINGLETON,
  };
}

// ============================================================================
// Bulk Registration Helper
// ============================================================================

/**
 * Registers all auth providers with a container
 *
 * This is the recommended way to set up auth services with DI.
 * It registers config values and all service providers in the correct order.
 *
 * @param container - The DI container to register providers with
 * @param config - Auth configuration (jwt config is required)
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerAuthProviders, JWT_MANAGER, PASSWORD_HASHER } from '@veloxts/auth';
 *
 * const container = new Container();
 *
 * registerAuthProviders(container, {
 *   jwt: {
 *     secret: process.env.JWT_SECRET!,
 *     accessTokenExpiry: '15m',
 *     refreshTokenExpiry: '7d',
 *   },
 *   hash: {
 *     algorithm: 'bcrypt',
 *     bcryptRounds: 12,
 *   },
 * });
 *
 * // Now resolve services from container
 * const jwt = container.resolve(JWT_MANAGER);
 * const hasher = container.resolve(PASSWORD_HASHER);
 * const auth = container.resolve(AUTH_SERVICE);
 * ```
 */
export function registerAuthProviders(container: Container, config: AuthConfig): void {
  // Register config values
  container.register({
    provide: AUTH_CONFIG,
    useValue: config,
  });

  container.register({
    provide: JWT_CONFIG,
    useValue: config.jwt,
  });

  // Register HASH_CONFIG if provided, otherwise use undefined
  // PasswordHasher handles undefined config gracefully
  container.register({
    provide: HASH_CONFIG,
    useValue: config.hash,
  });

  // Register service providers
  container.register(jwtManagerProvider());
  container.register(passwordHasherProvider());
  container.register(authServiceProvider());
}

// ============================================================================
// Testing Utilities
// ============================================================================

/**
 * Registers mock-friendly auth providers for testing
 *
 * Same as registerAuthProviders but allows individual service overrides.
 *
 * @example
 * ```typescript
 * // In tests
 * const container = new Container();
 * registerAuthProviders(container, testConfig);
 *
 * // Override with mock
 * const mockJwt = { createTokenPair: vi.fn() } as unknown as JwtManager;
 * container.register({ provide: JWT_MANAGER, useValue: mockJwt });
 *
 * // AuthService will now use the mock
 * const auth = container.resolve(AUTH_SERVICE);
 * ```
 */
export { registerAuthProviders as registerAuthProvidersForTesting };
