# VeloxTS Framework - Test Development Guide

> **Deprecated:** This document is no longer maintained. Please refer to the official documentation at [veloxts.dev/docs](https://www.veloxts.dev/docs/).

This guide provides concrete examples and patterns for adding tests to close coverage gaps identified in the coverage report.

## Quick Reference: Testing Patterns

### Unit Test Template

```typescript
import { describe, it, expect } from 'vitest';

describe('ComponentName', () => {
  describe('methodName', () => {
    it('should handle the happy path', () => {
      // Arrange
      const input = createValidInput();

      // Act
      const result = methodName(input);

      // Assert
      expect(result).toMatchObject({ expected: 'value' });
    });

    it('should throw error for invalid input', () => {
      // Arrange
      const invalidInput = createInvalidInput();

      // Act & Assert
      expect(() => methodName(invalidInput)).toThrow(ExpectedError);
    });
  });
});
```

### Integration Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ComponentName - Integration', () => {
  let app: VeloxApp;

  beforeEach(async () => {
    app = await veloxApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should handle full request lifecycle', async () => {
    // Arrange
    const request = createTestRequest();

    // Act
    const response = await app.inject(request);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ expected: 'data' });
  });
});
```

### Type Test Template (using tsd)

```typescript
import { expectType, expectError } from 'tsd';
import type { InferredType } from '../types.js';

// Test type inference
const result = someFunction({ input: 'value' });
expectType<InferredType>(result);

// Test that invalid usage produces errors
expectError(someFunction('invalid'));
```

## Priority 1: GuardError Tests (Router Package)

### File: `/Users/alainduchesneau/Projets/@veloxts/packages/router/src/__tests__/errors.test.ts`

**Goal**: Increase errors.ts coverage from 14.28% to 100%

**Current Gap**: Lines 77-93 uncovered (GuardError class)

```typescript
import { describe, it, expect } from 'vitest';
import { GuardError, isGuardError } from '../errors.js';
import { VeloxError } from '@veloxts/core';

describe('GuardError', () => {
  describe('constructor', () => {
    it('should create GuardError with default 403 status code', () => {
      const error = new GuardError('authenticated', 'Authentication required');

      expect(error).toBeInstanceOf(GuardError);
      expect(error).toBeInstanceOf(VeloxError);
      expect(error.name).toBe('GuardError');
      expect(error.guardName).toBe('authenticated');
      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('GUARD_FAILED');
    });

    it('should create GuardError with custom status code', () => {
      const error = new GuardError('authenticated', 'Not authenticated', 401);

      expect(error.statusCode).toBe(401);
      expect(error.guardName).toBe('authenticated');
      expect(error.message).toBe('Not authenticated');
    });

    it('should create GuardError for role check failure', () => {
      const error = new GuardError('hasRole', 'Requires admin role', 403);

      expect(error.guardName).toBe('hasRole');
      expect(error.message).toBe('Requires admin role');
      expect(error.statusCode).toBe(403);
    });

    it('should have proper stack trace', () => {
      const error = new GuardError('test', 'Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('GuardError');
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON with all required fields', () => {
      const error = new GuardError('authenticated', 'Auth required', 401);
      const json = error.toJSON();

      expect(json).toEqual({
        error: 'GuardError',
        message: 'Auth required',
        statusCode: 401,
        code: 'GUARD_FAILED',
        guardName: 'authenticated',
      });
    });

    it('should serialize to JSON with 403 status when using default', () => {
      const error = new GuardError('hasPermission', 'Insufficient permissions');
      const json = error.toJSON();

      expect(json.statusCode).toBe(403);
      expect(json.guardName).toBe('hasPermission');
    });

    it('should preserve guardName in JSON serialization', () => {
      const error = new GuardError('customGuard', 'Custom error');
      const json = error.toJSON();

      expect(json.guardName).toBe('customGuard');
      expect(json.code).toBe('GUARD_FAILED');
    });
  });

  describe('isGuardError type guard', () => {
    it('should return true for GuardError instances', () => {
      const error = new GuardError('test', 'Test');

      expect(isGuardError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');

      expect(isGuardError(error)).toBe(false);
    });

    it('should return false for VeloxError', () => {
      const error = new VeloxError('VeloxError message', 500, 'INTERNAL_ERROR');

      expect(isGuardError(error)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isGuardError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isGuardError(undefined)).toBe(false);
    });

    it('should return false for plain objects', () => {
      const obj = { guardName: 'fake', message: 'fake' };

      expect(isGuardError(obj)).toBe(false);
    });

    it('should return false for strings', () => {
      expect(isGuardError('error string')).toBe(false);
    });
  });

  describe('inheritance', () => {
    it('should extend VeloxError', () => {
      const error = new GuardError('test', 'Test');

      expect(error instanceof VeloxError).toBe(true);
    });

    it('should extend Error', () => {
      const error = new GuardError('test', 'Test');

      expect(error instanceof Error).toBe(true);
    });

    it('should have GuardError as constructor name', () => {
      const error = new GuardError('test', 'Test');

      expect(error.constructor.name).toBe('GuardError');
    });
  });
});
```

**Expected Coverage Improvement**: 14.28% → 100% (85.72% gain)

**Estimated Time**: 1-2 hours

## Priority 2: Rate Limiting Tests (Auth Package)

### File: `/Users/alainduchesneau/Projets/@veloxts/packages/auth/src/__tests__/rate-limit.test.ts`

**Goal**: Increase rate-limit.ts coverage from 36.73% to 80%+

**Current Gap**: Lines 80-148, 186-192, 355, 394-499 uncovered

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { veloxApp } from '@veloxts/core';
import { procedure, procedures } from '@veloxts/router';
import { z } from 'zod';
import {
  createAuthRateLimiter,
  createLoginRateLimiter,
  createPasswordResetRateLimiter,
} from '../rate-limit.js';

describe('Auth Rate Limiting', () => {
  let app: Awaited<ReturnType<typeof veloxApp>>;

  beforeEach(async () => {
    app = await veloxApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('createLoginRateLimiter', () => {
    it('should allow requests under the limit', async () => {
      const rateLimiter = createLoginRateLimiter({
        maxAttempts: 5,
        windowMs: 60000,
      });

      const loginProcedure = procedure
        .use(rateLimiter)
        .input(z.object({ email: z.string().email() }))
        .mutation(async ({ input }) => ({ success: true }));

      const authProcedures = procedures('auth', {
        login: loginProcedure,
      });

      app.registerProcedures(procedures);

      // First 5 attempts should succeed
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: 'test@example.com' },
        });

        expect(response.statusCode).toBe(200);
      }
    });

    it('should block requests exceeding the limit', async () => {
      const rateLimiter = createLoginRateLimiter({
        maxAttempts: 3,
        windowMs: 60000,
      });

      const loginProcedure = procedure
        .use(rateLimiter)
        .input(z.object({ email: z.string().email() }))
        .mutation(async ({ input }) => ({ success: true }));

      const authProcedures = procedures('auth', {
        login: loginProcedure,
      });

      app.registerProcedures(procedures);

      // First 3 attempts should succeed
      for (let i = 0; i < 3; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: 'test@example.com' },
        });

        expect(response.statusCode).toBe(200);
      }

      // 4th attempt should be rate limited
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com' },
      });

      expect(response.statusCode).toBe(429);
      expect(response.json()).toMatchObject({
        error: expect.stringContaining('Too many'),
      });
    });

    it('should track attempts per email+IP combination', async () => {
      const rateLimiter = createLoginRateLimiter({
        maxAttempts: 2,
        windowMs: 60000,
      });

      const loginProcedure = procedure
        .use(rateLimiter)
        .input(z.object({ email: z.string().email() }))
        .mutation(async ({ input }) => ({ success: true }));

      const authProcedures = procedures('auth', {
        login: loginProcedure,
      });

      app.registerProcedures(procedures);

      // Different emails should have separate limits
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'user1@example.com' },
        headers: { 'x-forwarded-for': '1.1.1.1' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'user1@example.com' },
        headers: { 'x-forwarded-for': '1.1.1.1' },
      });

      // user1 from same IP is now at limit
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'user1@example.com' },
        headers: { 'x-forwarded-for': '1.1.1.1' },
      });
      expect(response1.statusCode).toBe(429);

      // user2 from same IP should still work
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'user2@example.com' },
        headers: { 'x-forwarded-for': '1.1.1.1' },
      });
      expect(response2.statusCode).toBe(200);
    });

    it('should reset after window expires', async () => {
      vi.useFakeTimers();

      const rateLimiter = createLoginRateLimiter({
        maxAttempts: 2,
        windowMs: 1000, // 1 second window
      });

      const loginProcedure = procedure
        .use(rateLimiter)
        .input(z.object({ email: z.string().email() }))
        .mutation(async ({ input }) => ({ success: true }));

      const authProcedures = procedures('auth', {
        login: loginProcedure,
      });

      app.registerProcedures(procedures);

      // Hit the limit
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com' },
      });

      // Should be rate limited
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com' },
      });
      expect(response1.statusCode).toBe(429);

      // Advance time past window
      vi.advanceTimersByTime(1100);

      // Should work again
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com' },
      });
      expect(response2.statusCode).toBe(200);

      vi.useRealTimers();
    });
  });

  describe('createPasswordResetRateLimiter', () => {
    it('should have stricter limits than login', async () => {
      const rateLimiter = createPasswordResetRateLimiter();

      const resetProcedure = procedure
        .use(rateLimiter)
        .input(z.object({ email: z.string().email() }))
        .mutation(async ({ input }) => ({ success: true }));

      const authProcedures = procedures('auth', {
        resetPassword: resetProcedure,
      });

      app.registerProcedures(procedures);

      // Should have lower limit than login
      // Attempt multiple requests
      const responses = [];
      for (let i = 0; i < 10; i++) {
        responses.push(
          await app.inject({
            method: 'POST',
            url: '/api/auth/reset-password',
            payload: { email: 'test@example.com' },
          })
        );
      }

      // At least one should be rate limited
      const rateLimited = responses.some((r) => r.statusCode === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('Account Lockout', () => {
    it('should lock account after max attempts exceeded', async () => {
      const rateLimiter = createLoginRateLimiter({
        maxAttempts: 3,
        lockoutDurationMs: 5000,
      });

      const loginProcedure = procedure
        .use(rateLimiter)
        .input(z.object({ email: z.string().email(), password: z.string() }))
        .mutation(async ({ input }) => {
          // Simulate failed login
          throw new Error('Invalid credentials');
        });

      const authProcedures = procedures('auth', {
        login: loginProcedure,
      });

      app.registerProcedures(procedures);

      // Exceed max attempts
      for (let i = 0; i < 3; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: 'test@example.com', password: 'wrong' },
        });
      }

      // Next attempt should indicate account lockout
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'correct' },
      });

      expect(response.statusCode).toBe(429);
      expect(response.json().error).toContain('locked');
    });

    it('should unlock account after lockout duration', async () => {
      vi.useFakeTimers();

      const rateLimiter = createLoginRateLimiter({
        maxAttempts: 2,
        lockoutDurationMs: 1000,
      });

      const loginProcedure = procedure
        .use(rateLimiter)
        .input(z.object({ email: z.string().email() }))
        .mutation(async ({ input }) => ({ success: true }));

      const authProcedures = procedures('auth', {
        login: loginProcedure,
      });

      app.registerProcedures(procedures);

      // Lock the account
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com' },
      });
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com' },
      });
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com' },
      });

      // Advance past lockout duration
      vi.advanceTimersByTime(1100);

      // Should work again
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com' },
      });

      expect(response.statusCode).toBe(200);

      vi.useRealTimers();
    });
  });

  describe('Custom Key Generator', () => {
    it('should use custom key generator when provided', async () => {
      const rateLimiter = createAuthRateLimiter({
        maxAttempts: 2,
        keyGenerator: (ctx, identifier) => {
          // Only use email, ignore IP
          return identifier || 'anonymous';
        },
      });

      const procedure1 = procedure
        .use(rateLimiter)
        .input(z.object({ email: z.string() }))
        .mutation(async ({ input }) => ({ success: true }));

      const authProcedures = procedures('auth', {
        action: procedure1,
      });

      app.registerProcedures(procedures);

      // Hit limit from IP 1
      await app.inject({
        method: 'POST',
        url: '/api/auth/action',
        payload: { email: 'test@example.com' },
        headers: { 'x-forwarded-for': '1.1.1.1' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/auth/action',
        payload: { email: 'test@example.com' },
        headers: { 'x-forwarded-for': '1.1.1.1' },
      });

      // Should be rate limited from different IP too (only email matters)
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/action',
        payload: { email: 'test@example.com' },
        headers: { 'x-forwarded-for': '2.2.2.2' },
      });

      expect(response.statusCode).toBe(429);
    });
  });

  describe('Memory Store Cleanup', () => {
    it('should clean up expired entries', async () => {
      vi.useFakeTimers();

      const rateLimiter = createAuthRateLimiter({
        maxAttempts: 5,
        windowMs: 1000,
      });

      // Create many entries
      const emails = Array.from({ length: 100 }, (_, i) => `user${i}@example.com`);

      const testProcedure = procedure
        .use(rateLimiter)
        .input(z.object({ email: z.string() }))
        .mutation(async ({ input }) => ({ success: true }));

      const testProcedures = procedures('test', {
        action: testProcedure,
      });

      app.registerProcedures(procedures);

      // Create entries
      for (const email of emails) {
        await app.inject({
          method: 'POST',
          url: '/api/test/action',
          payload: { email },
        });
      }

      // Advance past window
      vi.advanceTimersByTime(2000);

      // Trigger cleanup by making a new request
      await app.inject({
        method: 'POST',
        url: '/api/test/action',
        payload: { email: 'cleanup-trigger@example.com' },
      });

      // All old entries should be cleanable now
      // (Implementation specific - may need to expose cleanup method for testing)

      vi.useRealTimers();
    });
  });
});
```

**Expected Coverage Improvement**: 36.73% → 80%+ (43%+ gain)

**Estimated Time**: 4-6 hours

## Priority 3: Auth Plugin Tests

### File: `/Users/alainduchesneau/Projets/@veloxts/packages/auth/src/__tests__/plugin.test.ts`

**Goal**: Increase plugin.ts coverage from 66.66% to 85%+

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { veloxApp } from '@veloxts/core';
import { authPlugin } from '../plugin.js';
import { jwtManager } from '../jwt.js';

describe('Auth Plugin', () => {
  let app: Awaited<ReturnType<typeof veloxApp>>;

  beforeEach(() => {
    app = await veloxApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Plugin Registration', () => {
    it('should register with JWT configuration', async () => {
      const jwt = jwtManager({
        secret: 'test-secret-at-least-32-chars-long',
        refreshSecret: 'refresh-secret-at-least-32-chars',
      });

      await app.register(authPlugin, {
        jwt,
      });

      await app.ready();

      // Should add auth to context
      expect(app).toBeDefined();
    });

    it('should register with session configuration', async () => {
      await app.register(authPlugin, {
        session: {
          secret: 'session-secret-at-least-32-chars-long',
          cookie: {
            name: 'test-session',
            secure: false,
          },
        },
      });

      await app.ready();

      expect(app).toBeDefined();
    });

    it('should register with both JWT and session', async () => {
      const jwt = jwtManager({
        secret: 'test-secret-at-least-32-chars-long',
        refreshSecret: 'refresh-secret-at-least-32-chars',
      });

      await app.register(authPlugin, {
        jwt,
        session: {
          secret: 'session-secret-at-least-32-chars-long',
        },
      });

      await app.ready();

      expect(app).toBeDefined();
    });

    it('should throw error for invalid JWT secret (too short)', async () => {
      await expect(async () => {
        await app.register(authPlugin, {
          jwt: jwtManager({
            secret: 'short',
            refreshSecret: 'also-short',
          }),
        });
        await app.ready();
      }).rejects.toThrow();
    });

    it('should throw error for invalid session secret', async () => {
      await expect(async () => {
        await app.register(authPlugin, {
          session: {
            secret: 'too-short',
          },
        });
        await app.ready();
      }).rejects.toThrow();
    });

    it('should accept custom user loader', async () => {
      const customUserLoader = async (userId: string) => ({
        id: userId,
        email: 'test@example.com',
        role: 'user',
      });

      await app.register(authPlugin, {
        session: {
          secret: 'session-secret-at-least-32-chars-long',
          userLoader: customUserLoader,
        },
      });

      await app.ready();

      expect(app).toBeDefined();
    });
  });

  describe('Plugin Integration', () => {
    it('should extend context with auth methods', async () => {
      const jwt = jwtManager({
        secret: 'test-secret-at-least-32-chars-long',
        refreshSecret: 'refresh-secret-at-least-32-chars',
      });

      await app.register(authPlugin, { jwt });

      const testProcedures = procedures('test', {
        checkAuth: procedure().query(async ({ ctx }) => {
          // Context should have auth-related properties
          return {
            hasAuth: 'auth' in ctx || 'user' in ctx,
          };
        }),
      });

      app.registerProcedures(procedures);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/test/check-auth',
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
```

**Expected Coverage Improvement**: 66.66% → 85%+ (18%+ gain)

**Estimated Time**: 3-4 hours

## Testing Best Practices for VeloxTS

### 1. Type Safety in Tests

```typescript
// ❌ BAD: Using any
const result: any = procedure().input(schema);

// ✅ GOOD: Let TypeScript infer or use proper types
const result = procedure().input(schema);
expectType<{ id: string }>(result._input);
```

### 2. Async Test Patterns

```typescript
// ✅ GOOD: Proper async/await usage
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

// ✅ GOOD: Testing promise rejections
it('should reject with error', async () => {
  await expect(asyncFunction()).rejects.toThrow(ExpectedError);
});
```

### 3. Mock Timers for Time-Dependent Tests

```typescript
import { vi } from 'vitest';

it('should expire after timeout', () => {
  vi.useFakeTimers();

  const callback = vi.fn();
  setTimeout(callback, 1000);

  vi.advanceTimersByTime(1000);
  expect(callback).toHaveBeenCalled();

  vi.useRealTimers();
});
```

### 4. Resource Cleanup

```typescript
describe('Component with resources', () => {
  let resource: Resource;

  beforeEach(async () => {
    resource = await createResource();
  });

  afterEach(async () => {
    await resource.cleanup();
  });

  it('should use resource', async () => {
    // Test using resource
  });
});
```

### 5. Test Isolation

```typescript
// ✅ GOOD: Each test is independent
describe('UserService', () => {
  it('should create user', async () => {
    const service = new UserService();
    const user = await service.create({ email: 'test@example.com' });
    expect(user).toBeDefined();
  });

  it('should find user', async () => {
    const service = new UserService();
    // Don't rely on user from previous test
    const user = await service.create({ email: 'find@example.com' });
    const found = await service.findById(user.id);
    expect(found).toEqual(user);
  });
});
```

### 6. Testing Error Cases

```typescript
describe('Error Handling', () => {
  it('should throw specific error type', () => {
    expect(() => {
      throwError();
    }).toThrow(CustomError);
  });

  it('should throw with specific message', () => {
    expect(() => {
      throwError();
    }).toThrow('Expected message');
  });

  it('should have error properties', () => {
    try {
      throwError();
    } catch (error) {
      expect(error).toBeInstanceOf(CustomError);
      expect((error as CustomError).code).toBe('ERROR_CODE');
    }
  });
});
```

## Coverage Measurement Commands

### Run Coverage for Specific Package

```bash
cd packages/router
pnpm test:coverage
```

### View HTML Coverage Report

```bash
# After running coverage
open packages/router/coverage/index.html
open packages/auth/coverage/index.html
```

### Run Coverage for All Packages

```bash
# From monorepo root
pnpm test:coverage
```

### Watch Mode for Test Development

```bash
cd packages/router
pnpm test:watch
```

## Next Steps

1. Start with Priority 1 (GuardError tests) - Quick win, high impact
2. Move to Priority 2 (Rate Limiting) - Security-critical
3. Add Auth Plugin tests - Core functionality
4. Continue with DI Container edge cases
5. Monitor coverage after each addition

## Success Metrics

After implementing these tests, target metrics:

- @veloxts/router: 95%+ coverage
- @veloxts/auth: 90%+ coverage
- @veloxts/core: 90%+ coverage
- All security-critical code: 95%+ coverage
- All error paths: 100% coverage

Remember: Coverage is a metric, not a goal. Focus on testing behavior, not implementation details.
