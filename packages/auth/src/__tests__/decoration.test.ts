/**
 * Tests for shared decoration utilities
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import {
  AUTH_REGISTERED,
  checkDoubleRegistration,
  decorateAuth,
  getRequestAuth,
  getRequestUser,
  setRequestAuth,
} from '../decoration.js';
import type { AdapterAuthContext, NativeAuthContext, User } from '../types.js';

// ============================================================================
// Mock Factories
// ============================================================================

function createMockFastify(): FastifyInstance & { [AUTH_REGISTERED]?: string } {
  const requestDecorators = new Set<string>();

  return {
    decorateRequest: vi.fn((name: string) => {
      requestDecorators.add(name);
    }),
    hasRequestDecorator: vi.fn((name: string) => requestDecorators.has(name)),
    log: {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  } as unknown as FastifyInstance & { [AUTH_REGISTERED]?: string };
}

function createMockRequest(): FastifyRequest & { auth?: unknown; user?: unknown } {
  return {
    method: 'GET',
    url: '/api/test',
    headers: {},
  } as unknown as FastifyRequest & { auth?: unknown; user?: unknown };
}

// ============================================================================
// checkDoubleRegistration Tests
// ============================================================================

describe('checkDoubleRegistration', () => {
  it('should mark fastify instance as registered', () => {
    const fastify = createMockFastify();

    checkDoubleRegistration(fastify, 'authPlugin');

    expect(fastify[AUTH_REGISTERED]).toBe('authPlugin');
  });

  it('should throw if auth already registered', () => {
    const fastify = createMockFastify();

    checkDoubleRegistration(fastify, 'authPlugin');

    expect(() => checkDoubleRegistration(fastify, 'adapter:clerk')).toThrow(
      'Auth already registered by "authPlugin"'
    );
  });

  it('should include both sources in error message', () => {
    const fastify = createMockFastify();

    checkDoubleRegistration(fastify, 'adapter:better-auth');

    expect(() => checkDoubleRegistration(fastify, 'authPlugin')).toThrow(
      'Cannot register "authPlugin"'
    );
  });

  it('should provide guidance in error message', () => {
    const fastify = createMockFastify();

    checkDoubleRegistration(fastify, 'authPlugin');

    expect(() => checkDoubleRegistration(fastify, 'adapter:clerk')).toThrow(
      'Use either authPlugin OR an AuthAdapter, not both'
    );
  });

  it('should allow first registration from any source', () => {
    const fastify1 = createMockFastify();
    const fastify2 = createMockFastify();
    const fastify3 = createMockFastify();

    // All should succeed on fresh instances
    expect(() => checkDoubleRegistration(fastify1, 'authPlugin')).not.toThrow();
    expect(() => checkDoubleRegistration(fastify2, 'adapter:clerk')).not.toThrow();
    expect(() => checkDoubleRegistration(fastify3, 'adapter:jwt')).not.toThrow();
  });
});

// ============================================================================
// decorateAuth Tests
// ============================================================================

describe('decorateAuth', () => {
  it('should decorate request with auth property', () => {
    const fastify = createMockFastify();

    decorateAuth(fastify);

    expect(fastify.decorateRequest).toHaveBeenCalledWith('auth', undefined);
  });

  it('should decorate request with user property', () => {
    const fastify = createMockFastify();

    decorateAuth(fastify);

    expect(fastify.decorateRequest).toHaveBeenCalledWith('user', undefined);
  });

  it('should not re-decorate if auth already exists', () => {
    const fastify = createMockFastify();

    // First call decorates
    decorateAuth(fastify);
    // Second call should check and skip
    decorateAuth(fastify);

    // decorateRequest should only be called twice (once for auth, once for user)
    // on the first call, then hasRequestDecorator returns true on second call
    expect(fastify.hasRequestDecorator).toHaveBeenCalledWith('auth');
    expect(fastify.hasRequestDecorator).toHaveBeenCalledWith('user');
  });

  it('should be idempotent', () => {
    const fastify = createMockFastify();

    // Multiple calls should work without throwing
    decorateAuth(fastify);
    decorateAuth(fastify);
    decorateAuth(fastify);

    // Should have checked for existing decorators
    expect(fastify.hasRequestDecorator).toHaveBeenCalled();
  });
});

// ============================================================================
// setRequestAuth Tests
// ============================================================================

describe('setRequestAuth', () => {
  it('should set NativeAuthContext on request', () => {
    const request = createMockRequest();
    const user: User = { id: 'user-1', email: 'test@example.com' };
    const auth: NativeAuthContext = {
      authMode: 'native',
      isAuthenticated: true,
      user,
      token: 'jwt-token',
      payload: { sub: 'user-1', email: 'test@example.com', type: 'access', iat: 0, exp: 0 },
    };

    setRequestAuth(request, auth, user);

    expect(request.auth).toBe(auth);
    expect(request.user).toBe(user);
  });

  it('should set AdapterAuthContext on request', () => {
    const request = createMockRequest();
    const user: User = { id: 'user-2', email: 'adapter@example.com' };
    const auth: AdapterAuthContext = {
      authMode: 'adapter',
      isAuthenticated: true,
      user,
      providerId: 'clerk',
      session: { clerkSessionId: 'sess-123' },
    };

    setRequestAuth(request, auth, user);

    expect(request.auth).toBe(auth);
    expect(request.user).toBe(user);
  });

  it('should extract user from auth context if not provided', () => {
    const request = createMockRequest();
    const user: User = { id: 'user-3', email: 'auto@example.com' };
    const auth: NativeAuthContext = {
      authMode: 'native',
      isAuthenticated: true,
      user,
      token: 'jwt-token',
      payload: { sub: 'user-3', email: 'auto@example.com', type: 'access', iat: 0, exp: 0 },
    };

    setRequestAuth(request, auth); // No explicit user param

    expect(request.auth).toBe(auth);
    expect(request.user).toBe(user);
  });

  it('should not set user if auth is not authenticated', () => {
    const request = createMockRequest();
    const auth: AdapterAuthContext = {
      authMode: 'adapter',
      isAuthenticated: false,
      providerId: 'clerk',
      session: undefined,
    };

    setRequestAuth(request, auth);

    expect(request.auth).toBe(auth);
    expect(request.user).toBeUndefined();
  });
});

// ============================================================================
// getRequestAuth Tests
// ============================================================================

describe('getRequestAuth', () => {
  it('should return auth context when set', () => {
    const request = createMockRequest();
    const auth: NativeAuthContext = {
      authMode: 'native',
      isAuthenticated: true,
      user: { id: 'user-1', email: 'test@example.com' },
      token: 'jwt-token',
      payload: { sub: 'user-1', email: 'test@example.com', type: 'access', iat: 0, exp: 0 },
    };
    request.auth = auth;

    const result = getRequestAuth(request);

    expect(result).toBe(auth);
  });

  it('should return undefined when not set', () => {
    const request = createMockRequest();

    const result = getRequestAuth(request);

    expect(result).toBeUndefined();
  });

  it('should discriminate between native and adapter auth', () => {
    const request1 = createMockRequest();
    const request2 = createMockRequest();

    const nativeAuth: NativeAuthContext = {
      authMode: 'native',
      isAuthenticated: true,
      user: { id: 'user-1', email: 'test@example.com' },
      token: 'jwt-token',
      payload: { sub: 'user-1', email: 'test@example.com', type: 'access', iat: 0, exp: 0 },
    };

    const adapterAuth: AdapterAuthContext = {
      authMode: 'adapter',
      isAuthenticated: true,
      user: { id: 'user-2', email: 'adapter@example.com' },
      providerId: 'clerk',
      session: {},
    };

    request1.auth = nativeAuth;
    request2.auth = adapterAuth;

    const result1 = getRequestAuth(request1);
    const result2 = getRequestAuth(request2);

    // Type narrowing based on authMode
    expect(result1?.authMode).toBe('native');
    expect(result2?.authMode).toBe('adapter');

    if (result1?.authMode === 'native') {
      expect(result1.token).toBe('jwt-token');
    }

    if (result2?.authMode === 'adapter') {
      expect(result2.providerId).toBe('clerk');
    }
  });
});

// ============================================================================
// getRequestUser Tests
// ============================================================================

describe('getRequestUser', () => {
  it('should return user when set', () => {
    const request = createMockRequest();
    const user: User = { id: 'user-1', email: 'test@example.com', roles: ['admin'] };
    request.user = user;

    const result = getRequestUser(request);

    expect(result).toBe(user);
  });

  it('should return undefined when not set', () => {
    const request = createMockRequest();

    const result = getRequestUser(request);

    expect(result).toBeUndefined();
  });

  it('should return user with roles and permissions', () => {
    const request = createMockRequest();
    const user: User = {
      id: 'user-1',
      email: 'test@example.com',
      roles: ['admin', 'editor'],
      permissions: ['read', 'write', 'delete'],
    };
    request.user = user;

    const result = getRequestUser(request);

    expect(result?.roles).toEqual(['admin', 'editor']);
    expect(result?.permissions).toEqual(['read', 'write', 'delete']);
  });
});

// ============================================================================
// AUTH_REGISTERED Symbol Tests
// ============================================================================

describe('AUTH_REGISTERED', () => {
  it('should be a symbol', () => {
    expect(typeof AUTH_REGISTERED).toBe('symbol');
  });

  it('should have consistent identity via Symbol.for', () => {
    // Symbol.for creates/retrieves from global registry
    const retrieved = Symbol.for('@veloxts/auth/registered');
    expect(AUTH_REGISTERED).toBe(retrieved);
  });

  it('should be usable as object key', () => {
    const obj: { [AUTH_REGISTERED]?: string } = {};
    obj[AUTH_REGISTERED] = 'test-value';

    expect(obj[AUTH_REGISTERED]).toBe('test-value');
  });
});
