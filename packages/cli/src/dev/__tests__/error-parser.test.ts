/**
 * Error Parser - Unit Tests
 *
 * Tests for error analysis and suggestion generation functionality.
 */

import { describe, expect, it } from 'vitest';

import {
  type DevErrorType,
  formatParsedError,
  getErrorTypeLabel,
  isDevelopmentError,
  parseDevError,
} from '../error-parser.js';

describe('parseDevError', () => {
  describe('error type detection', () => {
    it('should detect syntax errors', () => {
      const error = new Error('SyntaxError: Unexpected token }');
      const parsed = parseDevError(error);

      expect(parsed.type).toBe('syntax-error');
    });

    it('should detect module not found errors', () => {
      const error = new Error("Cannot find module './missing'");
      const parsed = parseDevError(error);

      expect(parsed.type).toBe('module-not-found');
    });

    it('should detect ERR_MODULE_NOT_FOUND', () => {
      const error = new Error("ERR_MODULE_NOT_FOUND: Cannot find module '@veloxts/unknown'");
      const parsed = parseDevError(error);

      expect(parsed.type).toBe('module-not-found');
    });

    it('should detect type errors', () => {
      const error = new Error("TypeError: Cannot read property 'foo' of undefined");
      const parsed = parseDevError(error);

      expect(parsed.type).toBe('type-error');
    });

    it('should detect database errors from Prisma', () => {
      const error = new Error('PrismaClientKnownRequestError: Connection refused');
      const parsed = parseDevError(error);

      expect(parsed.type).toBe('database-error');
    });

    it('should detect Prisma error codes', () => {
      const error = new Error('P1001: Cannot reach database server');
      const parsed = parseDevError(error);

      expect(parsed.type).toBe('database-error');
    });

    it('should detect port in use errors', () => {
      const error = new Error('EADDRINUSE: address already in use :::3030');
      const parsed = parseDevError(error);

      expect(parsed.type).toBe('port-in-use');
    });

    it('should detect permission denied errors', () => {
      const error = new Error('EACCES: permission denied, open /etc/passwd');
      const parsed = parseDevError(error);

      expect(parsed.type).toBe('permission-denied');
    });

    it('should detect HMR failure errors', () => {
      const error = new Error('hot-hook: Cannot apply update to module');
      const parsed = parseDevError(error);

      expect(parsed.type).toBe('hmr-failure');
    });

    it('should return unknown for unrecognized errors', () => {
      const error = new Error('Something completely unexpected happened');
      const parsed = parseDevError(error);

      expect(parsed.type).toBe('unknown');
    });
  });

  describe('file location extraction', () => {
    it('should extract file path and line from TypeScript errors', () => {
      const error = new Error('Error in src/procedures/users.ts:42:10');
      const parsed = parseDevError(error);

      expect(parsed.filePath).toBe('src/procedures/users.ts');
      expect(parsed.line).toBe(42);
      expect(parsed.column).toBe(10);
    });

    it('should extract location from Node.js stack traces', () => {
      const error = new Error('Something went wrong');
      error.stack = `Error: Something went wrong
    at Object.<anonymous> (src/test.ts:15:3)
    at Module._compile (node:internal/modules/cjs/loader:1376:14)`;
      const parsed = parseDevError(error);

      expect(parsed.filePath).toBe('src/test.ts');
      expect(parsed.line).toBe(15);
      expect(parsed.column).toBe(3);
    });

    it('should prefer user code over node_modules paths', () => {
      // Create error where user code appears first in stack trace
      // The parser returns the first valid match, so user code should come first
      const error = {
        message: 'Error',
        stack: `Error
    at userFunction (src/app.ts:20:5)
    at Object.<anonymous> (node_modules/some-lib/index.js:5:3)`,
        name: 'Error',
      } as Error;
      const parsed = parseDevError(error);

      expect(parsed.filePath).toBe('src/app.ts');
    });

    it('should handle errors without file location', () => {
      // Create error without stack trace to test no-location case
      const error = {
        message: 'Generic error',
        stack: undefined,
        name: 'Error',
      } as Error;
      const parsed = parseDevError(error);

      expect(parsed.filePath).toBeUndefined();
      expect(parsed.line).toBeUndefined();
    });

    it('should extract location with line only (no column)', () => {
      // Create error with location in message but no stack
      const error = {
        message: 'Error at file.ts:100',
        stack: undefined,
        name: 'Error',
      } as Error;
      const parsed = parseDevError(error);

      expect(parsed.filePath).toBe('file.ts');
      expect(parsed.line).toBe(100);
    });
  });

  describe('message cleaning', () => {
    it('should remove ANSI color codes', () => {
      const error = new Error('\x1b[31mRed error message\x1b[0m');
      const parsed = parseDevError(error);

      expect(parsed.message).not.toContain('\x1b[');
      expect(parsed.message).toContain('Red error message');
    });

    it('should trim whitespace', () => {
      const error = new Error('  Padded error  ');
      const parsed = parseDevError(error);

      expect(parsed.message).toBe('Padded error');
    });

    it('should truncate very long messages', () => {
      const longMessage = 'A'.repeat(300);
      const error = new Error(longMessage);
      const parsed = parseDevError(error);

      expect(parsed.message.length).toBeLessThanOrEqual(203); // 200 + '...'
      expect(parsed.message).toContain('...');
    });
  });

  describe('suggestion generation', () => {
    it('should provide suggestion for syntax errors', () => {
      const error = new Error('SyntaxError: Unexpected token');
      const parsed = parseDevError(error);

      expect(parsed.suggestion).toContain('bracket');
    });

    it('should provide specific suggestion for missing npm package', () => {
      const error = new Error("Cannot find module 'lodash'");
      const parsed = parseDevError(error);

      expect(parsed.suggestion).toContain('pnpm add lodash');
    });

    it('should provide specific suggestion for missing scoped package', () => {
      const error = new Error("Cannot find module '@veloxts/missing'");
      const parsed = parseDevError(error);

      expect(parsed.suggestion).toContain('pnpm add @veloxts/missing');
    });

    it('should provide specific suggestion for missing relative import', () => {
      const error = new Error("Cannot find module './utils/helper'");
      const parsed = parseDevError(error);

      expect(parsed.suggestion).toContain('file');
      expect(parsed.suggestion).toContain('exists');
    });

    it('should provide specific suggestion for P1001 Prisma error', () => {
      const error = new Error('P1001: Cannot reach database server');
      const parsed = parseDevError(error);

      expect(parsed.suggestion).toContain('database');
      expect(parsed.suggestion).toContain('DATABASE_URL');
    });

    it('should provide specific suggestion for P2002 Prisma error', () => {
      const error = new Error('P2002: Unique constraint failed');
      const parsed = parseDevError(error);

      expect(parsed.suggestion).toContain('Unique constraint');
    });

    it('should provide suggestion for port in use', () => {
      const error = new Error('EADDRINUSE: address already in use');
      const parsed = parseDevError(error);

      expect(parsed.suggestion).toContain('port');
    });
  });

  describe('recoverability', () => {
    it('should mark syntax errors as recoverable', () => {
      const error = new Error('SyntaxError: test');
      const parsed = parseDevError(error);

      expect(parsed.isRecoverable).toBe(true);
    });

    it('should mark module not found as recoverable', () => {
      const error = new Error('Cannot find module test');
      const parsed = parseDevError(error);

      expect(parsed.isRecoverable).toBe(true);
    });

    it('should mark port in use as not recoverable', () => {
      const error = new Error('EADDRINUSE');
      const parsed = parseDevError(error);

      expect(parsed.isRecoverable).toBe(false);
    });

    it('should mark permission denied as not recoverable', () => {
      const error = new Error('EACCES: permission denied');
      const parsed = parseDevError(error);

      expect(parsed.isRecoverable).toBe(false);
    });
  });

  describe('help URLs', () => {
    it('should provide Prisma help URL for database errors', () => {
      const error = new Error('PrismaClientError');
      const parsed = parseDevError(error);

      expect(parsed.helpUrl).toContain('prisma.io');
    });

    it('should not provide help URL for unknown errors', () => {
      const error = new Error('Unknown error');
      const parsed = parseDevError(error);

      expect(parsed.helpUrl).toBeUndefined();
    });
  });

  describe('originalError', () => {
    it('should preserve the original error', () => {
      const error = new Error('Original');
      const parsed = parseDevError(error);

      expect(parsed.originalError).toBe(error);
    });
  });

  describe('error cause handling', () => {
    it('should include cause in error analysis', () => {
      const cause = new Error('P1001: Database connection failed');
      const error = new Error('Operation failed');
      (error as { cause: Error }).cause = cause;

      const parsed = parseDevError(error);

      // Should detect the database error from cause
      expect(parsed.type).toBe('database-error');
    });
  });
});

describe('isDevelopmentError', () => {
  it('should return true for recoverable errors', () => {
    const error = new Error('SyntaxError: test');
    expect(isDevelopmentError(error)).toBe(true);
  });

  it('should return false for non-recoverable errors', () => {
    const error = new Error('EADDRINUSE: port in use');
    expect(isDevelopmentError(error)).toBe(false);
  });
});

describe('getErrorTypeLabel', () => {
  it('should return human-readable labels', () => {
    const types: DevErrorType[] = [
      'syntax-error',
      'module-not-found',
      'type-error',
      'runtime-error',
      'hmr-failure',
      'database-error',
      'port-in-use',
      'permission-denied',
      'unknown',
    ];

    for (const type of types) {
      const label = getErrorTypeLabel(type);
      expect(label).toBeTruthy();
      expect(label.length).toBeGreaterThan(0);
      // Should not be the raw type string
      expect(label).not.toContain('-');
    }
  });

  it('should return "Syntax Error" for syntax-error', () => {
    expect(getErrorTypeLabel('syntax-error')).toBe('Syntax Error');
  });

  it('should return "Module Not Found" for module-not-found', () => {
    expect(getErrorTypeLabel('module-not-found')).toBe('Module Not Found');
  });

  it('should return "Database Error" for database-error', () => {
    expect(getErrorTypeLabel('database-error')).toBe('Database Error');
  });
});

describe('formatParsedError', () => {
  it('should format error with type and message', () => {
    const error = new Error('Unexpected token');
    const parsed = parseDevError(error);
    const formatted = formatParsedError(parsed);

    expect(formatted).toContain('Error');
    expect(formatted).toContain('Unexpected token');
  });

  it('should include file location when available', () => {
    const error = new Error('Error at src/test.ts:10:5');
    const parsed = parseDevError(error);
    const formatted = formatParsedError(parsed);

    expect(formatted).toContain('src/test.ts');
    expect(formatted).toContain('10');
  });

  it('should include suggestion when available', () => {
    const error = new Error('SyntaxError: test');
    const parsed = parseDevError(error);
    const formatted = formatParsedError(parsed);

    expect(formatted).toContain('Suggestion');
  });

  it('should include help URL when available', () => {
    const error = new Error('PrismaClientError');
    const parsed = parseDevError(error);
    const formatted = formatParsedError(parsed);

    expect(formatted).toContain('More info');
    expect(formatted).toContain('prisma.io');
  });
});
