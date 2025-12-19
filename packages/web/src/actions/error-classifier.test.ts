/**
 * Tests for the Error Classifier
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  classifyError,
  classifyPrismaError,
  createErrorClassifier,
  DEFAULT_ERROR_PATTERNS,
  PRISMA_ERROR_PATTERNS,
  toActionError,
} from './error-classifier.js';

describe('classifyError', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    consoleErrorSpy.mockRestore();
  });

  describe('authentication errors', () => {
    it('should classify "unauthorized" as UNAUTHORIZED', () => {
      const result = classifyError(new Error('User is unauthorized'));
      expect(result.code).toBe('UNAUTHORIZED');
      expect(result.matched).toBe(true);
    });

    it('should classify "unauthenticated" as UNAUTHORIZED', () => {
      const result = classifyError(new Error('Request is unauthenticated'));
      expect(result.code).toBe('UNAUTHORIZED');
    });

    it('should classify "not authenticated" as UNAUTHORIZED', () => {
      const result = classifyError(new Error('User is not authenticated'));
      expect(result.code).toBe('UNAUTHORIZED');
    });

    it('should classify "authentication required" as UNAUTHORIZED', () => {
      const result = classifyError(new Error('Authentication required for this endpoint'));
      expect(result.code).toBe('UNAUTHORIZED');
    });
  });

  describe('authorization errors', () => {
    it('should classify "forbidden" as FORBIDDEN', () => {
      const result = classifyError(new Error('Access forbidden'));
      expect(result.code).toBe('FORBIDDEN');
      expect(result.matched).toBe(true);
    });

    it('should classify "permission denied" as FORBIDDEN', () => {
      const result = classifyError(new Error('Permission denied'));
      expect(result.code).toBe('FORBIDDEN');
    });

    it('should classify "access denied" as FORBIDDEN', () => {
      const result = classifyError(new Error('Access denied to resource'));
      expect(result.code).toBe('FORBIDDEN');
    });

    it('should classify "not allowed" as FORBIDDEN', () => {
      const result = classifyError(new Error('Operation not allowed'));
      expect(result.code).toBe('FORBIDDEN');
    });
  });

  describe('not found errors', () => {
    it('should classify "not found" as NOT_FOUND', () => {
      const result = classifyError(new Error('User not found'));
      expect(result.code).toBe('NOT_FOUND');
      expect(result.matched).toBe(true);
    });

    it('should classify "does not exist" as NOT_FOUND', () => {
      const result = classifyError(new Error('Resource does not exist'));
      expect(result.code).toBe('NOT_FOUND');
    });

    it('should classify "no such" as NOT_FOUND', () => {
      const result = classifyError(new Error('No such file or directory'));
      expect(result.code).toBe('NOT_FOUND');
    });

    it('should classify "could not find" as NOT_FOUND', () => {
      const result = classifyError(new Error('Could not find the requested item'));
      expect(result.code).toBe('NOT_FOUND');
    });
  });

  describe('conflict errors', () => {
    it('should classify "conflict" as CONFLICT', () => {
      const result = classifyError(new Error('Update conflict detected'));
      expect(result.code).toBe('CONFLICT');
      expect(result.matched).toBe(true);
    });

    it('should classify "duplicate" as CONFLICT', () => {
      const result = classifyError(new Error('Duplicate entry'));
      expect(result.code).toBe('CONFLICT');
    });

    it('should classify "already exists" as CONFLICT', () => {
      const result = classifyError(new Error('User already exists'));
      expect(result.code).toBe('CONFLICT');
    });

    it('should classify "unique constraint" as CONFLICT', () => {
      const result = classifyError(new Error('Unique constraint violation on email'));
      expect(result.code).toBe('CONFLICT');
    });
  });

  describe('rate limiting errors', () => {
    it('should classify "rate limit" as RATE_LIMITED', () => {
      const result = classifyError(new Error('Rate limit exceeded'));
      expect(result.code).toBe('RATE_LIMITED');
      expect(result.matched).toBe(true);
    });

    it('should classify "too many requests" as RATE_LIMITED', () => {
      const result = classifyError(new Error('Too many requests, please slow down'));
      expect(result.code).toBe('RATE_LIMITED');
    });

    it('should classify "throttled" as RATE_LIMITED', () => {
      const result = classifyError(new Error('Request throttled'));
      expect(result.code).toBe('RATE_LIMITED');
    });

    it('should classify "quota exceeded" as RATE_LIMITED', () => {
      const result = classifyError(new Error('API quota exceeded'));
      expect(result.code).toBe('RATE_LIMITED');
    });
  });

  describe('validation errors', () => {
    it('should classify "validation" as VALIDATION_ERROR', () => {
      const result = classifyError(new Error('Validation failed'));
      expect(result.code).toBe('VALIDATION_ERROR');
    });

    it('should classify "invalid" as VALIDATION_ERROR', () => {
      const result = classifyError(new Error('Invalid input format'));
      expect(result.code).toBe('VALIDATION_ERROR');
    });

    it('should classify "malformed" as VALIDATION_ERROR', () => {
      const result = classifyError(new Error('Malformed JSON'));
      expect(result.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('bad request errors', () => {
    it('should classify "bad request" as BAD_REQUEST', () => {
      const result = classifyError(new Error('Bad request format'));
      expect(result.code).toBe('BAD_REQUEST');
    });

    it('should classify "missing required" as BAD_REQUEST', () => {
      const result = classifyError(new Error('Missing required field'));
      expect(result.code).toBe('BAD_REQUEST');
    });
  });

  describe('unclassified errors', () => {
    it('should classify unknown errors as INTERNAL_ERROR', () => {
      const result = classifyError(new Error('Something went wrong'));
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.matched).toBe(false);
    });

    it('should preserve error message for unknown errors', () => {
      const result = classifyError(new Error('Custom error message'));
      expect(result.message).toBe('Custom error message');
    });

    it('should log unclassified errors in development', () => {
      process.env.NODE_ENV = 'development';
      classifyError(new Error('Unknown error'));
      expect(consoleErrorSpy).toHaveBeenCalledWith('[VeloxTS] Unclassified error:', expect.any(Error));
    });

    it('should not log unclassified errors in production', () => {
      process.env.NODE_ENV = 'production';
      classifyError(new Error('Unknown error'));
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('non-Error values', () => {
    it('should handle string errors', () => {
      const result = classifyError('Something went wrong');
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.message).toBe('Something went wrong');
      expect(result.matched).toBe(false);
    });

    it('should use default message for non-string non-Error values', () => {
      const result = classifyError(42);
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.message).toBe('An unexpected error occurred');
    });

    it('should handle null', () => {
      const result = classifyError(null);
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.matched).toBe(false);
    });

    it('should handle undefined', () => {
      const result = classifyError(undefined);
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.matched).toBe(false);
    });

    it('should handle objects', () => {
      const result = classifyError({ error: 'test' });
      expect(result.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('case insensitivity', () => {
    it('should match patterns case-insensitively', () => {
      expect(classifyError(new Error('UNAUTHORIZED')).code).toBe('UNAUTHORIZED');
      expect(classifyError(new Error('Unauthorized')).code).toBe('UNAUTHORIZED');
      expect(classifyError(new Error('UnAuThOrIzEd')).code).toBe('UNAUTHORIZED');
    });
  });

  describe('options', () => {
    it('should use custom default code', () => {
      const result = classifyError(new Error('Unknown'), { defaultCode: 'BAD_REQUEST' });
      expect(result.code).toBe('BAD_REQUEST');
    });

    it('should use custom default message', () => {
      const result = classifyError(null, { defaultMessage: 'Custom default' });
      expect(result.message).toBe('Custom default');
    });

    it('should respect logInDevelopment: false', () => {
      process.env.NODE_ENV = 'development';
      classifyError(new Error('Unknown'), { logInDevelopment: false });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should use custom patterns', () => {
      const result = classifyError(new Error('custom-error-xyz'), {
        patterns: [{ patterns: ['custom-error'], code: 'FORBIDDEN' }],
      });
      expect(result.code).toBe('FORBIDDEN');
    });

    it('should check additional patterns before defaults', () => {
      const result = classifyError(new Error('special case not found'), {
        additionalPatterns: [{ patterns: ['special case'], code: 'FORBIDDEN' }],
      });
      expect(result.code).toBe('FORBIDDEN');
    });
  });
});

describe('toActionError', () => {
  it('should return a properly formatted ActionError', () => {
    const result = toActionError(new Error('User not found'));

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('NOT_FOUND');
    expect(result.error.message).toBe('User not found');
  });

  it('should handle unknown errors', () => {
    const result = toActionError(new Error('Something went wrong'));

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INTERNAL_ERROR');
  });

  it('should pass options to classifyError', () => {
    const result = toActionError(new Error('Unknown'), { defaultCode: 'BAD_REQUEST' });

    expect(result.error.code).toBe('BAD_REQUEST');
  });
});

describe('createErrorClassifier', () => {
  it('should create a classifier with default options', () => {
    const classifier = createErrorClassifier({
      additionalPatterns: [{ patterns: ['custom'], code: 'FORBIDDEN' }],
    });

    const result = classifier(new Error('custom error'));
    expect(result.code).toBe('FORBIDDEN');
  });

  it('should allow overriding options', () => {
    const classifier = createErrorClassifier({ defaultCode: 'BAD_REQUEST' });

    const result = classifier(new Error('Unknown'), { defaultCode: 'INTERNAL_ERROR' });
    expect(result.code).toBe('INTERNAL_ERROR');
  });

  it('should merge default and override options', () => {
    const classifier = createErrorClassifier({
      additionalPatterns: [{ patterns: ['custom'], code: 'FORBIDDEN' }],
    });

    const result = classifier(new Error('Unknown'), { defaultCode: 'BAD_REQUEST' });
    expect(result.code).toBe('BAD_REQUEST');
  });
});

describe('PRISMA_ERROR_PATTERNS', () => {
  it('should include Prisma unique constraint pattern', () => {
    const pattern = PRISMA_ERROR_PATTERNS.find((p) => p.patterns.includes('P2002'));
    expect(pattern).toBeDefined();
    expect(pattern?.code).toBe('CONFLICT');
  });

  it('should include Prisma not found patterns', () => {
    const pattern = PRISMA_ERROR_PATTERNS.find((p) => p.patterns.includes('P2025'));
    expect(pattern).toBeDefined();
    expect(pattern?.code).toBe('NOT_FOUND');
  });
});

describe('classifyPrismaError', () => {
  it('should classify Prisma unique constraint errors', () => {
    const error = new Error('P2002: Unique constraint failed on the fields: (`email`)');
    const result = classifyPrismaError(error);
    expect(result.code).toBe('CONFLICT');
    expect(result.matched).toBe(true);
  });

  it('should classify Prisma record not found errors', () => {
    const error = new Error('P2025: An operation failed because it depends on one or more records that were required but not found.');
    const result = classifyPrismaError(error);
    expect(result.code).toBe('NOT_FOUND');
  });

  it('should fall back to default patterns for non-Prisma errors', () => {
    const error = new Error('User unauthorized');
    const result = classifyPrismaError(error);
    expect(result.code).toBe('UNAUTHORIZED');
  });
});

describe('DEFAULT_ERROR_PATTERNS', () => {
  it('should be a readonly array (enforced at compile time)', () => {
    expect(Array.isArray(DEFAULT_ERROR_PATTERNS)).toBe(true);
    // Note: `as const` provides compile-time readonly enforcement, not runtime Object.freeze
    // The array structure is immutable at the type level
    expect(DEFAULT_ERROR_PATTERNS.length).toBeGreaterThan(0);
  });

  it('should have patterns for all major error categories', () => {
    const codes = DEFAULT_ERROR_PATTERNS.map((p) => p.code);
    expect(codes).toContain('UNAUTHORIZED');
    expect(codes).toContain('FORBIDDEN');
    expect(codes).toContain('NOT_FOUND');
    expect(codes).toContain('CONFLICT');
    expect(codes).toContain('RATE_LIMITED');
    expect(codes).toContain('VALIDATION_ERROR');
    expect(codes).toContain('BAD_REQUEST');
  });
});
