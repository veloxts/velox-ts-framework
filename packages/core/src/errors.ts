/**
 * Error handling foundation for VeloxTS framework
 * Provides base error classes with HTTP status codes and discriminated unions
 * @module errors
 */

// Import catalog for use in error classes
import { getErrorEntry as _getErrorEntry, ERROR_CATALOG } from './errors/catalog.js';
import { formatError as _formatError } from './errors/formatter.js';

// Re-export the enhanced error catalog and formatter
export {
  ERROR_CATALOG,
  ERROR_DOMAINS,
  type ErrorCatalogEntry,
  type ErrorDomain,
  type ErrorLocation,
  extractErrorLocation,
  type FormatErrorOptions,
  formatError,
  formatErrorForApi,
  formatErrorOneLine,
  getDocsUrl,
  getErrorEntry,
  getErrorsByDomain,
  isKnownErrorCode,
  logDeprecation,
  logError,
  logWarning,
} from './errors/index.js';

// ============================================================================
// Error Code Types
// ============================================================================

/**
 * Known error codes in the VeloxTS framework core
 * Can be extended via declaration merging by plugins
 */
export type VeloxCoreErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFIGURATION_ERROR'
  | 'PLUGIN_REGISTRATION_ERROR'
  | 'SERVER_ALREADY_RUNNING'
  | 'SERVER_NOT_RUNNING'
  | 'SERVER_START_ERROR'
  | 'SERVER_STOP_ERROR'
  | 'INVALID_PLUGIN_METADATA';

/**
 * Registry for error codes - allows plugins to extend via declaration merging
 *
 * @example
 * ```typescript
 * // In your plugin
 * declare module '@veloxts/core' {
 *   interface VeloxErrorCodeRegistry {
 *     myPlugin: 'MY_PLUGIN_ERROR' | 'ANOTHER_ERROR';
 *   }
 * }
 * ```
 */
export interface VeloxErrorCodeRegistry {
  core: VeloxCoreErrorCode;
}

/**
 * Union of all registered error codes from all packages
 */
export type VeloxErrorCode = VeloxErrorCodeRegistry[keyof VeloxErrorCodeRegistry];

// ============================================================================
// Error Response Types (Discriminated Union)
// ============================================================================

/**
 * Base error response fields common to all errors
 */
interface BaseErrorResponse {
  /** Error class name */
  error: string;
  /** Human-readable error message */
  message: string;
  /** HTTP status code */
  statusCode: number;
  /** Error code for programmatic handling */
  code?: string;
}

/**
 * Validation error response with field-specific errors
 */
export interface ValidationErrorResponse extends BaseErrorResponse {
  error: 'ValidationError';
  statusCode: 400;
  code: 'VALIDATION_ERROR';
  /** Field-specific validation errors */
  fields?: Record<string, string>;
}

/**
 * Not found error response with resource details
 */
export interface NotFoundErrorResponse extends BaseErrorResponse {
  error: 'NotFoundError';
  statusCode: 404;
  code: 'NOT_FOUND';
  /** Type of resource that was not found */
  resource: string;
  /** Optional identifier of the resource */
  resourceId?: string;
}

/**
 * Generic VeloxTS error response for all other errors
 */
export interface GenericErrorResponse extends BaseErrorResponse {
  error: string;
  statusCode: number;
  code?: string;
}

/**
 * Discriminated union of all error response types
 * Enables type-safe error handling based on the 'error' field
 *
 * @example
 * ```typescript
 * function handleError(response: ErrorResponse) {
 *   if (response.error === 'ValidationError') {
 *     // TypeScript knows response.fields exists here
 *     console.log(response.fields);
 *   }
 * }
 * ```
 */
export type ErrorResponse = ValidationErrorResponse | NotFoundErrorResponse | GenericErrorResponse;

/**
 * Type guard for validation error responses
 */
export function isValidationErrorResponse(
  response: ErrorResponse
): response is ValidationErrorResponse {
  return response.error === 'ValidationError';
}

/**
 * Type guard for not found error responses
 */
export function isNotFoundErrorResponse(
  response: ErrorResponse
): response is NotFoundErrorResponse {
  return response.error === 'NotFoundError';
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for all VeloxTS framework errors
 *
 * Extends the standard Error class with HTTP status code and optional error code.
 * All framework errors should extend this class for consistent error handling.
 *
 * @template TCode - The error code type (defaults to VeloxErrorCode)
 *
 * @example
 * ```typescript
 * // Basic usage
 * throw new VeloxError('Something went wrong', 500);
 * ```
 *
 * @example
 * ```typescript
 * // With catalog code for rich error details
 * throw new VeloxError('Database connection failed', 503, 'VELOX-4001');
 * ```
 *
 * @example
 * ```typescript
 * // With legacy string code
 * throw new VeloxError('Database connection failed', 503, 'DB_CONNECTION_ERROR');
 * ```
 */
export class VeloxError<TCode extends string = string> extends Error {
  /**
   * HTTP status code for the error
   */
  public readonly statusCode: number;

  /**
   * Error code for programmatic error handling
   * Can be a catalog code (VELOX-XXXX) or legacy string code
   */
  public readonly code?: TCode;

  /**
   * Fix suggestion for developers (populated from catalog)
   */
  public readonly fix?: string;

  /**
   * Documentation URL for this error
   */
  public readonly docsUrl?: string;

  /**
   * Creates a new VeloxError instance
   *
   * @param message - Human-readable error message
   * @param statusCode - HTTP status code (default: 500)
   * @param code - Optional error code (VELOX-XXXX catalog code or legacy string)
   */
  constructor(message: string, statusCode: number = 500, code?: TCode) {
    super(message);
    this.name = 'VeloxError';
    this.statusCode = statusCode;
    this.code = code;

    // Look up catalog entry for enhanced error info
    if (code && typeof code === 'string' && code.startsWith('VELOX-')) {
      const entry = ERROR_CATALOG[code];
      if (entry) {
        this.fix = entry.fix?.suggestion;
        this.docsUrl = entry.docsUrl;
      }
    }

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VeloxError);
    }
  }

  /**
   * Converts error to JSON format for API responses
   *
   * @returns Error response object with optional fix suggestion in development
   */
  toJSON(): GenericErrorResponse & { fix?: string; docs?: string } {
    const response: GenericErrorResponse & { fix?: string; docs?: string } = {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
    };

    // Include fix suggestion in development only
    if (process.env.NODE_ENV !== 'production' && this.fix) {
      response.fix = this.fix;
    }

    // Always include docs URL if available
    if (this.docsUrl) {
      response.docs = this.docsUrl;
    }

    return response;
  }

  /**
   * Format error for terminal display with colors and fix suggestions
   *
   * @returns Formatted error string
   */
  format(): string {
    return _formatError(this, this.code);
  }

  /**
   * Log this error with pretty formatting
   */
  log(): void {
    console.error(this.format());
  }
}

/**
 * Validation error for invalid user input
 *
 * Used when request data fails validation (e.g., missing required fields,
 * invalid format, type mismatches, etc.)
 *
 * @example
 * ```typescript
 * throw new ValidationError('Invalid email format', {
 *   email: 'Must be a valid email address'
 * });
 * ```
 *
 * @example
 * ```typescript
 * throw new ValidationError('Missing required fields', {
 *   name: 'Name is required',
 *   email: 'Email is required'
 * });
 * ```
 */
export class ValidationError extends VeloxError<'VALIDATION_ERROR'> {
  /**
   * Field-specific validation errors
   * Maps field names to error messages
   */
  public readonly fields?: Record<string, string>;

  /**
   * Creates a new ValidationError instance
   *
   * @param message - General validation error message
   * @param fields - Optional object mapping field names to specific error messages
   */
  constructor(message: string, fields?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.fields = fields;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  /**
   * Converts validation error to JSON format with field details
   *
   * @returns Validation error response with field-specific errors
   */
  override toJSON(): ValidationErrorResponse {
    return {
      error: 'ValidationError',
      message: this.message,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      fields: this.fields,
    };
  }
}

/**
 * Configuration error for framework setup issues
 *
 * Used when the framework is misconfigured or used incorrectly.
 * These errors indicate developer mistakes rather than runtime issues.
 *
 * @example
 * ```typescript
 * throw new ConfigurationError('VeloxApp must be started before registering routes');
 * ```
 *
 * @example
 * ```typescript
 * throw new ConfigurationError('Missing required plugin: @veloxts/orm');
 * ```
 */
export class ConfigurationError extends VeloxError<'CONFIGURATION_ERROR'> {
  /**
   * Creates a new ConfigurationError instance
   *
   * @param message - Human-readable error message explaining the configuration issue
   */
  constructor(message: string) {
    super(message, 500, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigurationError);
    }
  }
}

/**
 * Not found error for missing resources
 *
 * Used when a requested resource (user, post, file, etc.) doesn't exist
 *
 * @example
 * ```typescript
 * throw new NotFoundError('User');
 * // Message: "User not found"
 * ```
 *
 * @example
 * ```typescript
 * throw new NotFoundError('Post', '123');
 * // Message: "Post with id 123 not found"
 * ```
 */
export class NotFoundError extends VeloxError<'NOT_FOUND'> {
  /**
   * Type of resource that was not found
   */
  public readonly resource: string;

  /**
   * Optional identifier of the resource that was not found
   */
  public readonly resourceId?: string;

  /**
   * Creates a new NotFoundError instance
   *
   * @param resource - Type of resource (e.g., "User", "Post", "File")
   * @param resourceId - Optional identifier of the specific resource
   */
  constructor(resource: string, resourceId?: string) {
    const message = resourceId
      ? `${resource} with id ${resourceId} not found`
      : `${resource} not found`;

    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
    this.resource = resource;
    this.resourceId = resourceId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NotFoundError);
    }
  }

  /**
   * Converts not found error to JSON format with resource details
   *
   * @returns Not found error response with resource information
   */
  override toJSON(): NotFoundErrorResponse {
    return {
      error: 'NotFoundError',
      message: this.message,
      statusCode: 404,
      code: 'NOT_FOUND',
      resource: this.resource,
      resourceId: this.resourceId,
    };
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an error is a VeloxError
 *
 * @param error - Error to check
 * @returns true if error is a VeloxError instance
 *
 * @example
 * ```typescript
 * try {
 *   // ... some code
 * } catch (error) {
 *   if (isVeloxError(error)) {
 *     console.log('Status code:', error.statusCode);
 *   }
 * }
 * ```
 */
export function isVeloxError(error: unknown): error is VeloxError {
  return error != null && error instanceof VeloxError;
}

/**
 * Type guard to check if an error is a ValidationError
 *
 * @param error - Error to check
 * @returns true if error is a ValidationError instance
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if an error is a NotFoundError
 *
 * @param error - Error to check
 * @returns true if error is a NotFoundError instance
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Type guard to check if an error is a ConfigurationError
 *
 * @param error - Error to check
 * @returns true if error is a ConfigurationError instance
 */
export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Helper to ensure exhaustive handling of error types
 * Throws at compile time if a case is not handled
 *
 * @example
 * ```typescript
 * function handleError(error: VeloxError): string {
 *   if (isValidationError(error)) return 'validation';
 *   if (isNotFoundError(error)) return 'not found';
 *   return 'generic';
 * }
 * ```
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
}
