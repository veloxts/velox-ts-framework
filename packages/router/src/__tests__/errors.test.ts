/**
 * Unit tests for @veloxts/router errors module
 *
 * Tests GuardError class and isGuardError type guard
 */

import { VeloxError } from '@veloxts/core';
import { describe, expect, it } from 'vitest';

import { GuardError, isGuardError } from '../errors.js';
import type { GuardErrorResponse, RouterErrorCode } from '../errors.js';

// ============================================================================
// GuardError Class Tests
// ============================================================================

describe('GuardError', () => {
  describe('constructor', () => {
    it('should create a GuardError with default status code 403', () => {
      const error = new GuardError('authenticated', 'Authentication required');

      expect(error).toBeInstanceOf(GuardError);
      expect(error).toBeInstanceOf(VeloxError);
      expect(error).toBeInstanceOf(Error);
      expect(error.guardName).toBe('authenticated');
      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('GUARD_FAILED');
      expect(error.name).toBe('GuardError');
    });

    it('should create a GuardError with custom status code', () => {
      const error = new GuardError('authenticated', 'Not authenticated', 401);

      expect(error.statusCode).toBe(401);
      expect(error.guardName).toBe('authenticated');
      expect(error.message).toBe('Not authenticated');
    });

    it('should create a GuardError with status code 403 (Forbidden)', () => {
      const error = new GuardError('hasRole', 'Insufficient permissions', 403);

      expect(error.statusCode).toBe(403);
      expect(error.guardName).toBe('hasRole');
    });

    it('should create a GuardError with status code 404 (Not Found)', () => {
      const error = new GuardError('resourceExists', 'Resource not found', 404);

      expect(error.statusCode).toBe(404);
      expect(error.guardName).toBe('resourceExists');
    });

    it('should handle empty guard name', () => {
      const error = new GuardError('', 'Guard failed');

      expect(error.guardName).toBe('');
      expect(error.message).toBe('Guard failed');
    });

    it('should handle empty message', () => {
      const error = new GuardError('testGuard', '');

      expect(error.guardName).toBe('testGuard');
      expect(error.message).toBe('');
    });

    it('should handle special characters in guard name', () => {
      const error = new GuardError('has-role:admin', 'Admin required');

      expect(error.guardName).toBe('has-role:admin');
    });

    it('should handle special characters in message', () => {
      const error = new GuardError('auth', 'Access denied: "admin" role required');

      expect(error.message).toBe('Access denied: "admin" role required');
    });

    it('should handle unicode in guard name and message', () => {
      const error = new GuardError('验证', '需要身份验证');

      expect(error.guardName).toBe('验证');
      expect(error.message).toBe('需要身份验证');
    });

    it('should have proper prototype chain', () => {
      const error = new GuardError('test', 'test message');

      expect(Object.getPrototypeOf(error)).toBe(GuardError.prototype);
      expect(Object.getPrototypeOf(GuardError.prototype)).toBe(VeloxError.prototype);
    });

    it('should capture stack trace', () => {
      const error = new GuardError('test', 'test message');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('GuardError');
    });
  });

  describe('toJSON', () => {
    it('should return properly formatted GuardErrorResponse', () => {
      const error = new GuardError('authenticated', 'Authentication required', 401);
      const json = error.toJSON();

      expect(json).toEqual({
        error: 'GuardError',
        message: 'Authentication required',
        statusCode: 401,
        code: 'GUARD_FAILED',
        guardName: 'authenticated',
      });
    });

    it('should return GuardErrorResponse with default status code', () => {
      const error = new GuardError('hasPermission', 'Permission denied');
      const json = error.toJSON();

      expect(json.statusCode).toBe(403);
      expect(json.guardName).toBe('hasPermission');
    });

    it('should always have error property as "GuardError"', () => {
      const error = new GuardError('test', 'test');
      const json = error.toJSON();

      expect(json.error).toBe('GuardError');
    });

    it('should always have code property as "GUARD_FAILED"', () => {
      const error = new GuardError('test', 'test');
      const json = error.toJSON();

      expect(json.code).toBe('GUARD_FAILED');
    });

    it('should be serializable to JSON string', () => {
      const error = new GuardError('auth', 'Auth failed', 401);
      const json = error.toJSON();
      const serialized = JSON.stringify(json);
      const parsed = JSON.parse(serialized);

      expect(parsed).toEqual(json);
    });

    it('should handle special characters in serialization', () => {
      const error = new GuardError('guard', 'Message with "quotes" and \\ backslash');
      const json = error.toJSON();
      const serialized = JSON.stringify(json);
      const parsed = JSON.parse(serialized);

      expect(parsed.message).toBe('Message with "quotes" and \\ backslash');
    });
  });

  describe('inheritance from VeloxError', () => {
    it('should inherit from VeloxError', () => {
      const error = new GuardError('test', 'test message');

      expect(error instanceof VeloxError).toBe(true);
    });

    it('should have VeloxError properties', () => {
      const error = new GuardError('test', 'test message', 401);

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('GUARD_FAILED');
      expect(error.message).toBe('test message');
    });

    it('should be catchable as VeloxError', () => {
      let caught: VeloxError | undefined;

      try {
        throw new GuardError('test', 'test');
      } catch (e) {
        if (e instanceof VeloxError) {
          caught = e;
        }
      }

      expect(caught).toBeInstanceOf(GuardError);
    });

    it('should be catchable as Error', () => {
      let caught: Error | undefined;

      try {
        throw new GuardError('test', 'test');
      } catch (e) {
        if (e instanceof Error) {
          caught = e;
        }
      }

      expect(caught).toBeInstanceOf(GuardError);
    });
  });

  describe('edge cases', () => {
    it('should handle zero as status code', () => {
      const error = new GuardError('test', 'test', 0);

      expect(error.statusCode).toBe(0);
    });

    it('should handle negative status code', () => {
      const error = new GuardError('test', 'test', -1);

      expect(error.statusCode).toBe(-1);
    });

    it('should handle very large status code', () => {
      const error = new GuardError('test', 'test', 999);

      expect(error.statusCode).toBe(999);
    });

    it('should handle very long guard name', () => {
      const longName = 'a'.repeat(1000);
      const error = new GuardError(longName, 'test');

      expect(error.guardName).toBe(longName);
      expect(error.guardName.length).toBe(1000);
    });

    it('should handle very long message', () => {
      const longMessage = 'x'.repeat(10000);
      const error = new GuardError('test', longMessage);

      expect(error.message).toBe(longMessage);
      expect(error.message.length).toBe(10000);
    });
  });
});

// ============================================================================
// isGuardError Type Guard Tests
// ============================================================================

describe('isGuardError', () => {
  describe('positive cases', () => {
    it('should return true for GuardError instance', () => {
      const error = new GuardError('test', 'test message');

      expect(isGuardError(error)).toBe(true);
    });

    it('should return true for thrown and caught GuardError', () => {
      let caught: unknown;

      try {
        throw new GuardError('auth', 'Auth failed');
      } catch (e) {
        caught = e;
      }

      expect(isGuardError(caught)).toBe(true);
    });

    it('should narrow type correctly', () => {
      const error: unknown = new GuardError('test', 'test');

      if (isGuardError(error)) {
        // TypeScript should know these properties exist
        expect(error.guardName).toBe('test');
        expect(error.statusCode).toBeDefined();
        expect(error.code).toBe('GUARD_FAILED');
      } else {
        // This branch should not be reached
        expect.fail('isGuardError should return true');
      }
    });
  });

  describe('negative cases', () => {
    it('should return false for null', () => {
      expect(isGuardError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isGuardError(undefined)).toBe(false);
    });

    it('should return false for regular Error', () => {
      const error = new Error('test');

      expect(isGuardError(error)).toBe(false);
    });

    it('should return false for VeloxError', () => {
      const error = new VeloxError('test', 500);

      expect(isGuardError(error)).toBe(false);
    });

    it('should return false for string', () => {
      expect(isGuardError('GuardError')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isGuardError(403)).toBe(false);
    });

    it('should return false for boolean', () => {
      expect(isGuardError(true)).toBe(false);
      expect(isGuardError(false)).toBe(false);
    });

    it('should return false for plain object', () => {
      const obj = {
        name: 'GuardError',
        guardName: 'test',
        message: 'test',
        statusCode: 403,
        code: 'GUARD_FAILED',
      };

      expect(isGuardError(obj)).toBe(false);
    });

    it('should return false for object with toJSON method', () => {
      const obj = {
        guardName: 'test',
        message: 'test',
        statusCode: 403,
        toJSON: () => ({ error: 'GuardError' }),
      };

      expect(isGuardError(obj)).toBe(false);
    });

    it('should return false for array', () => {
      expect(isGuardError([])).toBe(false);
      expect(isGuardError([new GuardError('test', 'test')])).toBe(false);
    });

    it('should return false for function', () => {
      expect(isGuardError(() => {})).toBe(false);
    });

    it('should return false for symbol', () => {
      expect(isGuardError(Symbol('GuardError'))).toBe(false);
    });

    it('should return false for TypeError', () => {
      expect(isGuardError(new TypeError('test'))).toBe(false);
    });

    it('should return false for SyntaxError', () => {
      expect(isGuardError(new SyntaxError('test'))).toBe(false);
    });

    it('should return false for RangeError', () => {
      expect(isGuardError(new RangeError('test'))).toBe(false);
    });

    it('should return false for custom error class', () => {
      class CustomError extends Error {
        guardName = 'test';
      }
      expect(isGuardError(new CustomError('test'))).toBe(false);
    });
  });
});

// ============================================================================
// Type Tests (compile-time verification)
// ============================================================================

describe('Type definitions', () => {
  it('should have correct RouterErrorCode type', () => {
    const code1: RouterErrorCode = 'GUARD_FAILED';
    const code2: RouterErrorCode = 'UNAUTHORIZED';
    const code3: RouterErrorCode = 'FORBIDDEN';

    expect([code1, code2, code3]).toEqual(['GUARD_FAILED', 'UNAUTHORIZED', 'FORBIDDEN']);
  });

  it('should have correct GuardErrorResponse shape', () => {
    const response: GuardErrorResponse = {
      error: 'GuardError',
      message: 'test',
      statusCode: 403,
      code: 'GUARD_FAILED',
      guardName: 'testGuard',
    };

    expect(response.error).toBe('GuardError');
    expect(response.code).toBe('GUARD_FAILED');
  });

  it('GuardError.toJSON should return GuardErrorResponse', () => {
    const error = new GuardError('test', 'message');
    const json: GuardErrorResponse = error.toJSON();

    expect(json.error).toBe('GuardError');
  });
});

// ============================================================================
// Integration-style Tests
// ============================================================================

describe('GuardError integration scenarios', () => {
  it('should work in try-catch pattern with type narrowing', () => {
    const runGuard = (shouldFail: boolean): string => {
      if (shouldFail) {
        throw new GuardError('authenticated', 'Please log in', 401);
      }
      return 'success';
    };

    // Success case
    expect(runGuard(false)).toBe('success');

    // Failure case
    try {
      runGuard(true);
      expect.fail('Should have thrown');
    } catch (error) {
      if (isGuardError(error)) {
        expect(error.guardName).toBe('authenticated');
        expect(error.statusCode).toBe(401);
      } else {
        expect.fail('Should be GuardError');
      }
    }
  });

  it('should work with async/await pattern', async () => {
    const asyncGuard = async (authorized: boolean): Promise<string> => {
      await Promise.resolve(); // Simulate async operation
      if (!authorized) {
        throw new GuardError('hasRole', 'Admin role required', 403);
      }
      return 'authorized';
    };

    // Success case
    await expect(asyncGuard(true)).resolves.toBe('authorized');

    // Failure case
    try {
      await asyncGuard(false);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isGuardError(error)).toBe(true);
      if (isGuardError(error)) {
        expect(error.guardName).toBe('hasRole');
      }
    }
  });

  it('should work with Promise.catch pattern', async () => {
    const guardPromise = Promise.reject(
      new GuardError('permission', 'Access denied', 403)
    );

    const result = await guardPromise.catch((error) => {
      if (isGuardError(error)) {
        return { handled: true, guard: error.guardName };
      }
      return { handled: false };
    });

    expect(result).toEqual({ handled: true, guard: 'permission' });
  });

  it('should serialize correctly for HTTP response', () => {
    const error = new GuardError('authenticated', 'Token expired', 401);

    // Simulate sending as HTTP response
    const responseBody = JSON.stringify(error.toJSON());
    const parsed = JSON.parse(responseBody);

    expect(parsed).toEqual({
      error: 'GuardError',
      message: 'Token expired',
      statusCode: 401,
      code: 'GUARD_FAILED',
      guardName: 'authenticated',
    });
  });

  it('should support multiple guards failing in sequence', () => {
    const guards = ['auth', 'role', 'permission'];
    const errors: GuardError[] = [];

    for (const guard of guards) {
      errors.push(new GuardError(guard, `${guard} check failed`));
    }

    expect(errors).toHaveLength(3);
    expect(errors.map((e) => e.guardName)).toEqual(['auth', 'role', 'permission']);
    expect(errors.every((e) => isGuardError(e))).toBe(true);
  });
});
