/**
 * @veloxts/validation - Middleware Tests
 * Tests validation middleware, error formatting, and validator utilities
 */

import { ValidationError } from '@veloxts/core';
import { describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';

import {
  assertSchema,
  createTypeGuard,
  createValidator,
  formatZodErrors,
  safeValidate,
  validate,
  validateAll,
  zodErrorToValidationError,
} from '../middleware.js';
import { wrapSchema } from '../types.js';

describe('Error Transformation', () => {
  describe('formatZodErrors', () => {
    it('should format single field error', () => {
      const issues = [{ path: ['email'], message: 'Invalid email' }];

      const formatted = formatZodErrors(issues);

      expect(formatted).toEqual({
        email: 'Invalid email',
      });
    });

    it('should format nested field errors', () => {
      const issues = [
        { path: ['user', 'email'], message: 'Invalid email' },
        { path: ['user', 'age'], message: 'Must be positive' },
      ];

      const formatted = formatZodErrors(issues);

      expect(formatted).toEqual({
        'user.email': 'Invalid email',
        'user.age': 'Must be positive',
      });
    });

    it('should format array index errors', () => {
      const issues = [
        { path: ['tags', 0], message: 'Required' },
        { path: ['tags', 2], message: 'Too long' },
      ];

      const formatted = formatZodErrors(issues);

      expect(formatted).toEqual({
        'tags.0': 'Required',
        'tags.2': 'Too long',
      });
    });

    it('should use _root for empty path', () => {
      const issues = [{ path: [], message: 'Invalid input' }];

      const formatted = formatZodErrors(issues);

      expect(formatted).toEqual({
        _root: 'Invalid input',
      });
    });

    it('should only keep first error per field', () => {
      const issues = [
        { path: ['email'], message: 'First error' },
        { path: ['email'], message: 'Second error' },
        { path: ['name'], message: 'Name error' },
      ];

      const formatted = formatZodErrors(issues);

      expect(formatted).toEqual({
        email: 'First error',
        name: 'Name error',
      });
    });
  });

  describe('zodErrorToValidationError', () => {
    it('should convert ZodError to ValidationError', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().positive(),
      });

      try {
        schema.parse({ email: 'invalid', age: -5 });
      } catch (error) {
        if (error instanceof ZodError) {
          const veloxError = zodErrorToValidationError(error);

          expect(veloxError).toBeInstanceOf(ValidationError);
          expect(veloxError.message).toBe('Validation failed');
          expect(veloxError.statusCode).toBe(400);
          expect(veloxError.fields).toHaveProperty('email');
          expect(veloxError.fields).toHaveProperty('age');
        }
      }
    });

    it('should use custom message', () => {
      const schema = z.string().email();

      try {
        schema.parse('invalid');
      } catch (error) {
        if (error instanceof ZodError) {
          const veloxError = zodErrorToValidationError(error, 'Custom message');

          expect(veloxError.message).toBe('Custom message');
        }
      }
    });
  });
});

describe('Validation Functions', () => {
  describe('validate', () => {
    it('should validate with Zod schema', () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const input = { name: 'John', age: 30 };

      const result = validate(schema, input);

      expect(result).toEqual(input);
    });

    it('should validate with wrapped Schema', () => {
      const schema = wrapSchema(z.object({ name: z.string() }));
      const input = { name: 'John' };

      const result = validate(schema, input);

      expect(result).toEqual(input);
    });

    it('should throw ValidationError on invalid input', () => {
      const schema = z.object({ email: z.string().email() });
      const input = { email: 'invalid' };

      expect(() => validate(schema, input)).toThrow(ValidationError);
    });

    it('should use custom error message', () => {
      const schema = z.string();
      const input = 123;

      try {
        validate(schema, input, 'Custom error');
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.message).toBe('Custom error');
        }
      }
    });

    it('should use custom error message with wrapped Schema', () => {
      const schema = wrapSchema(z.string().email());
      const input = 'invalid-email';

      try {
        validate(schema, input, 'Custom wrapped schema error');
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.message).toBe('Custom wrapped schema error');
        }
      }
    });

    it('should preserve transformation logic', () => {
      const schema = z
        .string()
        .transform((val) => val.toUpperCase())
        .pipe(z.string());

      const result = validate(schema, 'hello');

      expect(result).toBe('HELLO');
    });

    it('should throw error for invalid schema', () => {
      const invalidSchema = { not: 'a schema' };

      expect(() => validate(invalidSchema as z.ZodTypeAny, {})).toThrow(
        'Invalid schema provided to parse()'
      );
    });
  });

  describe('safeValidate', () => {
    it('should return success result for valid input', () => {
      const schema = z.object({ name: z.string() });
      const input = { name: 'John' };

      const result = safeValidate(schema, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(input);
      }
    });

    it('should return error result for invalid input', () => {
      const schema = z.object({ email: z.string().email() });
      const input = { email: 'invalid' };

      const result = safeValidate(schema, input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Array);
        expect(result.error.length).toBeGreaterThan(0);
        expect(result.error[0]).toHaveProperty('path');
        expect(result.error[0]).toHaveProperty('message');
      }
    });

    it('should work with wrapped Schema', () => {
      const schema = wrapSchema(z.string().min(5));
      const input = 'hi';

      const result = safeValidate(schema, input);

      expect(result.success).toBe(false);
    });

    it('should return error for invalid schema', () => {
      const invalidSchema = { not: 'a schema' };

      const result = safeValidate(invalidSchema as z.ZodTypeAny, {});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error[0].message).toBe('Invalid schema provided');
      }
    });
  });
});

describe('Schema Validators', () => {
  describe('createValidator', () => {
    it('should create reusable validator', () => {
      const UserSchema = z.object({
        name: z.string(),
        email: z.string().email(),
      });

      const userValidator = createValidator(UserSchema);

      expect(typeof userValidator.validate).toBe('function');
      expect(typeof userValidator.safeValidate).toBe('function');
      expect(typeof userValidator.parse).toBe('function');
      expect(typeof userValidator.safeParse).toBe('function');
      expect(userValidator.schema).toBe(UserSchema);
    });

    it('should validate successfully', () => {
      const validator = createValidator(z.string().email());

      const result = validator.validate('test@example.com');

      expect(result).toBe('test@example.com');
    });

    it('should parse successfully (new method)', () => {
      const validator = createValidator(z.string().email());

      const result = validator.parse('test@example.com');

      expect(result).toBe('test@example.com');
    });

    it('should throw on validation failure', () => {
      const validator = createValidator(z.string().email());

      expect(() => validator.validate('invalid')).toThrow(ValidationError);
    });

    it('should throw on parse failure (new method)', () => {
      const validator = createValidator(z.string().email());

      expect(() => validator.parse('invalid')).toThrow(ValidationError);
    });

    it('should safe validate successfully', () => {
      const validator = createValidator(z.number().positive());

      const result = validator.safeValidate(42);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('should safe parse successfully (new method)', () => {
      const validator = createValidator(z.number().positive());

      const result = validator.safeParse(42);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('should safe validate with error', () => {
      const validator = createValidator(z.number().positive());

      const result = validator.safeValidate(-5);

      expect(result.success).toBe(false);
    });

    it('should safe parse with error (new method)', () => {
      const validator = createValidator(z.number().positive());

      const result = validator.safeParse(-5);

      expect(result.success).toBe(false);
    });
  });
});

describe('Request Validation Helpers', () => {
  describe('validateAll', () => {
    it('should validate multiple sources', () => {
      const BodySchema = z.object({ name: z.string() });
      const QuerySchema = z.object({ page: z.number() });
      const ParamsSchema = z.object({ id: z.string() });

      const result = validateAll({
        body: [BodySchema, { name: 'John' }],
        query: [QuerySchema, { page: 1 }],
        params: [ParamsSchema, { id: '123' }],
      });

      expect(result.body).toEqual({ name: 'John' });
      expect(result.query).toEqual({ page: 1 });
      expect(result.params).toEqual({ id: '123' });
    });

    it('should throw ValidationError with combined errors', () => {
      const BodySchema = z.object({ email: z.string().email() });
      const QuerySchema = z.object({ page: z.number().positive() });

      try {
        validateAll({
          body: [BodySchema, { email: 'invalid' }],
          query: [QuerySchema, { page: -1 }],
        });
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.fields).toHaveProperty('body.email');
          expect(error.fields).toHaveProperty('query.page');
        }
      }
    });

    it('should handle partial failures', () => {
      const Schema1 = z.object({ valid: z.string() });
      const Schema2 = z.object({ invalid: z.number() });

      try {
        validateAll({
          first: [Schema1, { valid: 'ok' }],
          second: [Schema2, { invalid: 'not-a-number' }],
        });
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.fields).toHaveProperty('second.invalid');
          expect(error.fields).not.toHaveProperty('first.valid');
        }
      }
    });

    it('should namespace errors correctly', () => {
      const schema = z.object({
        nested: z.object({
          field: z.string(),
        }),
      });

      try {
        validateAll({
          data: [schema, { nested: { field: 123 } }],
        });
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.fields).toHaveProperty('data.nested.field');
        }
      }
    });

    it('should handle root-level validation errors (empty path)', () => {
      // Create a schema with root-level refinement that can fail with empty path
      const schema = z
        .string()
        .refine((val) => val.length > 5, { message: 'Too short', path: [] });

      try {
        validateAll({
          input: [schema, 'hi'],
        });
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ValidationError) {
          // Should have the error at the root level of 'input'
          expect(error.fields).toHaveProperty('input');
        }
      }
    });

    it('should handle multiple errors with duplicate paths', () => {
      const schema = z.object({
        value: z.string().min(5).max(10),
      });

      try {
        validateAll({
          data: [schema, { value: 'a' }],
        });
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ValidationError) {
          // Only first error for each path should be kept
          expect(error.fields).toHaveProperty('data.value');
        }
      }
    });
  });
});

describe('Type Guards', () => {
  describe('createTypeGuard', () => {
    it('should create working type guard', () => {
      const UserSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const isUser = createTypeGuard(UserSchema);

      expect(isUser({ name: 'John', age: 30 })).toBe(true);
      expect(isUser({ name: 'John' })).toBe(false);
      expect(isUser(null)).toBe(false);
      expect(isUser('string')).toBe(false);
    });

    it('should narrow types correctly', () => {
      const schema = z.object({ id: z.string() });
      const isValidData = createTypeGuard(schema);

      const data: unknown = { id: '123' };

      if (isValidData(data)) {
        // TypeScript should know data is { id: string }
        expect(data.id).toBe('123');
      }
    });
  });

  describe('assertSchema', () => {
    it('should assert valid data', () => {
      const schema = z.object({ name: z.string() });
      const data: unknown = { name: 'John' };

      expect(() => assertSchema(schema, data)).not.toThrow();
    });

    it('should throw on invalid data', () => {
      const schema = z.object({ name: z.string() });
      const data: unknown = { name: 123 };

      expect(() => assertSchema(schema, data)).toThrow(ValidationError);
    });

    it('should use custom error message', () => {
      const schema = z.string();
      const data: unknown = 123;

      try {
        assertSchema(schema, data, 'Custom assertion error');
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.message).toBe('Custom assertion error');
        }
      }
    });

    it('should narrow types', () => {
      const schema = z.object({ id: z.string(), count: z.number() });
      const data: unknown = { id: '123', count: 42 };

      assertSchema(schema, data);

      // After assertion, TypeScript knows data is { id: string, count: number }
      expect(data.id).toBe('123');
      expect(data.count).toBe(42);
    });
  });
});

describe('Edge Cases and Error Handling', () => {
  it('should handle nested validation errors', () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          email: z.string().email(),
        }),
      }),
    });

    const result = safeValidate(schema, {
      user: {
        profile: {
          email: 'invalid',
        },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error[0].path).toEqual(['user', 'profile', 'email']);
    }
  });

  it('should handle array validation errors', () => {
    const schema = z.object({
      items: z.array(z.object({ id: z.string().uuid() })),
    });

    const result = safeValidate(schema, {
      items: [{ id: 'valid-uuid' }, { id: 'invalid' }],
    });

    expect(result.success).toBe(false);
  });

  it('should handle union type errors', () => {
    const schema = z.union([z.string(), z.number()]);

    const validString = safeValidate(schema, 'hello');
    const validNumber = safeValidate(schema, 42);
    const invalid = safeValidate(schema, true);

    expect(validString.success).toBe(true);
    expect(validNumber.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it('should handle refinement errors', () => {
    const schema = z
      .object({
        password: z.string(),
        confirmPassword: z.string(),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords must match',
        path: ['confirmPassword'],
      });

    const result = safeValidate(schema, {
      password: 'secret',
      confirmPassword: 'different',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted.confirmPassword).toBe('Passwords must match');
    }
  });

  it('should handle coercion in validation', () => {
    const schema = z.object({
      count: z.coerce.number(),
      active: z.coerce.boolean(),
    });

    const result = validate(schema, {
      count: '42',
      active: 'true',
    });

    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
  });

  it('should handle optional fields correctly', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    const result1 = validate(schema, { required: 'value' });
    expect(result1).toEqual({ required: 'value' });

    const result2 = validate(schema, { required: 'value', optional: 'also' });
    expect(result2).toEqual({ required: 'value', optional: 'also' });
  });
});
