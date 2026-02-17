/**
 * Error handling foundation for VeloxTS framework
 * Provides base error classes with HTTP status codes and discriminated unions
 * @module errors
 */

import { ERROR_CATALOG } from './errors/catalog.js';
import { formatError as _formatError } from './errors/formatter.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('core');

export {
  ERROR_CATALOG,
  ERROR_DOMAINS,
  type ErrorCatalogEntry,
  type ErrorCode,
  type ErrorDomain,
  type ErrorLocation,
  extractErrorLocation,
  type FormatErrorOptions,
  fail,
  formatError,
  formatErrorForApi,
  formatErrorOneLine,
  getDocsUrl,
  getErrorEntry,
  getErrorsByDomain,
  type InterpolationVars,
  isKnownErrorCode,
  isVeloxFailure,
  logDeprecation,
  logError,
  logWarning,
  VeloxFailure,
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
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'SERVICE_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'UNPROCESSABLE'
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
 * Conflict error response with field details
 */
export interface ConflictErrorResponse extends BaseErrorResponse {
  error: 'ConflictError';
  statusCode: 409;
  code: 'CONFLICT';
  fields?: string[];
}

/**
 * Too many requests error response with retry timing
 */
export interface TooManyRequestsErrorResponse extends BaseErrorResponse {
  error: 'TooManyRequestsError';
  statusCode: 429;
  code: 'RATE_LIMITED';
  retryAfter?: number;
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
export type ErrorResponse =
  | ValidationErrorResponse
  | NotFoundErrorResponse
  | ConflictErrorResponse
  | TooManyRequestsErrorResponse
  | GenericErrorResponse;

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

    if (code != null && String(code).startsWith('VELOX-')) {
      const entry = ERROR_CATALOG[code];
      if (entry) {
        this.fix = entry.fix?.suggestion;
        this.docsUrl = entry.docsUrl;
      }
    }

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

    if (process.env.NODE_ENV !== 'production' && this.fix) {
      response.fix = this.fix;
    }

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
    log.error(this.format());
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

/**
 * Conflict error for duplicate resources
 *
 * Used when an operation would violate a uniqueness constraint
 * (e.g., creating a user with an email that already exists)
 *
 * @example
 * ```typescript
 * throw new ConflictError('A user with this email already exists', ['email']);
 * ```
 */
export class ConflictError extends VeloxError<'CONFLICT'> {
  public readonly fields?: string[];

  constructor(message: string, fields?: string[]) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
    this.fields = fields;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConflictError);
    }
  }

  override toJSON(): ConflictErrorResponse {
    return {
      error: 'ConflictError',
      message: this.message,
      statusCode: 409,
      code: 'CONFLICT',
      fields: this.fields,
    };
  }
}

/**
 * Forbidden error for insufficient permissions
 *
 * Used when an authenticated user lacks the required permissions
 * for an operation (different from UnauthorizedError which means not authenticated)
 *
 * @example
 * ```typescript
 * throw new ForbiddenError('You do not have permission to delete this resource');
 * ```
 */
export class ForbiddenError extends VeloxError<'FORBIDDEN'> {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ForbiddenError);
    }
  }
}

/**
 * Unauthorized error for missing or invalid authentication
 *
 * Used when a request lacks valid authentication credentials
 *
 * @example
 * ```typescript
 * throw new UnauthorizedError('Invalid or expired token');
 * ```
 */
export class UnauthorizedError extends VeloxError<'UNAUTHORIZED'> {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnauthorizedError);
    }
  }
}

/**
 * Service unavailable error for downstream failures
 *
 * Used when an external service or dependency is unreachable
 *
 * @example
 * ```typescript
 * throw new ServiceUnavailableError('Payment gateway is temporarily unavailable');
 * ```
 */
export class ServiceUnavailableError extends VeloxError<'SERVICE_UNAVAILABLE'> {
  constructor(message: string = 'Service unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ServiceUnavailableError);
    }
  }
}

/**
 * Too many requests error for rate limiting
 *
 * Used when a client exceeds the allowed request rate
 *
 * @example
 * ```typescript
 * throw new TooManyRequestsError('Rate limit exceeded', 60);
 * ```
 */
export class TooManyRequestsError extends VeloxError<'RATE_LIMITED'> {
  public readonly retryAfter?: number;

  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(message, 429, 'RATE_LIMITED');
    this.name = 'TooManyRequestsError';
    this.retryAfter = retryAfter;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TooManyRequestsError);
    }
  }

  override toJSON(): TooManyRequestsErrorResponse {
    return {
      error: 'TooManyRequestsError',
      message: this.message,
      statusCode: 429,
      code: 'RATE_LIMITED',
      retryAfter: this.retryAfter,
    };
  }
}

/**
 * Unprocessable entity error for semantically invalid requests
 *
 * Used when the request is syntactically valid but semantically wrong
 * (e.g., trying to publish a draft that has no content)
 *
 * @example
 * ```typescript
 * throw new UnprocessableEntityError('Cannot publish a post without content');
 * ```
 */
export class UnprocessableEntityError extends VeloxError<'UNPROCESSABLE'> {
  constructor(message: string) {
    super(message, 422, 'UNPROCESSABLE');
    this.name = 'UnprocessableEntityError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnprocessableEntityError);
    }
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
  return error instanceof VeloxError;
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

/**
 * Type guard to check if an error is a ConflictError
 */
export function isConflictError(error: unknown): error is ConflictError {
  return error instanceof ConflictError;
}

/**
 * Type guard to check if an error is a ForbiddenError
 */
export function isForbiddenError(error: unknown): error is ForbiddenError {
  return error instanceof ForbiddenError;
}

/**
 * Type guard to check if an error is an UnauthorizedError
 */
export function isUnauthorizedError(error: unknown): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}

/**
 * Type guard to check if an error is a ServiceUnavailableError
 */
export function isServiceUnavailableError(error: unknown): error is ServiceUnavailableError {
  return error instanceof ServiceUnavailableError;
}

/**
 * Type guard to check if an error is a TooManyRequestsError
 */
export function isTooManyRequestsError(error: unknown): error is TooManyRequestsError {
  return error instanceof TooManyRequestsError;
}

/**
 * Type guard to check if an error is an UnprocessableEntityError
 */
export function isUnprocessableEntityError(error: unknown): error is UnprocessableEntityError {
  return error instanceof UnprocessableEntityError;
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
