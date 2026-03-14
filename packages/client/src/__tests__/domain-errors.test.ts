/**
 * @veloxts/client - Domain Error Support Tests
 *
 * Verifies that VeloxClientError exposes `code` and `data` from DomainError
 * responses, and that InferProcedureErrors correctly extracts error types.
 */

import { describe, expect, expectTypeOf, it } from 'vitest';

import { isDomainErrorResponse, parseErrorResponse, VeloxClientError } from '../errors.js';
import type { InferProcedureErrors } from '../types.js';

// ============================================================================
// Helpers
// ============================================================================

function createMockResponse(status: number): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(),
  } as Response;
}

// ============================================================================
// VeloxClientError — data property
// ============================================================================

describe('VeloxClientError data property', () => {
  it('should expose the data property when provided', () => {
    const payload = { amount: 100, currency: 'USD' };
    const error = new VeloxClientError('Insufficient funds', {
      statusCode: 422,
      code: 'INSUFFICIENT_FUNDS',
      body: {
        error: 'DomainError',
        message: 'Insufficient funds',
        statusCode: 422,
        code: 'INSUFFICIENT_FUNDS',
        data: payload,
      },
      data: payload,
      url: '/api/payments',
      method: 'POST',
    });

    expect(error.code).toBe('INSUFFICIENT_FUNDS');
    expect(error.data).toEqual({ amount: 100, currency: 'USD' });
  });

  it('should have data undefined when not provided', () => {
    const error = new VeloxClientError('Not found', {
      statusCode: 404,
      code: 'NOT_FOUND',
      url: '/api/users/99',
      method: 'GET',
    });

    expect(error.data).toBeUndefined();
  });

  it('data is distinct from body', () => {
    const domainData = { reason: 'banned' };
    const fullBody = {
      error: 'DomainError',
      message: 'User banned',
      statusCode: 403,
      code: 'USER_BANNED',
      data: domainData,
    };
    const error = new VeloxClientError('User banned', {
      statusCode: 403,
      code: 'USER_BANNED',
      body: fullBody,
      data: domainData,
      url: '/api/posts',
      method: 'POST',
    });

    expect(error.body).toBe(fullBody);
    expect(error.data).toBe(domainData);
    expect(error.body).not.toBe(error.data);
  });
});

// ============================================================================
// isDomainErrorResponse type guard
// ============================================================================

describe('isDomainErrorResponse', () => {
  it('should return true for domain error responses', () => {
    const response = {
      error: 'DomainError',
      message: 'Insufficient funds',
      statusCode: 422,
      code: 'INSUFFICIENT_FUNDS',
      data: { amount: 50 },
    };

    expect(isDomainErrorResponse(response)).toBe(true);
  });

  it('should return false for VALIDATION_ERROR code', () => {
    const response = {
      error: 'ValidationError',
      message: 'Invalid input',
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    };

    expect(isDomainErrorResponse(response)).toBe(false);
  });

  it('should return false for NOT_FOUND code', () => {
    const response = {
      error: 'NotFoundError',
      message: 'Resource not found',
      statusCode: 404,
      code: 'NOT_FOUND',
      resource: 'User',
    };

    expect(isDomainErrorResponse(response)).toBe(false);
  });

  it('should return false when code is undefined', () => {
    const response = {
      error: 'GenericError',
      message: 'Something went wrong',
      statusCode: 500,
    };

    // Cast to match the union type — code is optional in GenericErrorResponse
    expect(isDomainErrorResponse(response as Parameters<typeof isDomainErrorResponse>[0])).toBe(
      false
    );
  });
});

// ============================================================================
// parseErrorResponse — domain error extraction
// ============================================================================

describe('parseErrorResponse — domain errors', () => {
  it('should extract code and data from a domain error response', () => {
    const response = createMockResponse(422);
    const body = {
      error: 'DomainError',
      message: 'Insufficient funds',
      statusCode: 422,
      code: 'INSUFFICIENT_FUNDS',
      data: { amount: 50, currency: 'USD' },
    };

    const error = parseErrorResponse(response, body, '/api/payments', 'POST');

    expect(error).toBeInstanceOf(VeloxClientError);
    expect(error.code).toBe('INSUFFICIENT_FUNDS');
    expect(error.data).toEqual({ amount: 50, currency: 'USD' });
    expect(error.body).toBe(body);
  });

  it('should set data to undefined when domain error has no data field', () => {
    const response = createMockResponse(409);
    const body = {
      error: 'DomainError',
      message: 'Conflict',
      statusCode: 409,
      code: 'CONFLICT',
    };

    const error = parseErrorResponse(response, body, '/api/items', 'PUT');

    expect(error.code).toBe('CONFLICT');
    expect(error.data).toBeUndefined();
  });

  it('should not set data for non-domain errors (no code field)', () => {
    const response = createMockResponse(400);
    const body = {
      error: 'BadRequest',
      message: 'Bad request',
      statusCode: 400,
    };

    const error = parseErrorResponse(response, body, '/api/test', 'POST');

    expect(error.data).toBeUndefined();
  });

  it('should extract data from 5xx domain errors as ServerError', () => {
    const response = createMockResponse(503);
    const body = {
      error: 'DomainError',
      message: 'Service overloaded',
      statusCode: 503,
      code: 'SERVICE_OVERLOADED',
      data: { retryAfter: 30 },
    };

    const error = parseErrorResponse(response, body, '/api/process', 'POST');

    expect(error.code).toBe('SERVICE_OVERLOADED');
    expect(error.data).toEqual({ retryAfter: 30 });
    expect(error.statusCode).toBe(503);
  });

  it('should not set data for VALIDATION_ERROR (parsed as ClientValidationError)', () => {
    const response = createMockResponse(400);
    const body = {
      error: 'ValidationError',
      message: 'Invalid input',
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      fields: { email: 'Invalid format' },
    };

    const error = parseErrorResponse(response, body, '/api/users', 'POST');

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.data).toBeUndefined();
  });

  it('should not set data for NOT_FOUND (parsed as ClientNotFoundError)', () => {
    const response = createMockResponse(404);
    const body = {
      error: 'NotFoundError',
      message: 'User not found',
      statusCode: 404,
      code: 'NOT_FOUND',
      resource: 'User',
      resourceId: '123',
    };

    const error = parseErrorResponse(response, body, '/api/users/123', 'GET');

    expect(error.code).toBe('NOT_FOUND');
    expect(error.data).toBeUndefined();
  });
});

// ============================================================================
// InferProcedureErrors type utility
// ============================================================================

describe('InferProcedureErrors type utility', () => {
  it('should extract error union from a procedure with errorClasses', () => {
    // Simulated error classes as the server would define them
    // biome-ignore lint/correctness/noUnusedVariables: used in MockProcedure type
    class InsufficientFundsError {
      readonly code = 'INSUFFICIENT_FUNDS' as const;
      constructor(public readonly data: { amount: number; currency: string }) {}
    }

    // biome-ignore lint/correctness/noUnusedVariables: used in MockProcedure type
    class UserBannedError {
      readonly code = 'USER_BANNED' as const;
      constructor(public readonly data: { reason: string }) {}
    }

    // Simulated compiled procedure shape (matches what @veloxts/router produces)
    type MockProcedure = {
      readonly type: 'mutation';
      readonly errorClasses?: ReadonlyArray<typeof InsufficientFundsError | typeof UserBannedError>;
    };

    type Errors = InferProcedureErrors<MockProcedure>;

    // Type-level check: Errors should be a union of the two error shapes
    expectTypeOf<{
      code: 'INSUFFICIENT_FUNDS';
      data: { amount: number; currency: string };
    }>().toMatchTypeOf<Errors>();
    expectTypeOf<{ code: 'USER_BANNED'; data: { reason: string } }>().toMatchTypeOf<Errors>();
  });

  it('should resolve to never for a procedure without errorClasses', () => {
    type ProcedureWithoutErrors = {
      readonly type: 'query';
    };

    type Errors = InferProcedureErrors<ProcedureWithoutErrors>;

    expectTypeOf<Errors>().toBeNever();
  });

  it('should resolve to never for a non-procedure type', () => {
    type Errors = InferProcedureErrors<string>;

    expectTypeOf<Errors>().toBeNever();
  });
});
