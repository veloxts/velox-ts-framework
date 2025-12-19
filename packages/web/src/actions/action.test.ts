/**
 * Tests for the action() helper
 *
 * @module @veloxts/web/actions/action.test
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { action } from './action.js';

describe('action()', () => {
  describe('simple form: action(schema, handler)', () => {
    it('should infer input type from schema', async () => {
      const CreateUserSchema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      });

      const createUser = action(CreateUserSchema, async (input) => {
        // Type check: input should be { name: string; email: string }
        return { id: '123', name: input.name, email: input.email };
      });

      const result = await createUser({ name: 'John', email: 'john@example.com' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          id: '123',
          name: 'John',
          email: 'john@example.com',
        });
      }
    });

    it('should validate input and return validation errors', async () => {
      const Schema = z.object({
        name: z.string().min(3, 'Name must be at least 3 characters'),
        email: z.string().email('Invalid email format'),
      });

      const createUser = action(Schema, async (input) => {
        return input;
      });

      const result = await createUser({ name: 'Jo', email: 'invalid' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.details).toBeDefined();
        const details = result.error.details as {
          errors: Array<{ path: string; message: string }>;
        };
        expect(details.errors).toHaveLength(2);
        expect(details.errors).toContainEqual({
          path: 'name',
          message: 'Name must be at least 3 characters',
        });
        expect(details.errors).toContainEqual({
          path: 'email',
          message: 'Invalid email format',
        });
      }
    });

    it('should catch and handle runtime errors', async () => {
      const Schema = z.object({ id: z.string() });

      const deleteUser = action(Schema, async () => {
        throw new Error('Database connection failed');
      });

      const result = await deleteUser({ id: '123' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
        expect(result.error.message).toBe('Database connection failed');
      }
    });

    it('should categorize common error patterns', async () => {
      const Schema = z.object({ id: z.string() });

      // Unauthorized error
      const action1 = action(Schema, async () => {
        throw new Error('Unauthorized access');
      });
      const r1 = await action1({ id: '1' });
      expect(r1.success).toBe(false);
      if (!r1.success) expect(r1.error.code).toBe('UNAUTHORIZED');

      // Forbidden error
      const action2 = action(Schema, async () => {
        throw new Error('Permission denied');
      });
      const r2 = await action2({ id: '2' });
      expect(r2.success).toBe(false);
      if (!r2.success) expect(r2.error.code).toBe('FORBIDDEN');

      // Not found error
      const action3 = action(Schema, async () => {
        throw new Error('User not found');
      });
      const r3 = await action3({ id: '3' });
      expect(r3.success).toBe(false);
      if (!r3.success) expect(r3.error.code).toBe('NOT_FOUND');
    });
  });

  describe('fluent builder: action.input().run()', () => {
    it('should work with input() builder method', async () => {
      const UpdateSchema = z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
      });

      const updateUser = action.input(UpdateSchema).run(async (input) => {
        return { ...input, updated: true };
      });

      const result = await updateUser({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Jane',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updated).toBe(true);
        expect(result.data.name).toBe('Jane');
      }
    });

    it('should validate output when output() is specified', async () => {
      const InputSchema = z.object({ value: z.number() });
      const OutputSchema = z.object({
        doubled: z.number().int(),
      });

      const doubleIt = action
        .input(InputSchema)
        .output(OutputSchema)
        .run(async (input) => {
          return { doubled: input.value * 2 };
        });

      const result = await doubleIt({ value: 5 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.doubled).toBe(10);
      }
    });

    it('should fail when output does not match schema', async () => {
      const InputSchema = z.object({ value: z.number() });
      const OutputSchema = z.object({
        result: z.string(), // Expecting string
      });

      const badAction = action
        .input(InputSchema)
        .output(OutputSchema)
        .run(async (input) => {
          // Returning number instead of string (type assertion to bypass TS)
          return { result: input.value * 2 } as unknown as { result: string };
        });

      const result = await badAction({ value: 5 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
        expect(result.error.message).toBe('Output validation failed');
      }
    });
  });

  describe('protected actions: action.protected()', () => {
    it('should return UNAUTHORIZED when no user is present', async () => {
      const Schema = z.object({ data: z.string() });

      const protectedAction = action
        .input(Schema)
        .protected()
        .run(async (input, ctx) => {
          // ctx.user should be typed
          return { userId: ctx.user.id, data: input.data };
        });

      const result = await protectedAction({ data: 'test' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
        expect(result.error.message).toBe('Authentication required');
      }
    });
  });

  describe('custom error handlers: action.onError()', () => {
    it('should use custom error handler when provided', async () => {
      const Schema = z.object({ id: z.string() });

      const customAction = action
        .input(Schema)
        .onError(() => ({
          success: false as const,
          error: {
            code: 'CONFLICT' as const,
            message: 'Custom error message',
            details: { custom: true },
          },
        }))
        .run(async () => {
          throw new Error('Original error');
        });

      const result = await customAction({ id: '1' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CONFLICT');
        expect(result.error.message).toBe('Custom error message');
        expect(result.error.details).toEqual({ custom: true });
      }
    });
  });

  describe('complex schemas', () => {
    it('should handle nested object schemas', async () => {
      const Schema = z.object({
        user: z.object({
          name: z.string(),
          address: z.object({
            street: z.string(),
            city: z.string(),
          }),
        }),
        tags: z.array(z.string()),
      });

      const complexAction = action(Schema, async (input) => {
        return {
          userName: input.user.name,
          city: input.user.address.city,
          tagCount: input.tags.length,
        };
      });

      const result = await complexAction({
        user: {
          name: 'John',
          address: { street: '123 Main St', city: 'Boston' },
        },
        tags: ['admin', 'user'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userName).toBe('John');
        expect(result.data.city).toBe('Boston');
        expect(result.data.tagCount).toBe(2);
      }
    });

    it('should handle optional and nullable fields', async () => {
      const Schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        nullable: z.string().nullable(),
      });

      const optionalAction = action(Schema, async (input) => ({
        required: input.required,
        optional: input.optional ?? 'default',
        nullable: input.nullable ?? 'was null',
      }));

      const result = await optionalAction({
        required: 'value',
        nullable: null,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.required).toBe('value');
        expect(result.data.optional).toBe('default');
        expect(result.data.nullable).toBe('was null');
      }
    });

    it('should handle union types', async () => {
      const Schema = z.discriminatedUnion('type', [
        z.object({ type: z.literal('create'), name: z.string() }),
        z.object({ type: z.literal('update'), id: z.string(), name: z.string() }),
      ]);

      const unionAction = action(Schema, async (input) => {
        if (input.type === 'create') {
          return { action: 'created', name: input.name };
        }
        return { action: 'updated', id: input.id, name: input.name };
      });

      const createResult = await unionAction({ type: 'create', name: 'New' });
      expect(createResult.success).toBe(true);
      if (createResult.success) {
        expect(createResult.data.action).toBe('created');
      }

      const updateResult = await unionAction({ type: 'update', id: '123', name: 'Updated' });
      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data.action).toBe('updated');
      }
    });
  });

  describe('async validation (transform/refine)', () => {
    it('should work with async transforms', async () => {
      const Schema = z.object({
        email: z
          .string()
          .email()
          .transform((email) => email.toLowerCase()),
        name: z.string().transform((name) => name.trim()),
      });

      const transformAction = action(Schema, async (input) => ({
        email: input.email,
        name: input.name,
      }));

      const result = await transformAction({
        email: 'JOHN@EXAMPLE.COM',
        name: '  John Doe  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('john@example.com');
        expect(result.data.name).toBe('John Doe');
      }
    });

    it('should work with refine validators', async () => {
      const Schema = z
        .object({
          password: z.string().min(8),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: 'Passwords must match',
          path: ['confirmPassword'],
        });

      const registerAction = action(Schema, async (input) => ({
        registered: true,
        passwordLength: input.password.length,
      }));

      // Valid input
      const validResult = await registerAction({
        password: 'securepass123',
        confirmPassword: 'securepass123',
      });
      expect(validResult.success).toBe(true);

      // Invalid input (passwords don't match)
      const invalidResult = await registerAction({
        password: 'securepass123',
        confirmPassword: 'different',
      });
      expect(invalidResult.success).toBe(false);
      if (!invalidResult.success) {
        expect(invalidResult.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty objects', async () => {
      const Schema = z.object({});

      const emptyAction = action(Schema, async () => ({ ok: true }));

      const result = await emptyAction({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ok).toBe(true);
      }
    });

    it('should handle void return', async () => {
      const Schema = z.object({ id: z.string() });

      const voidAction = action(Schema, async () => {
        // No return value
      });

      const result = await voidAction({ id: '123' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    });

    it('should handle non-Error thrown values', async () => {
      const Schema = z.object({ id: z.string() });

      const throwsString = action(Schema, async () => {
        throw 'string error';
      });

      const result = await throwsString({ id: '1' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
        // The error classifier preserves string error messages when thrown directly
        expect(result.error.message).toBe('string error');
      }
    });
  });
});
