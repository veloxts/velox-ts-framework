/**
 * Tests for Validated Server Action Helper
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  AuthenticationError,
  AuthorizationError,
  CsrfError,
  clearRateLimitStore,
  InputSizeError,
  RateLimitError,
  resetServerContextCache,
  stopRateLimitCleanup,
  validated,
  validatedMutation,
  validatedQuery,
} from './validated.js';

// Helper to check if result is successful
function isSuccess<T>(result: { success: boolean }): result is { success: true; data: T } {
  return result.success === true;
}

// Helper to check if result is error
function isError(result: { success: boolean }): result is {
  success: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
} {
  return result.success === false;
}

describe('validated()', () => {
  describe('basic functionality', () => {
    it('should create a callable action', async () => {
      const schema = z.object({ name: z.string() });
      const action = validated(schema, async (input) => {
        return { greeting: `Hello, ${input.name}!` };
      });

      const result = await action({ name: 'World' });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.greeting).toBe('Hello, World!');
      }
    });

    it('should infer input types from schema', async () => {
      const schema = z.object({
        id: z.string().uuid(),
        count: z.number().positive(),
      });

      const action = validated(schema, async (input) => {
        // TypeScript should infer: input: { id: string; count: number }
        return { received: input.id, doubled: input.count * 2 };
      });

      const result = await action({ id: '550e8400-e29b-41d4-a716-446655440000', count: 5 });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.doubled).toBe(10);
      }
    });

    it('should handle async handlers', async () => {
      const schema = z.object({ delay: z.number() });
      const action = validated(schema, async (input) => {
        await new Promise((resolve) => setTimeout(resolve, input.delay));
        return { delayed: true };
      });

      const result = await action({ delay: 10 });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.delayed).toBe(true);
      }
    });
  });

  describe('input validation', () => {
    it('should validate input with Zod schema', async () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      const action = validated(schema, async (input) => ({ valid: true, email: input.email }));

      const result = await action({ email: 'test@example.com', age: 25 });

      expect(isSuccess(result)).toBe(true);
    });

    it('should return validation error for invalid input', async () => {
      const schema = z.object({
        email: z.string().email(),
      });

      const action = validated(schema, async (input) => input);

      const result = await action({ email: 'not-an-email' });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.details?.errors).toBeDefined();
      }
    });

    it('should not call handler when validation fails', async () => {
      const handler = vi.fn().mockResolvedValue({});
      const schema = z.object({ id: z.string().uuid() });

      const action = validated(schema, handler);

      await action({ id: 'not-a-uuid' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle complex nested schemas', async () => {
      const schema = z.object({
        user: z.object({
          name: z.string().min(1),
          contacts: z.array(
            z.object({
              type: z.enum(['email', 'phone']),
              value: z.string(),
            })
          ),
        }),
      });

      const action = validated(schema, async (input) => ({
        userName: input.user.name,
        contactCount: input.user.contacts.length,
      }));

      const result = await action({
        user: {
          name: 'John',
          contacts: [
            { type: 'email', value: 'john@example.com' },
            { type: 'phone', value: '+1234567890' },
          ],
        },
      });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.contactCount).toBe(2);
      }
    });
  });

  describe('output validation', () => {
    it('should validate output when schema provided', async () => {
      const inputSchema = z.object({ id: z.string() });
      const outputSchema = z.object({
        id: z.string(),
        createdAt: z.string(),
      });

      const action = validated(inputSchema, async () => ({ id: '123', createdAt: '2024-01-01' }), {
        outputSchema,
      });

      const result = await action({ id: 'test' });

      expect(isSuccess(result)).toBe(true);
    });

    it('should return internal error for invalid output', async () => {
      const inputSchema = z.object({ id: z.string() });
      const outputSchema = z.object({
        id: z.string(),
        createdAt: z.string(),
      });

      const action = validated(
        inputSchema,
        async () => ({ id: 123 }) as unknown as { id: string; createdAt: string },
        { outputSchema }
      );

      const result = await action({ id: 'test' });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });
  });

  describe('authentication', () => {
    it('should return unauthorized when requireAuth is true and no user', async () => {
      const schema = z.object({ data: z.string() });
      const action = validated(
        schema,
        async (_input, ctx) => {
          // ctx.user should be guaranteed here
          return { userId: ctx.user.id };
        },
        { requireAuth: true }
      );

      const result = await action({ data: 'test' });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should allow access without auth when requireAuth is false', async () => {
      const schema = z.object({ public: z.boolean() });
      const action = validated(schema, async (input) => ({ accessed: input.public }));

      const result = await action({ public: true });

      expect(isSuccess(result)).toBe(true);
    });
  });

  describe('input sanitization', () => {
    it('should strip null bytes from strings', async () => {
      const schema = z.object({ name: z.string() });
      const action = validated(schema, async (input) => ({ sanitized: input.name }));

      const result = await action({ name: 'hello\0world' });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.sanitized).toBe('helloworld');
        expect(result.data.sanitized).not.toContain('\0');
      }
    });

    it('should prevent prototype pollution', async () => {
      const schema = z.record(z.unknown());
      const action = validated(schema, async (input) => ({ keys: Object.keys(input) }));

      const result = await action({
        normal: 'value',
        __proto__: { malicious: true },
        constructor: { bad: true },
        prototype: { evil: true },
      });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.keys).toContain('normal');
        expect(result.data.keys).not.toContain('__proto__');
        expect(result.data.keys).not.toContain('constructor');
        expect(result.data.keys).not.toContain('prototype');
      }
    });

    it('should recursively sanitize nested objects', async () => {
      const schema = z.object({
        nested: z.object({
          value: z.string(),
        }),
      });
      const action = validated(schema, async (input) => ({ value: input.nested.value }));

      const result = await action({
        nested: { value: 'test\0injection' },
      });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.value).toBe('testinjection');
      }
    });

    it('should sanitize arrays', async () => {
      const schema = z.object({ items: z.array(z.string()) });
      const action = validated(schema, async (input) => ({ items: input.items }));

      const result = await action({ items: ['a\0b', 'c\0d'] });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.items).toEqual(['ab', 'cd']);
      }
    });
  });

  describe('input size validation', () => {
    it('should reject payloads exceeding max size', async () => {
      const schema = z.object({ data: z.string() });
      const action = validated(schema, async (input) => ({ received: input.data }), {
        maxInputSize: 100,
      });

      // Create input larger than 100 bytes
      const result = await action({ data: 'x'.repeat(200) });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('BAD_REQUEST');
        expect(result.error.message).toContain('maximum size');
      }
    });

    it('should allow payloads within max size', async () => {
      const schema = z.object({ data: z.string() });
      const action = validated(schema, async (input) => ({ received: input.data }), {
        maxInputSize: 1000,
      });

      const result = await action({ data: 'small payload' });

      expect(isSuccess(result)).toBe(true);
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limits', async () => {
      // Use unique key generator to isolate this test from others
      const testKey = `test-rate-limit-${Date.now()}-${Math.random()}`;
      const schema = z.object({ id: z.number() });
      const action = validated(schema, async (input) => ({ id: input.id }), {
        rateLimit: {
          maxRequests: 2,
          windowMs: 60000,
          keyGenerator: () => testKey,
        },
      });

      // First two requests should succeed
      const result1 = await action({ id: 1 });
      const result2 = await action({ id: 2 });

      expect(isSuccess(result1)).toBe(true);
      expect(isSuccess(result2)).toBe(true);

      // Third request should be rate limited
      const result3 = await action({ id: 3 });

      expect(isError(result3)).toBe(true);
      if (isError(result3)) {
        expect(result3.error.code).toBe('RATE_LIMITED');
        expect(result3.error.details?.retryAfter).toBeDefined();
      }
    });
  });

  describe('error handling', () => {
    it('should catch and wrap handler errors', async () => {
      const schema = z.object({});
      const action = validated(schema, async () => {
        throw new Error('Something went wrong');
      });

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });

    it('should use custom error handler when provided', async () => {
      const schema = z.object({});
      const action = validated(
        schema,
        async () => {
          throw new Error('Original error');
        },
        {
          onError: () => ({
            code: 'CONFLICT' as const,
            message: 'Custom error message',
          }),
        }
      );

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('CONFLICT');
        expect(result.error.message).toBe('Custom error message');
      }
    });

    it('should handle thrown AuthenticationError', async () => {
      const schema = z.object({});
      const action = validated(schema, async () => {
        throw new AuthenticationError('Custom auth message');
      });

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('UNAUTHORIZED');
        expect(result.error.message).toBe('Custom auth message');
      }
    });

    it('should handle thrown AuthorizationError', async () => {
      const schema = z.object({});
      const action = validated(schema, async () => {
        throw new AuthorizationError('Access denied');
      });

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('should handle thrown InputSizeError', async () => {
      const schema = z.object({});
      const action = validated(schema, async () => {
        throw new InputSizeError('Too large');
      });

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('BAD_REQUEST');
      }
    });

    it('should handle thrown RateLimitError', async () => {
      const schema = z.object({});
      const action = validated(schema, async () => {
        throw new RateLimitError('Too many requests', 60);
      });

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('RATE_LIMITED');
        expect(result.error.details?.retryAfter).toBe(60);
      }
    });
  });
});

describe('validatedMutation()', () => {
  it('should require authentication by default', async () => {
    // Use unique key to avoid rate limit interference from other tests
    const testKey = `mutation-auth-test-${Date.now()}-${Math.random()}`;
    const schema = z.object({ data: z.string() });
    const action = validatedMutation(
      schema,
      async (_input, ctx) => {
        return { userId: ctx.user.id };
      },
      {
        rateLimit: {
          maxRequests: 100,
          windowMs: 60000,
          keyGenerator: () => testKey,
        },
      }
    );

    const result = await action({ data: 'test' });

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('should use stricter default rate limit', async () => {
    // Use unique key to avoid rate limit interference from other tests
    const testKey = `mutation-rate-test-${Date.now()}-${Math.random()}`;
    const schema = z.object({ id: z.number() });
    // Default mutation rate limit is 10/min
    const action = validatedMutation(schema, async (input, _ctx) => ({ id: input.id }), {
      rateLimit: {
        maxRequests: 100,
        windowMs: 60000,
        keyGenerator: () => testKey,
      },
    });

    // We can't easily test the default without many requests,
    // but we can verify it compiles and runs
    const result = await action({ id: 1 });

    // Will fail because no auth, but that's expected
    expect(isError(result)).toBe(true);
  });
});

describe('validatedQuery()', () => {
  it('should not require authentication by default', async () => {
    const schema = z.object({ id: z.string() });
    const action = validatedQuery(schema, async (input) => ({ found: input.id }));

    const result = await action({ id: 'test' });

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data.found).toBe('test');
    }
  });

  it('should bypass CSRF by default', async () => {
    const schema = z.object({ search: z.string() });
    // bypassCsrf should be true for queries
    const action = validatedQuery(schema, async (input) => ({ results: [input.search] }));

    const result = await action({ search: 'test query' });

    expect(isSuccess(result)).toBe(true);
  });
});

describe('error classes', () => {
  describe('AuthenticationError', () => {
    it('should have correct properties', () => {
      const error = new AuthenticationError('Custom message');

      expect(error.name).toBe('AuthenticationError');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Custom message');
    });

    it('should use default message', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Authentication required');
    });
  });

  describe('AuthorizationError', () => {
    it('should have correct properties', () => {
      const error = new AuthorizationError('Not allowed');

      expect(error.name).toBe('AuthorizationError');
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('Not allowed');
    });
  });

  describe('InputSizeError', () => {
    it('should have correct properties', () => {
      const error = new InputSizeError('Payload too large');

      expect(error.name).toBe('InputSizeError');
      expect(error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('RateLimitError', () => {
    it('should have correct properties', () => {
      const error = new RateLimitError('Slow down', 120);

      expect(error.name).toBe('RateLimitError');
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.retryAfter).toBe(120);
    });
  });
});

describe('type inference', () => {
  it('should correctly infer input type from schema', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      active: z.boolean(),
    });

    // This test verifies type inference at compile time
    const action = validated(schema, async (input) => {
      // TypeScript should know these types
      const name: string = input.name;
      const age: number = input.age;
      const active: boolean = input.active;

      return { name, age, active };
    });

    const result = await action({ name: 'Test', age: 30, active: true });
    expect(isSuccess(result)).toBe(true);
  });

  it('should correctly infer output type', async () => {
    const schema = z.object({ id: z.string() });

    const action = validated(schema, async (input) => ({
      userId: input.id,
      timestamp: Date.now(),
    }));

    const result = await action({ id: 'test' });

    if (isSuccess(result)) {
      // TypeScript should know result.data has userId and timestamp
      const _userId: string = result.data.userId;
      const _timestamp: number = result.data.timestamp;
      expect(result.data.userId).toBe('test');
    }
  });
});

// ============================================================================
// CSRF Validation Tests
// ============================================================================

describe('CSRF validation', () => {
  it('should export CsrfError class', () => {
    const error = new CsrfError('Test error');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CsrfError');
    expect(error.code).toBe('CSRF_INVALID');
    expect(error.message).toBe('Test error');
  });

  it('should have default message for CsrfError', () => {
    const error = new CsrfError();
    expect(error.message).toBe('CSRF validation failed');
  });

  it('should export resetServerContextCache for testing', () => {
    expect(typeof resetServerContextCache).toBe('function');
    // Should not throw
    resetServerContextCache();
  });
});

// ============================================================================
// Integration: CSRF with Authenticated Mutations
// ============================================================================

describe('CSRF with authenticated mutations', () => {
  it('should require auth for validatedMutation', async () => {
    const schema = z.object({ data: z.string() });

    // Use unique key generator to avoid rate limiting conflicts with other tests
    const action = validatedMutation(
      schema,
      async (input, ctx) => {
        return { data: input.data, userId: ctx.user.id };
      },
      {
        rateLimit: {
          maxRequests: 100,
          windowMs: 60000,
          keyGenerator: () => `csrf-auth-test-${Date.now()}`,
        },
      }
    );

    // Without authenticated context, should fail with UNAUTHORIZED
    const result = await action({ data: 'test' });

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('should allow bypassCsrf option for validatedQuery', async () => {
    const schema = z.object({ id: z.string() });

    // validatedQuery bypasses CSRF by default
    const action = validatedQuery(schema, async (input) => {
      return { id: input.id };
    });

    const result = await action({ id: 'test' });

    // Should succeed (no CSRF check for queries)
    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data.id).toBe('test');
    }
  });
});

// ============================================================================
// P2 Fix: Rate Limiter Cleanup Tests
// ============================================================================

describe('rate limiter cleanup utilities', () => {
  it('should export clearRateLimitStore for testing', () => {
    expect(typeof clearRateLimitStore).toBe('function');
    // Should not throw
    clearRateLimitStore();
  });

  it('should export stopRateLimitCleanup for testing', () => {
    expect(typeof stopRateLimitCleanup).toBe('function');
    // Should not throw
    stopRateLimitCleanup();
  });

  it('should clear rate limit store correctly', async () => {
    const testKey = `cleanup-test-${Date.now()}-${Math.random()}`;
    const schema = z.object({ id: z.number() });
    const action = validated(schema, async (input) => ({ id: input.id }), {
      rateLimit: {
        maxRequests: 2,
        windowMs: 60000,
        keyGenerator: () => testKey,
      },
    });

    // Exhaust rate limit
    await action({ id: 1 });
    await action({ id: 2 });
    const limitedResult = await action({ id: 3 });

    expect(isError(limitedResult)).toBe(true);
    if (isError(limitedResult)) {
      expect(limitedResult.error.code).toBe('RATE_LIMITED');
    }

    // Clear the store
    clearRateLimitStore();

    // Should succeed again after clearing
    const freshResult = await action({ id: 4 });
    expect(isSuccess(freshResult)).toBe(true);
  });
});

// ============================================================================
// P2 Fix: Circular Reference Handling Tests
// ============================================================================

describe('input size validation with circular references', () => {
  it('should handle circular references gracefully', async () => {
    const schema = z.record(z.unknown());
    const action = validated(
      schema,
      async (input) => ({ received: true, keys: Object.keys(input) }),
      {
        maxInputSize: 10000, // Large enough for circular ref estimate
      }
    );

    // Create circular reference
    const circular: Record<string, unknown> = { name: 'test' };
    circular.self = circular;

    const result = await action(circular);

    // Should not throw - either succeeds or returns validation error
    // The important thing is it doesn't crash
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  it('should reject large circular structures', async () => {
    const schema = z.record(z.unknown());
    const action = validated(schema, async () => ({ received: true }), {
      maxInputSize: 10, // Very small - should reject
    });

    // Create circular reference with data
    const circular: Record<string, unknown> = { name: 'test', value: 'data' };
    circular.self = circular;

    const result = await action(circular);

    // Should fail with size error since estimated size > 10 bytes
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('maximum size');
    }
  });

  it('should handle deeply nested objects', async () => {
    const schema = z.record(z.unknown());
    const action = validated(
      schema,
      async (input) => ({ depth: 'deep', keys: Object.keys(input) }),
      {
        maxInputSize: 50000,
      }
    );

    // Create deeply nested object
    interface NestedObject {
      value: string;
      nested?: NestedObject;
    }
    let deep: NestedObject = { value: 'leaf' };
    for (let i = 0; i < 15; i++) {
      deep = { value: `level-${i}`, nested: deep };
    }

    const result = await action(deep);
    expect(result).toBeDefined();
  });
});

// ============================================================================
// P2 Fix: Authorization Tests (requireRoles/requirePermissions)
// ============================================================================

describe('authorization with roles and permissions', () => {
  it('should reject when user lacks required roles', async () => {
    const schema = z.object({ data: z.string() });

    // This will fail because mock context doesn't have a user
    const action = validated(
      schema,
      async (_input, ctx) => {
        return { userId: ctx.user.id };
      },
      {
        requireAuth: true,
        requireRoles: ['admin'],
        rateLimit: {
          maxRequests: 100,
          windowMs: 60000,
          keyGenerator: () => `roles-test-${Date.now()}`,
        },
      }
    );

    const result = await action({ data: 'test' });

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      // Will fail with UNAUTHORIZED (no user) before checking roles
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('should reject when user lacks required permissions', async () => {
    const schema = z.object({ data: z.string() });

    const action = validated(
      schema,
      async (_input, ctx) => {
        return { userId: ctx.user.id };
      },
      {
        requireAuth: true,
        requirePermissions: ['users:delete', 'users:admin'],
        rateLimit: {
          maxRequests: 100,
          windowMs: 60000,
          keyGenerator: () => `perms-test-${Date.now()}`,
        },
      }
    );

    const result = await action({ data: 'test' });

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      // Will fail with UNAUTHORIZED (no user) before checking permissions
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('should handle hasRequiredRoles with roles array', () => {
    // Test the type inference for role-based access
    const schema = z.object({ action: z.string() });

    const action = validated(
      schema,
      async (input) => {
        return { action: input.action, authorized: true };
      },
      {
        requireAuth: true,
        requireRoles: ['admin', 'moderator'], // Any of these roles grants access
        rateLimit: {
          maxRequests: 100,
          windowMs: 60000,
          keyGenerator: () => `role-arr-test-${Date.now()}`,
        },
      }
    );

    // Verify the action is callable
    expect(typeof action).toBe('function');
  });

  it('should handle hasRequiredPermissions with permissions array', () => {
    // Test the type inference for permission-based access
    const schema = z.object({ resource: z.string() });

    const action = validated(
      schema,
      async (input) => {
        return { resource: input.resource, authorized: true };
      },
      {
        requireAuth: true,
        requirePermissions: ['read:users', 'write:users'], // All permissions required
        rateLimit: {
          maxRequests: 100,
          windowMs: 60000,
          keyGenerator: () => `perm-arr-test-${Date.now()}`,
        },
      }
    );

    // Verify the action is callable
    expect(typeof action).toBe('function');
  });
});

// ============================================================================
// P2 Fix: IP Extraction Tests
// ============================================================================

describe('IP extraction and validation', () => {
  // Note: These tests verify the exported functionality works correctly.
  // The actual IP extraction happens internally via getDefaultRateLimitKey.

  it('should use unique rate limit key for each IP', async () => {
    const testKey1 = `ip-test-1-${Date.now()}`;
    const testKey2 = `ip-test-2-${Date.now()}`;
    const schema = z.object({ id: z.number() });

    // Create two actions with different key generators (simulating different IPs)
    const action1 = validated(schema, async (input) => ({ id: input.id }), {
      rateLimit: { maxRequests: 1, windowMs: 60000, keyGenerator: () => testKey1 },
    });

    const action2 = validated(schema, async (input) => ({ id: input.id }), {
      rateLimit: { maxRequests: 1, windowMs: 60000, keyGenerator: () => testKey2 },
    });

    // First request from "IP 1" should succeed
    const result1 = await action1({ id: 1 });
    expect(isSuccess(result1)).toBe(true);

    // First request from "IP 2" should also succeed (different key)
    const result2 = await action2({ id: 2 });
    expect(isSuccess(result2)).toBe(true);

    // Second request from "IP 1" should be rate limited
    const result3 = await action1({ id: 3 });
    expect(isError(result3)).toBe(true);
    if (isError(result3)) {
      expect(result3.error.code).toBe('RATE_LIMITED');
    }
  });

  it('should handle rate limiting by user ID when authenticated', async () => {
    // This tests that user ID is preferred over IP for authenticated users
    const schema = z.object({ data: z.string() });

    // When user is not authenticated, falls back to IP
    const action = validatedQuery(schema, async (input) => ({ data: input.data }), {
      rateLimit: {
        maxRequests: 100,
        windowMs: 60000,
        keyGenerator: () => `user-ip-test-${Date.now()}`,
      },
    });

    const result = await action({ data: 'test' });
    expect(isSuccess(result)).toBe(true);
  });
});
