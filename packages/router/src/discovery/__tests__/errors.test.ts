/**
 * Discovery Errors Tests
 */

import { describe, expect, it } from 'vitest';

import {
  DiscoveryError,
  directoryNotFound,
  fileLoadError,
  invalidExport,
  invalidFileType,
  isDiscoveryError,
  noProceduresFound,
  permissionDenied,
} from '../errors.js';
import { DiscoveryErrorCode } from '../types.js';

// ============================================================================
// DiscoveryError Class Tests
// ============================================================================

describe('DiscoveryError', () => {
  it('should set code, message, and name', () => {
    const error = new DiscoveryError(DiscoveryErrorCode.DIRECTORY_NOT_FOUND, 'Test message');

    expect(error.code).toBe(DiscoveryErrorCode.DIRECTORY_NOT_FOUND);
    expect(error.message).toBe('Test message');
    expect(error.name).toBe('DiscoveryError');
  });

  it('should set optional properties when provided', () => {
    const error = new DiscoveryError(DiscoveryErrorCode.FILE_LOAD_ERROR, 'Test message', {
      filePath: '/path/to/file.ts',
      fix: 'Check the file',
      details: { key: 'value' },
    });

    expect(error.filePath).toBe('/path/to/file.ts');
    expect(error.fix).toBe('Check the file');
    expect(error.details).toEqual({ key: 'value' });
  });

  it('should set cause when provided', () => {
    const cause = new Error('Original error');
    const error = new DiscoveryError(DiscoveryErrorCode.FILE_LOAD_ERROR, 'Test message', {
      cause,
    });

    expect(error.cause).toBe(cause);
  });

  describe('format', () => {
    it('should format error with code and message', () => {
      const error = new DiscoveryError(DiscoveryErrorCode.DIRECTORY_NOT_FOUND, 'Test message');

      const formatted = error.format();

      expect(formatted).toBe('DiscoveryError[E4001]: Test message');
    });

    it('should include file path when provided', () => {
      const error = new DiscoveryError(DiscoveryErrorCode.DIRECTORY_NOT_FOUND, 'Test message', {
        filePath: '/path/to/dir',
      });

      const formatted = error.format();

      expect(formatted).toContain('File: /path/to/dir');
    });

    it('should include fix when provided', () => {
      const error = new DiscoveryError(DiscoveryErrorCode.DIRECTORY_NOT_FOUND, 'Test message', {
        fix: 'Create the directory',
      });

      const formatted = error.format();

      expect(formatted).toContain('Fix: Create the directory');
    });

    it('should include both file path and fix when both provided', () => {
      const error = new DiscoveryError(DiscoveryErrorCode.DIRECTORY_NOT_FOUND, 'Test message', {
        filePath: '/path/to/dir',
        fix: 'Create the directory',
      });

      const formatted = error.format();

      expect(formatted).toContain('File: /path/to/dir');
      expect(formatted).toContain('Fix: Create the directory');
    });
  });

  describe('toJSON', () => {
    it('should return correct JSON shape', () => {
      const error = new DiscoveryError(DiscoveryErrorCode.DIRECTORY_NOT_FOUND, 'Test message', {
        filePath: '/path/to/dir',
        fix: 'Create the directory',
        details: { key: 'value' },
      });

      const json = error.toJSON();

      expect(json).toEqual({
        code: 'E4001',
        message: 'Test message',
        filePath: '/path/to/dir',
        fix: 'Create the directory',
        details: { key: 'value' },
      });
    });

    it('should include undefined for missing optional fields', () => {
      const error = new DiscoveryError(DiscoveryErrorCode.DIRECTORY_NOT_FOUND, 'Test message');

      const json = error.toJSON();

      expect(json.filePath).toBeUndefined();
      expect(json.fix).toBeUndefined();
      expect(json.details).toBeUndefined();
    });
  });
});

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('isDiscoveryError', () => {
  it('should return true for DiscoveryError instances', () => {
    const error = new DiscoveryError(DiscoveryErrorCode.DIRECTORY_NOT_FOUND, 'Test');

    expect(isDiscoveryError(error)).toBe(true);
  });

  it('should return false for regular Error instances', () => {
    const error = new Error('Test');

    expect(isDiscoveryError(error)).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isDiscoveryError(null)).toBe(false);
    expect(isDiscoveryError(undefined)).toBe(false);
    expect(isDiscoveryError('error')).toBe(false);
    expect(isDiscoveryError({})).toBe(false);
  });
});

// ============================================================================
// Error Factory Tests
// ============================================================================

describe('Error Factory Functions', () => {
  describe('directoryNotFound', () => {
    it('should create error with E4001 code', () => {
      const error = directoryNotFound('/path/to/procedures');

      expect(error.code).toBe(DiscoveryErrorCode.DIRECTORY_NOT_FOUND);
    });

    it('should include path in message', () => {
      const error = directoryNotFound('/path/to/procedures');

      expect(error.message).toContain('/path/to/procedures');
    });

    it('should set filePath', () => {
      const error = directoryNotFound('/path/to/procedures');

      expect(error.filePath).toBe('/path/to/procedures');
    });

    it('should have fix suggestion', () => {
      const error = directoryNotFound('/path/to/procedures');

      expect(error.fix).toBeDefined();
      expect(error.fix).toContain('Create');
    });
  });

  describe('noProceduresFound', () => {
    it('should create error with E4002 code', () => {
      const error = noProceduresFound('/path/to/procedures', 5);

      expect(error.code).toBe(DiscoveryErrorCode.NO_PROCEDURES_FOUND);
    });

    it('should include path in message', () => {
      const error = noProceduresFound('/path/to/procedures', 5);

      expect(error.message).toContain('/path/to/procedures');
    });

    it('should include scanned count in details', () => {
      const error = noProceduresFound('/path/to/procedures', 5);

      expect(error.details).toEqual({ scannedFiles: 5 });
    });

    it('should have different fix for zero files vs some files', () => {
      const errorZero = noProceduresFound('/path', 0);
      const errorSome = noProceduresFound('/path', 5);

      expect(errorZero.fix).toContain('velox make');
      expect(errorSome.fix).toContain('defineProcedures');
    });
  });

  describe('invalidExport', () => {
    it('should create error with E4003 code', () => {
      const error = invalidExport('/path/file.ts', 'badExport', 'Invalid structure');

      expect(error.code).toBe(DiscoveryErrorCode.INVALID_EXPORT);
    });

    it('should include file path and export name in message', () => {
      const error = invalidExport('/path/file.ts', 'badExport', 'Invalid structure');

      expect(error.message).toContain('/path/file.ts');
      expect(error.message).toContain('badExport');
      expect(error.message).toContain('Invalid structure');
    });

    it('should set details with export name and reason', () => {
      const error = invalidExport('/path/file.ts', 'badExport', 'Invalid structure');

      expect(error.details).toEqual({
        exportName: 'badExport',
        reason: 'Invalid structure',
      });
    });
  });

  describe('fileLoadError', () => {
    it('should create error with E4004 code', () => {
      const cause = new Error('Syntax error');
      const error = fileLoadError('/path/file.ts', cause);

      expect(error.code).toBe(DiscoveryErrorCode.FILE_LOAD_ERROR);
    });

    it('should include file path and cause message', () => {
      const cause = new Error('Syntax error');
      const error = fileLoadError('/path/file.ts', cause);

      expect(error.message).toContain('/path/file.ts');
      expect(error.message).toContain('Syntax error');
    });

    it('should set cause', () => {
      const cause = new Error('Syntax error');
      const error = fileLoadError('/path/file.ts', cause);

      expect(error.cause).toBe(cause);
    });

    it('should have fix suggestion', () => {
      const cause = new Error('Syntax error');
      const error = fileLoadError('/path/file.ts', cause);

      expect(error.fix).toContain('syntax');
    });
  });

  describe('permissionDenied', () => {
    it('should create error with E4005 code', () => {
      const error = permissionDenied('/path/to/dir');

      expect(error.code).toBe(DiscoveryErrorCode.PERMISSION_DENIED);
    });

    it('should include path in message', () => {
      const error = permissionDenied('/path/to/dir');

      expect(error.message).toContain('/path/to/dir');
    });

    it('should have fix suggestion about permissions', () => {
      const error = permissionDenied('/path/to/dir');

      expect(error.fix).toContain('permission');
    });
  });

  describe('invalidFileType', () => {
    it('should create error with E4006 code', () => {
      const error = invalidFileType('/path/file.xyz', '.xyz');

      expect(error.code).toBe(DiscoveryErrorCode.INVALID_FILE_TYPE);
    });

    it('should include extension in message', () => {
      const error = invalidFileType('/path/file.xyz', '.xyz');

      expect(error.message).toContain('.xyz');
    });

    it('should include extension in details', () => {
      const error = invalidFileType('/path/file.xyz', '.xyz');

      expect(error.details).toEqual({ extension: '.xyz' });
    });

    it('should have fix suggestion with valid extensions', () => {
      const error = invalidFileType('/path/file.xyz', '.xyz');

      expect(error.fix).toContain('.ts');
      expect(error.fix).toContain('.js');
    });
  });
});

// ============================================================================
// Error Code Tests
// ============================================================================

describe('DiscoveryErrorCode', () => {
  it('should have all error codes with unique values', () => {
    const codes = Object.values(DiscoveryErrorCode);
    const uniqueCodes = new Set(codes);

    expect(codes.length).toBe(uniqueCodes.size);
  });

  it('should follow E40xx pattern', () => {
    const codes = Object.values(DiscoveryErrorCode);

    for (const code of codes) {
      expect(code).toMatch(/^E40\d{2}$/);
    }
  });
});
