/**
 * Tests for the BetterAuth Adapter
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthAdapterError } from '../adapter.js';
import type {
  BetterAuthAdapterConfig,
  BetterAuthApi,
  BetterAuthInstance,
  BetterAuthSessionResult,
} from '../adapters/better-auth.js';
import { BetterAuthAdapter, createBetterAuthAdapter } from '../adapters/better-auth.js';

// ============================================================================
// Mock Factories
// ============================================================================

function createMockRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  return {
    method: 'GET',
    url: '/api/test',
    headers: {
      host: 'localhost:3000',
      cookie: 'better-auth.session_token=test-token',
    },
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
  return {
    decorate: vi.fn(),
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

function createMockBetterAuth(
  sessionResult: BetterAuthSessionResult | null = null
): BetterAuthInstance {
  const api: BetterAuthApi = {
    getSession: vi.fn().mockResolvedValue(sessionResult),
  };

  const handler = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );

  return {
    api,
    handler,
    options: {
      basePath: '/api/auth',
    },
  };
}

function createMockSession(): BetterAuthSessionResult {
  return {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      emailVerified: true,
      name: 'Test User',
      image: 'https://example.com/avatar.png',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15'),
    },
    session: {
      id: 'sess-456',
      userId: 'user-123',
      expiresAt: new Date(Date.now() + 86400000), // 1 day from now
      token: 'session-token-xyz',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    },
  };
}

// ============================================================================
// BetterAuthAdapter Tests
// ============================================================================

describe('BetterAuthAdapter', () => {
  let adapter: BetterAuthAdapter;
  let mockAuth: BetterAuthInstance;
  let fastify: FastifyInstance;
  let config: BetterAuthAdapterConfig;

  beforeEach(() => {
    adapter = new BetterAuthAdapter();
    mockAuth = createMockBetterAuth();
    fastify = createMockFastify();
    config = {
      name: 'better-auth',
      auth: mockAuth,
    };
  });

  describe('constructor', () => {
    it('should create adapter with correct name and version', () => {
      expect(adapter.name).toBe('better-auth');
      expect(adapter.version).toBe('1.0.0');
    });
  });

  describe('initialize', () => {
    it('should initialize with BetterAuth instance', async () => {
      await adapter.initialize(fastify, config);

      expect(adapter.auth).toBe(mockAuth);
    });

    it('should use basePath from config', async () => {
      await adapter.initialize(fastify, {
        ...config,
        basePath: '/auth',
      });

      expect(adapter.basePath).toBe('/auth');
    });

    it('should use basePath from BetterAuth options if not in config', async () => {
      await adapter.initialize(fastify, config);

      expect(adapter.basePath).toBe('/api/auth');
    });

    it('should default to /api/auth if no basePath specified', async () => {
      const authWithoutOptions = createMockBetterAuth();
      delete authWithoutOptions.options;

      await adapter.initialize(fastify, {
        ...config,
        auth: authWithoutOptions,
      });

      expect(adapter.basePath).toBe('/api/auth');
    });

    it('should throw if auth instance is missing', async () => {
      await expect(
        adapter.initialize(fastify, { name: 'test' } as BetterAuthAdapterConfig)
      ).rejects.toThrow('BetterAuth instance is required');
    });
  });

  describe('getSession', () => {
    it('should return null when no session exists', async () => {
      await adapter.initialize(fastify, config);

      const request = createMockRequest();
      const result = await adapter.getSession(request);

      expect(result).toBeNull();
      expect(mockAuth.api.getSession).toHaveBeenCalled();
    });

    it('should return normalized session data', async () => {
      const mockSession = createMockSession();
      mockAuth = createMockBetterAuth(mockSession);
      await adapter.initialize(fastify, { ...config, auth: mockAuth });

      const request = createMockRequest();
      const result = await adapter.getSession(request);

      expect(result).not.toBeNull();
      expect(result?.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        image: 'https://example.com/avatar.png',
        providerData: {
          createdAt: mockSession.user.createdAt,
          updatedAt: mockSession.user.updatedAt,
        },
      });
      expect(result?.session).toEqual({
        sessionId: 'sess-456',
        userId: 'user-123',
        expiresAt: mockSession.session.expiresAt.getTime(),
        isActive: true,
        providerData: {
          token: 'session-token-xyz',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          createdAt: mockSession.session.createdAt,
          updatedAt: mockSession.session.updatedAt,
        },
      });
    });

    it('should handle null image correctly', async () => {
      const mockSession = createMockSession();
      mockSession.user.image = null;
      mockAuth = createMockBetterAuth(mockSession);
      await adapter.initialize(fastify, { ...config, auth: mockAuth });

      const request = createMockRequest();
      const result = await adapter.getSession(request);

      expect(result?.user.image).toBeUndefined();
    });

    it('should pass headers to BetterAuth', async () => {
      await adapter.initialize(fastify, config);

      const request = createMockRequest({
        headers: {
          cookie: 'session=abc123',
          authorization: 'Bearer token',
        },
      });

      await adapter.getSession(request);

      expect(mockAuth.api.getSession).toHaveBeenCalledWith({
        headers: expect.any(Headers),
      });

      // Verify headers were converted correctly
      const callArg = (mockAuth.api.getSession as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.headers.get('cookie')).toBe('session=abc123');
      expect(callArg.headers.get('authorization')).toBe('Bearer token');
    });

    it('should throw if adapter not initialized', async () => {
      const request = createMockRequest();

      await expect(adapter.getSession(request)).rejects.toThrow(
        'BetterAuth adapter not initialized'
      );
    });

    it('should wrap BetterAuth errors', async () => {
      (mockAuth.api.getSession as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('BetterAuth error')
      );
      await adapter.initialize(fastify, config);

      const request = createMockRequest();

      await expect(adapter.getSession(request)).rejects.toThrow(AuthAdapterError);
      await expect(adapter.getSession(request)).rejects.toThrow(
        'Failed to load session from BetterAuth'
      );
    });
  });

  describe('getRoutes', () => {
    it('should return wildcard route for auth handler', async () => {
      await adapter.initialize(fastify, config);

      const routes = adapter.getRoutes();

      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/api/auth/*');
      expect(routes[0].methods).toEqual(['GET', 'POST']);
      expect(routes[0].handler).toBeDefined();
    });

    it('should respect custom basePath', async () => {
      await adapter.initialize(fastify, {
        ...config,
        basePath: '/auth',
      });

      const routes = adapter.getRoutes();

      expect(routes[0].path).toBe('/auth/*');
    });

    it('should include all methods when handleAllMethods is true', async () => {
      await adapter.initialize(fastify, {
        ...config,
        handleAllMethods: true,
      });

      const routes = adapter.getRoutes();

      expect(routes[0].methods).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
    });
  });

  describe('route handler', () => {
    it('should forward request to BetterAuth handler', async () => {
      await adapter.initialize(fastify, config);
      const routes = adapter.getRoutes();
      const handler = routes[0].handler;

      const request = createMockRequest({ url: '/api/auth/login' });
      const reply = createMockReply();

      await handler(request, reply);

      expect(mockAuth.handler).toHaveBeenCalled();
    });

    it('should set response status from BetterAuth response', async () => {
      (mockAuth.handler as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response('Created', { status: 201 })
      );
      await adapter.initialize(fastify, config);
      const routes = adapter.getRoutes();
      const handler = routes[0].handler;

      const request = createMockRequest({ url: '/api/auth/register' });
      const reply = createMockReply();

      await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
    });

    it('should forward headers from BetterAuth response', async () => {
      (mockAuth.handler as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response('OK', {
          status: 200,
          headers: {
            'Set-Cookie': 'session=abc123',
            'X-Custom': 'value',
          },
        })
      );
      await adapter.initialize(fastify, config);
      const routes = adapter.getRoutes();
      const handler = routes[0].handler;

      const request = createMockRequest();
      const reply = createMockReply();

      await handler(request, reply);

      expect(reply.header).toHaveBeenCalledWith('set-cookie', 'session=abc123');
      expect(reply.header).toHaveBeenCalledWith('x-custom', 'value');
    });

    it('should send response body', async () => {
      (mockAuth.handler as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ user: { id: '123' } }), { status: 200 })
      );
      await adapter.initialize(fastify, config);
      const routes = adapter.getRoutes();
      const handler = routes[0].handler;

      const request = createMockRequest();
      const reply = createMockReply();

      await handler(request, reply);

      expect(reply.send).toHaveBeenCalledWith(JSON.stringify({ user: { id: '123' } }));
    });

    it('should handle empty response body', async () => {
      (mockAuth.handler as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(null, { status: 204 })
      );
      await adapter.initialize(fastify, config);
      const routes = adapter.getRoutes();
      const handler = routes[0].handler;

      const request = createMockRequest();
      const reply = createMockReply();

      await handler(request, reply);

      expect(reply.send).toHaveBeenCalledWith();
    });

    it('should throw if adapter not initialized', async () => {
      const handler = adapter.getRoutes()[0].handler;
      const request = createMockRequest();
      const reply = createMockReply();

      await expect(handler(request, reply)).rejects.toThrow('BetterAuth adapter not initialized');
    });

    it('should wrap handler errors', async () => {
      (mockAuth.handler as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Handler failed'));
      await adapter.initialize(fastify, config);
      const routes = adapter.getRoutes();
      const handler = routes[0].handler;

      const request = createMockRequest();
      const reply = createMockReply();

      await expect(handler(request, reply)).rejects.toThrow(AuthAdapterError);
      await expect(handler(request, reply)).rejects.toThrow('BetterAuth handler failed');
    });
  });

  describe('cleanup', () => {
    it('should clear auth reference', async () => {
      await adapter.initialize(fastify, config);
      expect(adapter.auth).not.toBeNull();

      await adapter.cleanup();

      expect(adapter.auth).toBeNull();
    });
  });
});

// ============================================================================
// createBetterAuthAdapter Tests
// ============================================================================

describe('createBetterAuthAdapter', () => {
  it('should create adapter with config attached', () => {
    const mockAuth = createMockBetterAuth();
    const config: BetterAuthAdapterConfig = {
      name: 'better-auth',
      auth: mockAuth,
    };

    const adapter = createBetterAuthAdapter(config);

    expect(adapter).toBeInstanceOf(BetterAuthAdapter);
    expect(adapter.config).toBe(config);
  });

  it('should work with createAuthAdapterPlugin', async () => {
    const mockAuth = createMockBetterAuth();
    const adapter = createBetterAuthAdapter({
      name: 'better-auth',
      auth: mockAuth,
    });

    // Verify adapter has the expected shape
    expect(adapter.name).toBe('better-auth');
    expect(adapter.config.auth).toBe(mockAuth);
    expect(typeof adapter.initialize).toBe('function');
    expect(typeof adapter.getSession).toBe('function');
    expect(typeof adapter.getRoutes).toBe('function');
  });
});

// ============================================================================
// Request Conversion Tests
// ============================================================================

describe('Request conversion', () => {
  let adapter: BetterAuthAdapter;
  let mockAuth: BetterAuthInstance;
  let fastify: FastifyInstance;

  beforeEach(async () => {
    adapter = new BetterAuthAdapter();
    mockAuth = createMockBetterAuth();
    fastify = createMockFastify();
    await adapter.initialize(fastify, {
      name: 'better-auth',
      auth: mockAuth,
    });
  });

  it('should convert array headers correctly', async () => {
    const request = createMockRequest({
      headers: {
        'set-cookie': ['cookie1=a', 'cookie2=b'],
      },
    });

    await adapter.getSession(request);

    const callArg = (mockAuth.api.getSession as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const cookies = callArg.headers.get('set-cookie');
    expect(cookies).toContain('cookie1=a');
    expect(cookies).toContain('cookie2=b');
  });

  it('should handle POST request with JSON body', async () => {
    let capturedRequest: Request | null = null;
    (mockAuth.handler as ReturnType<typeof vi.fn>).mockImplementation(async (req: Request) => {
      capturedRequest = req;
      return new Response('OK', { status: 200 });
    });

    const routes = adapter.getRoutes();
    const handler = routes[0].handler;

    const request = createMockRequest({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: 'test@example.com', password: 'secret' },
    });

    await handler(request, createMockReply());

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest?.method).toBe('POST');
    const body = await capturedRequest?.text();
    expect(JSON.parse(body)).toEqual({
      email: 'test@example.com',
      password: 'secret',
    });
  });

  it('should handle POST request with string body', async () => {
    let capturedRequest: Request | null = null;
    (mockAuth.handler as ReturnType<typeof vi.fn>).mockImplementation(async (req: Request) => {
      capturedRequest = req;
      return new Response('OK', { status: 200 });
    });

    const routes = adapter.getRoutes();
    const handler = routes[0].handler;

    const request = createMockRequest({
      method: 'POST',
      url: '/api/auth/login',
      body: 'raw-body-content',
    });

    await handler(request, createMockReply());

    const body = await capturedRequest?.text();
    expect(body).toBe('raw-body-content');
  });

  it('should not include body for GET requests', async () => {
    let capturedRequest: Request | null = null;
    (mockAuth.handler as ReturnType<typeof vi.fn>).mockImplementation(async (req: Request) => {
      capturedRequest = req;
      return new Response('OK', { status: 200 });
    });

    const routes = adapter.getRoutes();
    const handler = routes[0].handler;

    const request = createMockRequest({
      method: 'GET',
      url: '/api/auth/session',
      body: { ignored: true },
    });

    await handler(request, createMockReply());

    expect(capturedRequest?.method).toBe('GET');
    // GET requests should not have a body
    expect(capturedRequest?.body).toBeNull();
  });
});
