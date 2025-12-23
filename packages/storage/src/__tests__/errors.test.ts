/**
 * Storage Errors Tests
 */

import { describe, expect, it } from 'vitest';

import {
  FileExistsError,
  FileNotFoundError,
  InvalidPathError,
  isFileNotFoundError,
  isPermissionDeniedError,
  isStorageError,
  PermissionDeniedError,
  QuotaExceededError,
  S3Error,
  StorageConfigError,
  StorageError,
} from '../errors.js';

describe('StorageError base class', () => {
  it('should be an abstract base class for storage errors', () => {
    const error = new FileNotFoundError('/path/to/file');
    expect(error).toBeInstanceOf(StorageError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('FileNotFoundError', () => {
  it('should create error with path', () => {
    const error = new FileNotFoundError('/uploads/image.jpg');

    expect(error.message).toBe('File not found: /uploads/image.jpg');
    expect(error.code).toBe('FILE_NOT_FOUND');
    expect(error.path).toBe('/uploads/image.jpg');
    expect(error.name).toBe('FileNotFoundError');
  });

  it('should have proper stack trace', () => {
    const error = new FileNotFoundError('/test.txt');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('FileNotFoundError');
  });
});

describe('FileExistsError', () => {
  it('should create error with path', () => {
    const error = new FileExistsError('/uploads/duplicate.jpg');

    expect(error.message).toBe('File already exists: /uploads/duplicate.jpg');
    expect(error.code).toBe('FILE_EXISTS');
    expect(error.path).toBe('/uploads/duplicate.jpg');
    expect(error.name).toBe('FileExistsError');
  });
});

describe('InvalidPathError', () => {
  it('should create error with path and reason', () => {
    const error = new InvalidPathError('../../../etc/passwd', 'Path traversal not allowed');

    expect(error.message).toBe('Invalid path "../../../etc/passwd": Path traversal not allowed');
    expect(error.code).toBe('INVALID_PATH');
    expect(error.path).toBe('../../../etc/passwd');
    expect(error.reason).toBe('Path traversal not allowed');
    expect(error.name).toBe('InvalidPathError');
  });
});

describe('PermissionDeniedError', () => {
  it('should create error with path and operation', () => {
    const error = new PermissionDeniedError('/private/secret.txt', 'read');

    expect(error.message).toBe('Permission denied for read on: /private/secret.txt');
    expect(error.code).toBe('PERMISSION_DENIED');
    expect(error.path).toBe('/private/secret.txt');
    expect(error.operation).toBe('read');
    expect(error.name).toBe('PermissionDeniedError');
  });
});

describe('QuotaExceededError', () => {
  it('should create error with message', () => {
    const error = new QuotaExceededError('Storage quota exceeded');

    expect(error.message).toBe('Storage quota exceeded');
    expect(error.code).toBe('QUOTA_EXCEEDED');
    expect(error.name).toBe('QuotaExceededError');
  });

  it('should include limit and current values', () => {
    const error = new QuotaExceededError('Storage quota exceeded', 1000000, 1500000);

    expect(error.limit).toBe(1000000);
    expect(error.current).toBe(1500000);
  });

  it('should work without limit values', () => {
    const error = new QuotaExceededError('Quota exceeded');

    expect(error.limit).toBeUndefined();
    expect(error.current).toBeUndefined();
  });
});

describe('StorageConfigError', () => {
  it('should create error with driver and message', () => {
    const error = new StorageConfigError('s3', 'Missing bucket name');

    expect(error.message).toBe('Storage configuration error (s3): Missing bucket name');
    expect(error.code).toBe('STORAGE_CONFIG_ERROR');
    expect(error.driver).toBe('s3');
    expect(error.name).toBe('StorageConfigError');
  });
});

describe('S3Error', () => {
  it('should create error with operation and message', () => {
    const error = new S3Error('PutObject', 'Access Denied');

    expect(error.message).toBe('S3 PutObject failed: Access Denied');
    expect(error.code).toBe('S3_ERROR');
    expect(error.operation).toBe('PutObject');
    expect(error.name).toBe('S3Error');
  });

  it('should include status code when provided', () => {
    const error = new S3Error('GetObject', 'Not Found', 404);

    expect(error.statusCode).toBe(404);
  });

  it('should work without status code', () => {
    const error = new S3Error('DeleteObject', 'Unknown error');

    expect(error.statusCode).toBeUndefined();
  });
});

describe('Type guards', () => {
  describe('isStorageError', () => {
    it('should return true for StorageError instances', () => {
      expect(isStorageError(new FileNotFoundError('/test'))).toBe(true);
      expect(isStorageError(new FileExistsError('/test'))).toBe(true);
      expect(isStorageError(new PermissionDeniedError('/test', 'read'))).toBe(true);
      expect(isStorageError(new S3Error('Get', 'Failed'))).toBe(true);
    });

    it('should return false for non-StorageError values', () => {
      expect(isStorageError(new Error('Regular error'))).toBe(false);
      expect(isStorageError(null)).toBe(false);
      expect(isStorageError(undefined)).toBe(false);
      expect(isStorageError('error string')).toBe(false);
      expect(isStorageError({ message: 'fake error' })).toBe(false);
    });
  });

  describe('isFileNotFoundError', () => {
    it('should return true for FileNotFoundError', () => {
      expect(isFileNotFoundError(new FileNotFoundError('/test'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isFileNotFoundError(new FileExistsError('/test'))).toBe(false);
      expect(isFileNotFoundError(new Error('not found'))).toBe(false);
    });
  });

  describe('isPermissionDeniedError', () => {
    it('should return true for PermissionDeniedError', () => {
      expect(isPermissionDeniedError(new PermissionDeniedError('/test', 'write'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isPermissionDeniedError(new FileNotFoundError('/test'))).toBe(false);
      expect(isPermissionDeniedError(new Error('permission denied'))).toBe(false);
    });
  });
});

describe('Error inheritance chain', () => {
  it('should have correct prototype chain', () => {
    const errors = [
      new FileNotFoundError('/test'),
      new FileExistsError('/test'),
      new InvalidPathError('/test', 'reason'),
      new PermissionDeniedError('/test', 'read'),
      new QuotaExceededError('message'),
      new StorageConfigError('s3', 'message'),
      new S3Error('op', 'message'),
    ];

    for (const error of errors) {
      expect(error instanceof Error).toBe(true);
      expect(error instanceof StorageError).toBe(true);
    }
  });
});
