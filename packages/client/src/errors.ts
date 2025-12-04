/**
 * Client-side error handling
 *
 * Provides error classes that mirror the server-side VeloxError structure,
 * with additional context about the failed request.
 *
 * @module errors
 */

import type { ClientError } from './types.js';

// ============================================================================
// Error Response Types (from server)
// ============================================================================

/**
 * Base error response fields from server
 */
interface BaseErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  code?: string;
}

/**
 * Validation error response from server
 */
interface ValidationErrorResponse extends BaseErrorResponse {
  error: 'ValidationError';
  statusCode: 400;
  code: 'VALIDATION_ERROR';
  fields?: Record<string, string>;
}

/**
 * Not found error response from server
 */
interface NotFoundErrorResponse extends BaseErrorResponse {
  error: 'NotFoundError';
  statusCode: 404;
  code: 'NOT_FOUND';
  resource: string;
  resourceId?: string;
}

/**
 * Generic error response from server
 */
interface GenericErrorResponse extends BaseErrorResponse {
  error: string;
  statusCode: number;
  code?: string;
}

/**
 * Union of all error response types from server
 */
export type ErrorResponse = ValidationErrorResponse | NotFoundErrorResponse | GenericErrorResponse;

// ============================================================================
// Client Error Classes
// ============================================================================

/**
 * Base error class for all client errors
 *
 * Represents an error that occurred during an API request, including
 * both network errors and server-returned error responses.
 */
export class VeloxClientError extends Error implements ClientError {
  public readonly statusCode?: number;
  public readonly code?: string;
  public readonly body?: unknown;
  public readonly url: string;
  public readonly method: string;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      code?: string;
      body?: unknown;
      url: string;
      method: string;
    }
  ) {
    super(message);
    this.name = 'VeloxClientError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.body = options.body;
    this.url = options.url;
    this.method = options.method;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VeloxClientError);
    }
  }
}

/**
 * Network error when request fails to reach server
 *
 * Thrown when the request cannot be completed due to network issues,
 * CORS problems, or other transport-level failures.
 */
export class NetworkError extends VeloxClientError {
  public readonly cause?: Error;

  constructor(
    message: string,
    options: {
      url: string;
      method: string;
      cause?: Error;
    }
  ) {
    super(message, {
      url: options.url,
      method: options.method,
    });
    this.name = 'NetworkError';
    this.cause = options.cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NetworkError);
    }
  }
}

/**
 * Validation error from server (400 status)
 *
 * Thrown when request data fails server-side validation.
 * Includes field-level error details if provided by server.
 */
export class ClientValidationError extends VeloxClientError {
  public readonly fields?: Record<string, string>;

  constructor(
    message: string,
    options: {
      url: string;
      method: string;
      fields?: Record<string, string>;
      body?: unknown;
    }
  ) {
    super(message, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      url: options.url,
      method: options.method,
      body: options.body,
    });
    this.name = 'ClientValidationError';
    this.fields = options.fields;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClientValidationError);
    }
  }
}

/**
 * Not found error from server (404 status)
 *
 * Thrown when a requested resource doesn't exist.
 */
export class ClientNotFoundError extends VeloxClientError {
  public readonly resource?: string;
  public readonly resourceId?: string;

  constructor(
    message: string,
    options: {
      url: string;
      method: string;
      resource?: string;
      resourceId?: string;
      body?: unknown;
    }
  ) {
    super(message, {
      statusCode: 404,
      code: 'NOT_FOUND',
      url: options.url,
      method: options.method,
      body: options.body,
    });
    this.name = 'ClientNotFoundError';
    this.resource = options.resource;
    this.resourceId = options.resourceId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClientNotFoundError);
    }
  }
}

/**
 * Server error (5xx status)
 *
 * Thrown when server returns an internal error.
 */
export class ServerError extends VeloxClientError {
  constructor(
    message: string,
    options: {
      statusCode: number;
      code?: string;
      url: string;
      method: string;
      body?: unknown;
    }
  ) {
    super(message, options);
    this.name = 'ServerError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ServerError);
    }
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for VeloxClientError
 */
export function isVeloxClientError(error: unknown): error is VeloxClientError {
  return error instanceof VeloxClientError;
}

/**
 * Type guard for NetworkError
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Type guard for ClientValidationError
 */
export function isClientValidationError(error: unknown): error is ClientValidationError {
  return error instanceof ClientValidationError;
}

/**
 * Type guard for ClientNotFoundError
 */
export function isClientNotFoundError(error: unknown): error is ClientNotFoundError {
  return error instanceof ClientNotFoundError;
}

/**
 * Type guard for ServerError
 */
export function isServerError(error: unknown): error is ServerError {
  return error instanceof ServerError;
}

/**
 * Type guard for validation error response
 */
export function isValidationErrorResponse(
  response: ErrorResponse
): response is ValidationErrorResponse {
  return response.error === 'ValidationError';
}

/**
 * Type guard for not found error response
 */
export function isNotFoundErrorResponse(
  response: ErrorResponse
): response is NotFoundErrorResponse {
  return response.error === 'NotFoundError';
}

// ============================================================================
// Error Parsing
// ============================================================================

/**
 * Parses an error response from the server and creates appropriate error instance
 *
 * @internal
 */
export function parseErrorResponse(
  response: Response,
  body: unknown,
  url: string,
  method: string
): VeloxClientError {
  // Try to parse as ErrorResponse
  if (isErrorResponseLike(body)) {
    const errorResponse = body as ErrorResponse;

    // Validation error
    if (isValidationErrorResponse(errorResponse)) {
      return new ClientValidationError(errorResponse.message, {
        url,
        method,
        fields: errorResponse.fields,
        body,
      });
    }

    // Not found error
    if (isNotFoundErrorResponse(errorResponse)) {
      return new ClientNotFoundError(errorResponse.message, {
        url,
        method,
        resource: errorResponse.resource,
        resourceId: errorResponse.resourceId,
        body,
      });
    }

    // Server error (5xx)
    if (response.status >= 500) {
      return new ServerError(errorResponse.message, {
        statusCode: errorResponse.statusCode,
        code: errorResponse.code,
        url,
        method,
        body,
      });
    }

    // Generic error
    return new VeloxClientError(errorResponse.message, {
      statusCode: errorResponse.statusCode,
      code: errorResponse.code,
      url,
      method,
      body,
    });
  }

  // Fallback for non-standard error responses
  const message =
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
      ? body.message
      : `Request failed with status ${response.status}`;

  if (response.status >= 500) {
    return new ServerError(message, {
      statusCode: response.status,
      url,
      method,
      body,
    });
  }

  return new VeloxClientError(message, {
    statusCode: response.status,
    url,
    method,
    body,
  });
}

/**
 * Type guard to check if body looks like an error response
 *
 * @internal
 */
function isErrorResponseLike(body: unknown): body is ErrorResponse {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const obj = body as Record<string, unknown>;

  return (
    typeof obj.error === 'string' &&
    typeof obj.message === 'string' &&
    typeof obj.statusCode === 'number'
  );
}
