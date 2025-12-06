/**
 * @veloxts/core - Error Classes Unit Tests
 * Tests error class construction, inheritance, and type guards
 */

import { describe, expect, it } from 'vitest';

import {
  assertNever,
  ConfigurationError,
  isConfigurationError,
  isNotFoundError,
  isNotFoundErrorResponse,
  isValidationError,
  isValidationErrorResponse,
  isVeloxError,
  NotFoundError,
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
});

describe('Error Type Guards', () => {
  // Common test values for all type guards
  const allErrors = {
    velox: new VeloxError('test'),
    validation: new ValidationError('test'),
    notFound: new NotFoundError('test'),
    config: new ConfigurationError('test'),
    standard: new Error('test'),
  };

  const invalidValues = [null, undefined, 'error', 123, true, {}, { message: 'test' }];

  describe('isVeloxError', () => {
    it('should return true for all VeloxError subclasses', () => {
      expect(isVeloxError(allErrors.velox)).toBe(true);
      expect(isVeloxError(allErrors.validation)).toBe(true);
      expect(isVeloxError(allErrors.notFound)).toBe(true);
      expect(isVeloxError(allErrors.config)).toBe(true);
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
