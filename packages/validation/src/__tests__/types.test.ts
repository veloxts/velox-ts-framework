/**
 * @veloxts/validation - Type Guards and Schema Wrapper Tests
 * Tests schema type guards, wrapper functionality, and type inference
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isSchema, isZodSchema, wrapSchema } from '../types.js';

describe('Type Guards', () => {
  describe('isSchema', () => {
    it('should return true for wrapped schemas', () => {
      const schema = wrapSchema(z.string());
      expect(isSchema(schema)).toBe(true);
    });

    it('should return false for raw Zod schemas', () => {
      const zodSchema = z.string();
      expect(isSchema(zodSchema)).toBe(false);
    });

    it('should return false for non-schema objects', () => {
      expect(isSchema({})).toBe(false);
      expect(isSchema({ _schema: false })).toBe(false);
      expect(isSchema({ _schema: 'true' })).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isSchema(null)).toBe(false);
      expect(isSchema(undefined)).toBe(false);
      expect(isSchema(42)).toBe(false);
      expect(isSchema('string')).toBe(false);
    });
  });

  describe('isZodSchema', () => {
    it('should return true for Zod schemas', () => {
      expect(isZodSchema(z.string())).toBe(true);
      expect(isZodSchema(z.number())).toBe(true);
      expect(isZodSchema(z.object({ id: z.string() }))).toBe(true);
      expect(isZodSchema(z.array(z.string()))).toBe(true);
    });

    it('should return false for wrapped schemas', () => {
      const schema = wrapSchema(z.string());
      expect(isZodSchema(schema)).toBe(false);
    });

    it('should return false for non-schema objects', () => {
      expect(isZodSchema({})).toBe(false);
      expect(isZodSchema({ parse: () => {}, safeParse: () => {} })).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isZodSchema(null)).toBe(false);
      expect(isZodSchema(undefined)).toBe(false);
      expect(isZodSchema(42)).toBe(false);
    });
  });
});

describe('wrapSchema', () => {
  it('should wrap a Zod schema with Schema interface', () => {
    const zodSchema = z.string().min(1);
    const wrapped = wrapSchema(zodSchema);

    expect(wrapped._schema).toBe(true);
    expect(typeof wrapped.parse).toBe('function');
    expect(typeof wrapped.safeParse).toBe('function');
  });

  it('should parse valid input successfully', () => {
    const schema = wrapSchema(z.object({ name: z.string(), age: z.number() }));
    const input = { name: 'John', age: 30 };

    const result = schema.parse(input);

    expect(result).toEqual(input);
  });

  it('should throw on invalid input', () => {
    const schema = wrapSchema(z.object({ name: z.string(), age: z.number() }));
    const input = { name: 'John', age: 'invalid' };

    expect(() => schema.parse(input)).toThrow();
  });

  it('should safeParse valid input successfully', () => {
    const schema = wrapSchema(z.object({ name: z.string(), age: z.number() }));
    const input = { name: 'John', age: 30 };

    const result = schema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(input);
    }
  });

  it('should safeParse invalid input without throwing', () => {
    const schema = wrapSchema(z.object({ name: z.string(), age: z.number() }));
    const input = { name: 'John', age: 'invalid' };

    const result = schema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Array);
      expect(result.error.length).toBeGreaterThan(0);
      expect(result.error[0]).toHaveProperty('path');
      expect(result.error[0]).toHaveProperty('message');
      expect(result.error[0]).toHaveProperty('code');
    }
  });

  it('should preserve transformation logic', () => {
    const schema = wrapSchema(
      z
        .string()
        .transform((val) => val.toUpperCase())
        .pipe(z.string().min(1))
    );

    const result = schema.parse('hello');
    expect(result).toBe('HELLO');
  });

  it('should handle nested validation errors', () => {
    const schema = wrapSchema(
      z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
      })
    );

    const result = schema.safeParse({
      user: {
        name: 'John',
        email: 'invalid-email',
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error[0].path).toEqual(['user', 'email']);
    }
  });

  it('should handle array validation errors', () => {
    const schema = wrapSchema(
      z.object({
        tags: z.array(z.string().min(1)),
      })
    );

    const result = schema.safeParse({
      tags: ['valid', '', 'also-valid'],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error[0].path).toEqual(['tags', 1]);
    }
  });

  it('should handle multiple validation errors', () => {
    const schema = wrapSchema(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        age: z.number().positive(),
      })
    );

    const result = schema.safeParse({
      name: '',
      email: 'invalid',
      age: -5,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('should handle optional fields', () => {
    const schema = wrapSchema(
      z.object({
        required: z.string(),
        optional: z.string().optional(),
      })
    );

    const result1 = schema.parse({ required: 'value' });
    expect(result1).toEqual({ required: 'value' });

    const result2 = schema.parse({ required: 'value', optional: 'also-value' });
    expect(result2).toEqual({ required: 'value', optional: 'also-value' });
  });

  it('should handle default values', () => {
    const schema = wrapSchema(
      z.object({
        name: z.string(),
        role: z.string().default('user'),
      })
    );

    const result = schema.parse({ name: 'John' });
    expect(result).toEqual({ name: 'John', role: 'user' });
  });

  it('should preserve type coercion', () => {
    const schema = wrapSchema(
      z.object({
        count: z.coerce.number(),
        active: z.coerce.boolean(),
      })
    );

    const result = schema.parse({ count: '42', active: 'true' });
    expect(result).toEqual({ count: 42, active: true });
  });
});

describe('SafeParseResult type discrimination', () => {
  it('should properly discriminate success vs error', () => {
    const schema = wrapSchema(z.string());

    const successResult = schema.safeParse('valid');
    const errorResult = schema.safeParse(123);

    // TypeScript discriminated union test
    if (successResult.success) {
      expect(successResult.data).toBe('valid');
      // @ts-expect-error - error should not exist on success
      expect(successResult.error).toBeUndefined();
    }

    if (!errorResult.success) {
      expect(errorResult.error).toBeInstanceOf(Array);
      // @ts-expect-error - data should not exist on error
      expect(errorResult.data).toBeUndefined();
    }
  });
});
