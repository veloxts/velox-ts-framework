/**
 * Tests for Auth Bridge
 *
 * These tests verify the auth-bridge's behavior without requiring
 * the full H3/Vinxi environment. The core procedure execution is
 * tested in action.test.ts; here we focus on auth-specific logic.
 *
 * @module @veloxts/web/actions/auth-bridge.test
 */

import { describe, expect, it } from 'vitest';

import {
  authAction,
  isTokenResponse,
  type LoginResponse,
  type TokenResponse,
} from './auth-bridge.js';

describe('isTokenResponse type guard', () => {
  it('should return true for valid TokenResponse', () => {
    const validTokens: TokenResponse = {
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      expiresIn: 900,
      tokenType: 'Bearer',
    };

    expect(isTokenResponse(validTokens)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isTokenResponse(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isTokenResponse(undefined)).toBe(false);
  });

  it('should return false for primitive types', () => {
    expect(isTokenResponse('string')).toBe(false);
    expect(isTokenResponse(123)).toBe(false);
    expect(isTokenResponse(true)).toBe(false);
  });

  it('should return false for empty object', () => {
    expect(isTokenResponse({})).toBe(false);
  });

  it('should return false for partial TokenResponse', () => {
    expect(isTokenResponse({ accessToken: 'token' })).toBe(false);
    expect(isTokenResponse({ accessToken: 'token', refreshToken: 'refresh' })).toBe(false);
    expect(
      isTokenResponse({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 900,
      })
    ).toBe(false);
  });

  it('should return false for wrong types', () => {
    expect(
      isTokenResponse({
        accessToken: 123, // should be string
        refreshToken: 'refresh',
        expiresIn: 900,
        tokenType: 'Bearer',
      })
    ).toBe(false);

    expect(
      isTokenResponse({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: '900', // should be number
        tokenType: 'Bearer',
      })
    ).toBe(false);
  });

  it('should narrow type correctly when used as guard', () => {
    const maybeTokens: unknown = {
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      expiresIn: 900,
      tokenType: 'Bearer',
    };

    if (isTokenResponse(maybeTokens)) {
      // TypeScript should now know this is TokenResponse
      expect(maybeTokens.accessToken).toBe('access-123');
      expect(maybeTokens.refreshToken).toBe('refresh-456');
      expect(maybeTokens.expiresIn).toBe(900);
      expect(maybeTokens.tokenType).toBe('Bearer');
    } else {
      throw new Error('Should have matched');
    }
  });
});

describe('authAction', () => {
  describe('type exports', () => {
    it('should export authAction object with expected methods', () => {
      expect(authAction).toBeDefined();
      expect(typeof authAction.fromTokenProcedure).toBe('function');
      expect(typeof authAction.fromLogoutProcedure).toBe('function');
      expect(typeof authAction.fromRefreshProcedure).toBe('function');
    });
  });

  describe('TokenResponse type', () => {
    it('should match expected token response shape', () => {
      const tokens: TokenResponse = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        expiresIn: 900,
        tokenType: 'Bearer',
      };

      expect(tokens.accessToken).toBe('access-token-123');
      expect(tokens.refreshToken).toBe('refresh-token-456');
      expect(tokens.expiresIn).toBe(900);
      expect(tokens.tokenType).toBe('Bearer');
    });
  });

  describe('LoginResponse type', () => {
    it('should match expected login response shape', () => {
      const response: LoginResponse = {
        success: true,
        expiresIn: 900,
      };

      expect(response.success).toBe(true);
      expect(response.expiresIn).toBe(900);
      // Should NOT have token properties (stripped for security)
      expect((response as Record<string, unknown>).accessToken).toBeUndefined();
      expect((response as Record<string, unknown>).refreshToken).toBeUndefined();
    });
  });

  describe('fromTokenProcedure()', () => {
    it('should create a callable function', () => {
      const mockProcedure = {
        handler: async () => ({
          accessToken: 'token',
          refreshToken: 'refresh',
          expiresIn: 900,
          tokenType: 'Bearer',
        }),
        middlewares: [],
        guards: [],
        validators: { input: undefined, output: undefined },
        meta: { name: 'login', type: 'mutation' as const },
      };

      const login = authAction.fromTokenProcedure(mockProcedure as never);
      expect(typeof login).toBe('function');
    });

    it('should accept options with custom cookie names', () => {
      const mockProcedure = {
        handler: async () => ({
          accessToken: 'token',
          refreshToken: 'refresh',
          expiresIn: 900,
          tokenType: 'Bearer',
        }),
        middlewares: [],
        guards: [],
        validators: { input: undefined, output: undefined },
        meta: { name: 'login', type: 'mutation' as const },
      };

      // Should not throw when options are provided
      const login = authAction.fromTokenProcedure(mockProcedure as never, {
        cookies: {
          accessTokenName: 'session',
          refreshTokenName: 'refresh',
          cookieOptions: { sameSite: 'strict' },
        },
        parseFormData: true,
      });

      expect(typeof login).toBe('function');
    });
  });

  describe('fromLogoutProcedure()', () => {
    it('should create a callable function', () => {
      const mockProcedure = {
        handler: async () => ({ success: true }),
        middlewares: [],
        guards: [],
        validators: { input: undefined, output: undefined },
        meta: { name: 'logout', type: 'mutation' as const },
      };

      const logout = authAction.fromLogoutProcedure(mockProcedure as never);
      expect(typeof logout).toBe('function');
    });

    it('should accept options with custom cookie names', () => {
      const mockProcedure = {
        handler: async () => ({ success: true }),
        middlewares: [],
        guards: [],
        validators: { input: undefined, output: undefined },
        meta: { name: 'logout', type: 'mutation' as const },
      };

      const logout = authAction.fromLogoutProcedure(mockProcedure as never, {
        cookies: {
          accessTokenName: 'session',
          refreshTokenName: 'refresh',
        },
      });

      expect(typeof logout).toBe('function');
    });
  });

  describe('fromRefreshProcedure()', () => {
    it('should create a callable function', () => {
      const mockProcedure = {
        handler: async () => ({
          accessToken: 'new-token',
          refreshToken: 'new-refresh',
          expiresIn: 900,
          tokenType: 'Bearer',
        }),
        middlewares: [],
        guards: [],
        validators: { input: undefined, output: undefined },
        meta: { name: 'refresh', type: 'mutation' as const },
      };

      const refresh = authAction.fromRefreshProcedure(mockProcedure as never);
      expect(typeof refresh).toBe('function');
    });
  });

  describe('options handling', () => {
    it('should handle skipGuards option', () => {
      const mockProcedure = {
        handler: async () => ({
          accessToken: 'token',
          refreshToken: 'refresh',
          expiresIn: 900,
          tokenType: 'Bearer',
        }),
        middlewares: [],
        guards: [],
        validators: { input: undefined, output: undefined },
        meta: { name: 'login', type: 'mutation' as const },
      };

      const login = authAction.fromTokenProcedure(mockProcedure as never, {
        skipGuards: true,
      });

      expect(typeof login).toBe('function');
    });

    it('should handle contextExtensions option', () => {
      const mockDb = { user: { findUnique: () => null } };
      const mockProcedure = {
        handler: async () => ({
          accessToken: 'token',
          refreshToken: 'refresh',
          expiresIn: 900,
          tokenType: 'Bearer',
        }),
        middlewares: [],
        guards: [],
        validators: { input: undefined, output: undefined },
        meta: { name: 'login', type: 'mutation' as const },
      };

      const login = authAction.fromTokenProcedure(mockProcedure as never, {
        contextExtensions: { db: mockDb },
      });

      expect(typeof login).toBe('function');
    });
  });
});
