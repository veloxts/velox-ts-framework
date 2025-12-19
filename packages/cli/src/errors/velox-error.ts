/**
 * VeloxError Base Class
 *
 * A structured error class with error codes, fix suggestions, and JSON serialization.
 * All VeloxTS CLI errors extend this class.
 */

import pc from 'picocolors';

import { ERROR_CATALOG, getErrorDefinition, type ErrorDefinition } from './catalog.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Location information for an error
 */
export interface ErrorLocation {
  /** File path where the error occurred */
  readonly file?: string;
  /** Line number (1-indexed) */
  readonly line?: number;
  /** Column number (1-indexed) */
  readonly column?: number;
}

/**
 * Options for creating a VeloxError
 */
export interface VeloxErrorOptions {
  /** Custom message (overrides catalog message) */
  message?: string;
  /** Suggested fix (overrides catalog fix) */
  fix?: string;
  /** Location where the error occurred */
  location?: ErrorLocation;
  /** Additional context/details */
  details?: Record<string, unknown>;
  /** Original error that caused this error */
  cause?: Error;
}

// ============================================================================
// VeloxError Class
// ============================================================================

/**
 * Base error class for all VeloxTS CLI errors.
 *
 * Features:
 * - Error codes from central catalog (E1001, E2001, etc.)
 * - Optional fix suggestions
 * - Optional location information
 * - JSON serialization for --json output
 * - Formatted console output with colors
 *
 * @example
 * ```typescript
 * // Using a catalog code
 * throw new VeloxError('E2001');
 *
 * // With custom message and location
 * throw new VeloxError('E5003', {
 *   message: 'Failed to compile users.ts',
 *   location: { file: 'src/procedures/users.ts', line: 42 }
 * });
 *
 * // Using factory methods
 * throw VeloxError.notFound('User', '123');
 * ```
 */
export class VeloxError extends Error {
  /** Error code (e.g., 'E2001') */
  public readonly code: string;

  /** Error name from catalog (e.g., 'NOT_IN_PROJECT') */
  public readonly errorName: string;

  /** Suggested fix for the error */
  public readonly fix?: string;

  /** URL to documentation about this error */
  public readonly docsUrl?: string;

  /** Location where the error occurred */
  public readonly location?: ErrorLocation;

  /** Additional context/details */
  public readonly details?: Record<string, unknown>;

  constructor(code: string, options?: VeloxErrorOptions) {
    const definition = getErrorDefinition(code);
    const message = options?.message ?? definition?.message ?? 'Unknown error';

    super(message, { cause: options?.cause });

    this.name = 'VeloxError';
    this.code = code;
    this.errorName = definition?.name ?? 'UNKNOWN';
    this.fix = options?.fix ?? definition?.fix;
    this.docsUrl = definition?.docsUrl;
    this.location = options?.location;
    this.details = options?.details;
  }

  // ==========================================================================
  // Formatting
  // ==========================================================================

  /**
   * Format error for console display with colors
   */
  format(): string {
    const lines: string[] = [];

    // Error header: VeloxError[E2001]: Message
    lines.push(pc.red(`VeloxError[${this.code}]: ${this.message}`));

    // Location
    if (this.location?.file) {
      let locationStr = `  at ${this.location.file}`;
      if (this.location.line !== undefined) {
        locationStr += `:${this.location.line}`;
        if (this.location.column !== undefined) {
          locationStr += `:${this.location.column}`;
        }
      }
      lines.push(pc.dim(locationStr));
    }

    // Details
    if (this.details && Object.keys(this.details).length > 0) {
      lines.push('');
      lines.push(pc.dim('  Details:'));
      for (const [key, value] of Object.entries(this.details)) {
        lines.push(pc.dim(`    ${key}: ${String(value)}`));
      }
    }

    // Fix suggestion
    if (this.fix) {
      lines.push('');
      lines.push(pc.yellow(`  Fix: ${this.fix}`));
    }

    // Docs URL
    if (this.docsUrl) {
      lines.push(pc.dim(`  Docs: ${this.docsUrl}`));
    }

    return lines.join('\n');
  }

  /**
   * Format error for console display without colors
   */
  formatPlain(): string {
    const lines: string[] = [];

    lines.push(`VeloxError[${this.code}]: ${this.message}`);

    if (this.location?.file) {
      let locationStr = `  at ${this.location.file}`;
      if (this.location.line !== undefined) {
        locationStr += `:${this.location.line}`;
        if (this.location.column !== undefined) {
          locationStr += `:${this.location.column}`;
        }
      }
      lines.push(locationStr);
    }

    if (this.details && Object.keys(this.details).length > 0) {
      lines.push('');
      lines.push('  Details:');
      for (const [key, value] of Object.entries(this.details)) {
        lines.push(`    ${key}: ${String(value)}`);
      }
    }

    if (this.fix) {
      lines.push('');
      lines.push(`  Fix: ${this.fix}`);
    }

    if (this.docsUrl) {
      lines.push(`  Docs: ${this.docsUrl}`);
    }

    return lines.join('\n');
  }

  // ==========================================================================
  // JSON Serialization
  // ==========================================================================

  /**
   * Convert to JSON for --json output
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      name: this.errorName,
      message: this.message,
      fix: this.fix,
      docsUrl: this.docsUrl,
      location: this.location,
      details: this.details,
    };
  }

  // ==========================================================================
  // Factory Methods for Common Errors
  // ==========================================================================

  /**
   * Create a NOT_FOUND error (E1001)
   */
  static notFound(resource: string, id?: string): VeloxError {
    const message = id ? `${resource} not found: ${id}` : `${resource} not found`;
    return new VeloxError('E1001', {
      message,
      details: { resource, id },
    });
  }

  /**
   * Create a VALIDATION_FAILED error (E1002)
   */
  static validation(message: string, details?: Record<string, unknown>): VeloxError {
    return new VeloxError('E1002', { message, details });
  }

  /**
   * Create an UNAUTHORIZED error (E1003)
   */
  static unauthorized(message = 'Authentication required'): VeloxError {
    return new VeloxError('E1003', { message });
  }

  /**
   * Create a FORBIDDEN error (E1004)
   */
  static forbidden(message = 'Access denied'): VeloxError {
    return new VeloxError('E1004', { message });
  }

  /**
   * Create a CONFLICT error (E1005)
   */
  static conflict(message: string, details?: Record<string, unknown>): VeloxError {
    return new VeloxError('E1005', { message, details });
  }

  /**
   * Create an INTERNAL_ERROR (E1006)
   */
  static internal(message: string, cause?: Error): VeloxError {
    return new VeloxError('E1006', { message, cause });
  }

  // ==========================================================================
  // Static Utilities
  // ==========================================================================

  /**
   * Check if an error is a VeloxError
   */
  static isVeloxError(error: unknown): error is VeloxError {
    return error instanceof VeloxError;
  }

  /**
   * Get all available error codes
   */
  static getCodes(): string[] {
    return Object.keys(ERROR_CATALOG);
  }

  /**
   * Get error definition from catalog
   */
  static getDefinition(code: string): ErrorDefinition | undefined {
    return getErrorDefinition(code);
  }
}
