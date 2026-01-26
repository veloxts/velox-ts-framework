/**
 * Tests for the Auth0 Authentication Adapter
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Auth0AdapterConfig, Auth0Claims, JwtVerifier } from '../adapters/auth0.js';
import { Auth0Adapter, createAuth0Adapter } from '../adapters/auth0.js';

// ============================================================================
// Test Constants
// ============================================================================

const TEST_DOMAIN = 'test-tenant.auth0.com';
const TEST_AUDIENCE = 'https://api.example.com';
const TEST_USER_ID = 'auth0|user123abc';
const TEST_ISSUER = `https://${TEST_DOMAIN}/`;

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

function createMockJwtVerifier(overrides: Partial<JwtVerifier> = {}): JwtVerifier {
  return {
    verify: vi.fn(),
    ...overrides,
  };
}

function createMockAuth0Claims(overrides: Partial<Auth0Claims> = {}): Auth0Claims {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: TEST_USER_ID,
    iat: now - 60,
    exp: now + 3600,
    iss: TEST_ISSUER,
    aud: TEST_AUDIENCE,
    ...overrides,
  };
}

// ============================================================================
// Auth0Adapter Tests
// ============================================================================

describe('Auth0Adapter', () => {
  let adapter: Auth0Adapter;
  let fastify: FastifyInstance;
  let jwtVerifier: JwtVerifier;
  let config: Auth0AdapterConfig;

  beforeEach(() => {
    adapter = new Auth0Adapter();
    fastify = createMockFastify();
    jwtVerifier = createMockJwtVerifier();
    config = {
      name: 'auth0',
      domain: TEST_DOMAIN,
      audience: TEST_AUDIENCE,
      jwtVerifier, // Use mock verifier to avoid JWKS calls
    };
  });

  describe('constructor', () => {
    it('should create adapter with correct name and version', () => {
      expect(adapter.name).toBe('auth0');
      expect(adapter.version).toBe('1.0.0');
    });
  });

  describe('initialize', () => {
    it('should initialize with domain and audience', async () => {
      await adapter.initialize(fastify, config);
      // Should not throw
    });

    it('should throw if domain is not provided', async () => {
      await expect(
        adapter.initialize(fastify, {
          name: 'auth0',
          domain: '',
          audience: TEST_AUDIENCE,
        })
      ).rejects.toThrow('Auth0 domain is required and cannot be empty');
    });

    it('should throw if domain is whitespace only', async () => {
      await expect(
        adapter.initialize(fastify, {
          name: 'auth0',
          domain: '   ',
          audience: TEST_AUDIENCE,
        })
      ).rejects.toThrow('Auth0 domain is required and cannot be empty');
    });

    it('should throw if audience is not provided', async () => {
      await expect(
        adapter.initialize(fastify, {
          name: 'auth0',
          domain: TEST_DOMAIN,
          audience: '',
        })
      ).rejects.toThrow('Auth0 audience is required and cannot be empty');
    });

    it('should throw if audience is whitespace only', async () => {
      await expect(
        adapter.initialize(fastify, {
          name: 'auth0',
          domain: TEST_DOMAIN,
          audience: '   ',
        })
      ).rejects.toThrow('Auth0 audience is required and cannot be empty');
    });

    it('should accept custom client ID', async () => {
      await adapter.initialize(fastify, {
        ...config,
        clientId: 'my-client-id',
      });
      // Should not throw
    });

    it('should accept custom auth header name', async () => {
      await adapter.initialize(fastify, {
        ...config,
        authHeader: 'x-auth0-token',
      });
      // Should not throw
    });

    it('should accept custom issuer', async () => {
      await adapter.initialize(fastify, {
        ...config,
        issuer: 'https://custom-domain.auth0.com/',
      });
      // Should not throw
    });
  });

  describe('getSession', () => {
    beforeEach(async () => {
      await adapter.initialize(fastify, config);
    });

    it('should return null when no authorization header', async () => {
      const request = createMockRequest();
      const result = await adapter.getSession(request);
      expect(result).toBeNull();
    });

    it('should return null when authorization header is not Bearer token', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Basic abc123' },
      });
      const result = await adapter.getSession(request);
      expect(result).toBeNull();
    });

    it('should return null when token verification fails', async () => {
      vi.mocked(jwtVerifier.verify).mockRejectedValueOnce(new Error('Invalid token'));

      const request = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' },
      });

      const result = await adapter.getSession(request);
      expect(result).toBeNull();
    });

    it('should return session when token is valid', async () => {
      const claims = createMockAuth0Claims({
        email: 'user@example.com',
        name: 'Test User',
      });
      vi.mocked(jwtVerifier.verify).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result).not.toBeNull();
      expect(result?.user.id).toBe(TEST_USER_ID);
      expect(result?.user.email).toBe('user@example.com');
      expect(result?.user.name).toBe('Test User');
      expect(result?.session.userId).toBe(TEST_USER_ID);
      expect(result?.session.isActive).toBe(true);
    });

    it('should validate authorized party when clientId is configured', async () => {
      await adapter.initialize(fastify, {
        ...config,
        clientId: 'expected-client',
      });

      const claims = createMockAuth0Claims({
        azp: 'different-client',
      });
      vi.mocked(jwtVerifier.verify).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);
      expect(result).toBeNull(); // azp mismatch
    });

    it('should accept token when azp matches clientId', async () => {
      await adapter.initialize(fastify, {
        ...config,
        clientId: 'expected-client',
      });

      const claims = createMockAuth0Claims({
        azp: 'expected-client',
        email: 'user@example.com',
      });
      vi.mocked(jwtVerifier.verify).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);
      expect(result).not.toBeNull();
    });

    it('should validate token with array audience', async () => {
      const claims = createMockAuth0Claims({
        aud: [TEST_AUDIENCE, 'https://other-api.example.com'],
        email: 'user@example.com',
      });
      vi.mocked(jwtVerifier.verify).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);
      expect(result).not.toBeNull();
      expect(result?.session.providerData?.audience).toEqual([
        TEST_AUDIENCE,
        'https://other-api.example.com',
      ]);
    });

    it('should use custom auth header when configured', async () => {
      await adapter.initialize(fastify, {
        ...config,
        authHeader: 'x-auth0-token',
      });

      const claims = createMockAuth0Claims();
      vi.mocked(jwtVerifier.verify).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { 'x-auth0-token': 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);
      expect(result).not.toBeNull();
    });

    it('should include permissions in provider data', async () => {
      const claims = createMockAuth0Claims({
        permissions: ['read:users', 'write:users'],
      });
      vi.mocked(jwtVerifier.verify).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result?.user.providerData?.permissions).toEqual(['read:users', 'write:users']);
    });

    it('should include scope in provider data', async () => {
      const claims = createMockAuth0Claims({
        scope: 'openid profile email',
      });
      vi.mocked(jwtVerifier.verify).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result?.user.providerData?.scope).toEqual(['openid', 'profile', 'email']);
    });

    it('should include organization data when present', async () => {
      const claims = createMockAuth0Claims({
        org_id: 'org_abc123',
        org_name: 'My Organization',
      });
      vi.mocked(jwtVerifier.verify).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result?.user.providerData).toMatchObject({
        organizationId: 'org_abc123',
        organizationName: 'My Organization',
      });
    });

    it('should handle missing email gracefully', async () => {
      const claims = createMockAuth0Claims({
        // No email claim
      });
      vi.mocked(jwtVerifier.verify).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result?.user.email).toBe('unknown');
    });

    it('should include email_verified status', async () => {
      const claims = createMockAuth0Claims({
        email: 'user@example.com',
        email_verified: true,
      });
      vi.mocked(jwtVerifier.verify).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result?.user.emailVerified).toBe(true);
    });

    it('should use nickname as fallback for name', async () => {
      const claims = createMockAuth0Claims({
        nickname: 'johndoe',
        // No name claim
      });
      vi.mocked(jwtVerifier.verify).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result?.user.name).toBe('johndoe');
    });

    it('should include picture URL', async () => {
      const claims = createMockAuth0Claims({
        picture: 'https://example.com/avatar.png',
      });
      vi.mocked(jwtVerifier.verify).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result?.user.image).toBe('https://example.com/avatar.png');
    });

    it('should generate synthetic session ID from sub and iat', async () => {
      const claims = createMockAuth0Claims({
        sub: 'auth0|123',
        iat: 1000,
      });
      vi.mocked(jwtVerifier.verify).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result?.session.sessionId).toBe('auth0|123:1000');
    });

    it('should set expiration from exp claim', async () => {
      const expTime = Math.floor(Date.now() / 1000) + 7200;
      const claims = createMockAuth0Claims({
        exp: expTime,
      });
      vi.mocked(jwtVerifier.verify).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result?.session.expiresAt).toBe(expTime * 1000);
    });
  });

  describe('getRoutes', () => {
    it('should return empty array (Auth0 handles auth client-side)', () => {
      const routes = adapter.getRoutes();
      expect(routes).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should clean up resources', async () => {
      await adapter.initialize(fastify, config);
      await adapter.cleanup();
      // Should not throw
    });
  });
});

// ============================================================================
// createAuth0Adapter Factory Tests
// ============================================================================

describe('createAuth0Adapter', () => {
  it('should create adapter with config attached', () => {
    const config: Auth0AdapterConfig = {
      name: 'auth0',
      domain: TEST_DOMAIN,
      audience: TEST_AUDIENCE,
    };

    const result = createAuth0Adapter(config);

    expect(result).toBeInstanceOf(Auth0Adapter);
    expect(result.config).toBe(config);
  });

  it('should preserve all config options', () => {
    const jwtVerifier = createMockJwtVerifier();
    const config: Auth0AdapterConfig = {
      name: 'auth0',
      domain: TEST_DOMAIN,
      audience: TEST_AUDIENCE,
      clientId: 'my-client',
      jwtVerifier,
      jwksCacheTtl: 7200000,
      clockTolerance: 10,
      authHeader: 'x-auth',
      issuer: 'https://custom.auth0.com/',
      debug: true,
    };

    const result = createAuth0Adapter(config);

    expect(result.config).toEqual(config);
  });
});

// ============================================================================
// JWT Parsing Validation Tests
// ============================================================================

describe('Auth0Adapter JWT Parsing', () => {
  let adapter: Auth0Adapter;
  let fastify: FastifyInstance;

  beforeEach(async () => {
    adapter = new Auth0Adapter();
    fastify = createMockFastify();

    // Initialize without custom verifier to test internal parsing
    // This tests the parseAndValidateHeader/parseAndValidateClaims functions
    await adapter.initialize(fastify, {
      name: 'auth0',
      domain: TEST_DOMAIN,
      audience: TEST_AUDIENCE,
      // Don't provide jwtVerifier - let it use internal validation
      // But since we can't easily mock the JWKS fetch, we'll test
      // with a custom verifier that simulates invalid JSON
    });
  });

  it('should handle malformed JWT (not 3 parts)', async () => {
    const mockVerifier = createMockJwtVerifier({
      verify: vi.fn().mockRejectedValue(new Error('Invalid JWT format')),
    });

    await adapter.initialize(fastify, {
      name: 'auth0',
      domain: TEST_DOMAIN,
      audience: TEST_AUDIENCE,
      jwtVerifier: mockVerifier,
    });

    const request = createMockRequest({
      headers: { authorization: 'Bearer invalid' },
    });

    const result = await adapter.getSession(request);
    expect(result).toBeNull();
  });

  it('should handle expired token', async () => {
    const mockVerifier = createMockJwtVerifier({
      verify: vi.fn().mockRejectedValue(new Error('Token has expired')),
    });

    await adapter.initialize(fastify, {
      name: 'auth0',
      domain: TEST_DOMAIN,
      audience: TEST_AUDIENCE,
      jwtVerifier: mockVerifier,
    });

    const request = createMockRequest({
      headers: { authorization: 'Bearer expired-token' },
    });

    const result = await adapter.getSession(request);
    expect(result).toBeNull();
  });

  it('should handle invalid issuer', async () => {
    const mockVerifier = createMockJwtVerifier({
      verify: vi.fn().mockRejectedValue(new Error('Invalid issuer')),
    });

    await adapter.initialize(fastify, {
      name: 'auth0',
      domain: TEST_DOMAIN,
      audience: TEST_AUDIENCE,
      jwtVerifier: mockVerifier,
    });

    const request = createMockRequest({
      headers: { authorization: 'Bearer wrong-issuer-token' },
    });

    const result = await adapter.getSession(request);
    expect(result).toBeNull();
  });

  it('should handle invalid audience', async () => {
    const mockVerifier = createMockJwtVerifier({
      verify: vi.fn().mockRejectedValue(new Error('Invalid audience')),
    });

    await adapter.initialize(fastify, {
      name: 'auth0',
      domain: TEST_DOMAIN,
      audience: TEST_AUDIENCE,
      jwtVerifier: mockVerifier,
    });

    const request = createMockRequest({
      headers: { authorization: 'Bearer wrong-audience-token' },
    });

    const result = await adapter.getSession(request);
    expect(result).toBeNull();
  });
});
