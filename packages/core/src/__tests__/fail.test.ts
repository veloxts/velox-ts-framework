/**
 * @veloxts/core - fail() API Unit Tests
 * Tests for the elegant error creation API
 */

import { afterEach, describe, expect, it } from 'vitest';

import { ERROR_CATALOG } from '../errors/catalog.js';
import { fail, isVeloxFailure, VeloxFailure } from '../errors/fail.js';

describe('VeloxFailure Class', () => {
  describe('constructor', () => {
    it('should create error with code and entry', () => {
      const entry = ERROR_CATALOG['VELOX-1001'];
      const error = new VeloxFailure('VELOX-1001', entry);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(VeloxFailure);
      expect(error.name).toBe('VeloxError');
      expect(error.code).toBe('VELOX-1001');
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Server Already Running');
      expect(error.entry).toBe(entry);
      expect(error.stack).toBeDefined();
    });

    it('should capture stack trace correctly', () => {
      const entry = ERROR_CATALOG['VELOX-1001'];
      const error = new VeloxFailure('VELOX-1001', entry);

      // Stack should not include VeloxFailure constructor
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('VeloxError');
    });

    it('should work with different status codes', () => {
      const error401 = new VeloxFailure('VELOX-3002', ERROR_CATALOG['VELOX-3002']);
      const error403 = new VeloxFailure('VELOX-2003', ERROR_CATALOG['VELOX-2003']);
      const error429 = new VeloxFailure('VELOX-3004', ERROR_CATALOG['VELOX-3004']);
      const error503 = new VeloxFailure('VELOX-4001', ERROR_CATALOG['VELOX-4001']);

      expect(error401.statusCode).toBe(401);
      expect(error403.statusCode).toBe(403);
      expect(error429.statusCode).toBe(429);
      expect(error503.statusCode).toBe(503);
    });
  });

  describe('because() method', () => {
    it('should override the message', () => {
      const error = fail('VELOX-1001').because('Custom reason here');

      expect(error.message).toBe('Custom reason here');
    });

    it('should return this for chaining', () => {
      const error = fail('VELOX-1001');
      const result = error.because('Chained');

      expect(result).toBe(error);
    });

    it('should support variable interpolation in custom message', () => {
      const error = fail('VELOX-1001')
        .because('Server on port ${port} already running')
        .with({ port: 3000 });

      expect(error.message).toBe('Server on port 3000 already running');
    });
  });

  describe('with() method', () => {
    it('should interpolate variables into catalog message', () => {
      // VELOX-3005 has description with interpolation variables
      const error = fail('VELOX-3005').with({ length: 12, required: 32 });

      // The catalog message should be interpolated
      expect(error.message).toContain('session secret');
    });

    it('should return this for chaining', () => {
      const error = fail('VELOX-1001');
      const result = error.with({ key: 'value' });

      expect(result).toBe(error);
    });

    it('should merge multiple with() calls', () => {
      const error = fail('VELOX-1001')
        .because('Error: ${first} and ${second}')
        .with({ first: 'A' })
        .with({ second: 'B' });

      expect(error.message).toBe('Error: A and B');
    });

    it('should handle different value types', () => {
      const error = fail('VELOX-1001')
        .because('String: ${str}, Number: ${num}, Boolean: ${bool}')
        .with({ str: 'hello', num: 42, bool: true });

      expect(error.message).toBe('String: hello, Number: 42, Boolean: true');
    });

    it('should preserve unreplaced variables', () => {
      const error = fail('VELOX-1001').because('Has ${missing} variable').with({});

      expect(error.message).toBe('Has ${missing} variable');
    });

    it('should handle undefined variable values', () => {
      const error = fail('VELOX-1001').because('Value is ${val}').with({ val: undefined });

      expect(error.message).toBe('Value is ${val}');
    });
  });

  describe('suggest() method', () => {
    it('should override the catalog suggestion', () => {
      const error = fail('VELOX-1001').suggest('Custom fix suggestion');

      expect(error.suggestion).toBe('Custom fix suggestion');
    });

    it('should return this for chaining', () => {
      const error = fail('VELOX-1001');
      const result = error.suggest('Fix it');

      expect(result).toBe(error);
    });
  });

  describe('suggestion getter', () => {
    it('should return custom suggestion when set', () => {
      const error = fail('VELOX-1001').suggest('Custom');

      expect(error.suggestion).toBe('Custom');
    });

    it('should return catalog suggestion when no custom set', () => {
      const error = fail('VELOX-1001');

      expect(error.suggestion).toBe(ERROR_CATALOG['VELOX-1001'].fix?.suggestion);
    });

    it('should return undefined for entries without fix', () => {
      // VELOX-3003 has no example in its fix
      const error = fail('VELOX-3003');

      expect(error.suggestion).toBe(ERROR_CATALOG['VELOX-3003'].fix?.suggestion);
    });
  });

  describe('example getter', () => {
    it('should return catalog example', () => {
      const error = fail('VELOX-1001');

      expect(error.example).toBe(ERROR_CATALOG['VELOX-1001'].fix?.example);
    });

    it('should return undefined for entries without example', () => {
      // VELOX-3003 doesn't have an example
      const error = fail('VELOX-3003');

      expect(error.example).toBeUndefined();
    });
  });

  describe('docsUrl getter', () => {
    it('should return catalog docs URL', () => {
      const error = fail('VELOX-1001');

      expect(error.docsUrl).toBe('https://veloxts.dev/errors/VELOX-1001');
    });
  });

  describe('seeAlso getter', () => {
    it('should return related error codes from catalog', () => {
      // VELOX-2001 has seeAlso
      const error = fail('VELOX-2001');

      expect(error.seeAlso).toEqual(['VELOX-2002']);
    });

    it('should return undefined when no related codes', () => {
      const error = fail('VELOX-1001');

      expect(error.seeAlso).toBeUndefined();
    });
  });

  describe('toJSON() method', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should serialize basic error properties', () => {
      const error = fail('VELOX-1001');
      const json = error.toJSON();

      expect(json.error).toBe('VeloxError');
      expect(json.message).toBe('Server Already Running');
      expect(json.statusCode).toBe(500);
      expect(json.code).toBe('VELOX-1001');
    });

    it('should include docs URL when available', () => {
      const error = fail('VELOX-1001');
      const json = error.toJSON();

      expect(json.docs).toBe('https://veloxts.dev/errors/VELOX-1001');
    });

    it('should include fix suggestion in development mode', () => {
      process.env.NODE_ENV = 'development';
      const error = fail('VELOX-1001');
      const json = error.toJSON();

      expect(json.fix).toBeDefined();
    });

    it('should exclude fix suggestion in production mode', () => {
      process.env.NODE_ENV = 'production';
      const error = fail('VELOX-1001');
      const json = error.toJSON();

      expect(json.fix).toBeUndefined();
    });

    it('should include custom suggestion in development mode', () => {
      process.env.NODE_ENV = 'development';
      const error = fail('VELOX-1001').suggest('Custom fix');
      const json = error.toJSON();

      expect(json.fix).toBe('Custom fix');
    });

    it('should handle errors without docs URL', () => {
      // Create a mock entry without docsUrl
      const mockEntry = { ...ERROR_CATALOG['VELOX-1001'] };
      delete mockEntry.docsUrl;
      const error = new VeloxFailure('TEST-001', mockEntry);
      const json = error.toJSON();

      expect(json.docs).toBeUndefined();
    });

    it('should handle errors without fix suggestion', () => {
      // Create a mock entry without fix
      const mockEntry = {
        code: 'TEST-002',
        title: 'Test Error',
        description: 'Test description',
        statusCode: 500,
      };
      const error = new VeloxFailure('TEST-002', mockEntry);

      process.env.NODE_ENV = 'development';
      const json = error.toJSON();

      expect(json.fix).toBeUndefined();
    });
  });

  describe('fluent chaining', () => {
    it('should support full fluent chain', () => {
      const error = fail('VELOX-3005')
        .because('Secret "${name}" has only ${unique} unique characters')
        .with({ name: 'SESSION_SECRET', unique: 8 })
        .suggest('Generate with: openssl rand -base64 32');

      expect(error.message).toBe('Secret "SESSION_SECRET" has only 8 unique characters');
      expect(error.suggestion).toBe('Generate with: openssl rand -base64 32');
      expect(error.code).toBe('VELOX-3005');
    });

    it('should allow chaining in any order', () => {
      const error = fail('VELOX-1001')
        .with({ port: 3000 })
        .suggest('Try another port')
        .because('Port ${port} is in use');

      expect(error.message).toBe('Port 3000 is in use');
      expect(error.suggestion).toBe('Try another port');
    });
  });
});

describe('fail() function', () => {
  it('should create VeloxFailure for valid error code', () => {
    const error = fail('VELOX-1001');

    expect(error).toBeInstanceOf(VeloxFailure);
    expect(error.code).toBe('VELOX-1001');
  });

  it('should create errors for all catalog codes', () => {
    const codes = Object.keys(ERROR_CATALOG);

    for (const code of codes) {
      const error = fail(code);
      expect(error).toBeInstanceOf(VeloxFailure);
      expect(error.code).toBe(code);
    }
  });

  it('should apply interpolation variables when provided', () => {
    const error = fail('VELOX-1001', { port: 3000 });

    // Variables are available for interpolation
    expect(error).toBeInstanceOf(VeloxFailure);
  });

  it('should throw for unknown error code', () => {
    expect(() => fail('UNKNOWN-999')).toThrow('Unknown error code: UNKNOWN-999');
    expect(() => fail('UNKNOWN-999')).toThrow('Check ERROR_CATALOG');
  });

  it('should throw helpful message for unknown codes', () => {
    try {
      fail('INVALID-CODE');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain('INVALID-CODE');
      expect((e as Error).message).toContain('@veloxts/core');
    }
  });

  it('should work with all core errors (1XXX)', () => {
    const coreErrors = ['VELOX-1001', 'VELOX-1002', 'VELOX-1003', 'VELOX-1004', 'VELOX-1005'];
    for (const code of coreErrors) {
      expect(fail(code).code).toBe(code);
    }
  });

  it('should work with all router errors (2XXX)', () => {
    const routerErrors = [
      'VELOX-2001',
      'VELOX-2002',
      'VELOX-2003',
      'VELOX-2004',
      'VELOX-2005',
      'VELOX-2006',
      'VELOX-2007',
    ];
    for (const code of routerErrors) {
      expect(fail(code).code).toBe(code);
    }
  });

  it('should work with all auth errors (3XXX)', () => {
    const authErrors = [
      'VELOX-3001',
      'VELOX-3002',
      'VELOX-3003',
      'VELOX-3004',
      'VELOX-3005',
      'VELOX-3006',
      'VELOX-3007',
    ];
    for (const code of authErrors) {
      expect(fail(code).code).toBe(code);
    }
  });

  it('should work with all orm errors (4XXX)', () => {
    const ormErrors = ['VELOX-4001', 'VELOX-4002', 'VELOX-4003'];
    for (const code of ormErrors) {
      expect(fail(code).code).toBe(code);
    }
  });

  it('should work with all validation errors (5XXX)', () => {
    const validationErrors = ['VELOX-5001', 'VELOX-5002'];
    for (const code of validationErrors) {
      expect(fail(code).code).toBe(code);
    }
  });

  it('should work with all client errors (6XXX)', () => {
    const clientErrors = ['VELOX-6001', 'VELOX-6002'];
    for (const code of clientErrors) {
      expect(fail(code).code).toBe(code);
    }
  });
});

describe('isVeloxFailure() type guard', () => {
  it('should return true for VeloxFailure instances', () => {
    const error = fail('VELOX-1001');

    expect(isVeloxFailure(error)).toBe(true);
  });

  it('should return true for VeloxFailure created directly', () => {
    const entry = ERROR_CATALOG['VELOX-1001'];
    const error = new VeloxFailure('VELOX-1001', entry);

    expect(isVeloxFailure(error)).toBe(true);
  });

  it('should return false for standard Error', () => {
    const error = new Error('Standard error');

    expect(isVeloxFailure(error)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isVeloxFailure(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isVeloxFailure(undefined)).toBe(false);
  });

  it('should return false for strings', () => {
    expect(isVeloxFailure('error string')).toBe(false);
  });

  it('should return false for numbers', () => {
    expect(isVeloxFailure(500)).toBe(false);
  });

  it('should return false for objects', () => {
    expect(isVeloxFailure({ message: 'error', code: 'VELOX-1001' })).toBe(false);
  });

  it('should return false for arrays', () => {
    expect(isVeloxFailure(['error'])).toBe(false);
  });

  it('should return false for TypeError', () => {
    expect(isVeloxFailure(new TypeError('Type error'))).toBe(false);
  });

  it('should return false for SyntaxError', () => {
    expect(isVeloxFailure(new SyntaxError('Syntax error'))).toBe(false);
  });
});

describe('Integration: Error throwing patterns', () => {
  it('should work with try/catch', () => {
    try {
      throw fail('VELOX-1001');
    } catch (e) {
      expect(isVeloxFailure(e)).toBe(true);
      if (isVeloxFailure(e)) {
        expect(e.code).toBe('VELOX-1001');
        expect(e.statusCode).toBe(500);
      }
    }
  });

  it('should work with async/await error handling', async () => {
    const asyncOp = async () => {
      throw fail('VELOX-3002');
    };

    await expect(asyncOp()).rejects.toThrow();

    try {
      await asyncOp();
    } catch (e) {
      expect(isVeloxFailure(e)).toBe(true);
      if (isVeloxFailure(e)) {
        expect(e.statusCode).toBe(401);
      }
    }
  });

  it('should support conditional throwing', () => {
    const validate = (value: number) => {
      if (value < 0) {
        throw fail('VELOX-5001').because('Value must be non-negative');
      }
      return value;
    };

    expect(() => validate(-1)).toThrow('Value must be non-negative');
    expect(validate(5)).toBe(5);
  });

  it('should support error transformation in middleware', () => {
    const errorToResponse = (error: unknown) => {
      if (isVeloxFailure(error)) {
        return error.toJSON();
      }
      return { error: 'Unknown', message: String(error), statusCode: 500, code: 'UNKNOWN' };
    };

    const veloxError = fail('VELOX-2003');
    const response = errorToResponse(veloxError);

    expect(response.code).toBe('VELOX-2003');
    expect(response.statusCode).toBe(403);
  });
});

describe('Edge cases', () => {
  it('should handle empty interpolation object', () => {
    const error = fail('VELOX-1001').with({});

    expect(error.message).toBeDefined();
  });

  it('should handle multiple because() calls (last wins)', () => {
    const error = fail('VELOX-1001').because('First message').because('Second message');

    expect(error.message).toBe('Second message');
  });

  it('should handle multiple suggest() calls (last wins)', () => {
    const error = fail('VELOX-1001').suggest('First suggestion').suggest('Second suggestion');

    expect(error.suggestion).toBe('Second suggestion');
  });

  it('should handle special characters in interpolation', () => {
    const error = fail('VELOX-1001')
      .because('Path: ${path}')
      .with({ path: '/foo/bar?query=1&other=2' });

    expect(error.message).toBe('Path: /foo/bar?query=1&other=2');
  });

  it('should handle numeric zero in interpolation', () => {
    const error = fail('VELOX-1001').because('Count: ${count}').with({ count: 0 });

    expect(error.message).toBe('Count: 0');
  });

  it('should handle boolean false in interpolation', () => {
    const error = fail('VELOX-1001').because('Enabled: ${enabled}').with({ enabled: false });

    expect(error.message).toBe('Enabled: false');
  });

  it('should preserve error identity through chaining', () => {
    const original = fail('VELOX-1001');
    const chained = original.because('test').with({ k: 'v' }).suggest('fix');

    expect(chained).toBe(original);
  });
});
