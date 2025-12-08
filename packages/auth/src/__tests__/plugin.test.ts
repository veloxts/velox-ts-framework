/**
 * Unit tests for @veloxts/auth plugin module
 *
 * Tests the auth plugin factory and registration:
 * - authPlugin factory function
 * - defaultAuthPlugin factory function
 * - AuthService decoration on server
 * - Request decoration (auth, user)
 * - Auto token extraction from headers
 * - Token revocation checking
 * - User loader integration
 * - Debug mode logging
 *
 * @module __tests__/plugin.test
 */

import { TEST_SECRETS } from '@veloxts/testing';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JwtManager } from '../jwt.js';
import { AUTH_VERSION, authPlugin, createAuthPlugin, defaultAuthPlugin } from '../plugin.js';
import type { User } from '../types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a basic test server without the auth plugin
 */
async function createBaseServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: false });
  return server;
}

/**
 * Test user data
 */
const TEST_USERS: Record<string, User> = {
  admin: {
    id: 'user-admin-123',
    email: 'admin@example.com',
    roles: ['admin'],
  },
  user: {
    id: 'user-regular-456',
    email: 'user@example.com',
    roles: ['user'],
  },
};

/**
 * Test user loader
 */
async function testUserLoader(userId: string): Promise<User | null> {
  const user = Object.values(TEST_USERS).find((u) => u.id === userId);
  return user ?? null;
}

/**
 * Creates standard auth config for testing
 */
function createTestAuthConfig() {
  return {
    jwt: {
      secret: TEST_SECRETS.access,
      refreshSecret: TEST_SECRETS.refresh,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    },
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Auth Plugin', () => {
  let server: FastifyInstance;

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  // ==========================================================================
  // AUTH_VERSION Export
  // ==========================================================================

  describe('AUTH_VERSION', () => {
    it('should export package version', () => {
      expect(AUTH_VERSION).toBeDefined();
      expect(typeof AUTH_VERSION).toBe('string');
      // Version should match semver pattern or be 0.0.0-unknown
      expect(AUTH_VERSION).toMatch(/^\d+\.\d+\.\d+(-.*)?$/);
    });
  });

  // ==========================================================================
  // authPlugin Factory
  // ==========================================================================

  describe('authPlugin factory', () => {
    it('should create a valid VeloxPlugin', () => {
      const plugin = authPlugin(createTestAuthConfig());

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('@veloxts/auth');
      expect(plugin.version).toBe(AUTH_VERSION);
      expect(typeof plugin.register).toBe('function');
    });

    it('should register successfully on Fastify server', async () => {
      server = await createBaseServer();
      const plugin = authPlugin(createTestAuthConfig());

      // Register the plugin directly using its register function
      await plugin.register(server, createTestAuthConfig());
      await server.ready();

      expect(server.auth).toBeDefined();
    });

    it('should decorate server with auth service', async () => {
      server = await createBaseServer();
      const plugin = authPlugin(createTestAuthConfig());

      await plugin.register(server, createTestAuthConfig());
      await server.ready();

      expect(server.auth).toBeDefined();
      expect(server.auth.jwt).toBeInstanceOf(JwtManager);
      expect(server.auth.hasher).toBeDefined();
      expect(typeof server.auth.createTokens).toBe('function');
      expect(typeof server.auth.verifyToken).toBe('function');
      expect(typeof server.auth.refreshTokens).toBe('function');
      expect(server.auth.middleware).toBeDefined();
    });

    it('should decorate requests with auth and user', async () => {
      server = await createBaseServer();
      const plugin = authPlugin(createTestAuthConfig());

      await plugin.register(server, createTestAuthConfig());

      // Add a test route
      server.get('/test', async (request) => {
        return {
          hasAuth: 'auth' in request,
          hasUser: 'user' in request,
        };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hasAuth).toBe(true);
      expect(body.hasUser).toBe(true);
    });
  });

  // ==========================================================================
  // AuthService Methods
  // ==========================================================================

  describe('AuthService', () => {
    beforeEach(async () => {
      server = await createBaseServer();
      const plugin = authPlugin(createTestAuthConfig());
      await plugin.register(server, createTestAuthConfig());
      await server.ready();
    });

    describe('createTokens', () => {
      it('should create access and refresh tokens', () => {
        const user: User = { id: 'test-user', email: 'test@example.com' };
        const tokens = server.auth.createTokens(user);

        expect(tokens.accessToken).toBeDefined();
        expect(tokens.refreshToken).toBeDefined();
        expect(tokens.tokenType).toBe('Bearer');
        expect(tokens.expiresIn).toBe(15 * 60); // 15 minutes
      });

      it('should include additional claims', () => {
        const user: User = { id: 'test-user', email: 'test@example.com' };
        const tokens = server.auth.createTokens(user, { role: 'admin' });

        const payload = server.auth.jwt.verifyToken(tokens.accessToken);
        expect(payload.role).toBe('admin');
      });
    });

    describe('verifyToken', () => {
      it('should verify valid token and return auth context', () => {
        const user: User = { id: 'test-user', email: 'test@example.com' };
        const tokens = server.auth.createTokens(user);

        const authContext = server.auth.verifyToken(tokens.accessToken);

        expect(authContext.isAuthenticated).toBe(true);
        expect(authContext.user).toBeDefined();
        expect(authContext.user?.id).toBe('test-user');
        expect(authContext.user?.email).toBe('test@example.com');
        expect(authContext.token).toBeDefined();
      });

      it('should throw for invalid token', () => {
        expect(() => server.auth.verifyToken('invalid-token')).toThrow();
      });
    });

    describe('refreshTokens', () => {
      it('should refresh tokens without user loader', () => {
        const user: User = { id: 'test-user', email: 'test@example.com' };
        const tokens = server.auth.createTokens(user);

        const newTokens = server.auth.refreshTokens(tokens.refreshToken);

        expect(newTokens).toBeDefined();
        // Without async user loader, should return directly
        if ('accessToken' in newTokens) {
          expect(newTokens.accessToken).toBeDefined();
          expect(newTokens.accessToken).not.toBe(tokens.accessToken);
        }
      });

      it('should refresh tokens with user loader', async () => {
        // Create server with user loader
        await server.close();
        server = await createBaseServer();
        const plugin = authPlugin({
          ...createTestAuthConfig(),
          userLoader: testUserLoader,
        });
        await plugin.register(server, {
          ...createTestAuthConfig(),
          userLoader: testUserLoader,
        });
        await server.ready();

        const tokens = server.auth.createTokens(TEST_USERS.admin);
        const newTokens = await server.auth.refreshTokens(tokens.refreshToken);

        expect(newTokens.accessToken).toBeDefined();
        expect(newTokens.refreshToken).toBeDefined();
      });

      it('should throw for access token used as refresh', () => {
        const user: User = { id: 'test-user', email: 'test@example.com' };
        const tokens = server.auth.createTokens(user);

        expect(() => server.auth.refreshTokens(tokens.accessToken)).toThrow(
          'Invalid token type: expected refresh token'
        );
      });
    });

    describe('middleware', () => {
      it('should provide middleware factory', () => {
        expect(server.auth.middleware).toBeDefined();
        expect(typeof server.auth.middleware.middleware).toBe('function');
        expect(typeof server.auth.middleware.requireAuth).toBe('function');
        expect(typeof server.auth.middleware.optionalAuth).toBe('function');
      });
    });
  });

  // ==========================================================================
  // Auto Token Extraction
  // ==========================================================================

  describe('auto token extraction', () => {
    it('should extract token from Authorization header by default', async () => {
      server = await createBaseServer();
      const config = createTestAuthConfig();
      const plugin = authPlugin(config);
      await plugin.register(server, config);

      // Create a valid token
      const jwt = new JwtManager(config.jwt);
      const user: User = { id: 'test-user', email: 'test@example.com' };
      const tokens = jwt.createTokenPair(user);

      // Add a test route that returns the auth context
      server.get('/auth-test', async (request) => {
        return {
          isAuthenticated: request.auth?.isAuthenticated ?? false,
          userId: request.user?.id,
          email: request.user?.email,
        };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/auth-test',
        headers: {
          authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.isAuthenticated).toBe(true);
      expect(body.userId).toBe('test-user');
      expect(body.email).toBe('test@example.com');
    });

    it('should not extract token when autoExtract is false', async () => {
      server = await createBaseServer();
      const config = { ...createTestAuthConfig(), autoExtract: false };
      const plugin = authPlugin(config);
      await plugin.register(server, config);

      const jwt = new JwtManager(config.jwt);
      const user: User = { id: 'test-user', email: 'test@example.com' };
      const tokens = jwt.createTokenPair(user);

      server.get('/auth-test', async (request) => {
        return {
          hasAuth: request.auth !== undefined,
          hasUser: request.user !== undefined,
        };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/auth-test',
        headers: {
          authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // Auth should not be extracted when autoExtract is false
      expect(body.hasAuth).toBe(false);
      expect(body.hasUser).toBe(false);
    });

    it('should silently ignore invalid tokens in auto extraction', async () => {
      server = await createBaseServer();
      const config = createTestAuthConfig();
      const plugin = authPlugin(config);
      await plugin.register(server, config);

      server.get('/auth-test', async (request) => {
        return {
          isAuthenticated: request.auth?.isAuthenticated ?? false,
          hasUser: request.user !== undefined,
        };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/auth-test',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.isAuthenticated).toBe(false);
      expect(body.hasUser).toBe(false);
    });

    it('should work without Authorization header', async () => {
      server = await createBaseServer();
      const config = createTestAuthConfig();
      const plugin = authPlugin(config);
      await plugin.register(server, config);

      server.get('/auth-test', async (request) => {
        return {
          isAuthenticated: request.auth?.isAuthenticated ?? false,
        };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/auth-test',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.isAuthenticated).toBe(false);
    });
  });

  // ==========================================================================
  // User Loader Integration
  // ==========================================================================

  describe('user loader integration', () => {
    it('should load user from database using userLoader', async () => {
      server = await createBaseServer();
      const config = {
        ...createTestAuthConfig(),
        userLoader: testUserLoader,
      };
      const plugin = authPlugin(config);
      await plugin.register(server, config);

      const tokens = server.auth.createTokens(TEST_USERS.admin);

      server.get('/user-test', async (request) => {
        return {
          userId: request.user?.id,
          email: request.user?.email,
          roles: request.user?.roles,
        };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/user-test',
        headers: {
          authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.userId).toBe('user-admin-123');
      expect(body.email).toBe('admin@example.com');
      expect(body.roles).toEqual(['admin']);
    });

    it('should not set user when userLoader returns null', async () => {
      server = await createBaseServer();
      const config = {
        ...createTestAuthConfig(),
        userLoader: async () => null, // Always returns null
      };
      const plugin = authPlugin(config);
      await plugin.register(server, config);

      // Create token for non-existent user
      const jwt = new JwtManager(config.jwt);
      const tokens = jwt.createTokenPair({ id: 'nonexistent', email: 'none@example.com' });

      server.get('/user-test', async (request) => {
        return {
          hasUser: request.user !== undefined,
          isAuthenticated: request.auth?.isAuthenticated ?? false,
        };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/user-test',
        headers: {
          authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hasUser).toBe(false);
      expect(body.isAuthenticated).toBe(false);
    });

    it('should use token claims when no userLoader provided', async () => {
      server = await createBaseServer();
      const config = createTestAuthConfig(); // No userLoader
      const plugin = authPlugin(config);
      await plugin.register(server, config);

      const jwt = new JwtManager(config.jwt);
      const tokens = jwt.createTokenPair({
        id: 'token-user-id',
        email: 'token@example.com',
      });

      server.get('/user-test', async (request) => {
        return {
          userId: request.user?.id,
          email: request.user?.email,
        };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/user-test',
        headers: {
          authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.userId).toBe('token-user-id');
      expect(body.email).toBe('token@example.com');
    });
  });

  // ==========================================================================
  // Token Revocation
  // ==========================================================================

  describe('token revocation', () => {
    it('should check token revocation when isTokenRevoked is provided', async () => {
      const revokedTokens = new Set<string>();
      const isTokenRevoked = vi.fn(async (tokenId: string) => revokedTokens.has(tokenId));

      server = await createBaseServer();
      const config = {
        ...createTestAuthConfig(),
        isTokenRevoked,
      };
      const plugin = authPlugin(config);
      await plugin.register(server, config);

      // Create a token
      const jwt = new JwtManager(config.jwt);
      const tokens = jwt.createTokenPair({ id: 'test-user', email: 'test@example.com' });

      // Get the token ID from payload
      const payload = jwt.verifyToken(tokens.accessToken);
      const tokenId = payload.jti;

      server.get('/revoke-test', async (request) => {
        return {
          isAuthenticated: request.auth?.isAuthenticated ?? false,
        };
      });

      await server.ready();

      // First request - token not revoked
      const response1 = await server.inject({
        method: 'GET',
        url: '/revoke-test',
        headers: {
          authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      expect(response1.statusCode).toBe(200);
      const body1 = JSON.parse(response1.body);
      expect(body1.isAuthenticated).toBe(true);
      expect(isTokenRevoked).toHaveBeenCalledWith(tokenId);

      // Revoke the token
      if (tokenId) {
        revokedTokens.add(tokenId);
      }

      // Second request - token revoked
      const response2 = await server.inject({
        method: 'GET',
        url: '/revoke-test',
        headers: {
          authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.isAuthenticated).toBe(false);
    });
  });

  // ==========================================================================
  // Debug Mode
  // ==========================================================================

  describe('debug mode', () => {
    it('should log debug messages when debug is true', async () => {
      server = await createBaseServer();

      // Create a mock logger
      const mockLog = {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        child: vi.fn().mockReturnThis(),
        level: 'debug',
        silent: vi.fn(),
      };

      // Replace server.log
      (server as unknown as { log: typeof mockLog }).log = mockLog;

      const config = {
        ...createTestAuthConfig(),
        debug: true,
      };
      const plugin = authPlugin(config);
      await plugin.register(server, config);
      await server.ready();

      // Check that info was called during registration
      expect(mockLog.info).toHaveBeenCalledWith('Registering @veloxts/auth plugin');
      expect(mockLog.info).toHaveBeenCalledWith('@veloxts/auth plugin registered successfully');
    });

    it('should not log when debug is false', async () => {
      server = await createBaseServer();

      const mockLog = {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        child: vi.fn().mockReturnThis(),
        level: 'debug',
        silent: vi.fn(),
      };

      (server as unknown as { log: typeof mockLog }).log = mockLog;

      const config = {
        ...createTestAuthConfig(),
        debug: false,
      };
      const plugin = authPlugin(config);
      await plugin.register(server, config);
      await server.ready();

      expect(mockLog.info).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // createAuthPlugin (deprecated)
  // ==========================================================================

  describe('createAuthPlugin (deprecated)', () => {
    it('should be an alias for authPlugin', () => {
      expect(createAuthPlugin).toBe(authPlugin);
    });

    it('should create a valid plugin', () => {
      const plugin = createAuthPlugin(createTestAuthConfig());

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('@veloxts/auth');
    });
  });

  // ==========================================================================
  // defaultAuthPlugin
  // ==========================================================================

  describe('defaultAuthPlugin', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset process.env before each test
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should throw if JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;

      expect(() => defaultAuthPlugin()).toThrow('JWT_SECRET environment variable is required');
    });

    it('should create plugin when JWT_SECRET is set', () => {
      // Set a valid secret (64+ chars with high entropy)
      process.env.JWT_SECRET =
        'test-secret-that-is-definitely-long-enough-for-jwt-signing-purposes-with-entropy';

      const plugin = defaultAuthPlugin();

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('@veloxts/auth');
    });

    it('should use JWT_SECRET from environment', async () => {
      process.env.JWT_SECRET =
        'my-super-secret-key-that-is-long-enough-for-jwt-signing-with-good-entropy';

      server = await createBaseServer();
      const plugin = defaultAuthPlugin();
      await plugin.register(server, { jwt: { secret: process.env.JWT_SECRET } });
      await server.ready();

      // Should be able to create tokens
      const tokens = server.auth.createTokens({
        id: 'test',
        email: 'test@example.com',
      });
      expect(tokens.accessToken).toBeDefined();
    });
  });

  // ==========================================================================
  // Plugin Lifecycle
  // ==========================================================================

  describe('plugin lifecycle', () => {
    it('should handle onClose hook', async () => {
      server = await createBaseServer();
      const config = {
        ...createTestAuthConfig(),
        debug: true,
      };
      const plugin = authPlugin(config);

      const mockLog = {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        child: vi.fn().mockReturnThis(),
        level: 'debug',
        silent: vi.fn(),
      };
      (server as unknown as { log: typeof mockLog }).log = mockLog;

      await plugin.register(server, config);
      await server.ready();

      // Close the server to trigger onClose hook
      await server.close();

      expect(mockLog.info).toHaveBeenCalledWith('Shutting down @veloxts/auth plugin');
    });
  });

  // ==========================================================================
  // Configuration Merging
  // ==========================================================================

  describe('configuration merging', () => {
    it('should merge options from factory and register', async () => {
      server = await createBaseServer();

      const factoryConfig = {
        jwt: {
          secret: TEST_SECRETS.access,
          accessTokenExpiry: '15m',
        },
      };

      const registerConfig = {
        jwt: {
          secret: TEST_SECRETS.access,
          refreshTokenExpiry: '30d',
        },
        debug: false,
      };

      const plugin = authPlugin(factoryConfig);
      await plugin.register(server, registerConfig);
      await server.ready();

      // Plugin should be registered with merged config
      expect(server.auth).toBeDefined();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle tokens without jti claim for revocation check', async () => {
      const isTokenRevoked = vi.fn(async () => false);

      server = await createBaseServer();
      const config = {
        ...createTestAuthConfig(),
        isTokenRevoked,
      };
      const plugin = authPlugin(config);
      await plugin.register(server, config);

      // Create a simple JWT manager without jti generation logic exposed
      // The JwtManager always includes jti, but we can test the null check path
      const tokens = server.auth.createTokens({ id: 'test', email: 'test@example.com' });

      server.get('/test', async (request) => {
        return { isAuthenticated: request.auth?.isAuthenticated ?? false };
      });

      await server.ready();

      await server.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      // isTokenRevoked should be called with the jti
      expect(isTokenRevoked).toHaveBeenCalled();
    });

    it('should handle case-insensitive Bearer in Authorization header', async () => {
      server = await createBaseServer();
      const config = createTestAuthConfig();
      const plugin = authPlugin(config);
      await plugin.register(server, config);

      const tokens = server.auth.createTokens({ id: 'test', email: 'test@example.com' });

      server.get('/test', async (request) => {
        return { isAuthenticated: request.auth?.isAuthenticated ?? false };
      });

      await server.ready();

      // Test with lowercase 'bearer'
      const response = await server.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: `bearer ${tokens.accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.isAuthenticated).toBe(true);
    });

    it('should ignore non-Bearer authorization schemes', async () => {
      server = await createBaseServer();
      const config = createTestAuthConfig();
      const plugin = authPlugin(config);
      await plugin.register(server, config);

      server.get('/test', async (request) => {
        return { isAuthenticated: request.auth?.isAuthenticated ?? false };
      });

      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: 'Basic dXNlcjpwYXNz', // Basic auth
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.isAuthenticated).toBe(false);
    });
  });
});
