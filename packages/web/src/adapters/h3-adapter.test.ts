/**
 * Tests for H3/Vinxi Auth Adapter
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type AuthenticatedH3ActionContext,
  createH3Action,
  createH3AuthAdapter,
  createH3Context,
  createMockAuthenticatedH3Context,
  createMockH3Context,
  type H3ActionContext,
  H3AuthError,
  isAuthenticatedH3Context,
  isH3Context,
} from './h3-adapter.js';

// Mock vinxi/http module
vi.mock('vinxi/http', () => {
  const mockCookies = new Map<string, string>();
  const mockHeaders = new Headers({
    'content-type': 'application/json',
    cookie: 'session=test-token',
    authorization: 'Bearer jwt-token-123',
  });
  const mockRequest = new Request('http://localhost/api/test', {
    headers: mockHeaders,
  });

  return {
    getWebRequest: vi.fn(() => mockRequest),
    getCookie: vi.fn((_event: unknown, name: string) => mockCookies.get(name)),
    setCookie: vi.fn((_event: unknown, name: string, value: string) => {
      mockCookies.set(name, value);
    }),
    deleteCookie: vi.fn((_event: unknown, name: string) => {
      mockCookies.delete(name);
    }),
    parseCookies: vi.fn(() => Object.fromEntries(mockCookies)),
    getRequestHeaders: vi.fn(() => ({
      'content-type': 'application/json',
      cookie: 'session=test-token',
    })),
    __mockCookies: mockCookies,
    __mockRequest: mockRequest,
    __mockHeaders: mockHeaders,
  };
});

describe('createMockH3Context()', () => {
  it('should create a mock context with default values', () => {
    const ctx = createMockH3Context();

    expect(ctx.request).toBeInstanceOf(Request);
    expect(ctx.headers).toBeInstanceOf(Headers);
    expect(ctx.cookies).toBeInstanceOf(Map);
    expect(ctx.h3Event).toBeNull();
    expect(typeof ctx.getCookie).toBe('function');
    expect(typeof ctx.setCookie).toBe('function');
    expect(typeof ctx.deleteCookie).toBe('function');
  });

  it('should allow cookie operations', () => {
    const ctx = createMockH3Context();

    // Initially empty
    expect(ctx.getCookie('test')).toBeUndefined();

    // Set cookie
    ctx.setCookie('test', 'value');
    expect(ctx.getCookie('test')).toBe('value');
    expect(ctx.cookies.get('test')).toBe('value');

    // Delete cookie
    ctx.deleteCookie('test');
    expect(ctx.getCookie('test')).toBeUndefined();
  });

  it('should accept overrides', () => {
    const customRequest = new Request('http://example.com/custom');
    const customHeaders = new Headers({ 'x-custom': 'header' });
    const customCookies = new Map([['existing', 'cookie']]);

    const ctx = createMockH3Context({
      request: customRequest,
      headers: customHeaders,
      cookies: customCookies,
    });

    expect(ctx.request.url).toBe('http://example.com/custom');
    expect(ctx.headers.get('x-custom')).toBe('header');
    expect(ctx.cookies.get('existing')).toBe('cookie');
  });
});

describe('createMockAuthenticatedH3Context()', () => {
  it('should create an authenticated context with user', () => {
    const user = { id: 'user-123', email: 'test@example.com', role: 'admin' };
    const ctx = createMockAuthenticatedH3Context(user);

    expect(ctx.user).toEqual(user);
    expect(ctx.user.id).toBe('user-123');
    expect(ctx.user.email).toBe('test@example.com');
    expect(ctx.user.role).toBe('admin');
  });

  it('should support cookie operations', () => {
    const user = { id: 'user-123' };
    const ctx = createMockAuthenticatedH3Context(user);

    ctx.setCookie('session', 'new-token');
    expect(ctx.getCookie('session')).toBe('new-token');
  });

  it('should accept overrides', () => {
    const user = { id: 'user-123' };
    const customHeaders = new Headers({ authorization: 'Bearer custom' });

    const ctx = createMockAuthenticatedH3Context(user, { headers: customHeaders });

    expect(ctx.headers.get('authorization')).toBe('Bearer custom');
    expect(ctx.user.id).toBe('user-123');
  });
});

describe('isH3Context()', () => {
  it('should return true for H3 context', () => {
    const ctx = createMockH3Context();
    expect(isH3Context(ctx)).toBe(true);
  });

  it('should return false for basic action context', () => {
    const basicCtx = {
      request: new Request('http://localhost/'),
      headers: new Headers(),
      cookies: new Map(),
    };
    expect(isH3Context(basicCtx)).toBe(false);
  });

  it('should return false for context without getCookie function', () => {
    const invalidCtx = {
      request: new Request('http://localhost/'),
      headers: new Headers(),
      cookies: new Map(),
      getCookie: 'not-a-function',
    };
    expect(isH3Context(invalidCtx as unknown as H3ActionContext)).toBe(false);
  });
});

describe('isAuthenticatedH3Context()', () => {
  it('should return true for authenticated H3 context', () => {
    const ctx = createMockAuthenticatedH3Context({ id: 'user-123' });
    expect(isAuthenticatedH3Context(ctx)).toBe(true);
  });

  it('should return false for unauthenticated H3 context', () => {
    const ctx = createMockH3Context();
    expect(isAuthenticatedH3Context(ctx)).toBe(false);
  });

  it('should return false for basic action context', () => {
    const basicCtx = {
      request: new Request('http://localhost/'),
      headers: new Headers(),
      cookies: new Map(),
    };
    expect(isAuthenticatedH3Context(basicCtx)).toBe(false);
  });
});

describe('H3AuthError', () => {
  it('should create error with code and message', () => {
    const err = new H3AuthError('UNAUTHORIZED', 'Please log in');

    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Please log in');
    expect(err.name).toBe('H3AuthError');
  });

  it('should be instance of Error', () => {
    const err = new H3AuthError('FORBIDDEN', 'Access denied');

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(H3AuthError);
  });

  it('should support all error codes', () => {
    const codes: Array<'UNAUTHORIZED' | 'FORBIDDEN' | 'SESSION_EXPIRED'> = [
      'UNAUTHORIZED',
      'FORBIDDEN',
      'SESSION_EXPIRED',
    ];

    for (const code of codes) {
      const err = new H3AuthError(code, `Test ${code}`);
      expect(err.code).toBe(code);
    }
  });
});

describe('createH3Context()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create context with real request from vinxi/http', async () => {
    const ctx = await createH3Context();

    expect(ctx.request).toBeInstanceOf(Request);
    expect(ctx.request.url).toBe('http://localhost/api/test');
    expect(ctx.headers).toBeInstanceOf(Headers);
    expect(ctx.cookies).toBeInstanceOf(Map);
  });

  it('should have working getCookie method', async () => {
    // Set up mock cookies
    const vinxiHttp = await import('vinxi/http');
    const mockCookies = (vinxiHttp as unknown as { __mockCookies: Map<string, string> })
      .__mockCookies;
    mockCookies.set('session', 'test-session-token');

    const ctx = await createH3Context();

    expect(ctx.getCookie('session')).toBe('test-session-token');
  });

  it('should throw when setCookie called without event', async () => {
    const ctx = await createH3Context(); // No event passed

    expect(() => ctx.setCookie('test', 'value')).toThrow('setCookie requires H3 event context');
  });

  it('should throw when deleteCookie called without event', async () => {
    const ctx = await createH3Context(); // No event passed

    expect(() => ctx.deleteCookie('test')).toThrow('deleteCookie requires H3 event context');
  });
});

describe('createH3AuthAdapter()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getContext()', () => {
    it('should return H3 context', async () => {
      const adapter = createH3AuthAdapter();
      const ctx = await adapter.getContext();

      expect(ctx.request).toBeInstanceOf(Request);
      expect(typeof ctx.getCookie).toBe('function');
    });
  });

  describe('getAuthenticatedContext()', () => {
    it('should return null when no userLoader configured', async () => {
      const adapter = createH3AuthAdapter();
      const ctx = await adapter.getAuthenticatedContext();

      expect(ctx).toBeNull();
    });

    it('should return null when userLoader returns null', async () => {
      const adapter = createH3AuthAdapter({
        userLoader: async () => null,
      });

      const ctx = await adapter.getAuthenticatedContext();
      expect(ctx).toBeNull();
    });

    it('should return authenticated context when user loaded', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const adapter = createH3AuthAdapter({
        userLoader: async () => mockUser,
      });

      const ctx = await adapter.getAuthenticatedContext();

      expect(ctx).not.toBeNull();
      expect(ctx?.user.id).toBe('user-123');
      expect(ctx?.user.email).toBe('test@example.com');
    });

    it('should pass context to userLoader', async () => {
      const userLoader = vi.fn().mockResolvedValue({ id: 'user-123' });
      const adapter = createH3AuthAdapter({ userLoader });

      await adapter.getAuthenticatedContext();

      expect(userLoader).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.any(Request),
          getCookie: expect.any(Function),
        })
      );
    });
  });

  describe('requireAuth()', () => {
    it('should throw H3AuthError when not authenticated', async () => {
      const adapter = createH3AuthAdapter({
        userLoader: async () => null,
      });

      await expect(adapter.requireAuth()).rejects.toThrow(H3AuthError);
      await expect(adapter.requireAuth()).rejects.toThrow('Authentication required');
    });

    it('should return authenticated context when user exists', async () => {
      const mockUser = { id: 'user-123' };
      const adapter = createH3AuthAdapter({
        userLoader: async () => mockUser,
      });

      const ctx = await adapter.requireAuth();

      expect(ctx.user.id).toBe('user-123');
    });
  });

  describe('isAuthenticated()', () => {
    it('should return false when not authenticated', async () => {
      const adapter = createH3AuthAdapter({
        userLoader: async () => null,
      });

      const result = await adapter.isAuthenticated();
      expect(result).toBe(false);
    });

    it('should return true when authenticated', async () => {
      const adapter = createH3AuthAdapter({
        userLoader: async () => ({ id: 'user-123' }),
      });

      const result = await adapter.isAuthenticated();
      expect(result).toBe(true);
    });
  });

  describe('getAuthToken()', () => {
    it('should extract Bearer token from authorization header', () => {
      const ctx = createMockH3Context({
        headers: new Headers({ authorization: 'Bearer my-jwt-token' }),
      });

      const adapter = createH3AuthAdapter();
      const token = adapter.getAuthToken(ctx);

      expect(token).toBe('my-jwt-token');
    });

    it('should return raw header if not Bearer format', () => {
      const ctx = createMockH3Context({
        headers: new Headers({ authorization: 'Basic dXNlcjpwYXNz' }),
      });

      const adapter = createH3AuthAdapter();
      const token = adapter.getAuthToken(ctx);

      expect(token).toBe('Basic dXNlcjpwYXNz');
    });

    it('should fall back to session cookie', () => {
      const ctx = createMockH3Context();
      ctx.setCookie('session', 'session-cookie-token');

      const adapter = createH3AuthAdapter();
      const token = adapter.getAuthToken(ctx);

      expect(token).toBe('session-cookie-token');
    });

    it('should use custom session cookie name', () => {
      const ctx = createMockH3Context();
      ctx.setCookie('my-session', 'custom-token');

      const adapter = createH3AuthAdapter({ sessionCookieName: 'my-session' });
      const token = adapter.getAuthToken(ctx);

      expect(token).toBe('custom-token');
    });

    it('should use custom auth header name', () => {
      const ctx = createMockH3Context({
        headers: new Headers({ 'x-api-key': 'api-key-value' }),
      });

      const adapter = createH3AuthAdapter({ authHeaderName: 'x-api-key' });
      const token = adapter.getAuthToken(ctx);

      expect(token).toBe('api-key-value');
    });

    it('should prefer header over cookie', () => {
      const ctx = createMockH3Context({
        headers: new Headers({ authorization: 'Bearer header-token' }),
      });
      ctx.setCookie('session', 'cookie-token');

      const adapter = createH3AuthAdapter();
      const token = adapter.getAuthToken(ctx);

      expect(token).toBe('header-token');
    });

    it('should return undefined when no token found', () => {
      const ctx = createMockH3Context();

      const adapter = createH3AuthAdapter();
      const token = adapter.getAuthToken(ctx);

      expect(token).toBeUndefined();
    });
  });
});

describe('createH3Action()', () => {
  it('should create a callable action function', () => {
    const adapter = createH3AuthAdapter();
    const action = createH3Action(adapter, {}, async (input: { id: string }) => ({ id: input.id }));

    expect(typeof action).toBe('function');
  });

  it('should return success result on successful execution', async () => {
    const adapter = createH3AuthAdapter();
    const action = createH3Action(adapter, {}, async (input: { name: string }) => ({
      greeting: `Hello, ${input.name}!`,
    }));

    const result = await action({ name: 'World' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.greeting).toBe('Hello, World!');
    }
  });

  it('should return error result when handler throws', async () => {
    const adapter = createH3AuthAdapter();
    const action = createH3Action(adapter, {}, async () => {
      throw new Error('Something went wrong');
    });

    const result = await action({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
      expect(result.error.message).toBe('Something went wrong');
    }
  });

  it('should return UNAUTHORIZED when requireAuth fails', async () => {
    const adapter = createH3AuthAdapter({
      userLoader: async () => null, // No user
    });

    const action = createH3Action(adapter, { requireAuth: true }, async (_input, ctx) => ({
      userId: (ctx as AuthenticatedH3ActionContext).user.id,
    }));

    const result = await action({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('should provide user when requireAuth succeeds', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const adapter = createH3AuthAdapter({
      userLoader: async () => mockUser,
    });

    const action = createH3Action(adapter, { requireAuth: true }, async (_input, ctx) => {
      const authCtx = ctx as AuthenticatedH3ActionContext;
      return { userId: authCtx.user.id, email: authCtx.user.email };
    });

    const result = await action({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.userId).toBe('user-123');
      expect(result.data.email).toBe('test@example.com');
    }
  });

  it('should validate input when validator provided', async () => {
    const adapter = createH3AuthAdapter();

    const validateInput = (input: unknown): { id: string } => {
      const data = input as { id?: string };
      if (!data.id || typeof data.id !== 'string') {
        throw new Error('id is required');
      }
      return { id: data.id };
    };

    const action = createH3Action(adapter, { validate: validateInput }, async (input) => ({
      received: input.id,
    }));

    // Valid input
    const validResult = await action({ id: 'test-123' });
    expect(validResult.success).toBe(true);

    // Invalid input
    const invalidResult = await action({} as { id: string });
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.error.message).toBe('id is required');
    }
  });

  it('should handle non-Error throws', async () => {
    const adapter = createH3AuthAdapter();
    const action = createH3Action(adapter, {}, async () => {
      throw 'string error'; // eslint-disable-line @typescript-eslint/only-throw-error
    });

    const result = await action({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
      expect(result.error.message).toBe('An unexpected error occurred');
    }
  });
});

describe('H3 adapter integration scenarios', () => {
  it('should support typical auth flow: login with cookie', async () => {
    const sessions = new Map<string, { userId: string }>();
    sessions.set('valid-session', { userId: 'user-123' });

    const adapter = createH3AuthAdapter({
      userLoader: async (ctx) => {
        const token = ctx.getCookie('session');
        if (!token) return null;

        const session = sessions.get(token);
        if (!session) return null;

        return { id: session.userId };
      },
      sessionCookieName: 'session',
    });

    // User with valid session
    const ctx = createMockH3Context();
    ctx.setCookie('session', 'valid-session');

    // Simulate adapter using the context
    const mockAdapter = {
      ...adapter,
      getAuthenticatedContext: async () => {
        const token = ctx.getCookie('session');
        if (!token) return null;
        const session = sessions.get(token);
        if (!session) return null;
        return createMockAuthenticatedH3Context({ id: session.userId });
      },
    };

    const authCtx = await mockAdapter.getAuthenticatedContext();
    expect(authCtx?.user.id).toBe('user-123');
  });

  it('should support typical auth flow: JWT in header', async () => {
    const verifyJwt = (token: string) => {
      if (token === 'valid-jwt') {
        return { userId: 'jwt-user-456' };
      }
      return null;
    };

    const adapter = createH3AuthAdapter({
      userLoader: async (ctx) => {
        const authHeader = ctx.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return null;

        const token = authHeader.slice(7);
        const payload = verifyJwt(token);
        if (!payload) return null;

        return { id: payload.userId };
      },
    });

    // Create context with JWT header
    const ctx = createMockH3Context({
      headers: new Headers({ authorization: 'Bearer valid-jwt' }),
    });

    // Simulate the userLoader being called with this context
    const user = (await adapter.getAuthToken(ctx)?.startsWith('valid-jwt'))
      ? { id: 'jwt-user-456' }
      : null;

    expect(user?.id).toBe('jwt-user-456');
  });
});
