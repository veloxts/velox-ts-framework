/**
 * Tests for Error Catalog and Formatter
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ERROR_CATALOG,
  ERROR_DOMAINS,
  extractErrorLocation,
  formatError,
  formatErrorForApi,
  formatErrorOneLine,
  getDocsUrl,
  getErrorEntry,
  getErrorsByDomain,
  isKnownErrorCode,
  logDeprecation,
  logWarning,
  VeloxError,
} from '../errors';

// ============================================================================
// Error Catalog Tests
// ============================================================================

describe('Error Catalog', () => {
  describe('ERROR_DOMAINS', () => {
    it('should have correct domain numbers', () => {
      expect(ERROR_DOMAINS.CORE).toBe(1);
      expect(ERROR_DOMAINS.ROUTER).toBe(2);
      expect(ERROR_DOMAINS.AUTH).toBe(3);
      expect(ERROR_DOMAINS.ORM).toBe(4);
      expect(ERROR_DOMAINS.VALIDATION).toBe(5);
      expect(ERROR_DOMAINS.CLIENT).toBe(6);
    });
  });

  describe('ERROR_CATALOG', () => {
    it('should have entries for core errors', () => {
      expect(ERROR_CATALOG['VELOX-1001']).toBeDefined();
      expect(ERROR_CATALOG['VELOX-1001'].title).toBe('Server Already Running');
    });

    it('should have entries for router errors', () => {
      expect(ERROR_CATALOG['VELOX-2001']).toBeDefined();
      expect(ERROR_CATALOG['VELOX-2001'].title).toBe('Procedure Missing Input Schema');
    });

    it('should have entries for auth errors', () => {
      expect(ERROR_CATALOG['VELOX-3001']).toBeDefined();
      expect(ERROR_CATALOG['VELOX-3001'].title).toBe('Invalid JWT Secret');
    });

    it('should have entries for ORM errors', () => {
      expect(ERROR_CATALOG['VELOX-4001']).toBeDefined();
      expect(ERROR_CATALOG['VELOX-4001'].title).toBe('Database Connection Failed');
    });

    it('should have entries for validation errors', () => {
      expect(ERROR_CATALOG['VELOX-5001']).toBeDefined();
      expect(ERROR_CATALOG['VELOX-5001'].title).toBe('Validation Failed');
    });

    it('should have entries for client errors', () => {
      expect(ERROR_CATALOG['VELOX-6001']).toBeDefined();
      expect(ERROR_CATALOG['VELOX-6001'].title).toBe('Network Request Failed');
    });

    it('each entry should have required fields', () => {
      for (const [code, entry] of Object.entries(ERROR_CATALOG)) {
        expect(entry.code).toBe(code);
        expect(entry.title).toBeTruthy();
        expect(entry.description).toBeTruthy();
        expect(entry.statusCode).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getErrorEntry', () => {
    it('should return entry for valid code', () => {
      const entry = getErrorEntry('VELOX-1001');
      expect(entry).toBeDefined();
      expect(entry?.code).toBe('VELOX-1001');
    });

    it('should return undefined for invalid code', () => {
      const entry = getErrorEntry('VELOX-9999');
      expect(entry).toBeUndefined();
    });
  });

  describe('getErrorsByDomain', () => {
    it('should return all core error codes', () => {
      const codes = getErrorsByDomain('CORE');
      expect(codes.every((c) => c.startsWith('VELOX-1'))).toBe(true);
      expect(codes.length).toBeGreaterThan(0);
    });

    it('should return all auth error codes', () => {
      const codes = getErrorsByDomain('AUTH');
      expect(codes.every((c) => c.startsWith('VELOX-3'))).toBe(true);
      expect(codes.length).toBeGreaterThan(0);
    });
  });

  describe('isKnownErrorCode', () => {
    it('should return true for known codes', () => {
      expect(isKnownErrorCode('VELOX-1001')).toBe(true);
      expect(isKnownErrorCode('VELOX-3001')).toBe(true);
    });

    it('should return false for unknown codes', () => {
      expect(isKnownErrorCode('VELOX-9999')).toBe(false);
      expect(isKnownErrorCode('INVALID')).toBe(false);
    });
  });

  describe('getDocsUrl', () => {
    it('should return docs URL for known code', () => {
      const url = getDocsUrl('VELOX-1001');
      expect(url).toBe('https://veloxts.dev/errors/VELOX-1001');
    });

    it('should return undefined for unknown code', () => {
      const url = getDocsUrl('VELOX-9999');
      expect(url).toBeUndefined();
    });
  });
});

// ============================================================================
// Error Location Extraction Tests
// ============================================================================

describe('extractErrorLocation', () => {
  it('should extract location from error stack', () => {
    const error = new Error('test error');
    const location = extractErrorLocation(error);

    // Location should be extracted from this test file
    expect(location).toBeDefined();
    expect(location?.file).toContain('error-catalog.test');
    expect(location?.line).toBeGreaterThan(0);
  });

  it('should return undefined if no stack', () => {
    const error = new Error('test');
    error.stack = undefined;
    const location = extractErrorLocation(error);
    expect(location).toBeUndefined();
  });
});

// ============================================================================
// Error Formatting Tests
// ============================================================================

describe('formatError', () => {
  beforeEach(() => {
    // Disable colors for testing
    process.env.NO_COLOR = '1';
  });

  afterEach(() => {
    delete process.env.NO_COLOR;
  });

  it('should format error with catalog code', () => {
    const error = new VeloxError('Server is already running', 500, 'VELOX-1001');
    const formatted = formatError(error, 'VELOX-1001');

    expect(formatted).toContain('VELOX-1001');
    expect(formatted).toContain('Server Already Running');
    expect(formatted).toContain('Server is already running');
    expect(formatted).toContain('How to fix:');
  });

  it('should format error without catalog code', () => {
    const error = new Error('Generic error');
    const formatted = formatError(error);

    expect(formatted).toContain('Error');
    expect(formatted).toContain('Generic error');
  });

  it('should include location when available', () => {
    const error = new VeloxError('Test error', 500);
    const formatted = formatError(error);

    expect(formatted).toContain('Location:');
  });

  it('should include documentation link', () => {
    const error = new VeloxError('Test', 500, 'VELOX-1001');
    const formatted = formatError(error, 'VELOX-1001');

    expect(formatted).toContain('Documentation:');
    expect(formatted).toContain('https://veloxts.dev/errors/VELOX-1001');
  });

  it('should respect includeStack option', () => {
    const error = new VeloxError('Test', 500);
    const withStack = formatError(error, undefined, { includeStack: true });
    const withoutStack = formatError(error, undefined, { includeStack: false });

    expect(withStack).toContain('Stack trace:');
    expect(withoutStack).not.toContain('Stack trace:');
  });
});

describe('formatErrorForApi', () => {
  it('should format error for API response', () => {
    const error = new VeloxError('Test error', 400, 'VELOX-5001');
    const response = formatErrorForApi(error, 'VELOX-5001');

    expect(response.error).toBe('VeloxError');
    expect(response.message).toBe('Test error');
    expect(response.statusCode).toBe(400);
    expect(response.code).toBe('VELOX-5001');
  });

  it('should include docs URL', () => {
    const error = new VeloxError('Test', 500, 'VELOX-1001');
    const response = formatErrorForApi(error, 'VELOX-1001');

    expect(response.docs).toBe('https://veloxts.dev/errors/VELOX-1001');
  });

  it('should include fix in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new VeloxError('Test', 500, 'VELOX-1001');
    const response = formatErrorForApi(error, 'VELOX-1001');

    expect(response.fix).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });

  it('should not include fix in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new VeloxError('Test', 500, 'VELOX-1001');
    const response = formatErrorForApi(error, 'VELOX-1001');

    expect(response.fix).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });
});

describe('formatErrorOneLine', () => {
  beforeEach(() => {
    process.env.NO_COLOR = '1';
  });

  afterEach(() => {
    delete process.env.NO_COLOR;
  });

  it('should format error as one line with catalog code', () => {
    const error = new VeloxError('Test error', 500, 'VELOX-1001');
    const line = formatErrorOneLine(error, 'VELOX-1001');

    expect(line).toBe('VELOX-1001: Test error');
  });

  it('should format error as one line without catalog code', () => {
    const error = new Error('Test error');
    const line = formatErrorOneLine(error);

    expect(line).toBe('Error: Test error');
  });
});

// ============================================================================
// VeloxError with Catalog Integration Tests
// ============================================================================

describe('VeloxError with catalog integration', () => {
  it('should populate fix from catalog', () => {
    const error = new VeloxError('Test', 500, 'VELOX-1001');
    expect(error.fix).toBeDefined();
    expect(error.fix).toContain('Stop the existing server');
  });

  it('should populate docsUrl from catalog', () => {
    const error = new VeloxError('Test', 500, 'VELOX-1001');
    expect(error.docsUrl).toBe('https://veloxts.dev/errors/VELOX-1001');
  });

  it('should not populate fix for non-catalog codes', () => {
    const error = new VeloxError('Test', 500, 'CUSTOM_ERROR');
    expect(error.fix).toBeUndefined();
    expect(error.docsUrl).toBeUndefined();
  });

  it('toJSON should include docs URL', () => {
    const error = new VeloxError('Test', 500, 'VELOX-1001');
    const json = error.toJSON();

    expect(json.docs).toBe('https://veloxts.dev/errors/VELOX-1001');
  });

  it('toJSON should include fix in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new VeloxError('Test', 500, 'VELOX-1001');
    const json = error.toJSON();

    expect(json.fix).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });

  it('format() should return formatted string', () => {
    process.env.NO_COLOR = '1';
    const error = new VeloxError('Test', 500, 'VELOX-1001');
    const formatted = error.format();

    expect(formatted).toContain('VELOX-1001');
    expect(formatted).toContain('Server Already Running');

    delete process.env.NO_COLOR;
  });
});

// ============================================================================
// Warning and Deprecation Tests
// ============================================================================

describe('logWarning', () => {
  it('should log warning message', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.NO_COLOR = '1';

    logWarning('Test warning', 'Fix suggestion');

    expect(warnSpy).toHaveBeenCalled();
    const output = warnSpy.mock.calls[0][0];
    expect(output).toContain('Warning:');
    expect(output).toContain('Test warning');
    expect(output).toContain('Fix suggestion');

    warnSpy.mockRestore();
    delete process.env.NO_COLOR;
  });
});

describe('logDeprecation', () => {
  it('should log deprecation warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.NO_COLOR = '1';

    logDeprecation('oldApi', 'newApi', 'v2.0');

    expect(warnSpy).toHaveBeenCalled();
    const output = warnSpy.mock.calls[0][0];
    expect(output).toContain('oldApi');
    expect(output).toContain('deprecated');
    expect(output).toContain('newApi');
    expect(output).toContain('v2.0');

    warnSpy.mockRestore();
    delete process.env.NO_COLOR;
  });
});
