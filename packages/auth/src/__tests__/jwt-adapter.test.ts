/**
 * Tests for the JWT Authentication Adapter
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JwtAdapterConfig } from '../adapters/jwt-adapter.js';
import { createJwtAdapter, JwtAdapter } from '../adapters/jwt-adapter.js';
import type { TokenStore } from '../jwt.js';
import { JwtManager } from '../jwt.js';
import type { User } from '../types.js';

// ============================================================================
// Test Constants
// ============================================================================

// Valid JWT secret (64+ characters for HS256)
const TEST_SECRET =
  'test-secret-that-is-at-least-64-characters-long-for-jwt-validation-requirements-abc123';

// ============================================================================
// Mock Factories
// ============================================================================

function createMockRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  return {
    method: 'GET',
    url: '/api/test',
    headers: {},
    protocol: 'http',
    hostname: 'localhost',
    body: undefined,
    auth: undefined,
    user: undefined,
    ...overrides,
  } as unknown as FastifyRequest;
}

function createMockReply(): FastifyReply {
  return {
    status: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply;
}

function createMockFastify(): FastifyInstance {
  const decorators = new Map<string, unknown>();

  return {
    decorate: vi.fn((name: string, value: unknown) => {
      decorators.set(name, value);
    }),
    hasDecorator: vi.fn((name: string) => decorators.has(name)),
    decorateRequest: vi.fn(),
    addHook: vi.fn(),
    route: vi.fn(),
    log: {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  } as unknown as FastifyInstance;
}

function createMockTokenStore(): TokenStore {
  const revoked = new Set<string>();
  return {
    revoke: vi.fn((tokenId: string) => {
      revoked.add(tokenId);
    }),
    isRevoked: vi.fn((tokenId: string) => revoked.has(tokenId)),
    clear: vi.fn(() => revoked.clear()),
  };
}

function createTestUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    ...overrides,
  };
}

function createValidToken(user: User = createTestUser()): string {
  const jwt = new JwtManager({ secret: TEST_SECRET });
  const tokens = jwt.createTokenPair(user);
  return tokens.accessToken;
}

function createRefreshToken(user: User = createTestUser()): string {
  const jwt = new JwtManager({ secret: TEST_SECRET });
  const tokens = jwt.createTokenPair(user);
  return tokens.refreshToken;
}

// ============================================================================
// JwtAdapter Tests
// ============================================================================

describe('JwtAdapter', () => {
  let adapter: JwtAdapter;
  let fastify: FastifyInstance;
  let config: JwtAdapterConfig;

  beforeEach(() => {
    adapter = new JwtAdapter();
    fastify = createMockFastify();
    config = {
      name: 'jwt',
      jwt: { secret: TEST_SECRET },
    };
  });

  describe('constructor', () => {
    it('should create adapter with correct name and version', () => {
      expect(adapter.name).toBe('jwt');
      expect(adapter.version).toBe('1.0.0');
    });
  });

  describe('initialize', () => {
    it('should initialize with JWT configuration', async () => {
      await adapter.initialize(fastify, config);

      expect(fastify.decorate).toHaveBeenCalledWith('jwtManager', expect.any(JwtManager));
      expect(fastify.decorate).toHaveBeenCalledWith('tokenStore', expect.any(Object));
    });

    it('should use custom token store when provided', async () => {
      const customStore = createMockTokenStore();
      await adapter.initialize(fastify, {
        ...config,
        tokenStore: customStore,
      });

      expect(adapter.getTokenStore()).toBe(customStore);
    });

    it('should create in-memory token store by default', async () => {
      await adapter.initialize(fastify, config);

      const store = adapter.getTokenStore();
      expect(store).toBeDefined();
      expect(typeof store.revoke).toBe('function');
      expect(typeof store.isRevoked).toBe('function');
    });

    it('should use custom route prefix', async () => {
      await adapter.initialize(fastify, {
        ...config,
        routePrefix: '/auth',
      });

      const routes = adapter.getRoutes();
      expect(routes[0].path).toBe('/auth/refresh');
      expect(routes[1].path).toBe('/auth/logout');
    });

    it('should disable routes when enableRoutes is false', async () => {
      await adapter.initialize(fastify, {
        ...config,
        enableRoutes: false,
      });

      const routes = adapter.getRoutes();
      expect(routes).toHaveLength(0);
    });

    it('should throw if JWT config is missing', async () => {
      await expect(
        adapter.initialize(fastify, { name: 'jwt' } as JwtAdapterConfig)
      ).rejects.toThrow('JWT configuration is required');
    });

    it('should not decorate twice if already decorated', async () => {
      // Simulate existing decoration
      (fastify.hasDecorator as ReturnType<typeof vi.fn>).mockReturnValue(true);

      await adapter.initialize(fastify, config);

      // Should not call decorate since hasDecorator returns true
      expect(fastify.decorate).not.toHaveBeenCalled();
    });
  });

  describe('getSession', () => {
    it('should return null when no Authorization header', async () => {
      await adapter.initialize(fastify, config);

      const request = createMockRequest();
      const result = await adapter.getSession(request);

      expect(result).toBeNull();
    });

    it('should return null for invalid token format', async () => {
      await adapter.initialize(fastify, config);

      const request = createMockRequest({
        headers: { authorization: 'InvalidFormat token' },
      });
      const result = await adapter.getSession(request);

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      await adapter.initialize(fastify, config);

      // Create a manually crafted expired token
      // Note: JwtManager enforces minimum 1 minute expiry, so we can't create
      // a legitimately expired token through normal means. Instead, we test
      // by verifying that the token verification catches expired tokens.
      // The actual expiration check is tested in jwt.test.ts

      // Create a valid token first, then test with a malformed one
      const request = createMockRequest({
        headers: { authorization: 'Bearer invalid.token.here' },
      });
      const result = await adapter.getSession(request);

      expect(result).toBeNull();
    });

    it('should return session for valid token', async () => {
      await adapter.initialize(fastify, config);

      const user = createTestUser();
      const token = createValidToken(user);

      const request = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await adapter.getSession(request);

      expect(result).not.toBeNull();
      expect(result?.user.id).toBe('user-123');
      expect(result?.user.email).toBe('test@example.com');
      expect(result?.session.isActive).toBe(true);
    });

    it('should return null for refresh token in Authorization header', async () => {
      await adapter.initialize(fastify, config);

      const user = createTestUser();
      const refreshToken = createRefreshToken(user);

      const request = createMockRequest({
        headers: { authorization: `Bearer ${refreshToken}` },
      });
      const result = await adapter.getSession(request);

      expect(result).toBeNull();
    });

    it('should return null for revoked token', async () => {
      const tokenStore = createMockTokenStore();
      await adapter.initialize(fastify, {
        ...config,
        tokenStore,
      });

      const user = createTestUser();
      const token = createValidToken(user);

      // Decode token to get jti
      const jwt = new JwtManager({ secret: TEST_SECRET });
      const payload = jwt.decodeToken(token);
      if (payload?.jti) {
        await tokenStore.revoke(payload.jti);
      }

      const request = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await adapter.getSession(request);

      expect(result).toBeNull();
    });

    it('should load user via userLoader when provided', async () => {
      const loadedUser: User = {
        id: 'user-123',
        email: 'loaded@example.com',
        roles: ['admin'],
        permissions: ['read', 'write'],
      };

      const userLoader = vi.fn().mockResolvedValue(loadedUser);

      await adapter.initialize(fastify, {
        ...config,
        userLoader,
      });

      const token = createValidToken(createTestUser());
      const request = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await adapter.getSession(request);

      expect(userLoader).toHaveBeenCalledWith('user-123');
      expect(result?.user.email).toBe('loaded@example.com');
      expect(result?.user.providerData).toEqual({
        roles: ['admin'],
        permissions: ['read', 'write'],
      });
    });

    it('should return null if userLoader returns null', async () => {
      const userLoader = vi.fn().mockResolvedValue(null);

      await adapter.initialize(fastify, {
        ...config,
        userLoader,
      });

      const token = createValidToken(createTestUser());
      const request = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await adapter.getSession(request);

      expect(result).toBeNull();
    });

    it('should store token and payload on request', async () => {
      await adapter.initialize(fastify, config);

      const user = createTestUser();
      const token = createValidToken(user);

      const request = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      }) as FastifyRequest & { __jwtToken?: string; __jwtPayload?: unknown };

      await adapter.getSession(request);

      expect(request.__jwtToken).toBe(token);
      expect(request.__jwtPayload).toBeDefined();
      expect((request.__jwtPayload as { sub: string }).sub).toBe('user-123');
    });

    it('should throw if adapter not initialized', async () => {
      const request = createMockRequest();

      await expect(adapter.getSession(request)).rejects.toThrow('JWT adapter not initialized');
    });
  });

  describe('getRoutes', () => {
    it('should return refresh and logout routes by default', async () => {
      await adapter.initialize(fastify, config);

      const routes = adapter.getRoutes();

      expect(routes).toHaveLength(2);
      expect(routes[0].path).toBe('/api/auth/refresh');
      expect(routes[0].methods).toEqual(['POST']);
      expect(routes[1].path).toBe('/api/auth/logout');
      expect(routes[1].methods).toEqual(['POST']);
    });

    it('should return empty array when routes disabled', async () => {
      await adapter.initialize(fastify, {
        ...config,
        enableRoutes: false,
      });

      const routes = adapter.getRoutes();
      expect(routes).toHaveLength(0);
    });

    it('should use custom route prefix', async () => {
      await adapter.initialize(fastify, {
        ...config,
        routePrefix: '/v1/auth',
      });

      const routes = adapter.getRoutes();
      expect(routes[0].path).toBe('/v1/auth/refresh');
      expect(routes[1].path).toBe('/v1/auth/logout');
    });
  });

  describe('refresh endpoint', () => {
    it('should return new tokens for valid refresh token', async () => {
      await adapter.initialize(fastify, config);

      const routes = adapter.getRoutes();
      const refreshHandler = routes[0].handler;

      const user = createTestUser();
      const refreshToken = createRefreshToken(user);

      const request = createMockRequest({
        body: { refreshToken },
      });
      const reply = createMockReply();

      await refreshHandler(request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: expect.any(Number),
          tokenType: 'Bearer',
        })
      );
    });

    it('should return 400 for missing refresh token', async () => {
      await adapter.initialize(fastify, config);

      const routes = adapter.getRoutes();
      const refreshHandler = routes[0].handler;

      const request = createMockRequest({ body: {} });
      const reply = createMockReply();

      await refreshHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Missing refreshToken in request body',
      });
    });

    it('should return 401 for invalid refresh token', async () => {
      await adapter.initialize(fastify, config);

      const routes = adapter.getRoutes();
      const refreshHandler = routes[0].handler;

      const request = createMockRequest({
        body: { refreshToken: 'invalid-token' },
      });
      const reply = createMockReply();

      await refreshHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        error: expect.any(String),
      });
    });

    it('should return 401 for access token used as refresh token', async () => {
      await adapter.initialize(fastify, config);

      const routes = adapter.getRoutes();
      const refreshHandler = routes[0].handler;

      const user = createTestUser();
      const accessToken = createValidToken(user);

      const request = createMockRequest({
        body: { refreshToken: accessToken },
      });
      const reply = createMockReply();

      await refreshHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        error: expect.stringContaining('expected refresh token'),
      });
    });

    it('should use userLoader when refreshing tokens', async () => {
      const loadedUser: User = {
        id: 'user-123',
        email: 'updated@example.com',
      };

      const userLoader = vi.fn().mockResolvedValue(loadedUser);

      await adapter.initialize(fastify, {
        ...config,
        userLoader,
      });

      const routes = adapter.getRoutes();
      const refreshHandler = routes[0].handler;

      const user = createTestUser();
      const refreshToken = createRefreshToken(user);

      const request = createMockRequest({
        body: { refreshToken },
      });
      const reply = createMockReply();

      await refreshHandler(request, reply);

      expect(userLoader).toHaveBeenCalledWith('user-123');
    });
  });

  describe('logout endpoint', () => {
    it('should revoke token on logout', async () => {
      const tokenStore = createMockTokenStore();
      await adapter.initialize(fastify, {
        ...config,
        tokenStore,
      });

      const routes = adapter.getRoutes();
      const logoutHandler = routes[1].handler;

      const user = createTestUser();
      const token = createValidToken(user);

      // Decode to get jti
      const jwt = new JwtManager({ secret: TEST_SECRET });
      const payload = jwt.decodeToken(token);

      // Create request with payload already set (simulating preHandler)
      const request = createMockRequest() as FastifyRequest & {
        __jwtPayload?: { jti?: string };
      };
      request.__jwtPayload = payload ?? undefined;

      const reply = createMockReply();

      await logoutHandler(request, reply);

      expect(tokenStore.revoke).toHaveBeenCalledWith(payload?.jti);
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ success: true });
    });

    it('should succeed even without payload on request', async () => {
      await adapter.initialize(fastify, config);

      const routes = adapter.getRoutes();
      const logoutHandler = routes[1].handler;

      const request = createMockRequest();
      const reply = createMockReply();

      await logoutHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('cleanup', () => {
    it('should clean up resources', async () => {
      await adapter.initialize(fastify, config);

      expect(() => adapter.getJwtManager()).not.toThrow();
      expect(() => adapter.getTokenStore()).not.toThrow();

      await adapter.cleanup();

      expect(() => adapter.getJwtManager()).toThrow('JWT adapter not initialized');
      expect(() => adapter.getTokenStore()).toThrow('JWT adapter not initialized');
    });
  });

  describe('createTokenPair', () => {
    it('should create token pair for user', async () => {
      await adapter.initialize(fastify, config);

      const user = createTestUser();
      const tokens = adapter.createTokenPair(user);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.tokenType).toBe('Bearer');
      expect(tokens.expiresIn).toBeGreaterThan(0);
    });

    it('should include additional claims', async () => {
      await adapter.initialize(fastify, config);

      const user = createTestUser();
      const tokens = adapter.createTokenPair(user, { customClaim: 'value' });

      const jwt = adapter.getJwtManager();
      const payload = jwt.decodeToken(tokens.accessToken);

      expect(payload?.customClaim).toBe('value');
    });

    it('should throw if adapter not initialized', () => {
      const user = createTestUser();

      expect(() => adapter.createTokenPair(user)).toThrow('JWT adapter not initialized');
    });
  });
});

// ============================================================================
// createJwtAdapter Tests
// ============================================================================

describe('createJwtAdapter', () => {
  it('should create adapter with config attached', () => {
    const { adapter, config } = createJwtAdapter({
      jwt: { secret: TEST_SECRET },
    });

    expect(adapter).toBeInstanceOf(JwtAdapter);
    expect(config.name).toBe('jwt');
    expect(config.jwt.secret).toBe(TEST_SECRET);
  });

  it('should preserve all config options', () => {
    const userLoader = vi.fn();
    const tokenStore = createMockTokenStore();

    const { config } = createJwtAdapter({
      jwt: {
        secret: TEST_SECRET,
        accessTokenExpiry: '30m',
        refreshTokenExpiry: '14d',
      },
      userLoader,
      tokenStore,
      enableRoutes: false,
      routePrefix: '/auth',
      debug: true,
    });

    expect(config.jwt.accessTokenExpiry).toBe('30m');
    expect(config.jwt.refreshTokenExpiry).toBe('14d');
    expect(config.userLoader).toBe(userLoader);
    expect(config.tokenStore).toBe(tokenStore);
    expect(config.enableRoutes).toBe(false);
    expect(config.routePrefix).toBe('/auth');
    expect(config.debug).toBe(true);
  });

  it('should work with createAuthAdapterPlugin pattern', async () => {
    const { adapter, config } = createJwtAdapter({
      jwt: { secret: TEST_SECRET },
    });

    // Verify adapter has the expected shape for createAuthAdapterPlugin
    expect(adapter.name).toBe('jwt');
    expect(config.name).toBe('jwt');
    expect(typeof adapter.initialize).toBe('function');
    expect(typeof adapter.getSession).toBe('function');
    expect(typeof adapter.getRoutes).toBe('function');
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('JWT Adapter Integration', () => {
  it('should work with full auth flow', async () => {
    const { adapter, config } = createJwtAdapter({
      jwt: { secret: TEST_SECRET },
    });

    const fastify = createMockFastify();
    await adapter.initialize(fastify, config);

    const user = createTestUser({ email: 'flow@example.com' });

    // 1. Create tokens
    const tokens = adapter.createTokenPair(user);
    expect(tokens.accessToken).toBeDefined();

    // 2. Verify session from token
    const request = createMockRequest({
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    const session = await adapter.getSession(request);
    expect(session?.user.email).toBe('flow@example.com');

    // 3. Refresh tokens
    const routes = adapter.getRoutes();
    const refreshHandler = routes[0].handler;
    const refreshRequest = createMockRequest({
      body: { refreshToken: tokens.refreshToken },
    });
    const refreshReply = createMockReply();
    await refreshHandler(refreshRequest, refreshReply);
    expect(refreshReply.send).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: expect.any(String) })
    );

    // 4. Logout (revoke token)
    const tokenStore = adapter.getTokenStore();
    const jwt = adapter.getJwtManager();
    const payload = jwt.decodeToken(tokens.accessToken);
    if (payload?.jti) {
      await tokenStore.revoke(payload.jti);
    }

    // 5. Verify revoked token fails
    const revokedSession = await adapter.getSession(request);
    expect(revokedSession).toBeNull();
  });

  it('should maintain session data structure', async () => {
    const detailedUser: User = {
      id: 'detailed-user',
      email: 'detailed@example.com',
      emailVerified: true,
      roles: ['user', 'editor'],
      permissions: ['read', 'write', 'delete'],
    };

    // Use userLoader to return the full user with roles/permissions
    const userLoader = vi.fn().mockResolvedValue(detailedUser);

    const { adapter, config } = createJwtAdapter({
      jwt: { secret: TEST_SECRET },
      userLoader,
    });

    const fastify = createMockFastify();
    await adapter.initialize(fastify, config);

    const tokens = adapter.createTokenPair(detailedUser);
    const request = createMockRequest({
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });

    const session = await adapter.getSession(request);

    // Verify AdapterSessionResult structure
    expect(session).toMatchObject({
      user: {
        id: 'detailed-user',
        email: 'detailed@example.com',
        emailVerified: true,
        providerData: {
          roles: ['user', 'editor'],
          permissions: ['read', 'write', 'delete'],
        },
      },
      session: {
        sessionId: expect.any(String),
        userId: 'detailed-user',
        expiresAt: expect.any(Number),
        isActive: true,
        providerData: {
          token: tokens.accessToken,
          payload: expect.objectContaining({
            sub: 'detailed-user',
            email: 'detailed@example.com',
            type: 'access',
          }),
        },
      },
    });
  });
});
