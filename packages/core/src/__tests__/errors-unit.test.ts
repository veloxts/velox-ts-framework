/**
 * @veloxts/core - Error Classes Unit Tests
 * Tests error class construction, inheritance, and type guards
 */

import { describe, expect, it } from 'vitest';

import {
  assertNever,
  ConfigurationError,
  ConflictError,
  ForbiddenError,
  isConfigurationError,
  isConflictError,
  isForbiddenError,
  isNotFoundError,
  isNotFoundErrorResponse,
  isServiceUnavailableError,
  isTooManyRequestsError,
  isUnauthorizedError,
  isUnprocessableEntityError,
  isValidationError,
  isValidationErrorResponse,
  isVeloxError,
  NotFoundError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableEntityError,
  ValidationError,
  VeloxError,
} from '../errors.js';

describe('Error Classes - Unit Tests', () => {
  describe('VeloxError', () => {
    it('should create error with message and default status code', () => {
      const error = new VeloxError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(VeloxError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBeUndefined();
      expect(error.name).toBe('VeloxError');
      expect(error.stack).toBeDefined();
    });

    it('should create error with custom status code and code', () => {
      const error = new VeloxError('Conflict', 409, 'DUPLICATE_ENTRY');

      expect(error.message).toBe('Conflict');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('DUPLICATE_ENTRY');
    });

    it('should serialize to JSON correctly', () => {
      const error = new VeloxError('Test error', 418, 'TEAPOT');

      expect(error.toJSON()).toEqual({
        error: 'VeloxError',
        message: 'Test error',
        statusCode: 418,
        code: 'TEAPOT',
      });
    });

    it('should serialize to JSON without optional code', () => {
      const error = new VeloxError('Test error', 500);

      expect(error.toJSON()).toEqual({
        error: 'VeloxError',
        message: 'Test error',
        statusCode: 500,
        code: undefined,
      });
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with correct defaults', () => {
      const error = new ValidationError('Invalid input');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(VeloxError);
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
      expect(error.fields).toBeUndefined();
    });

    it('should include field details when provided', () => {
      const fields = { email: 'Must be a valid email', age: 'Must be at least 18' };
      const error = new ValidationError('Invalid input', fields);

      expect(error.fields).toEqual(fields);
    });

    it('should serialize to JSON with and without fields', () => {
      const withFields = new ValidationError('Validation failed', { email: 'Invalid' });
      const withoutFields = new ValidationError('Validation failed');

      expect(withFields.toJSON()).toEqual({
        error: 'ValidationError',
        message: 'Validation failed',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        fields: { email: 'Invalid' },
      });

      expect(withoutFields.toJSON()).toEqual({
        error: 'ValidationError',
        message: 'Validation failed',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        fields: undefined,
      });
    });
  });

  describe('NotFoundError', () => {
    it('should create error with resource only', () => {
      const error = new NotFoundError('User');

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toBeInstanceOf(VeloxError);
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.name).toBe('NotFoundError');
      expect(error.resource).toBe('User');
      expect(error.resourceId).toBeUndefined();
    });

    it('should create error with resource and ID', () => {
      const error = new NotFoundError('Post', '123');

      expect(error.message).toBe('Post with id 123 not found');
      expect(error.resource).toBe('Post');
      expect(error.resourceId).toBe('123');
    });

    it('should serialize to JSON with and without resource ID', () => {
      const withId = new NotFoundError('Product', 'abc-123');
      const withoutId = new NotFoundError('Page');

      expect(withId.toJSON()).toEqual({
        error: 'NotFoundError',
        message: 'Product with id abc-123 not found',
        statusCode: 404,
        code: 'NOT_FOUND',
        resource: 'Product',
        resourceId: 'abc-123',
      });

      expect(withoutId.toJSON()).toEqual({
        error: 'NotFoundError',
        message: 'Page not found',
        statusCode: 404,
        code: 'NOT_FOUND',
        resource: 'Page',
        resourceId: undefined,
      });
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error with correct defaults', () => {
      const error = new ConfigurationError('Invalid config');

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error).toBeInstanceOf(VeloxError);
      expect(error.message).toBe('Invalid config');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.name).toBe('ConfigurationError');
    });

    it('should serialize to JSON correctly', () => {
      const error = new ConfigurationError('Missing required plugin');

      expect(error.toJSON()).toEqual({
        error: 'ConfigurationError',
        message: 'Missing required plugin',
        statusCode: 500,
        code: 'CONFIGURATION_ERROR',
      });
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error with correct defaults', () => {
      const error = new ConflictError('Duplicate email');

      expect(error).toBeInstanceOf(ConflictError);
      expect(error).toBeInstanceOf(VeloxError);
      expect(error.message).toBe('Duplicate email');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.name).toBe('ConflictError');
      expect(error.fields).toBeUndefined();
    });

    it('should include field names when provided', () => {
      const error = new ConflictError('Duplicate entry', ['email', 'username']);

      expect(error.fields).toEqual(['email', 'username']);
    });

    it('should serialize to JSON with and without fields', () => {
      const withFields = new ConflictError('Duplicate', ['email']);
      const withoutFields = new ConflictError('Duplicate');

      expect(withFields.toJSON()).toEqual({
        error: 'ConflictError',
        message: 'Duplicate',
        statusCode: 409,
        code: 'CONFLICT',
        fields: ['email'],
      });

      expect(withoutFields.toJSON()).toEqual({
        error: 'ConflictError',
        message: 'Duplicate',
        statusCode: 409,
        code: 'CONFLICT',
        fields: undefined,
      });
    });
  });

  describe('ForbiddenError', () => {
    it('should create forbidden error with default message', () => {
      const error = new ForbiddenError();

      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error).toBeInstanceOf(VeloxError);
      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.name).toBe('ForbiddenError');
    });

    it('should accept custom message', () => {
      const error = new ForbiddenError('Admin access required');

      expect(error.message).toBe('Admin access required');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('UnauthorizedError', () => {
    it('should create unauthorized error with default message', () => {
      const error = new UnauthorizedError();

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error).toBeInstanceOf(VeloxError);
      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.name).toBe('UnauthorizedError');
    });

    it('should accept custom message', () => {
      const error = new UnauthorizedError('Token expired');

      expect(error.message).toBe('Token expired');
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create service unavailable error with default message', () => {
      const error = new ServiceUnavailableError();

      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(error).toBeInstanceOf(VeloxError);
      expect(error.message).toBe('Service unavailable');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.name).toBe('ServiceUnavailableError');
    });

    it('should accept custom message', () => {
      const error = new ServiceUnavailableError('Payment gateway down');

      expect(error.message).toBe('Payment gateway down');
    });
  });

  describe('TooManyRequestsError', () => {
    it('should create rate limit error with default message', () => {
      const error = new TooManyRequestsError();

      expect(error).toBeInstanceOf(TooManyRequestsError);
      expect(error).toBeInstanceOf(VeloxError);
      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.name).toBe('TooManyRequestsError');
      expect(error.retryAfter).toBeUndefined();
    });

    it('should include retryAfter when provided', () => {
      const error = new TooManyRequestsError('Slow down', 60);

      expect(error.retryAfter).toBe(60);
    });

    it('should serialize to JSON with retryAfter', () => {
      const error = new TooManyRequestsError('Rate limit exceeded', 120);

      expect(error.toJSON()).toEqual({
        error: 'TooManyRequestsError',
        message: 'Rate limit exceeded',
        statusCode: 429,
        code: 'RATE_LIMITED',
        retryAfter: 120,
      });
    });
  });

  describe('UnprocessableEntityError', () => {
    it('should create unprocessable entity error', () => {
      const error = new UnprocessableEntityError('Cannot publish empty post');

      expect(error).toBeInstanceOf(UnprocessableEntityError);
      expect(error).toBeInstanceOf(VeloxError);
      expect(error.message).toBe('Cannot publish empty post');
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('UNPROCESSABLE');
      expect(error.name).toBe('UnprocessableEntityError');
    });
  });
});

describe('Error Type Guards', () => {
  // Common test values for all type guards
  const allErrors = {
    velox: new VeloxError('test'),
    validation: new ValidationError('test'),
    notFound: new NotFoundError('test'),
    config: new ConfigurationError('test'),
    conflict: new ConflictError('test'),
    forbidden: new ForbiddenError('test'),
    unauthorized: new UnauthorizedError('test'),
    serviceUnavailable: new ServiceUnavailableError('test'),
    tooManyRequests: new TooManyRequestsError('test'),
    unprocessable: new UnprocessableEntityError('test'),
    standard: new Error('test'),
  };

  const invalidValues = [null, undefined, 'error', 123, true, {}, { message: 'test' }];

  describe('isVeloxError', () => {
    it('should return true for all VeloxError subclasses', () => {
      expect(isVeloxError(allErrors.velox)).toBe(true);
      expect(isVeloxError(allErrors.validation)).toBe(true);
      expect(isVeloxError(allErrors.notFound)).toBe(true);
      expect(isVeloxError(allErrors.config)).toBe(true);
      expect(isVeloxError(allErrors.conflict)).toBe(true);
      expect(isVeloxError(allErrors.forbidden)).toBe(true);
      expect(isVeloxError(allErrors.unauthorized)).toBe(true);
      expect(isVeloxError(allErrors.serviceUnavailable)).toBe(true);
      expect(isVeloxError(allErrors.tooManyRequests)).toBe(true);
      expect(isVeloxError(allErrors.unprocessable)).toBe(true);
    });

    it('should return false for non-VeloxError values', () => {
      expect(isVeloxError(allErrors.standard)).toBe(false);
      for (const value of invalidValues) {
        expect(isVeloxError(value)).toBe(false);
      }
    });
  });

  describe('isValidationError', () => {
    it('should return true only for ValidationError', () => {
      expect(isValidationError(allErrors.validation)).toBe(true);
      expect(isValidationError(new ValidationError('test', { field: 'error' }))).toBe(true);
    });

    it('should return false for other errors and invalid values', () => {
      expect(isValidationError(allErrors.velox)).toBe(false);
      expect(isValidationError(allErrors.notFound)).toBe(false);
      expect(isValidationError(allErrors.config)).toBe(false);
      expect(isValidationError(allErrors.standard)).toBe(false);
      for (const value of invalidValues) {
        expect(isValidationError(value)).toBe(false);
      }
    });
  });

  describe('isNotFoundError', () => {
    it('should return true only for NotFoundError', () => {
      expect(isNotFoundError(allErrors.notFound)).toBe(true);
      expect(isNotFoundError(new NotFoundError('Post', '123'))).toBe(true);
    });

    it('should return false for other errors and invalid values', () => {
      expect(isNotFoundError(allErrors.velox)).toBe(false);
      expect(isNotFoundError(allErrors.validation)).toBe(false);
      expect(isNotFoundError(allErrors.config)).toBe(false);
      expect(isNotFoundError(allErrors.standard)).toBe(false);
      for (const value of invalidValues) {
        expect(isNotFoundError(value)).toBe(false);
      }
    });
  });

  describe('isConfigurationError', () => {
    it('should return true only for ConfigurationError', () => {
      expect(isConfigurationError(allErrors.config)).toBe(true);
    });

    it('should return false for other errors and invalid values', () => {
      expect(isConfigurationError(allErrors.velox)).toBe(false);
      expect(isConfigurationError(allErrors.validation)).toBe(false);
      expect(isConfigurationError(allErrors.notFound)).toBe(false);
      expect(isConfigurationError(allErrors.standard)).toBe(false);
      for (const value of invalidValues) {
        expect(isConfigurationError(value)).toBe(false);
      }
    });
  });

  describe('isConflictError', () => {
    it('should return true only for ConflictError', () => {
      expect(isConflictError(allErrors.conflict)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isConflictError(allErrors.velox)).toBe(false);
      expect(isConflictError(allErrors.validation)).toBe(false);
      expect(isConflictError(allErrors.standard)).toBe(false);
      for (const value of invalidValues) {
        expect(isConflictError(value)).toBe(false);
      }
    });
  });

  describe('isForbiddenError', () => {
    it('should return true only for ForbiddenError', () => {
      expect(isForbiddenError(allErrors.forbidden)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isForbiddenError(allErrors.velox)).toBe(false);
      expect(isForbiddenError(allErrors.unauthorized)).toBe(false);
      for (const value of invalidValues) {
        expect(isForbiddenError(value)).toBe(false);
      }
    });
  });

  describe('isUnauthorizedError', () => {
    it('should return true only for UnauthorizedError', () => {
      expect(isUnauthorizedError(allErrors.unauthorized)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isUnauthorizedError(allErrors.velox)).toBe(false);
      expect(isUnauthorizedError(allErrors.forbidden)).toBe(false);
      for (const value of invalidValues) {
        expect(isUnauthorizedError(value)).toBe(false);
      }
    });
  });

  describe('isServiceUnavailableError', () => {
    it('should return true only for ServiceUnavailableError', () => {
      expect(isServiceUnavailableError(allErrors.serviceUnavailable)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isServiceUnavailableError(allErrors.velox)).toBe(false);
      for (const value of invalidValues) {
        expect(isServiceUnavailableError(value)).toBe(false);
      }
    });
  });

  describe('isTooManyRequestsError', () => {
    it('should return true only for TooManyRequestsError', () => {
      expect(isTooManyRequestsError(allErrors.tooManyRequests)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isTooManyRequestsError(allErrors.velox)).toBe(false);
      for (const value of invalidValues) {
        expect(isTooManyRequestsError(value)).toBe(false);
      }
    });
  });

  describe('isUnprocessableEntityError', () => {
    it('should return true only for UnprocessableEntityError', () => {
      expect(isUnprocessableEntityError(allErrors.unprocessable)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isUnprocessableEntityError(allErrors.velox)).toBe(false);
      for (const value of invalidValues) {
        expect(isUnprocessableEntityError(value)).toBe(false);
      }
    });
  });
});

describe('Error Response Type Guards', () => {
  describe('isValidationErrorResponse', () => {
    it('should return true for valid validation error responses', () => {
      const withFields = {
        error: 'ValidationError' as const,
        message: 'Invalid input',
        statusCode: 400 as const,
        code: 'VALIDATION_ERROR' as const,
        fields: { email: 'Invalid' },
      };
      const withoutFields = {
        error: 'ValidationError' as const,
        message: 'Invalid input',
        statusCode: 400 as const,
        code: 'VALIDATION_ERROR' as const,
      };

      expect(isValidationErrorResponse(withFields)).toBe(true);
      expect(isValidationErrorResponse(withoutFields)).toBe(true);
    });

    it('should return false for other error responses', () => {
      const notFoundResponse = {
        error: 'NotFoundError' as const,
        message: 'Not found',
        statusCode: 404 as const,
        code: 'NOT_FOUND' as const,
        resource: 'User',
      };

      expect(isValidationErrorResponse(notFoundResponse)).toBe(false);
    });
  });

  describe('isNotFoundErrorResponse', () => {
    it('should return true for valid not found error responses', () => {
      const withId = {
        error: 'NotFoundError' as const,
        message: 'User with id 123 not found',
        statusCode: 404 as const,
        code: 'NOT_FOUND' as const,
        resource: 'User',
        resourceId: '123',
      };
      const withoutId = {
        error: 'NotFoundError' as const,
        message: 'User not found',
        statusCode: 404 as const,
        code: 'NOT_FOUND' as const,
        resource: 'User',
      };

      expect(isNotFoundErrorResponse(withId)).toBe(true);
      expect(isNotFoundErrorResponse(withoutId)).toBe(true);
    });

    it('should return false for other error responses', () => {
      const validationResponse = {
        error: 'ValidationError' as const,
        message: 'Invalid',
        statusCode: 400 as const,
        code: 'VALIDATION_ERROR' as const,
      };

      expect(isNotFoundErrorResponse(validationResponse)).toBe(false);
    });
  });
});

describe('Utility Functions', () => {
  describe('assertNever', () => {
    it('should throw an error with the unhandled value', () => {
      expect(() => assertNever('test' as never)).toThrow('Unhandled value: "test"');
      expect(() => assertNever({ type: 'unknown' } as never)).toThrow(
        'Unhandled value: {"type":"unknown"}'
      );
      expect(() => assertNever(null as never)).toThrow('Unhandled value: null');
      expect(() => assertNever(undefined as never)).toThrow('Unhandled value:');
    });
  });
});
