/**
 * Tests for Auth DI Providers
 *
 * Validates:
 * - Factory providers create correct service instances
 * - registerAuthProviders bulk registration works correctly
 * - Services can be mocked/overridden in tests
 * - Provider dependencies are correctly resolved
 */

import { Container, Scope } from '@veloxts/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PasswordHasher } from '../hash.js';
import { JwtManager } from '../jwt.js';
import {
  authServiceProvider,
  jwtManagerProvider,
  passwordHasherProvider,
  passwordHasherProviderWithDefaults,
  registerAuthProviders,
} from '../providers.js';
import {
  AUTH_CONFIG,
  AUTH_SERVICE,
  HASH_CONFIG,
  JWT_CONFIG,
  JWT_MANAGER,
  PASSWORD_HASHER,
} from '../tokens.js';
import type { AuthConfig, HashConfig, JwtConfig, User } from '../types.js';

// Test constants - 64+ character secret with high entropy
const TEST_SECRET =
  'this-is-a-very-long-secret-key-for-testing-purposes-with-extra-chars-for-512-bits';

const TEST_JWT_CONFIG: JwtConfig = {
  secret: TEST_SECRET,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
};

const TEST_HASH_CONFIG: HashConfig = {
  algorithm: 'bcrypt',
  bcryptRounds: 4, // Low rounds for fast tests
};

const TEST_AUTH_CONFIG: AuthConfig = {
  jwt: TEST_JWT_CONFIG,
  hash: TEST_HASH_CONFIG,
};

describe('Auth DI Providers', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('jwtManagerProvider', () => {
    it('creates JwtManager from JWT_CONFIG', () => {
      container.register({ provide: JWT_CONFIG, useValue: TEST_JWT_CONFIG });
      container.register(jwtManagerProvider());

      const jwt = container.resolve(JWT_MANAGER);

      expect(jwt).toBeInstanceOf(JwtManager);
    });

    it('provider has SINGLETON scope', () => {
      const provider = jwtManagerProvider();

      expect(provider.scope).toBe(Scope.SINGLETON);
    });

    it('returns same instance on multiple resolves', () => {
      container.register({ provide: JWT_CONFIG, useValue: TEST_JWT_CONFIG });
      container.register(jwtManagerProvider());

      const jwt1 = container.resolve(JWT_MANAGER);
      const jwt2 = container.resolve(JWT_MANAGER);

      expect(jwt1).toBe(jwt2);
    });

    it('creates functional JwtManager that can create tokens', () => {
      container.register({ provide: JWT_CONFIG, useValue: TEST_JWT_CONFIG });
      container.register(jwtManagerProvider());

      const jwt = container.resolve(JWT_MANAGER);
      const user: User = { id: 'user-1', email: 'test@example.com' };
      const tokens = jwt.createTokenPair(user);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.tokenType).toBe('Bearer');
    });

    it('respects custom config options', () => {
      const customConfig: JwtConfig = {
        secret: TEST_SECRET,
        accessTokenExpiry: '30m',
        issuer: 'test-app',
        audience: 'test-audience',
      };
      container.register({ provide: JWT_CONFIG, useValue: customConfig });
      container.register(jwtManagerProvider());

      const jwt = container.resolve(JWT_MANAGER);
      const user: User = { id: 'user-1', email: 'test@example.com' };
      const tokens = jwt.createTokenPair(user);
      const payload = jwt.verifyToken(tokens.accessToken);

      expect(tokens.expiresIn).toBe(30 * 60);
      expect(payload.iss).toBe('test-app');
      expect(payload.aud).toBe('test-audience');
    });

    it('throws if JWT_CONFIG is not registered', () => {
      container.register(jwtManagerProvider());

      expect(() => container.resolve(JWT_MANAGER)).toThrow('No provider found for: JWT_CONFIG');
    });
  });

  describe('passwordHasherProvider', () => {
    it('creates PasswordHasher from HASH_CONFIG', () => {
      container.register({ provide: HASH_CONFIG, useValue: TEST_HASH_CONFIG });
      container.register(passwordHasherProvider());

      const hasher = container.resolve(PASSWORD_HASHER);

      expect(hasher).toBeInstanceOf(PasswordHasher);
    });

    it('provider has SINGLETON scope', () => {
      const provider = passwordHasherProvider();

      expect(provider.scope).toBe(Scope.SINGLETON);
    });

    it('returns same instance on multiple resolves', () => {
      container.register({ provide: HASH_CONFIG, useValue: TEST_HASH_CONFIG });
      container.register(passwordHasherProvider());

      const hasher1 = container.resolve(PASSWORD_HASHER);
      const hasher2 = container.resolve(PASSWORD_HASHER);

      expect(hasher1).toBe(hasher2);
    });

    it('creates functional PasswordHasher that can hash passwords', async () => {
      container.register({ provide: HASH_CONFIG, useValue: TEST_HASH_CONFIG });
      container.register(passwordHasherProvider());

      const hasher = container.resolve(PASSWORD_HASHER);
      const hash = await hasher.hash('password123');
      const valid = await hasher.verify('password123', hash);
      const invalid = await hasher.verify('wrong', hash);

      expect(hash).toBeDefined();
      expect(valid).toBe(true);
      expect(invalid).toBe(false);
    });

    it('handles undefined config gracefully', () => {
      container.register({ provide: HASH_CONFIG, useValue: undefined });
      container.register(passwordHasherProvider());

      const hasher = container.resolve(PASSWORD_HASHER);

      expect(hasher).toBeInstanceOf(PasswordHasher);
    });
  });

  describe('passwordHasherProviderWithDefaults', () => {
    it('creates PasswordHasher without requiring HASH_CONFIG', () => {
      container.register(passwordHasherProviderWithDefaults());

      const hasher = container.resolve(PASSWORD_HASHER);

      expect(hasher).toBeInstanceOf(PasswordHasher);
    });

    it('has empty inject array', () => {
      const provider = passwordHasherProviderWithDefaults();

      expect(provider.inject).toEqual([]);
    });

    it('creates functional hasher with default config', async () => {
      container.register(passwordHasherProviderWithDefaults());

      const hasher = container.resolve(PASSWORD_HASHER);
      const hash = await hasher.hash('test-password');

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(20);
    });
  });

  describe('authServiceProvider', () => {
    beforeEach(() => {
      // Register all dependencies for authServiceProvider
      container.register({ provide: AUTH_CONFIG, useValue: TEST_AUTH_CONFIG });
      container.register({ provide: JWT_CONFIG, useValue: TEST_JWT_CONFIG });
      container.register({ provide: HASH_CONFIG, useValue: TEST_HASH_CONFIG });
      container.register(jwtManagerProvider());
      container.register(passwordHasherProvider());
    });

    it('creates AuthService with all dependencies', () => {
      container.register(authServiceProvider());

      const auth = container.resolve(AUTH_SERVICE);

      expect(auth).toBeDefined();
      expect(auth.jwt).toBeInstanceOf(JwtManager);
      expect(auth.hasher).toBeInstanceOf(PasswordHasher);
      expect(auth.middleware).toBeDefined();
    });

    it('provider has SINGLETON scope', () => {
      const provider = authServiceProvider();

      expect(provider.scope).toBe(Scope.SINGLETON);
    });

    it('returns same instance on multiple resolves', () => {
      container.register(authServiceProvider());

      const auth1 = container.resolve(AUTH_SERVICE);
      const auth2 = container.resolve(AUTH_SERVICE);

      expect(auth1).toBe(auth2);
    });

    it('createTokens method works correctly', () => {
      container.register(authServiceProvider());

      const auth = container.resolve(AUTH_SERVICE);
      const user: User = { id: 'user-1', email: 'test@example.com' };
      const tokens = auth.createTokens(user);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
    });

    it('createTokens accepts additional claims', () => {
      container.register(authServiceProvider());

      const auth = container.resolve(AUTH_SERVICE);
      const user: User = { id: 'user-1', email: 'test@example.com' };
      const tokens = auth.createTokens(user, { role: 'admin' });
      const payload = auth.jwt.verifyToken(tokens.accessToken);

      expect(payload.role).toBe('admin');
    });

    it('verifyToken method works correctly', () => {
      container.register(authServiceProvider());

      const auth = container.resolve(AUTH_SERVICE);
      const user: User = { id: 'user-1', email: 'test@example.com' };
      const tokens = auth.createTokens(user);
      const context = auth.verifyToken(tokens.accessToken);

      expect(context.isAuthenticated).toBe(true);
      expect(context.user.id).toBe('user-1');
      expect(context.user.email).toBe('test@example.com');
    });

    it('refreshTokens method works without userLoader', () => {
      container.register(authServiceProvider());

      const auth = container.resolve(AUTH_SERVICE);
      const user: User = { id: 'user-1', email: 'test@example.com' };
      const tokens = auth.createTokens(user);
      const newTokens = auth.refreshTokens(tokens.refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.accessToken).not.toBe(tokens.accessToken);
    });

    it('refreshTokens method uses userLoader when provided', async () => {
      const updatedUser: User = { id: 'user-1', email: 'updated@example.com' };
      const userLoader = vi.fn().mockResolvedValue(updatedUser);
      const configWithLoader: AuthConfig = {
        ...TEST_AUTH_CONFIG,
        userLoader,
      };

      container.register({ provide: AUTH_CONFIG, useValue: configWithLoader });
      container.register(authServiceProvider());

      const auth = container.resolve(AUTH_SERVICE);
      const user: User = { id: 'user-1', email: 'test@example.com' };
      const tokens = auth.createTokens(user);
      const newTokens = await auth.refreshTokens(tokens.refreshToken);
      const payload = auth.jwt.verifyToken(newTokens.accessToken);

      expect(userLoader).toHaveBeenCalledWith('user-1');
      expect(payload.email).toBe('updated@example.com');
    });
  });

  describe('registerAuthProviders', () => {
    it('registers all auth providers at once', () => {
      registerAuthProviders(container, TEST_AUTH_CONFIG);

      expect(container.isRegistered(AUTH_CONFIG)).toBe(true);
      expect(container.isRegistered(JWT_CONFIG)).toBe(true);
      expect(container.isRegistered(HASH_CONFIG)).toBe(true);
      expect(container.isRegistered(JWT_MANAGER)).toBe(true);
      expect(container.isRegistered(PASSWORD_HASHER)).toBe(true);
      expect(container.isRegistered(AUTH_SERVICE)).toBe(true);
    });

    it('config values are accessible from container', () => {
      registerAuthProviders(container, TEST_AUTH_CONFIG);

      const authConfig = container.resolve(AUTH_CONFIG);
      const jwtConfig = container.resolve(JWT_CONFIG);
      const hashConfig = container.resolve(HASH_CONFIG);

      expect(authConfig).toEqual(TEST_AUTH_CONFIG);
      expect(jwtConfig).toEqual(TEST_JWT_CONFIG);
      expect(hashConfig).toEqual(TEST_HASH_CONFIG);
    });

    it('services are fully functional after bulk registration', () => {
      registerAuthProviders(container, TEST_AUTH_CONFIG);

      const jwt = container.resolve(JWT_MANAGER);
      const hasher = container.resolve(PASSWORD_HASHER);
      const auth = container.resolve(AUTH_SERVICE);

      // All services should be the same instances used by AUTH_SERVICE
      expect(auth.jwt).toBe(jwt);
      expect(auth.hasher).toBe(hasher);
    });

    it('handles config without hash option', () => {
      const configWithoutHash: AuthConfig = {
        jwt: TEST_JWT_CONFIG,
      };

      registerAuthProviders(container, configWithoutHash);

      const hashConfig = container.resolve(HASH_CONFIG);
      const hasher = container.resolve(PASSWORD_HASHER);

      expect(hashConfig).toBeUndefined();
      expect(hasher).toBeInstanceOf(PasswordHasher);
    });
  });

  describe('Service Mocking', () => {
    it('allows mocking JwtManager after registration', () => {
      registerAuthProviders(container, TEST_AUTH_CONFIG);

      // Override with mock
      const mockJwt = {
        createTokenPair: vi.fn().mockReturnValue({
          accessToken: 'mock-access',
          refreshToken: 'mock-refresh',
          tokenType: 'Bearer',
          expiresIn: 900,
        }),
        verifyToken: vi.fn(),
        extractFromHeader: vi.fn(),
      };

      container.register({ provide: JWT_MANAGER, useValue: mockJwt });

      const jwt = container.resolve(JWT_MANAGER);
      const tokens = jwt.createTokenPair({ id: '1', email: 'test@example.com' });

      expect(tokens.accessToken).toBe('mock-access');
      expect(mockJwt.createTokenPair).toHaveBeenCalled();
    });

    it('allows mocking PasswordHasher after registration', () => {
      registerAuthProviders(container, TEST_AUTH_CONFIG);

      // Override with mock
      const mockHasher = {
        hash: vi.fn().mockResolvedValue('mocked-hash'),
        verify: vi.fn().mockResolvedValue(true),
      };

      container.register({ provide: PASSWORD_HASHER, useValue: mockHasher });

      const hasher = container.resolve(PASSWORD_HASHER);

      expect(hasher).toBe(mockHasher);
    });

    it('child container can override parent registrations', () => {
      registerAuthProviders(container, TEST_AUTH_CONFIG);

      const childContainer = container.createChild();

      // Override in child
      const mockJwt = {
        createTokenPair: vi.fn().mockReturnValue({
          accessToken: 'child-mock-token',
          refreshToken: 'child-mock-refresh',
          tokenType: 'Bearer',
          expiresIn: 900,
        }),
      };

      childContainer.register({ provide: JWT_MANAGER, useValue: mockJwt });

      const parentJwt = container.resolve(JWT_MANAGER);
      const childJwt = childContainer.resolve(JWT_MANAGER);

      expect(parentJwt).toBeInstanceOf(JwtManager);
      expect(childJwt).toBe(mockJwt);
    });

    it('child container inherits parent registrations', () => {
      registerAuthProviders(container, TEST_AUTH_CONFIG);

      const childContainer = container.createChild();

      // Should resolve from parent
      const jwt = childContainer.resolve(JWT_MANAGER);
      const hasher = childContainer.resolve(PASSWORD_HASHER);

      expect(jwt).toBeInstanceOf(JwtManager);
      expect(hasher).toBeInstanceOf(PasswordHasher);
    });
  });

  describe('Provider Injection Dependencies', () => {
    it('jwtManagerProvider injects JWT_CONFIG', () => {
      const provider = jwtManagerProvider();

      expect(provider.inject).toContain(JWT_CONFIG);
    });

    it('passwordHasherProvider injects HASH_CONFIG', () => {
      const provider = passwordHasherProvider();

      expect(provider.inject).toContain(HASH_CONFIG);
    });

    it('authServiceProvider injects all required dependencies', () => {
      const provider = authServiceProvider();

      expect(provider.inject).toContain(JWT_MANAGER);
      expect(provider.inject).toContain(PASSWORD_HASHER);
      expect(provider.inject).toContain(AUTH_CONFIG);
    });
  });

  describe('Error Handling', () => {
    it('throws helpful error when JWT secret is invalid', () => {
      const invalidConfig: AuthConfig = {
        jwt: { secret: 'short' }, // Too short
      };

      expect(() => registerAuthProviders(container, invalidConfig)).not.toThrow();

      // Error should occur on resolution, not registration
      expect(() => container.resolve(JWT_MANAGER)).toThrow('JWT secret must be at least 64');
    });

    it('throws when resolving unregistered token', () => {
      expect(() => container.resolve(JWT_MANAGER)).toThrow('No provider found for: JWT_MANAGER');
    });

    it('throws when resolving AUTH_SERVICE without dependencies', () => {
      container.register(authServiceProvider());

      expect(() => container.resolve(AUTH_SERVICE)).toThrow('No provider found for: JWT_MANAGER');
    });
  });

  describe('Integration with Real Services', () => {
    it('complete auth flow works with DI-provided services', async () => {
      registerAuthProviders(container, TEST_AUTH_CONFIG);

      const auth = container.resolve(AUTH_SERVICE);
      const hasher = container.resolve(PASSWORD_HASHER);

      // Simulate user registration
      const password = 'secure-password-123';
      const passwordHash = await hasher.hash(password);
      const user: User = { id: 'new-user', email: 'newuser@example.com' };

      // Create tokens
      const tokens = auth.createTokens(user);
      expect(tokens.accessToken).toBeDefined();

      // Verify token
      const context = auth.verifyToken(tokens.accessToken);
      expect(context.isAuthenticated).toBe(true);
      expect(context.user.id).toBe('new-user');

      // Verify password
      const passwordValid = await hasher.verify(password, passwordHash);
      expect(passwordValid).toBe(true);

      // Refresh tokens
      const newTokens = auth.refreshTokens(tokens.refreshToken);
      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.accessToken).not.toBe(tokens.accessToken);
    });

    it('multiple containers can have independent service instances', () => {
      const container1 = new Container();
      const container2 = new Container();

      registerAuthProviders(container1, TEST_AUTH_CONFIG);
      registerAuthProviders(container2, TEST_AUTH_CONFIG);

      const jwt1 = container1.resolve(JWT_MANAGER);
      const jwt2 = container2.resolve(JWT_MANAGER);

      // Different instances
      expect(jwt1).not.toBe(jwt2);

      // But both functional
      const user: User = { id: '1', email: 'test@example.com' };
      const tokens1 = jwt1.createTokenPair(user);
      const tokens2 = jwt2.createTokenPair(user);

      expect(tokens1.accessToken).toBeDefined();
      expect(tokens2.accessToken).toBeDefined();
    });
  });
});
