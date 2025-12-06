/**
 * @veloxts/client - Error Classes Tests
 */

import { describe, expect, it } from 'vitest';

import {
  ClientNotFoundError,
  ClientValidationError,
  isClientNotFoundError,
  isClientValidationError,
  isNetworkError,
  isServerError,
  isVeloxClientError,
  NetworkError,
  parseErrorResponse,
  ServerError,
  VeloxClientError,
} from '../errors.js';

describe('VeloxClientError', () => {
  it('should create error with all properties', () => {
    const error = new VeloxClientError('Something went wrong', {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      body: { details: 'error details' },
      url: 'https://api.example.com/users',
      method: 'GET',
    });

    expect(error.message).toBe('Something went wrong');
    expect(error.name).toBe('VeloxClientError');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.body).toEqual({ details: 'error details' });
    expect(error.url).toBe('https://api.example.com/users');
    expect(error.method).toBe('GET');
    expect(error instanceof Error).toBe(true);
  });

  it('should create error with minimal properties', () => {
    const error = new VeloxClientError('Error', {
      url: '/api/test',
      method: 'POST',
    });

    expect(error.message).toBe('Error');
    expect(error.statusCode).toBeUndefined();
    expect(error.code).toBeUndefined();
    expect(error.body).toBeUndefined();
  });

  it('should have proper stack trace', () => {
    const error = new VeloxClientError('Test', {
      url: '/test',
      method: 'GET',
    });

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('VeloxClientError');
  });
});

describe('NetworkError', () => {
  it('should create network error with cause', () => {
    const cause = new Error('ECONNREFUSED');
    const error = new NetworkError('Network request failed', {
      url: 'https://api.example.com',
      method: 'GET',
      cause,
    });

    expect(error.message).toBe('Network request failed');
    expect(error.name).toBe('NetworkError');
    expect(error.cause).toBe(cause);
    expect(error.url).toBe('https://api.example.com');
    expect(error.method).toBe('GET');
    expect(error instanceof VeloxClientError).toBe(true);
  });

  it('should create network error without cause', () => {
    const error = new NetworkError('Failed', {
      url: '/api',
      method: 'POST',
    });

    expect(error.cause).toBeUndefined();
  });
});

describe('ClientValidationError', () => {
  it('should create validation error with fields', () => {
    const error = new ClientValidationError('Validation failed', {
      url: '/api/users',
      method: 'POST',
      fields: {
        email: 'Invalid email format',
        name: 'Name is required',
      },
      body: { error: 'ValidationError' },
    });

    expect(error.message).toBe('Validation failed');
    expect(error.name).toBe('ClientValidationError');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.fields).toEqual({
      email: 'Invalid email format',
      name: 'Name is required',
    });
    expect(error instanceof VeloxClientError).toBe(true);
  });

  it('should create validation error without fields', () => {
    const error = new ClientValidationError('Invalid input', {
      url: '/api/test',
      method: 'PUT',
    });

    expect(error.fields).toBeUndefined();
  });
});

describe('ClientNotFoundError', () => {
  it('should create not found error with resource info', () => {
    const error = new ClientNotFoundError('User not found', {
      url: '/api/users/123',
      method: 'GET',
      resource: 'User',
      resourceId: '123',
    });

    expect(error.message).toBe('User not found');
    expect(error.name).toBe('ClientNotFoundError');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.resource).toBe('User');
    expect(error.resourceId).toBe('123');
    expect(error instanceof VeloxClientError).toBe(true);
  });

  it('should create not found error without resource info', () => {
    const error = new ClientNotFoundError('Not found', {
      url: '/api/items/abc',
      method: 'DELETE',
    });

    expect(error.resource).toBeUndefined();
    expect(error.resourceId).toBeUndefined();
  });
});

describe('ServerError', () => {
  it('should create server error', () => {
    const error = new ServerError('Internal server error', {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      url: '/api/process',
      method: 'POST',
      body: { error: 'InternalError' },
    });

    expect(error.message).toBe('Internal server error');
    expect(error.name).toBe('ServerError');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error instanceof VeloxClientError).toBe(true);
  });

  it('should handle various 5xx status codes', () => {
    const error502 = new ServerError('Bad Gateway', {
      statusCode: 502,
      url: '/api',
      method: 'GET',
    });

    const error503 = new ServerError('Service Unavailable', {
      statusCode: 503,
      url: '/api',
      method: 'GET',
    });

    expect(error502.statusCode).toBe(502);
    expect(error503.statusCode).toBe(503);
  });
});

describe('Type Guards', () => {
  describe('isVeloxClientError', () => {
    it('should return true for VeloxClientError', () => {
      const error = new VeloxClientError('test', { url: '/', method: 'GET' });
      expect(isVeloxClientError(error)).toBe(true);
    });

    it('should return true for subclasses', () => {
      expect(isVeloxClientError(new NetworkError('test', { url: '/', method: 'GET' }))).toBe(true);
      expect(
        isVeloxClientError(new ClientValidationError('test', { url: '/', method: 'GET' }))
      ).toBe(true);
      expect(isVeloxClientError(new ClientNotFoundError('test', { url: '/', method: 'GET' }))).toBe(
        true
      );
      expect(
        isVeloxClientError(new ServerError('test', { statusCode: 500, url: '/', method: 'GET' }))
      ).toBe(true);
    });

    it('should return false for regular Error', () => {
      expect(isVeloxClientError(new Error('test'))).toBe(false);
    });

    it('should return false for non-errors', () => {
      expect(isVeloxClientError(null)).toBe(false);
      expect(isVeloxClientError(undefined)).toBe(false);
      expect(isVeloxClientError('error')).toBe(false);
      expect(isVeloxClientError({ message: 'error' })).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('should return true for NetworkError', () => {
      const error = new NetworkError('test', { url: '/', method: 'GET' });
      expect(isNetworkError(error)).toBe(true);
    });

    it('should return false for other VeloxClientErrors', () => {
      expect(isNetworkError(new VeloxClientError('test', { url: '/', method: 'GET' }))).toBe(false);
      expect(
        isNetworkError(new ServerError('test', { statusCode: 500, url: '/', method: 'GET' }))
      ).toBe(false);
    });
  });

  describe('isClientValidationError', () => {
    it('should return true for ClientValidationError', () => {
      const error = new ClientValidationError('test', { url: '/', method: 'GET' });
      expect(isClientValidationError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(
        isClientValidationError(new VeloxClientError('test', { url: '/', method: 'GET' }))
      ).toBe(false);
    });
  });

  describe('isClientNotFoundError', () => {
    it('should return true for ClientNotFoundError', () => {
      const error = new ClientNotFoundError('test', { url: '/', method: 'GET' });
      expect(isClientNotFoundError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isClientNotFoundError(new VeloxClientError('test', { url: '/', method: 'GET' }))).toBe(
        false
      );
    });
  });

  describe('isServerError', () => {
    it('should return true for ServerError', () => {
      const error = new ServerError('test', { statusCode: 500, url: '/', method: 'GET' });
      expect(isServerError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isServerError(new VeloxClientError('test', { url: '/', method: 'GET' }))).toBe(false);
    });
  });
});

describe('parseErrorResponse', () => {
  function createMockResponse(status: number, headers?: Record<string, string>): Response {
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: new Headers(headers),
    } as Response;
  }

  describe('validation errors', () => {
    it('should parse ValidationError response', () => {
      const response = createMockResponse(400);
      const body = {
        error: 'ValidationError',
        message: 'Invalid input',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        fields: { email: 'Invalid format' },
      };

      const error = parseErrorResponse(response, body, '/api/users', 'POST');

      expect(error).toBeInstanceOf(ClientValidationError);
      expect(error.message).toBe('Invalid input');
      expect((error as ClientValidationError).fields).toEqual({ email: 'Invalid format' });
    });
  });

  describe('not found errors', () => {
    it('should parse NotFoundError response', () => {
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

      expect(error).toBeInstanceOf(ClientNotFoundError);
      expect(error.message).toBe('User not found');
      expect((error as ClientNotFoundError).resource).toBe('User');
      expect((error as ClientNotFoundError).resourceId).toBe('123');
    });
  });

  describe('server errors', () => {
    it('should parse 5xx response as ServerError', () => {
      const response = createMockResponse(500);
      const body = {
        error: 'InternalError',
        message: 'Internal server error',
        statusCode: 500,
        code: 'INTERNAL_ERROR',
      };

      const error = parseErrorResponse(response, body, '/api/process', 'POST');

      expect(error).toBeInstanceOf(ServerError);
      expect(error.message).toBe('Internal server error');
      expect(error.statusCode).toBe(500);
    });

    it('should handle 5xx without standard error format', () => {
      const response = createMockResponse(503);
      const body = { message: 'Service unavailable' };

      const error = parseErrorResponse(response, body, '/api', 'GET');

      expect(error).toBeInstanceOf(ServerError);
      expect(error.message).toBe('Service unavailable');
      expect(error.statusCode).toBe(503);
    });
  });

  describe('generic errors', () => {
    it('should parse generic error response', () => {
      const response = createMockResponse(403);
      const body = {
        error: 'ForbiddenError',
        message: 'Access denied',
        statusCode: 403,
        code: 'FORBIDDEN',
      };

      const error = parseErrorResponse(response, body, '/api/admin', 'GET');

      expect(error).toBeInstanceOf(VeloxClientError);
      expect(error).not.toBeInstanceOf(ServerError);
      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('fallback handling', () => {
    it('should handle non-object body', () => {
      const response = createMockResponse(400);
      const body = 'Bad Request';

      const error = parseErrorResponse(response, body, '/api/test', 'POST');

      expect(error).toBeInstanceOf(VeloxClientError);
      expect(error.message).toBe('Request failed with status 400');
    });

    it('should handle null body', () => {
      const response = createMockResponse(500);

      const error = parseErrorResponse(response, null, '/api/test', 'GET');

      expect(error).toBeInstanceOf(ServerError);
      expect(error.message).toBe('Request failed with status 500');
    });

    it('should handle body with only message field', () => {
      const response = createMockResponse(400);
      const body = { message: 'Custom error message' };

      const error = parseErrorResponse(response, body, '/api/test', 'PUT');

      expect(error.message).toBe('Custom error message');
    });

    it('should handle empty object body', () => {
      const response = createMockResponse(400);
      const body = {};

      const error = parseErrorResponse(response, body, '/api/test', 'DELETE');

      expect(error.message).toBe('Request failed with status 400');
    });

    it('should handle array body', () => {
      const response = createMockResponse(400);
      const body = ['error1', 'error2'];

      const error = parseErrorResponse(response, body, '/api/test', 'POST');

      expect(error).toBeInstanceOf(VeloxClientError);
      expect(error.message).toBe('Request failed with status 400');
    });

    it('should handle number body', () => {
      const response = createMockResponse(500);
      const body = 42;

      const error = parseErrorResponse(response, body, '/api/test', 'GET');

      expect(error).toBeInstanceOf(ServerError);
      expect(error.message).toBe('Request failed with status 500');
    });
  });
});
