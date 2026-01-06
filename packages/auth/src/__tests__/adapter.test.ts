/**
 * Tests for the Auth Adapter system
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AdapterRoute,
  AdapterSessionResult,
  AuthAdapter,
  AuthAdapterConfig,
} from '../adapter.js';
import {
  AuthAdapterError,
  BaseAuthAdapter,
  createAdapterAuthMiddleware,
  createAuthAdapterPlugin,
  defineAuthAdapter,
  isAuthAdapter,
} from '../adapter.js';

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
  const reply = {
    status: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as unknown as FastifyReply;
}

function createMockFastify(): FastifyInstance {
  const hooks: Map<string, Array<(...args: unknown[]) => Promise<void>>> = new Map();
  const decorations: Map<string, unknown> = new Map();
  const requestDecorations: Set<string> = new Set();

  return {
    decorate: vi.fn((name: string, value: unknown) => {
      decorations.set(name, value);
    }),
    decorateRequest: vi.fn((name: string, value: unknown) => {
      decorations.set(`request.${name}`, value);
      requestDecorations.add(name);
    }),
    hasRequestDecorator: vi.fn((name: string) => {
      return requestDecorations.has(name);
    }),
    addHook: vi.fn((hookName: string, handler: (...args: unknown[]) => Promise<void>) => {
      if (!hooks.has(hookName)) {
        hooks.set(hookName, []);
      }
      hooks.get(hookName)?.push(handler);
    }),
    route: vi.fn(),
    log: {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
    // Helper to trigger hooks in tests
    __triggerHook: async (hookName: string, ...args: unknown[]) => {
      const handlers = hooks.get(hookName) || [];
      for (const handler of handlers) {
        await handler(...args);
      }
    },
  } as unknown as FastifyInstance & {
    __triggerHook: (hookName: string, ...args: unknown[]) => Promise<void>;
  };
}

// ============================================================================
// Test Adapter Implementation
// ============================================================================

interface TestAdapterConfig extends AuthAdapterConfig {
  testOption?: string;
}

class TestAdapter extends BaseAuthAdapter<TestAdapterConfig> {
  private sessionData: AdapterSessionResult | null = null;

  constructor() {
    super('test-adapter', '1.0.0');
  }

  setSessionData(data: AdapterSessionResult | null) {
    this.sessionData = data;
  }

  override async getSession(): Promise<AdapterSessionResult | null> {
    return this.sessionData;
  }

  override getRoutes(): AdapterRoute[] {
    return [
      {
        path: '/api/test-auth/*',
        methods: ['GET', 'POST'],
        handler: async (_req, reply) => {
          reply.send({ ok: true });
        },
      },
    ];
  }
}

// ============================================================================
// AuthAdapterError Tests
// ============================================================================

describe('AuthAdapterError', () => {
  it('should create error with all properties', () => {
    const cause = new Error('Original error');
    const error = new AuthAdapterError('Test error', 500, 'ADAPTER_INIT_FAILED', cause);

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('ADAPTER_INIT_FAILED');
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('AuthAdapterError');
    expect(error).toBeInstanceOf(Error);
  });

  it('should work without cause', () => {
    const error = new AuthAdapterError('Test error', 401, 'ADAPTER_SESSION_ERROR');

    expect(error.cause).toBeUndefined();
  });
});

// ============================================================================
// defineAuthAdapter Tests
// ============================================================================

describe('defineAuthAdapter', () => {
  it('should return the adapter unchanged', () => {
    const adapter = defineAuthAdapter<TestAdapterConfig>({
      name: 'test',
      version: '1.0.0',
      initialize: vi.fn(),
      getSession: vi.fn().mockResolvedValue(null),
      getRoutes: () => [],
    });

    expect(adapter.name).toBe('test');
    expect(adapter.version).toBe('1.0.0');
  });

  it('should throw if adapter has no name', () => {
    expect(() =>
      defineAuthAdapter({
        name: '',
        version: '1.0.0',
        initialize: vi.fn(),
        getSession: vi.fn(),
        getRoutes: () => [],
      })
    ).toThrow('Adapter must have a name');
  });

  it('should throw if adapter has no version', () => {
    expect(() =>
      defineAuthAdapter({
        name: 'test',
        version: '',
        initialize: vi.fn(),
        getSession: vi.fn(),
        getRoutes: () => [],
      })
    ).toThrow('must have a version');
  });

  it('should throw if initialize is missing', () => {
    expect(() =>
      defineAuthAdapter({
        name: 'test',
        version: '1.0.0',
        getSession: vi.fn(),
        getRoutes: () => [],
      } as unknown as AuthAdapter)
    ).toThrow('must implement initialize');
  });

  it('should throw if getSession is missing', () => {
    expect(() =>
      defineAuthAdapter({
        name: 'test',
        version: '1.0.0',
        initialize: vi.fn(),
        getRoutes: () => [],
      } as unknown as AuthAdapter)
    ).toThrow('must implement getSession');
  });

  it('should throw if getRoutes is missing', () => {
    expect(() =>
      defineAuthAdapter({
        name: 'test',
        version: '1.0.0',
        initialize: vi.fn(),
        getSession: vi.fn(),
      } as unknown as AuthAdapter)
    ).toThrow('must implement getRoutes');
  });
});

// ============================================================================
// isAuthAdapter Tests
// ============================================================================

describe('isAuthAdapter', () => {
  it('should return true for valid adapter', () => {
    const adapter = new TestAdapter();
    expect(isAuthAdapter(adapter)).toBe(true);
  });

  it('should return true for adapter created with defineAuthAdapter', () => {
    const adapter = defineAuthAdapter({
      name: 'test',
      version: '1.0.0',
      initialize: vi.fn(),
      getSession: vi.fn(),
      getRoutes: () => [],
    });
    expect(isAuthAdapter(adapter)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isAuthAdapter(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isAuthAdapter(undefined)).toBe(false);
  });

  it('should return false for object missing required methods', () => {
    expect(isAuthAdapter({ name: 'test', version: '1.0.0' })).toBe(false);
    expect(
      isAuthAdapter({
        name: 'test',
        version: '1.0.0',
        initialize: vi.fn(),
      })
    ).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isAuthAdapter('adapter')).toBe(false);
    expect(isAuthAdapter(123)).toBe(false);
    expect(isAuthAdapter([])).toBe(false);
  });
});

// ============================================================================
// BaseAuthAdapter Tests
// ============================================================================

describe('BaseAuthAdapter', () => {
  it('should store fastify and config on initialize', async () => {
    const adapter = new TestAdapter();
    const fastify = createMockFastify();
    const config: TestAdapterConfig = { name: 'test', testOption: 'value' };

    await adapter.initialize(fastify, config);

    expect(adapter.fastify).toBe(fastify);
    expect(adapter.config).toBe(config);
  });

  it('should clear fastify and config on cleanup', async () => {
    const adapter = new TestAdapter();
    const fastify = createMockFastify();
    const config: TestAdapterConfig = { name: 'test' };

    await adapter.initialize(fastify, config);
    await adapter.cleanup();

    expect(adapter.fastify).toBeNull();
    expect(adapter.config).toBeNull();
  });

  it('should return empty routes by default', () => {
    // Create a minimal adapter without overriding getRoutes
    class MinimalAdapter extends BaseAuthAdapter {
      constructor() {
        super('minimal', '1.0.0');
      }
      getSession(): AdapterSessionResult | null {
        return null;
      }
    }

    // We override it in TestAdapter, so let's test a different case
    const routes = new MinimalAdapter().getRoutes();
    expect(routes).toEqual([]);
  });
});

// ============================================================================
// createAuthAdapterPlugin Tests
// ============================================================================

describe('createAuthAdapterPlugin', () => {
  let adapter: TestAdapter;
  let fastify: FastifyInstance & {
    __triggerHook: (hookName: string, ...args: unknown[]) => Promise<void>;
  };
  let config: TestAdapterConfig;

  beforeEach(() => {
    adapter = new TestAdapter();
    fastify = createMockFastify() as FastifyInstance & {
      __triggerHook: (hookName: string, ...args: unknown[]) => Promise<void>;
    };
    config = { name: 'test-adapter' };
  });

  it('should create a valid VeloxPlugin', () => {
    const plugin = createAuthAdapterPlugin({ adapter, config });

    expect(plugin.name).toBe('@veloxts/auth-adapter:test-adapter');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.dependencies).toContain('@veloxts/core');
  });

  it('should initialize adapter on register', async () => {
    const initSpy = vi.spyOn(adapter, 'initialize');
    const plugin = createAuthAdapterPlugin({ adapter, config });

    await plugin.register(fastify, { adapter, config });

    expect(initSpy).toHaveBeenCalledWith(fastify, config);
  });

  it('should mount adapter routes', async () => {
    const plugin = createAuthAdapterPlugin({ adapter, config });

    await plugin.register(fastify, { adapter, config });

    expect(fastify.route).toHaveBeenCalled();
  });

  it('should decorate request with auth and user', async () => {
    const plugin = createAuthAdapterPlugin({ adapter, config });

    await plugin.register(fastify, { adapter, config });

    expect(fastify.decorateRequest).toHaveBeenCalledWith('auth', undefined);
    expect(fastify.decorateRequest).toHaveBeenCalledWith('user', undefined);
  });

  it('should add preHandler hook for session loading', async () => {
    const plugin = createAuthAdapterPlugin({ adapter, config });

    await plugin.register(fastify, { adapter, config });

    expect(fastify.addHook).toHaveBeenCalledWith('preHandler', expect.any(Function));
  });

  it('should load session and set request.auth and request.user', async () => {
    const sessionData: AdapterSessionResult = {
      user: { id: 'user-1', email: 'test@example.com' },
      session: { sessionId: 'sess-1', userId: 'user-1', isActive: true },
    };
    adapter.setSessionData(sessionData);

    const plugin = createAuthAdapterPlugin({ adapter, config });
    await plugin.register(fastify, { adapter, config });

    const request = createMockRequest({ url: '/api/protected' });
    const reply = createMockReply();

    await fastify.__triggerHook('preHandler', request, reply);

    expect(request.auth).toBeDefined();
    expect(request.auth?.isAuthenticated).toBe(true);
    expect(request.auth?.user).toEqual({
      id: 'user-1',
      email: 'test@example.com',
    });
    expect(request.user).toEqual({
      id: 'user-1',
      email: 'test@example.com',
    });
  });

  it('should skip session loading for adapter routes', async () => {
    const getSessionSpy = vi.spyOn(adapter, 'getSession');
    const plugin = createAuthAdapterPlugin({ adapter, config });

    await plugin.register(fastify, { adapter, config });

    const request = createMockRequest({ url: '/api/test-auth/login' });
    const reply = createMockReply();

    await fastify.__triggerHook('preHandler', request, reply);

    expect(getSessionSpy).not.toHaveBeenCalled();
  });

  it('should skip session loading for excluded routes', async () => {
    const getSessionSpy = vi.spyOn(adapter, 'getSession');
    const configWithExcludes: TestAdapterConfig = {
      name: 'test-adapter',
      excludeRoutes: ['/api/health', '/api/public/*'],
    };
    const plugin = createAuthAdapterPlugin({ adapter, config: configWithExcludes });

    await plugin.register(fastify, { adapter, config: configWithExcludes });

    // Exact match exclusion
    const request1 = createMockRequest({ url: '/api/health' });
    await fastify.__triggerHook('preHandler', request1, createMockReply());
    expect(getSessionSpy).not.toHaveBeenCalled();

    // Wildcard exclusion
    const request2 = createMockRequest({ url: '/api/public/files/image.png' });
    await fastify.__triggerHook('preHandler', request2, createMockReply());
    expect(getSessionSpy).not.toHaveBeenCalled();
  });

  it('should not set auth context for expired sessions', async () => {
    const sessionData: AdapterSessionResult = {
      user: { id: 'user-1', email: 'test@example.com' },
      session: {
        sessionId: 'sess-1',
        userId: 'user-1',
        isActive: true,
        expiresAt: Date.now() - 1000, // Expired
      },
    };
    adapter.setSessionData(sessionData);

    const plugin = createAuthAdapterPlugin({ adapter, config });
    await plugin.register(fastify, { adapter, config });

    const request = createMockRequest({ url: '/api/protected' });
    await fastify.__triggerHook('preHandler', request, createMockReply());

    expect(request.auth).toBeUndefined();
  });

  it('should not set auth context for inactive sessions', async () => {
    const sessionData: AdapterSessionResult = {
      user: { id: 'user-1', email: 'test@example.com' },
      session: { sessionId: 'sess-1', userId: 'user-1', isActive: false },
    };
    adapter.setSessionData(sessionData);

    const plugin = createAuthAdapterPlugin({ adapter, config });
    await plugin.register(fastify, { adapter, config });

    const request = createMockRequest({ url: '/api/protected' });
    await fastify.__triggerHook('preHandler', request, createMockReply());

    expect(request.auth).toBeUndefined();
  });

  it('should use custom transformUser if provided', async () => {
    const sessionData: AdapterSessionResult = {
      user: {
        id: 'user-1',
        email: 'test@example.com',
        providerData: { role: 'admin' },
      },
      session: { sessionId: 'sess-1', userId: 'user-1', isActive: true },
    };
    adapter.setSessionData(sessionData);

    const configWithTransform: TestAdapterConfig = {
      name: 'test-adapter',
      transformUser: (adapterUser) => ({
        id: adapterUser.id,
        email: adapterUser.email,
        role: adapterUser.providerData?.role as string,
      }),
    };

    const plugin = createAuthAdapterPlugin({ adapter, config: configWithTransform });
    await plugin.register(fastify, { adapter, config: configWithTransform });

    const request = createMockRequest({ url: '/api/protected' });
    await fastify.__triggerHook('preHandler', request, createMockReply());

    expect(request.user).toEqual({
      id: 'user-1',
      email: 'test@example.com',
      role: 'admin',
    });
  });

  it('should call adapter cleanup on server close', async () => {
    const cleanupSpy = vi.spyOn(adapter, 'cleanup');
    const plugin = createAuthAdapterPlugin({ adapter, config });

    await plugin.register(fastify, { adapter, config });
    await fastify.__triggerHook('onClose');

    expect(cleanupSpy).toHaveBeenCalled();
  });

  it('should throw on initialization failure', async () => {
    const failingAdapter = defineAuthAdapter({
      name: 'failing',
      version: '1.0.0',
      initialize: () => {
        throw new Error('Init failed');
      },
      getSession: vi.fn(),
      getRoutes: () => [],
    });

    const plugin = createAuthAdapterPlugin({
      adapter: failingAdapter,
      config: { name: 'failing' },
    });

    await expect(
      plugin.register(fastify, {
        adapter: failingAdapter,
        config: { name: 'failing' },
      })
    ).rejects.toThrow('Failed to initialize adapter');
  });
});

// ============================================================================
// createAdapterAuthMiddleware Tests
// ============================================================================

describe('createAdapterAuthMiddleware', () => {
  it('should create middleware factory', () => {
    const middleware = createAdapterAuthMiddleware();

    expect(middleware.requireAuth).toBeDefined();
    expect(middleware.optionalAuth).toBeDefined();
    expect(middleware.middleware).toBeDefined();
  });

  describe('requireAuth', () => {
    it('should throw for unauthenticated request', async () => {
      const middleware = createAdapterAuthMiddleware();
      const fn = middleware.requireAuth();

      const ctx = {
        request: createMockRequest(),
      };
      const next = vi.fn();

      await expect(fn({ ctx, next, input: undefined })).rejects.toThrow('Authentication required');
    });

    it('should continue for authenticated request', async () => {
      const middleware = createAdapterAuthMiddleware();
      const fn = middleware.requireAuth();

      const user = { id: 'user-1', email: 'test@example.com' };
      const request = createMockRequest();
      request.auth = { user, isAuthenticated: true };
      request.user = user;

      const ctx = { request };
      const next = vi.fn().mockResolvedValue({ ok: true });

      await fn({ ctx, next, input: undefined });

      expect(next).toHaveBeenCalled();
      const nextArg = next.mock.calls[0][0];
      expect(nextArg.ctx.user).toEqual(user);
      expect(nextArg.ctx.isAuthenticated).toBe(true);
    });
  });

  describe('optionalAuth', () => {
    it('should continue without user for unauthenticated request', async () => {
      const middleware = createAdapterAuthMiddleware();
      const fn = middleware.optionalAuth();

      const ctx = {
        request: createMockRequest(),
      };
      const next = vi.fn().mockResolvedValue({ ok: true });

      await fn({ ctx, next, input: undefined });

      expect(next).toHaveBeenCalled();
      const nextArg = next.mock.calls[0][0];
      expect(nextArg.ctx.user).toBeUndefined();
      expect(nextArg.ctx.isAuthenticated).toBe(false);
    });

    it('should continue with user for authenticated request', async () => {
      const middleware = createAdapterAuthMiddleware();
      const fn = middleware.optionalAuth();

      const user = { id: 'user-1', email: 'test@example.com' };
      const request = createMockRequest();
      request.auth = { user, isAuthenticated: true };
      request.user = user;

      const ctx = { request };
      const next = vi.fn().mockResolvedValue({ ok: true });

      await fn({ ctx, next, input: undefined });

      expect(next).toHaveBeenCalled();
      const nextArg = next.mock.calls[0][0];
      expect(nextArg.ctx.user).toEqual(user);
      expect(nextArg.ctx.isAuthenticated).toBe(true);
    });
  });
});
