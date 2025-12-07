/**
 * Error classes for @veloxts/router
 *
 * Provides specialized error types for the routing system, including
 * guard authorization failures.
 *
 * @module errors
 */

import { VeloxError } from '@veloxts/core';

// ============================================================================
// Error Code Types
// ============================================================================

/**
 * Error codes specific to the router package
 */
export type RouterErrorCode = 'GUARD_FAILED' | 'UNAUTHORIZED' | 'FORBIDDEN';

// ============================================================================
// Guard Error
// ============================================================================

/**
 * Guard error response type for API responses
 */
export interface GuardErrorResponse {
  error: 'GuardError';
  message: string;
  statusCode: number;
  code: 'GUARD_FAILED';
  guardName: string;
}

/**
 * Error thrown when a guard check fails
 *
 * Used to signal authorization failures in a type-safe way without
 * mutating error objects. Integrates with the VeloxTS error system
 * and provides proper HTTP status codes.
 *
 * @example
 * ```typescript
 * // In guard execution
 * if (!passed) {
 *   throw new GuardError('authenticated', 'Authentication required', 401);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In error handler
 * if (isGuardError(error)) {
 *   reply.status(error.statusCode).send({
 *     error: 'GuardError',
 *     message: error.message,
 *     guardName: error.guardName,
 *   });
 * }
 * ```
 */
export class GuardError extends VeloxError<'GUARD_FAILED'> {
  /**
   * Name of the guard that failed
   */
  public readonly guardName: string;

  /**
   * Creates a new GuardError instance
   *
   * @param guardName - Name of the guard that failed (for debugging)
   * @param message - Human-readable error message
   * @param statusCode - HTTP status code (default: 403 Forbidden)
   */
  constructor(guardName: string, message: string, statusCode: number = 403) {
    super(message, statusCode, 'GUARD_FAILED');
    this.name = 'GuardError';
    this.guardName = guardName;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GuardError);
    }
  }

  /**
   * Converts guard error to JSON format for API responses
   *
   * @returns Guard error response with guard name
   */
  override toJSON(): GuardErrorResponse {
    return {
      error: 'GuardError',
      message: this.message,
      statusCode: this.statusCode,
      code: 'GUARD_FAILED',
      guardName: this.guardName,
    };
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an error is a GuardError
 *
 * @param error - Error to check
 * @returns true if error is a GuardError instance
 *
 * @example
 * ```typescript
 * try {
 *   await executeProcedure(proc, input, ctx);
 * } catch (error) {
 *   if (isGuardError(error)) {
 *     console.log(`Guard "${error.guardName}" failed:`, error.message);
 *   }
 * }
 * ```
 */
export function isGuardError(error: unknown): error is GuardError {
  return error instanceof GuardError;
}
