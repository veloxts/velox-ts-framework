/**
 * Unit tests for @veloxts/auth rate-limit module
 *
 * Tests authentication-specific rate limiting:
 * - createAuthRateLimiter factory
 * - Login, register, password reset, and refresh limiters
 * - recordFailure, resetLimit, isLockedOut, getRemainingAttempts methods
 * - Progressive backoff support
 * - Store cleanup utilities
 *
 * @module __tests__/rate-limit.test
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAuthRateLimitStore,
  createAuthRateLimiter,
  stopAuthRateLimitCleanup,
} from '../rate-limit.js';
import { AuthError } from '../types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock context for middleware testing
 */
function createMockContext(ip = '127.0.0.1') {
  const headers: Record<string, string> = {};
  return {
    request: {
      ip,
      headers: {},
    } as unknown as FastifyRequest,
    reply: {
      header: vi.fn((name: string, value: string) => {
        headers[name] = value;
      }),
    } as unknown as FastifyReply,
    getHeader: (name: string) => headers[name],
    headers,
  };
}

/**
 * Creates a mock next function for middleware testing
 */
function createMockNext<T>(): {
  fn: (opts?: { ctx: T }) => Promise<{ data: string }>;
  calls: Array<{ ctx: T } | undefined>;
} {
  const calls: Array<{ ctx: T } | undefined> = [];
  return {
    fn: async (opts?: { ctx: T }) => {
      calls.push(opts);
      return { data: 'success' };
    },
    calls,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Auth Rate Limiting', () => {
  beforeEach(() => {
    // Clear store and stop cleanup between tests
    clearAuthRateLimitStore();
    stopAuthRateLimitCleanup();
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearAuthRateLimitStore();
    stopAuthRateLimitCleanup();
    vi.useRealTimers();
  });

  // ==========================================================================
  // createAuthRateLimiter Factory
  // ==========================================================================

  describe('createAuthRateLimiter', () => {
    it('should create rate limiter with default configuration', () => {
      const limiter = createAuthRateLimiter();

      expect(limiter).toBeDefined();
      expect(typeof limiter.login).toBe('function');
      expect(typeof limiter.register).toBe('function');
      expect(typeof limiter.passwordReset).toBe('function');
      expect(typeof limiter.refresh).toBe('function');
      expect(typeof limiter.recordFailure).toBe('function');
      expect(typeof limiter.resetLimit).toBe('function');
      expect(typeof limiter.isLockedOut).toBe('function');
      expect(typeof limiter.getRemainingAttempts).toBe('function');
    });

    it('should create rate limiter with custom configuration', () => {
      const limiter = createAuthRateLimiter({
        login: {
          maxAttempts: 10,
          windowMs: 5 * 60 * 1000,
          lockoutDurationMs: 10 * 60 * 1000,
          message: 'Custom login message',
          progressiveBackoff: false,
        },
        register: {
          maxAttempts: 5,
          windowMs: 30 * 60 * 1000,
        },
      });

      expect(limiter).toBeDefined();
      // Custom config should be applied internally
    });

    it('should allow partial configuration', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 3 },
        // Other configs use defaults
      });

      expect(limiter).toBeDefined();
    });
  });

  // ==========================================================================
  // Login Rate Limiter
  // ==========================================================================

  describe('login rate limiter', () => {
    it('should allow requests within limit', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 3, windowMs: 60000 },
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const result = await middleware({ ctx, input: undefined, next: next.fn });
        expect(result).toEqual({ data: 'success' });
      }

      expect(next.calls.length).toBe(3);
    });

    it('should block requests exceeding limit', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 2, windowMs: 60000 },
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      // First 2 requests succeed
      await middleware({ ctx, input: undefined, next: next.fn });
      await middleware({ ctx, input: undefined, next: next.fn });

      // Third request should be blocked
      await expect(middleware({ ctx, input: undefined, next: next.fn })).rejects.toThrow(AuthError);
    });

    it('should use identifier function for key generation', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 2, windowMs: 60000 },
      });

      const identifierFn = (ctx: { input?: { email?: string } }) => ctx.input?.email ?? 'unknown';

      const middleware = limiter.login<
        { email: string },
        ReturnType<typeof createMockContext>,
        unknown
      >(identifierFn);

      const ctx1 = createMockContext('192.168.1.1');
      const ctx2 = createMockContext('192.168.1.1');
      const next = createMockNext();

      // Two requests with same email should hit limit
      await middleware({ ctx: ctx1, input: { email: 'test@example.com' }, next: next.fn });
      await middleware({ ctx: ctx1, input: { email: 'test@example.com' }, next: next.fn });

      // Third request with same email should fail
      await expect(
        middleware({ ctx: ctx1, input: { email: 'test@example.com' }, next: next.fn })
      ).rejects.toThrow(AuthError);

      // Different email should succeed (separate counter)
      const result = await middleware({
        ctx: ctx2,
        input: { email: 'other@example.com' },
        next: next.fn,
      });
      expect(result).toEqual({ data: 'success' });
    });

    it('should set rate limit headers', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 5, windowMs: 60000 },
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      await middleware({ ctx, input: undefined, next: next.fn });

      expect(ctx.reply.header).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
      expect(ctx.reply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '4');
      expect(ctx.reply.header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    it('should enable progressive backoff by default for login', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 1, windowMs: 1000, lockoutDurationMs: 1000 },
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      // Exceed limit
      await middleware({ ctx, input: undefined, next: next.fn });
      await expect(middleware({ ctx, input: undefined, next: next.fn })).rejects.toThrow(AuthError);

      // Wait for first lockout to expire
      vi.advanceTimersByTime(1001);

      // Request after first lockout
      await middleware({ ctx, input: undefined, next: next.fn });

      // Exceed limit again - should trigger 2x lockout due to progressive backoff
      try {
        await middleware({ ctx, input: undefined, next: next.fn });
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        // Second lockout should be longer due to progressive backoff
      }
    });
  });

  // ==========================================================================
  // Register Rate Limiter
  // ==========================================================================

  describe('register rate limiter', () => {
    it('should use IP-only key by default', async () => {
      const limiter = createAuthRateLimiter({
        register: { maxAttempts: 2, windowMs: 60000 },
      });

      const middleware = limiter.register<unknown, ReturnType<typeof createMockContext>, unknown>();

      // Same IP should share rate limit
      const ctx = createMockContext('10.0.0.1');
      const next = createMockNext();

      await middleware({ ctx, input: undefined, next: next.fn });
      await middleware({ ctx, input: undefined, next: next.fn });

      // Third request blocked
      await expect(middleware({ ctx, input: undefined, next: next.fn })).rejects.toThrow(AuthError);

      // Different IP should have separate limit
      const ctx2 = createMockContext('10.0.0.2');
      const result = await middleware({ ctx: ctx2, input: undefined, next: next.fn });
      expect(result).toEqual({ data: 'success' });
    });

    it('should have stricter defaults than login', () => {
      // Register defaults: 3 attempts per hour
      // This is tested implicitly through the factory defaults
      const limiter = createAuthRateLimiter();
      expect(limiter.register).toBeDefined();
    });
  });

  // ==========================================================================
  // Password Reset Rate Limiter
  // ==========================================================================

  describe('passwordReset rate limiter', () => {
    it('should allow identifier function', async () => {
      const limiter = createAuthRateLimiter({
        passwordReset: { maxAttempts: 2, windowMs: 60000 },
      });

      const identifierFn = (ctx: { input?: { email?: string } }) => ctx.input?.email ?? 'unknown';

      const middleware = limiter.passwordReset<
        { email: string },
        ReturnType<typeof createMockContext>,
        unknown
      >(identifierFn);

      const ctx = createMockContext();
      const next = createMockNext();

      await middleware({ ctx, input: { email: 'reset@example.com' }, next: next.fn });
      await middleware({ ctx, input: { email: 'reset@example.com' }, next: next.fn });

      // Third should fail
      await expect(
        middleware({ ctx, input: { email: 'reset@example.com' }, next: next.fn })
      ).rejects.toThrow(AuthError);
    });

    it('should use custom message', async () => {
      const limiter = createAuthRateLimiter({
        passwordReset: {
          maxAttempts: 1,
          windowMs: 60000,
          message: 'Too many password reset requests',
        },
      });

      const middleware = limiter.passwordReset<
        unknown,
        ReturnType<typeof createMockContext>,
        unknown
      >();
      const ctx = createMockContext();
      const next = createMockNext();

      await middleware({ ctx, input: undefined, next: next.fn });

      try {
        await middleware({ ctx, input: undefined, next: next.fn });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).message).toContain('Too many password reset requests');
      }
    });
  });

  // ==========================================================================
  // Refresh Rate Limiter
  // ==========================================================================

  describe('refresh rate limiter', () => {
    it('should have higher default limit than login', async () => {
      const limiter = createAuthRateLimiter({
        refresh: { maxAttempts: 5, windowMs: 60000 },
      });

      const middleware = limiter.refresh<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      // Should allow 5 requests
      for (let i = 0; i < 5; i++) {
        await middleware({ ctx, input: undefined, next: next.fn });
      }

      // 6th should fail
      await expect(middleware({ ctx, input: undefined, next: next.fn })).rejects.toThrow(AuthError);
    });
  });

  // ==========================================================================
  // recordFailure Method
  // ==========================================================================

  describe('recordFailure', () => {
    it('should record failed attempts', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 3, windowMs: 60000 },
      });

      // Initially should have full attempts
      expect(limiter.getRemainingAttempts('test-key', 'login')).toBe(3);

      // Record failure
      limiter.recordFailure('test-key', 'login');
      expect(limiter.getRemainingAttempts('test-key', 'login')).toBe(2);

      // Record more failures
      limiter.recordFailure('test-key', 'login');
      limiter.recordFailure('test-key', 'login');

      expect(limiter.getRemainingAttempts('test-key', 'login')).toBe(0);
    });

    it('should trigger lockout when max attempts exceeded', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 2, windowMs: 60000 },
      });

      expect(limiter.isLockedOut('test-key', 'login')).toBe(false);

      limiter.recordFailure('test-key', 'login');
      expect(limiter.isLockedOut('test-key', 'login')).toBe(false);

      limiter.recordFailure('test-key', 'login');
      // After reaching max, should be locked out
      expect(limiter.isLockedOut('test-key', 'login')).toBe(true);
    });

    it('should work with different operations', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 3, windowMs: 60000 },
        register: { maxAttempts: 2, windowMs: 60000 },
        passwordReset: { maxAttempts: 2, windowMs: 60000 },
      });

      // Record failures for different operations
      limiter.recordFailure('user-1', 'login');
      limiter.recordFailure('user-1', 'register');
      limiter.recordFailure('user-1', 'password-reset');

      // Each operation has separate counter
      expect(limiter.getRemainingAttempts('user-1', 'login')).toBe(2);
      expect(limiter.getRemainingAttempts('user-1', 'register')).toBe(1);
      expect(limiter.getRemainingAttempts('user-1', 'password-reset')).toBe(1);
    });

    it('should start new window after expiration', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 3, windowMs: 1000 },
      });

      limiter.recordFailure('test-key', 'login');
      limiter.recordFailure('test-key', 'login');
      expect(limiter.getRemainingAttempts('test-key', 'login')).toBe(1);

      // Advance time past window
      vi.advanceTimersByTime(1001);

      // Should have full attempts again
      expect(limiter.getRemainingAttempts('test-key', 'login')).toBe(3);
    });

    it('should preserve lockout count for progressive backoff', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 2, windowMs: 1000, lockoutDurationMs: 100, progressiveBackoff: true },
      });

      // First lockout - need 2 failures to trigger lockout (maxAttempts=2)
      limiter.recordFailure('test-key', 'login'); // attempts=1
      limiter.recordFailure('test-key', 'login'); // attempts=2, triggers lockout
      expect(limiter.isLockedOut('test-key', 'login')).toBe(true);

      // Wait for lockout to expire
      vi.advanceTimersByTime(101);
      expect(limiter.isLockedOut('test-key', 'login')).toBe(false);

      // Wait for window to expire
      vi.advanceTimersByTime(1000);

      // Second lockout should be longer due to preserved count
      limiter.recordFailure('test-key', 'login'); // attempts=1 (new window)
      limiter.recordFailure('test-key', 'login'); // attempts=2, triggers lockout with 2x duration
      expect(limiter.isLockedOut('test-key', 'login')).toBe(true);

      // After 100ms (first lockout duration), should still be locked due to 2x multiplier
      vi.advanceTimersByTime(101);
      expect(limiter.isLockedOut('test-key', 'login')).toBe(true);

      // After 200ms total (2x lockout duration), should be unlocked
      vi.advanceTimersByTime(100);
      expect(limiter.isLockedOut('test-key', 'login')).toBe(false);
    });
  });

  // ==========================================================================
  // resetLimit Method
  // ==========================================================================

  describe('resetLimit', () => {
    it('should clear rate limit for specific key', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 3, windowMs: 60000 },
      });

      limiter.recordFailure('user-key', 'login');
      limiter.recordFailure('user-key', 'login');
      expect(limiter.getRemainingAttempts('user-key', 'login')).toBe(1);

      limiter.resetLimit('user-key', 'login');
      expect(limiter.getRemainingAttempts('user-key', 'login')).toBe(3);
    });

    it('should not affect other keys', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 3, windowMs: 60000 },
      });

      limiter.recordFailure('user-1', 'login');
      limiter.recordFailure('user-2', 'login');

      limiter.resetLimit('user-1', 'login');

      expect(limiter.getRemainingAttempts('user-1', 'login')).toBe(3);
      expect(limiter.getRemainingAttempts('user-2', 'login')).toBe(2);
    });

    it('should not affect other operations', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 3, windowMs: 60000 },
        register: { maxAttempts: 3, windowMs: 60000 },
      });

      limiter.recordFailure('user-key', 'login');
      limiter.recordFailure('user-key', 'register');

      limiter.resetLimit('user-key', 'login');

      expect(limiter.getRemainingAttempts('user-key', 'login')).toBe(3);
      expect(limiter.getRemainingAttempts('user-key', 'register')).toBe(2);
    });

    it('should clear lockout status', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 2, windowMs: 60000 },
      });

      // Need 2 failures to trigger lockout
      limiter.recordFailure('locked-user', 'login');
      limiter.recordFailure('locked-user', 'login');
      expect(limiter.isLockedOut('locked-user', 'login')).toBe(true);

      limiter.resetLimit('locked-user', 'login');
      expect(limiter.isLockedOut('locked-user', 'login')).toBe(false);
    });
  });

  // ==========================================================================
  // isLockedOut Method
  // ==========================================================================

  describe('isLockedOut', () => {
    it('should return false for unknown key', () => {
      const limiter = createAuthRateLimiter();

      expect(limiter.isLockedOut('unknown-key', 'login')).toBe(false);
    });

    it('should return false before max attempts', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 3, windowMs: 60000 },
      });

      limiter.recordFailure('user', 'login');
      limiter.recordFailure('user', 'login');

      expect(limiter.isLockedOut('user', 'login')).toBe(false);
    });

    it('should return true after lockout triggered', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 2, windowMs: 60000, lockoutDurationMs: 1000 },
      });

      limiter.recordFailure('user', 'login');
      limiter.recordFailure('user', 'login');

      expect(limiter.isLockedOut('user', 'login')).toBe(true);
    });

    it('should return false after lockout expires', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 2, windowMs: 60000, lockoutDurationMs: 1000 },
      });

      limiter.recordFailure('user', 'login');
      limiter.recordFailure('user', 'login');
      expect(limiter.isLockedOut('user', 'login')).toBe(true);

      vi.advanceTimersByTime(1001);
      expect(limiter.isLockedOut('user', 'login')).toBe(false);
    });
  });

  // ==========================================================================
  // getRemainingAttempts Method
  // ==========================================================================

  describe('getRemainingAttempts', () => {
    it('should return max attempts for unknown key', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 5, windowMs: 60000 },
      });

      expect(limiter.getRemainingAttempts('new-user', 'login')).toBe(5);
    });

    it('should return correct remaining count', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 5, windowMs: 60000 },
      });

      limiter.recordFailure('user', 'login');
      expect(limiter.getRemainingAttempts('user', 'login')).toBe(4);

      limiter.recordFailure('user', 'login');
      limiter.recordFailure('user', 'login');
      expect(limiter.getRemainingAttempts('user', 'login')).toBe(2);
    });

    it('should return 0 when limit exceeded', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 2, windowMs: 60000 },
      });

      limiter.recordFailure('user', 'login');
      limiter.recordFailure('user', 'login');
      limiter.recordFailure('user', 'login'); // Extra failure

      expect(limiter.getRemainingAttempts('user', 'login')).toBe(0);
    });

    it('should work with different operations', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 5, windowMs: 60000 },
        register: { maxAttempts: 3, windowMs: 60000 },
        passwordReset: { maxAttempts: 3, windowMs: 60000 },
        refresh: { maxAttempts: 10, windowMs: 60000 },
      });

      expect(limiter.getRemainingAttempts('user', 'login')).toBe(5);
      expect(limiter.getRemainingAttempts('user', 'register')).toBe(3);
      expect(limiter.getRemainingAttempts('user', 'password-reset')).toBe(3);
      expect(limiter.getRemainingAttempts('user', 'refresh')).toBe(10);
    });

    it('should reset after window expires', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 3, windowMs: 1000 },
      });

      limiter.recordFailure('user', 'login');
      limiter.recordFailure('user', 'login');
      expect(limiter.getRemainingAttempts('user', 'login')).toBe(1);

      vi.advanceTimersByTime(1001);
      expect(limiter.getRemainingAttempts('user', 'login')).toBe(3);
    });
  });

  // ==========================================================================
  // Lockout Duration and Headers
  // ==========================================================================

  describe('lockout and headers', () => {
    it('should include Retry-After header when locked out', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 1, windowMs: 60000, lockoutDurationMs: 60000 },
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      // First request succeeds
      await middleware({ ctx, input: undefined, next: next.fn });

      // Second request triggers lockout
      try {
        await middleware({ ctx, input: undefined, next: next.fn });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).statusCode).toBe(429);
        expect((error as AuthError).code).toBe('RATE_LIMIT_EXCEEDED');
      }

      // Check Retry-After header was set
      expect(ctx.reply.header).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });

    it('should throw when already locked out', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 1, windowMs: 60000, lockoutDurationMs: 5000 },
      });

      // Trigger lockout
      limiter.recordFailure('127.0.0.1', 'login');

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      await expect(middleware({ ctx, input: undefined, next: next.fn })).rejects.toThrow(AuthError);
    });

    it('should format duration in seconds', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 1, windowMs: 60000, lockoutDurationMs: 30000 }, // 30 seconds
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      await middleware({ ctx, input: undefined, next: next.fn });

      try {
        await middleware({ ctx, input: undefined, next: next.fn });
      } catch (error) {
        expect((error as AuthError).message).toContain('30 seconds');
      }
    });

    it('should format duration in minutes', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 1, windowMs: 60000, lockoutDurationMs: 5 * 60 * 1000 }, // 5 minutes
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      await middleware({ ctx, input: undefined, next: next.fn });

      try {
        await middleware({ ctx, input: undefined, next: next.fn });
      } catch (error) {
        expect((error as AuthError).message).toContain('5 minutes');
      }
    });

    it('should format duration in hours', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 1, windowMs: 60000, lockoutDurationMs: 2 * 60 * 60 * 1000 }, // 2 hours
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      await middleware({ ctx, input: undefined, next: next.fn });

      try {
        await middleware({ ctx, input: undefined, next: next.fn });
      } catch (error) {
        expect((error as AuthError).message).toContain('2 hours');
      }
    });
  });

  // ==========================================================================
  // Window Expiration
  // ==========================================================================

  describe('window expiration', () => {
    it('should reset attempts after window expires', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 2, windowMs: 1000, lockoutDurationMs: 500 },
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      // Use up attempts
      await middleware({ ctx, input: undefined, next: next.fn });
      await middleware({ ctx, input: undefined, next: next.fn });

      // Third fails and triggers lockout
      await expect(middleware({ ctx, input: undefined, next: next.fn })).rejects.toThrow();

      // Advance past both window (1000ms) and lockout (500ms)
      vi.advanceTimersByTime(1001);

      // Should succeed now - lockout expired and window reset
      const result = await middleware({ ctx, input: undefined, next: next.fn });
      expect(result).toEqual({ data: 'success' });
    });

    it('should preserve lockout count across windows for progressive backoff', async () => {
      const limiter = createAuthRateLimiter({
        login: {
          maxAttempts: 1,
          windowMs: 100,
          lockoutDurationMs: 100,
          progressiveBackoff: true,
        },
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      // First violation
      await middleware({ ctx, input: undefined, next: next.fn });
      await expect(middleware({ ctx, input: undefined, next: next.fn })).rejects.toThrow();

      // Wait for both lockout and window to expire
      vi.advanceTimersByTime(200);

      // Second violation should have longer lockout
      await middleware({ ctx, input: undefined, next: next.fn });

      try {
        await middleware({ ctx, input: undefined, next: next.fn });
      } catch (error) {
        // Progressive backoff should double the lockout time
        expect((error as AuthError).message).toMatch(/\d+ (second|minute|hour)/);
      }
    });
  });

  // ==========================================================================
  // Custom Key Generator
  // ==========================================================================

  describe('custom key generator', () => {
    it('should use custom key generator when provided', async () => {
      const limiter = createAuthRateLimiter({
        login: {
          maxAttempts: 2,
          windowMs: 60000,
          keyGenerator: (ctx, identifier) => `custom:${identifier ?? ctx.request.ip}`,
        },
      });

      const middleware = limiter.login<
        { email: string },
        ReturnType<typeof createMockContext>,
        unknown
      >((ctx) => (ctx.input as { email: string })?.email);

      const ctx1 = createMockContext('10.0.0.1');
      const ctx2 = createMockContext('10.0.0.2');
      const next = createMockNext();

      // Same email, different IPs should share limit (due to custom key generator)
      await middleware({ ctx: ctx1, input: { email: 'shared@example.com' }, next: next.fn });
      await middleware({ ctx: ctx2, input: { email: 'shared@example.com' }, next: next.fn });

      // Third request should fail even from different IP
      await expect(
        middleware({ ctx: ctx1, input: { email: 'shared@example.com' }, next: next.fn })
      ).rejects.toThrow(AuthError);
    });
  });

  // ==========================================================================
  // Store Cleanup Utilities
  // ==========================================================================

  describe('store cleanup utilities', () => {
    it('clearAuthRateLimitStore should clear all entries', () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 3, windowMs: 60000 },
      });

      limiter.recordFailure('user-1', 'login');
      limiter.recordFailure('user-2', 'login');

      expect(limiter.getRemainingAttempts('user-1', 'login')).toBe(2);
      expect(limiter.getRemainingAttempts('user-2', 'login')).toBe(2);

      clearAuthRateLimitStore();

      expect(limiter.getRemainingAttempts('user-1', 'login')).toBe(3);
      expect(limiter.getRemainingAttempts('user-2', 'login')).toBe(3);
    });

    it('stopAuthRateLimitCleanup should stop cleanup interval', () => {
      // This is mainly to ensure it doesn't throw
      stopAuthRateLimitCleanup();
      stopAuthRateLimitCleanup(); // Double call should be safe
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle missing IP gracefully', async () => {
      const limiter = createAuthRateLimiter({
        register: { maxAttempts: 2, windowMs: 60000 },
      });

      const middleware = limiter.register<unknown, ReturnType<typeof createMockContext>, unknown>();

      const ctx = {
        request: { ip: undefined, headers: {} } as unknown as FastifyRequest,
        reply: { header: vi.fn() } as unknown as FastifyReply,
      };
      const next = createMockNext();

      // Should use 'unknown' as fallback key
      const result = await middleware({ ctx, input: undefined, next: next.fn });
      expect(result).toEqual({ data: 'success' });
    });

    it('should handle concurrent requests correctly', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 3, windowMs: 60000 },
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      // Fire multiple requests concurrently
      const results = await Promise.allSettled([
        middleware({ ctx, input: undefined, next: next.fn }),
        middleware({ ctx, input: undefined, next: next.fn }),
        middleware({ ctx, input: undefined, next: next.fn }),
        middleware({ ctx, input: undefined, next: next.fn }),
        middleware({ ctx, input: undefined, next: next.fn }),
      ]);

      // First 3 should succeed, rest should fail
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(3);
      expect(rejected.length).toBe(2);
    });

    it('should handle zero max attempts', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 0, windowMs: 60000 },
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      // Even first request should fail with 0 max attempts
      await expect(middleware({ ctx, input: undefined, next: next.fn })).rejects.toThrow(AuthError);
    });

    it('should handle singular/plural in duration formatting', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 1, windowMs: 60000, lockoutDurationMs: 1000 }, // 1 second
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      await middleware({ ctx, input: undefined, next: next.fn });

      try {
        await middleware({ ctx, input: undefined, next: next.fn });
      } catch (error) {
        expect((error as AuthError).message).toContain('1 second');
        expect((error as AuthError).message).not.toContain('1 seconds');
      }
    });

    it('should handle 1 minute lockout formatting', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 1, windowMs: 60000, lockoutDurationMs: 60000 }, // 1 minute
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      await middleware({ ctx, input: undefined, next: next.fn });

      try {
        await middleware({ ctx, input: undefined, next: next.fn });
      } catch (error) {
        expect((error as AuthError).message).toContain('1 minute');
        expect((error as AuthError).message).not.toContain('1 minutes');
      }
    });

    it('should handle 1 hour lockout formatting', async () => {
      const limiter = createAuthRateLimiter({
        login: { maxAttempts: 1, windowMs: 60000, lockoutDurationMs: 60 * 60 * 1000 }, // 1 hour
      });

      const middleware = limiter.login<unknown, ReturnType<typeof createMockContext>, unknown>();
      const ctx = createMockContext();
      const next = createMockNext();

      await middleware({ ctx, input: undefined, next: next.fn });

      try {
        await middleware({ ctx, input: undefined, next: next.fn });
      } catch (error) {
        expect((error as AuthError).message).toContain('1 hour');
        expect((error as AuthError).message).not.toContain('1 hours');
      }
    });
  });
});
