/**
 * Procedure Discovery Errors
 *
 * Error classes and factory functions for the discovery system.
 * Uses E40xx error code range.
 *
 * @module discovery/errors
 */

import { DiscoveryErrorCode } from './types.js';

// ============================================================================
// Error Class
// ============================================================================

/**
 * Error thrown during procedure discovery operations
 */
export class DiscoveryError extends Error {
  /** Error code identifier */
  public readonly code: DiscoveryErrorCode;

  /** Optional file path where the error occurred */
  public readonly filePath?: string;

  /** Suggested fix for the error */
  public readonly fix?: string;

  /** Additional error details */
  public readonly details?: Record<string, unknown>;

  constructor(
    code: DiscoveryErrorCode,
    message: string,
    options?: {
      readonly filePath?: string;
      readonly fix?: string;
      readonly details?: Record<string, unknown>;
      readonly cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'DiscoveryError';
    this.code = code;
    this.filePath = options?.filePath;
    this.fix = options?.fix;
    this.details = options?.details;
  }

  /**
   * Format the error for display
   */
  format(): string {
    let output = `DiscoveryError[${this.code}]: ${this.message}`;

    if (this.filePath) {
      output += `\n\n  File: ${this.filePath}`;
    }

    if (this.fix) {
      output += `\n\n  Fix: ${this.fix}`;
    }

    return output;
  }

  /**
   * Convert to JSON for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      filePath: this.filePath,
      fix: this.fix,
      details: this.details,
    };
  }
}

// ============================================================================
// Type Guard
// ============================================================================

/**
 * Type guard to check if an error is a DiscoveryError
 */
export function isDiscoveryError(error: unknown): error is DiscoveryError {
  return error instanceof DiscoveryError;
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create error for directory not found
 */
export function directoryNotFound(path: string): DiscoveryError {
  return new DiscoveryError(
    DiscoveryErrorCode.DIRECTORY_NOT_FOUND,
    `Procedures directory not found: ${path}`,
    {
      filePath: path,
      fix: 'Create the procedures directory or check the path. Expected structure: src/procedures/*.ts',
    }
  );
}

/**
 * Create error for no procedures found
 */
export function noProceduresFound(path: string, scannedCount: number): DiscoveryError {
  return new DiscoveryError(
    DiscoveryErrorCode.NO_PROCEDURES_FOUND,
    `No procedure collections found in ${path}`,
    {
      filePath: path,
      details: { scannedFiles: scannedCount },
      fix:
        scannedCount === 0
          ? 'Create procedure files using: velox make procedure <name>'
          : 'Ensure files export ProcedureCollection objects using defineProcedures()',
    }
  );
}

/**
 * Create error for invalid export
 */
export function invalidExport(
  filePath: string,
  exportName: string,
  reason: string
): DiscoveryError {
  return new DiscoveryError(
    DiscoveryErrorCode.INVALID_EXPORT,
    `Invalid export '${exportName}' in ${filePath}: ${reason}`,
    {
      filePath,
      details: { exportName, reason },
      fix: 'Export must be a ProcedureCollection created with defineProcedures(namespace, procedures)',
    }
  );
}

/**
 * Create error for file load failure
 */
export function fileLoadError(filePath: string, cause: Error): DiscoveryError {
  return new DiscoveryError(
    DiscoveryErrorCode.FILE_LOAD_ERROR,
    `Failed to load procedure file: ${filePath} - ${cause.message}`,
    {
      filePath,
      cause,
      fix: 'Check for syntax errors or missing dependencies in the file',
    }
  );
}

/**
 * Create error for permission denied
 */
export function permissionDenied(path: string): DiscoveryError {
  return new DiscoveryError(
    DiscoveryErrorCode.PERMISSION_DENIED,
    `Permission denied accessing: ${path}`,
    {
      filePath: path,
      fix: 'Check file permissions and ensure the process has read access',
    }
  );
}

/**
 * Create error for invalid file type
 */
export function invalidFileType(filePath: string, extension: string): DiscoveryError {
  return new DiscoveryError(
    DiscoveryErrorCode.INVALID_FILE_TYPE,
    `Unsupported file type: ${extension}`,
    {
      filePath,
      details: { extension },
      fix: 'Procedure files must be .ts, .js, .mts, or .mjs',
    }
  );
}
