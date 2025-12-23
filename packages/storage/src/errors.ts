/**
 * Storage Errors
 *
 * Custom error classes for storage operations with descriptive messages.
 */

/**
 * Base error class for all storage errors.
 */
export abstract class StorageError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace for where error was thrown (V8 engines)
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error thrown when a file is not found.
 */
export class FileNotFoundError extends StorageError {
  readonly code = 'FILE_NOT_FOUND';
  readonly path: string;

  constructor(path: string) {
    super(`File not found: ${path}`);
    this.path = path;
  }
}

/**
 * Error thrown when a file already exists (during exclusive creation).
 */
export class FileExistsError extends StorageError {
  readonly code = 'FILE_EXISTS';
  readonly path: string;

  constructor(path: string) {
    super(`File already exists: ${path}`);
    this.path = path;
  }
}

/**
 * Error thrown when an invalid path is provided.
 */
export class InvalidPathError extends StorageError {
  readonly code = 'INVALID_PATH';
  readonly path: string;
  readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Invalid path "${path}": ${reason}`);
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when storage permission is denied.
 */
export class PermissionDeniedError extends StorageError {
  readonly code = 'PERMISSION_DENIED';
  readonly path: string;
  readonly operation: string;

  constructor(path: string, operation: string) {
    super(`Permission denied for ${operation} on: ${path}`);
    this.path = path;
    this.operation = operation;
  }
}

/**
 * Error thrown when storage quota is exceeded.
 */
export class QuotaExceededError extends StorageError {
  readonly code = 'QUOTA_EXCEEDED';
  readonly limit?: number;
  readonly current?: number;

  constructor(message: string, limit?: number, current?: number) {
    super(message);
    this.limit = limit;
    this.current = current;
  }
}

/**
 * Error thrown when storage driver is misconfigured.
 */
export class StorageConfigError extends StorageError {
  readonly code = 'STORAGE_CONFIG_ERROR';
  readonly driver: string;

  constructor(driver: string, message: string) {
    super(`Storage configuration error (${driver}): ${message}`);
    this.driver = driver;
  }
}

/**
 * Error thrown when S3 operation fails.
 */
export class S3Error extends StorageError {
  readonly code = 'S3_ERROR';
  readonly operation: string;
  readonly statusCode?: number;

  constructor(operation: string, message: string, statusCode?: number) {
    super(`S3 ${operation} failed: ${message}`);
    this.operation = operation;
    this.statusCode = statusCode;
  }
}

/**
 * Type guard to check if an error is a StorageError.
 */
export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError;
}

/**
 * Type guard to check if an error is a FileNotFoundError.
 */
export function isFileNotFoundError(error: unknown): error is FileNotFoundError {
  return error instanceof FileNotFoundError;
}

/**
 * Type guard to check if an error is a PermissionDeniedError.
 */
export function isPermissionDeniedError(error: unknown): error is PermissionDeniedError {
  return error instanceof PermissionDeniedError;
}
