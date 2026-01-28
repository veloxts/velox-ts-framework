/**
 * Tests for the Clerk Authentication Adapter
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ClerkAdapterConfig,
  ClerkClient,
  ClerkSessionClaims,
  ClerkUser,
} from '../adapters/clerk.js';
import { ClerkAdapter, createClerkAdapter } from '../adapters/clerk.js';

// ============================================================================
// Test Constants
// ============================================================================

const TEST_USER_ID = 'user_2abc123def456';
const TEST_SESSION_ID = 'sess_xyz789';
const TEST_EMAIL = 'test@example.com';

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

function createMockClerkClient(overrides: Partial<ClerkClient> = {}): ClerkClient {
  return {
    verifyToken: vi.fn(),
    users: {
      getUser: vi.fn(),
    },
    ...overrides,
  };
}

function createMockClerkUser(overrides: Partial<ClerkUser> = {}): ClerkUser {
  return {
    id: TEST_USER_ID,
    primaryEmailAddressId: 'email_123',
    emailAddresses: [
      {
        id: 'email_123',
        emailAddress: TEST_EMAIL,
        verification: { status: 'verified' },
      },
    ],
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    imageUrl: 'https://example.com/avatar.png',
    hasImage: true,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
    publicMetadata: {},
    privateMetadata: {},
    unsafeMetadata: {},
    ...overrides,
  };
}

function createMockSessionClaims(overrides: Partial<ClerkSessionClaims> = {}): ClerkSessionClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: TEST_USER_ID,
    sid: TEST_SESSION_ID,
    iat: now - 60,
    exp: now + 3600,
    nbf: now - 60,
    iss: 'https://clerk.example.com',
    ...overrides,
  };
}

// ============================================================================
// ClerkAdapter Tests
// ============================================================================

describe('ClerkAdapter', () => {
  let adapter: ClerkAdapter;
  let fastify: FastifyInstance;
  let clerkClient: ClerkClient;
  let config: ClerkAdapterConfig;

  beforeEach(() => {
    adapter = new ClerkAdapter();
    fastify = createMockFastify();
    clerkClient = createMockClerkClient();
    config = {
      name: 'clerk',
      clerk: clerkClient,
    };
  });

  describe('constructor', () => {
    it('should create adapter with correct name and version', () => {
      expect(adapter.name).toBe('clerk');
      expect(adapter.version).toBe('1.0.0');
    });
  });

  describe('initialize', () => {
    it('should initialize with Clerk client', async () => {
      await adapter.initialize(fastify, config);
      // Should not throw
    });

    it('should throw if Clerk client is not provided', async () => {
      await expect(
        adapter.initialize(fastify, {
          name: 'clerk',
          clerk: undefined as unknown as ClerkClient,
        })
      ).rejects.toThrow('Clerk client is required');
    });

    it('should accept custom authorized parties', async () => {
      await adapter.initialize(fastify, {
        ...config,
        authorizedParties: ['http://localhost:3000'],
      });
      // Should not throw
    });

    it('should accept custom auth header name', async () => {
      await adapter.initialize(fastify, {
        ...config,
        authHeader: 'x-clerk-token',
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
      vi.mocked(clerkClient.verifyToken).mockRejectedValueOnce(new Error('Invalid token'));

      const request = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' },
      });

      const result = await adapter.getSession(request);
      expect(result).toBeNull();
    });

    it('should return session when token is valid', async () => {
      const claims = createMockSessionClaims();
      const user = createMockClerkUser();

      vi.mocked(clerkClient.verifyToken).mockResolvedValueOnce(claims);
      vi.mocked(clerkClient.users.getUser).mockResolvedValueOnce(user);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result).not.toBeNull();
      expect(result?.user.id).toBe(TEST_USER_ID);
      expect(result?.user.email).toBe(TEST_EMAIL);
      expect(result?.user.name).toBe('John Doe');
      expect(result?.session.sessionId).toBe(TEST_SESSION_ID);
      expect(result?.session.userId).toBe(TEST_USER_ID);
      expect(result?.session.isActive).toBe(true);
    });

    it('should work without fetching user data when fetchUserData is false', async () => {
      await adapter.initialize(fastify, {
        ...config,
        fetchUserData: false,
      });

      const claims = createMockSessionClaims();
      vi.mocked(clerkClient.verifyToken).mockResolvedValueOnce(claims);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result).not.toBeNull();
      expect(result?.user.id).toBe(TEST_USER_ID);
      expect(result?.user.email).toBe('unknown'); // No user data fetched
      expect(clerkClient.users.getUser).not.toHaveBeenCalled();
    });

    it('should continue even if user fetch fails', async () => {
      const claims = createMockSessionClaims();
      vi.mocked(clerkClient.verifyToken).mockResolvedValueOnce(claims);
      vi.mocked(clerkClient.users.getUser).mockRejectedValueOnce(new Error('User not found'));

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result).not.toBeNull();
      expect(result?.user.id).toBe(TEST_USER_ID);
      expect(result?.user.email).toBe('unknown'); // User fetch failed
    });

    it('should use custom auth header when configured', async () => {
      await adapter.initialize(fastify, {
        ...config,
        authHeader: 'x-clerk-token',
      });

      const claims = createMockSessionClaims();
      const user = createMockClerkUser();

      vi.mocked(clerkClient.verifyToken).mockResolvedValueOnce(claims);
      vi.mocked(clerkClient.users.getUser).mockResolvedValueOnce(user);

      const request = createMockRequest({
        headers: { 'x-clerk-token': 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);
      expect(result).not.toBeNull();
    });

    it('should include organization data when present', async () => {
      const claims = createMockSessionClaims({
        org_id: 'org_abc123',
        org_role: 'admin',
        org_slug: 'my-org',
        org_permissions: ['read', 'write'],
      });
      const user = createMockClerkUser();

      vi.mocked(clerkClient.verifyToken).mockResolvedValueOnce(claims);
      vi.mocked(clerkClient.users.getUser).mockResolvedValueOnce(user);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result?.user.providerData).toMatchObject({
        organizationId: 'org_abc123',
        organizationRole: 'admin',
        organizationSlug: 'my-org',
        organizationPermissions: ['read', 'write'],
      });
    });

    it('should handle user with no primary email', async () => {
      const claims = createMockSessionClaims();
      const user = createMockClerkUser({
        primaryEmailAddressId: null,
        emailAddresses: [{ id: 'email_456', emailAddress: 'alt@example.com', verification: null }],
      });

      vi.mocked(clerkClient.verifyToken).mockResolvedValueOnce(claims);
      vi.mocked(clerkClient.users.getUser).mockResolvedValueOnce(user);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result?.user.email).toBe('alt@example.com'); // Falls back to first email
    });

    it('should handle user with no emails', async () => {
      const claims = createMockSessionClaims();
      const user = createMockClerkUser({
        primaryEmailAddressId: null,
        emailAddresses: [],
      });

      vi.mocked(clerkClient.verifyToken).mockResolvedValueOnce(claims);
      vi.mocked(clerkClient.users.getUser).mockResolvedValueOnce(user);

      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await adapter.getSession(request);

      expect(result?.user.email).toBe('unknown');
    });
  });

  describe('getRoutes', () => {
    it('should return empty array (Clerk handles auth client-side)', () => {
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
// createClerkAdapter Factory Tests
// ============================================================================

describe('createClerkAdapter', () => {
  it('should create adapter with config attached', () => {
    const clerkClient = createMockClerkClient();
    const config: ClerkAdapterConfig = {
      name: 'clerk',
      clerk: clerkClient,
    };

    const result = createClerkAdapter(config);

    expect(result).toBeInstanceOf(ClerkAdapter);
    expect(result.config).toBe(config);
  });

  it('should preserve all config options', () => {
    const clerkClient = createMockClerkClient();
    const config: ClerkAdapterConfig = {
      name: 'clerk',
      clerk: clerkClient,
      authorizedParties: ['http://localhost:3000'],
      audiences: 'my-api',
      clockTolerance: 10, // seconds
      authHeader: 'x-auth',
      fetchUserData: false,
      debug: true,
    };

    const result = createClerkAdapter(config);

    expect(result.config).toEqual(config);
  });
});
