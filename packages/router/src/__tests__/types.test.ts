/**
 * @veloxts/router - Type-Level Tests
 *
 * These tests verify that the procedure builder type system correctly infers
 * and preserves types throughout the fluent API chain. They use Vitest's
 * expectTypeOf to assert type equality at compile time.
 *
 * The tests cover:
 * - Input type inference from Zod schemas
 * - Output type inference from Zod schemas
 * - Context extension through middleware chain
 * - Type preservation in defineProcedures
 * - Edge cases (unions, optionals, transforms, discriminated unions)
 *
 * @module __tests__/types.test
 */

import type { BaseContext } from '@veloxts/core';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { defineProcedures, procedure } from '../procedure/builder.js';
import type { InferProcedures, InferSchemaOutput, ProcedureBuilder } from '../procedure/types.js';
import type {
  CompiledProcedure,
  ContextExtensions,
  InferProcedureInput,
  InferProcedureOutput,
  MiddlewareArgs,
  MiddlewareNext,
  ProcedureCollection,
} from '../types.js';

// ============================================================================
// Test Schemas
// ============================================================================

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.date(),
});

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// ============================================================================
// Basic Type Inference Tests
// ============================================================================

describe('Type Inference - Basic Cases', () => {
  describe('Input Type Inference', () => {
    it('should infer input type from z.object schema', () => {
      const inputSchema = z.object({
        id: z.string(),
        count: z.number(),
      });

      type ExpectedInput = { id: string; count: number };

      // Test InferSchemaOutput utility type
      expectTypeOf<InferSchemaOutput<typeof inputSchema>>().toEqualTypeOf<ExpectedInput>();

      // Test that procedure builder captures the type
      const builder = procedure().input(inputSchema);
      expectTypeOf(builder).toMatchTypeOf<ProcedureBuilder<ExpectedInput, unknown, BaseContext>>();
    });

    it('should infer input type from primitive schema', () => {
      const stringSchema = z.string();

      expectTypeOf<InferSchemaOutput<typeof stringSchema>>().toEqualTypeOf<string>();

      const builder = procedure().input(stringSchema);
      expectTypeOf(builder).toMatchTypeOf<ProcedureBuilder<string, unknown, BaseContext>>();
    });

    it('should preserve input type through to handler', () => {
      const inputSchema = z.object({ userId: z.string() });

      const proc = procedure()
        .input(inputSchema)
        .query(async ({ input }) => {
          // Verify input type in handler
          expectTypeOf(input).toEqualTypeOf<{ userId: string }>();
          return { found: true };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{ userId: string }>();
    });
  });

  describe('Output Type Inference', () => {
    it('should infer output type from z.object schema', () => {
      const outputSchema = z.object({
        success: z.boolean(),
        data: z.string(),
      });

      type ExpectedOutput = { success: boolean; data: string };

      expectTypeOf<InferSchemaOutput<typeof outputSchema>>().toEqualTypeOf<ExpectedOutput>();

      const builder = procedure().output(outputSchema);
      expectTypeOf(builder).toMatchTypeOf<ProcedureBuilder<unknown, ExpectedOutput, BaseContext>>();
    });

    it('should enforce handler return type matches output schema', () => {
      const proc = procedure()
        .output(z.object({ count: z.number() }))
        .query(async () => {
          // Handler must return { count: number }
          return { count: 42 };
        });

      expectTypeOf<InferProcedureOutput<typeof proc>>().toEqualTypeOf<{ count: number }>();
    });

    it('should preserve output type in compiled procedure', () => {
      const proc = procedure()
        .output(UserSchema)
        .query(async () => ({
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'John',
          email: 'john@example.com',
          createdAt: new Date(),
        }));

      type ExpectedUser = z.infer<typeof UserSchema>;
      expectTypeOf<InferProcedureOutput<typeof proc>>().toEqualTypeOf<ExpectedUser>();
    });
  });

  describe('Combined Input and Output', () => {
    it('should preserve both input and output types', () => {
      const proc = procedure()
        .input(z.object({ id: z.string() }))
        .output(z.object({ name: z.string(), email: z.string() }))
        .query(async ({ input }) => {
          expectTypeOf(input).toEqualTypeOf<{ id: string }>();
          return { name: 'John', email: 'john@example.com' };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{ id: string }>();
      expectTypeOf<InferProcedureOutput<typeof proc>>().toEqualTypeOf<{
        name: string;
        email: string;
      }>();
    });

    it('should work with complex nested schemas', () => {
      const inputSchema = z.object({
        filter: z.object({
          status: z.enum(['active', 'inactive']),
          createdAfter: z.date().optional(),
        }),
        pagination: z.object({
          page: z.number(),
          limit: z.number(),
        }),
      });

      const outputSchema = z.object({
        items: z.array(UserSchema),
        total: z.number(),
        hasMore: z.boolean(),
      });

      const proc = procedure()
        .input(inputSchema)
        .output(outputSchema)
        .query(async ({ input }) => {
          expectTypeOf(input.filter.status).toEqualTypeOf<'active' | 'inactive'>();
          expectTypeOf(input.filter.createdAfter).toEqualTypeOf<Date | undefined>();
          expectTypeOf(input.pagination.page).toEqualTypeOf<number>();

          return {
            items: [],
            total: 0,
            hasMore: false,
          };
        });

      type ExpectedInput = z.infer<typeof inputSchema>;
      type ExpectedOutput = z.infer<typeof outputSchema>;

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<ExpectedInput>();
      expectTypeOf<InferProcedureOutput<typeof proc>>().toEqualTypeOf<ExpectedOutput>();
    });
  });
});

// ============================================================================
// Context Extension Tests
// ============================================================================

describe('Type Inference - Context Extension', () => {
  describe('Middleware Context Extension', () => {
    it('should extend context type through single middleware', () => {
      interface AuthContext extends BaseContext {
        userId: string;
      }

      const proc = procedure()
        .use<AuthContext>(async ({ next }) => {
          return next({ ctx: { userId: 'user-123' } });
        })
        .query(async ({ ctx }) => {
          // Context should be extended with userId
          expectTypeOf(ctx).toMatchTypeOf<AuthContext>();
          return { authenticated: true };
        });

      expectTypeOf(proc).toMatchTypeOf<
        CompiledProcedure<unknown, { authenticated: boolean }, AuthContext>
      >();
    });

    it('should accumulate context extensions through middleware chain', () => {
      interface AuthContext extends BaseContext {
        userId: string;
      }

      interface AuthWithDbContext extends AuthContext {
        db: { query: () => void };
      }

      const proc = procedure()
        .use<AuthContext>(async ({ next }) => {
          return next({ ctx: { userId: 'user-123' } });
        })
        .use<AuthWithDbContext>(async ({ next }) => {
          return next({ ctx: { db: { query: () => {} } } });
        })
        .query(async ({ ctx }) => {
          // Context should have both userId and db
          expectTypeOf(ctx).toMatchTypeOf<AuthWithDbContext>();
          expectTypeOf(ctx.userId).toEqualTypeOf<string>();
          expectTypeOf(ctx.db).toMatchTypeOf<{ query: () => void }>();
          return { ready: true };
        });

      expectTypeOf(proc).toMatchTypeOf<
        CompiledProcedure<unknown, { ready: boolean }, AuthWithDbContext>
      >();
    });

    it('should preserve context type when no extension is made', () => {
      const proc = procedure()
        .use(async ({ next }) => {
          // Middleware that does not extend context
          return next();
        })
        .query(async ({ ctx }) => {
          // Context should still be BaseContext
          expectTypeOf(ctx).toMatchTypeOf<BaseContext>();
          return { result: true };
        });

      expectTypeOf(proc).toMatchTypeOf<
        CompiledProcedure<unknown, { result: boolean }, BaseContext>
      >();
    });
  });

  describe('Context with Input Types', () => {
    it('should preserve both input and extended context', () => {
      interface RequestContext extends BaseContext {
        requestId: string;
      }

      const proc = procedure()
        .input(z.object({ userId: z.string() }))
        .use<RequestContext>(async ({ next }) => {
          return next({ ctx: { requestId: 'req-456' } });
        })
        .query(async ({ input, ctx }) => {
          expectTypeOf(input).toEqualTypeOf<{ userId: string }>();
          expectTypeOf(ctx).toMatchTypeOf<RequestContext>();
          expectTypeOf(ctx.requestId).toEqualTypeOf<string>();
          return { processed: true };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{ userId: string }>();
    });
  });

  describe('ContextExtensions Utility Type', () => {
    it('should compute extensions between context types', () => {
      interface AuthContext extends BaseContext {
        userId: string;
        permissions: string[];
      }

      // ContextExtensions should extract properties added to BaseContext
      type Extensions = ContextExtensions<BaseContext, AuthContext>;

      // The extensions should be the new properties
      expectTypeOf<Extensions>().toEqualTypeOf<{
        userId: string;
        permissions: string[];
      }>();
    });

    it('should handle nested context extensions', () => {
      interface Level1Context extends BaseContext {
        level1: string;
      }

      interface Level2Context extends Level1Context {
        level2: number;
      }

      // Extensions from Level1 to Level2 should only include level2
      type Extensions = ContextExtensions<Level1Context, Level2Context>;

      expectTypeOf<Extensions>().toEqualTypeOf<{ level2: number }>();
    });

    it('should return empty object for identical contexts', () => {
      type Extensions = ContextExtensions<BaseContext, BaseContext>;

      // No new properties added
      expectTypeOf<Extensions>().toEqualTypeOf<object>();
    });
  });

  describe('MiddlewareNext Type Safety', () => {
    it('should type next function with context extensions', () => {
      interface AuthContext extends BaseContext {
        userId: string;
      }

      // Verify MiddlewareNext accepts the correct extension type
      type NextFn = MiddlewareNext<BaseContext, AuthContext, { result: boolean }>;

      // The next function should accept the extensions
      expectTypeOf<NextFn>().toMatchTypeOf<
        (opts?: {
          ctx?: { userId: string } | Partial<AuthContext>;
        }) => Promise<{ output: { result: boolean } }>
      >();
    });

    it('should type MiddlewareArgs with context extension tracking', () => {
      interface RequestContext extends BaseContext {
        requestId: string;
        timestamp: Date;
      }

      type Args = MiddlewareArgs<{ id: string }, BaseContext, RequestContext, { found: boolean }>;

      // Verify input type
      expectTypeOf<Args['input']>().toEqualTypeOf<{ id: string }>();

      // Verify context type (before middleware)
      expectTypeOf<Args['ctx']>().toMatchTypeOf<BaseContext>();

      // Verify next function accepts extensions
      expectTypeOf<Args['next']>().toMatchTypeOf<
        MiddlewareNext<BaseContext, RequestContext, { found: boolean }>
      >();
    });
  });
});

// ============================================================================
// defineProcedures Type Preservation Tests
// ============================================================================

describe('Type Inference - defineProcedures', () => {
  it('should preserve individual procedure types in collection', () => {
    const collection = defineProcedures('users', {
      getUser: procedure()
        .input(z.object({ id: z.string() }))
        .output(UserSchema)
        .query(async () => ({
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'John',
          email: 'john@example.com',
          createdAt: new Date(),
        })),

      createUser: procedure()
        .input(CreateUserSchema)
        .output(UserSchema)
        .mutation(async () => ({
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Jane',
          email: 'jane@example.com',
          createdAt: new Date(),
        })),
    });

    // Verify namespace type
    expectTypeOf(collection.namespace).toEqualTypeOf<string>();

    // Verify getUser procedure types
    expectTypeOf<InferProcedureInput<typeof collection.procedures.getUser>>().toEqualTypeOf<{
      id: string;
    }>();
    expectTypeOf<InferProcedureOutput<typeof collection.procedures.getUser>>().toEqualTypeOf<
      z.infer<typeof UserSchema>
    >();

    // Verify createUser procedure types
    expectTypeOf<InferProcedureInput<typeof collection.procedures.createUser>>().toEqualTypeOf<
      z.infer<typeof CreateUserSchema>
    >();
    expectTypeOf<InferProcedureOutput<typeof collection.procedures.createUser>>().toEqualTypeOf<
      z.infer<typeof UserSchema>
    >();
  });

  it('should work with InferProcedures helper type', () => {
    const procedures = {
      listItems: procedure()
        .output(z.array(z.string()))
        .query(async () => ['a', 'b', 'c']),

      addItem: procedure()
        .input(z.object({ item: z.string() }))
        .output(z.object({ added: z.boolean() }))
        .mutation(async () => ({ added: true })),
    };

    type InferredProcedures = InferProcedures<typeof procedures>;

    // InferProcedures should preserve the exact types
    expectTypeOf<InferredProcedures['listItems']>().toEqualTypeOf<typeof procedures.listItems>();
    expectTypeOf<InferredProcedures['addItem']>().toEqualTypeOf<typeof procedures.addItem>();
  });

  it('should create correct ProcedureCollection type', () => {
    const collection = defineProcedures('items', {
      get: procedure()
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => ({ id: input.id })),
    });

    expectTypeOf(collection).toMatchTypeOf<ProcedureCollection>();
    expectTypeOf(collection.procedures.get).toMatchTypeOf<CompiledProcedure>();
  });
});

// ============================================================================
// Edge Case Type Tests
// ============================================================================

describe('Type Inference - Edge Cases', () => {
  describe('Union Types', () => {
    it('should handle z.union with primitives', () => {
      const unionSchema = z.union([z.string(), z.number()]);

      const proc = procedure()
        .input(unionSchema)
        .query(async ({ input }) => {
          expectTypeOf(input).toEqualTypeOf<string | number>();
          return { received: true };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<string | number>();
    });

    it('should handle z.union with objects', () => {
      const successSchema = z.object({ type: z.literal('success'), data: z.string() });
      const errorSchema = z.object({ type: z.literal('error'), message: z.string() });
      const unionSchema = z.union([successSchema, errorSchema]);

      const proc = procedure()
        .output(unionSchema)
        .query(async () => ({ type: 'success' as const, data: 'result' }));

      type ExpectedOutput = { type: 'success'; data: string } | { type: 'error'; message: string };

      expectTypeOf<InferProcedureOutput<typeof proc>>().toEqualTypeOf<ExpectedOutput>();
    });

    it('should handle z.or (alias for union)', () => {
      const schema = z.string().or(z.number()).or(z.boolean());

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input).toEqualTypeOf<string | number | boolean>();
          return { type: typeof input };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<string | number | boolean>();
    });
  });

  describe('Discriminated Unions', () => {
    it('should handle z.discriminatedUnion', () => {
      const actionSchema = z.discriminatedUnion('action', [
        z.object({ action: z.literal('create'), name: z.string() }),
        z.object({ action: z.literal('update'), id: z.string(), name: z.string() }),
        z.object({ action: z.literal('delete'), id: z.string() }),
      ]);

      const proc = procedure()
        .input(actionSchema)
        .query(async ({ input }) => {
          // TypeScript should narrow the type based on discriminant
          if (input.action === 'create') {
            expectTypeOf(input).toMatchTypeOf<{ action: 'create'; name: string }>();
          } else if (input.action === 'update') {
            expectTypeOf(input).toMatchTypeOf<{ action: 'update'; id: string; name: string }>();
          } else {
            expectTypeOf(input).toMatchTypeOf<{ action: 'delete'; id: string }>();
          }
          return { processed: true };
        });

      type ExpectedInput =
        | { action: 'create'; name: string }
        | { action: 'update'; id: string; name: string }
        | { action: 'delete'; id: string };

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<ExpectedInput>();
    });
  });

  describe('Optional and Nullable Types', () => {
    it('should handle z.optional', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.required).toEqualTypeOf<string>();
          expectTypeOf(input.optional).toEqualTypeOf<string | undefined>();
          return { hasOptional: input.optional !== undefined };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        required: string;
        optional?: string | undefined;
      }>();
    });

    it('should handle z.nullable', () => {
      const schema = z.object({
        value: z.string().nullable(),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.value).toEqualTypeOf<string | null>();
          return { isNull: input.value === null };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        value: string | null;
      }>();
    });

    it('should handle z.nullish (optional and nullable)', () => {
      const schema = z.object({
        value: z.string().nullish(),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.value).toEqualTypeOf<string | null | undefined>();
          return { present: input.value != null };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        value?: string | null | undefined;
      }>();
    });
  });

  describe('Transformed Types', () => {
    it('should use output type after z.transform', () => {
      const schema = z.string().transform((s) => parseInt(s, 10));

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          // After transform, input should be number, not string
          expectTypeOf(input).toEqualTypeOf<number>();
          return { doubled: input * 2 };
        });

      // InferSchemaOutput gets the OUTPUT type (after transform)
      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<number>();
    });

    it('should handle transform on object properties', () => {
      const schema = z.object({
        count: z.string().transform((s) => parseInt(s, 10)),
        uppercase: z.string().transform((s) => s.toUpperCase()),
        date: z.string().transform((s) => new Date(s)),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.count).toEqualTypeOf<number>();
          expectTypeOf(input.uppercase).toEqualTypeOf<string>();
          expectTypeOf(input.date).toEqualTypeOf<Date>();
          return { success: true };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        count: number;
        uppercase: string;
        date: Date;
      }>();
    });

    it('should handle z.coerce transformations', () => {
      const schema = z.object({
        id: z.coerce.number(),
        active: z.coerce.boolean(),
        timestamp: z.coerce.date(),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.id).toEqualTypeOf<number>();
          expectTypeOf(input.active).toEqualTypeOf<boolean>();
          expectTypeOf(input.timestamp).toEqualTypeOf<Date>();
          return input;
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        id: number;
        active: boolean;
        timestamp: Date;
      }>();
    });

    it('should handle z.preprocess', () => {
      const schema = z.preprocess(
        (val) => (typeof val === 'string' ? val.trim() : val),
        z.string().min(1)
      );

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input).toEqualTypeOf<string>();
          return { trimmed: input };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<string>();
    });
  });

  describe('Nested Objects', () => {
    it('should handle deeply nested objects', () => {
      const schema = z.object({
        level1: z.object({
          level2: z.object({
            level3: z.object({
              value: z.string(),
            }),
          }),
        }),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.level1.level2.level3.value).toEqualTypeOf<string>();
          return { deep: input.level1.level2.level3.value };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        level1: {
          level2: {
            level3: {
              value: string;
            };
          };
        };
      }>();
    });

    it('should handle nested objects with mixed types', () => {
      const schema = z.object({
        user: z.object({
          id: z.string().uuid(),
          profile: z
            .object({
              bio: z.string().optional(),
              links: z.array(z.string().url()),
            })
            .nullable(),
        }),
        metadata: z.record(z.string(), z.unknown()),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.user.id).toEqualTypeOf<string>();
          expectTypeOf(input.user.profile).toEqualTypeOf<{
            bio?: string | undefined;
            links: string[];
          } | null>();
          expectTypeOf(input.metadata).toEqualTypeOf<Record<string, unknown>>();
          return { valid: true };
        });

      type ExpectedInput = z.infer<typeof schema>;
      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<ExpectedInput>();
    });
  });

  describe('Arrays', () => {
    it('should handle arrays of primitives', () => {
      const schema = z.object({
        ids: z.array(z.string()),
        counts: z.array(z.number()),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.ids).toEqualTypeOf<string[]>();
          expectTypeOf(input.counts).toEqualTypeOf<number[]>();
          return { total: input.ids.length + input.counts.length };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        ids: string[];
        counts: number[];
      }>();
    });

    it('should handle arrays of objects', () => {
      const ItemSchema = z.object({
        id: z.string(),
        name: z.string(),
        price: z.number(),
      });

      const schema = z.object({
        items: z.array(ItemSchema),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.items).toEqualTypeOf<
            Array<{ id: string; name: string; price: number }>
          >();
          return { count: input.items.length };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        items: Array<{ id: string; name: string; price: number }>;
      }>();
    });

    it('should handle z.tuple', () => {
      const schema = z.tuple([z.string(), z.number(), z.boolean()]);

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input).toEqualTypeOf<[string, number, boolean]>();
          const [str, num, bool] = input;
          expectTypeOf(str).toEqualTypeOf<string>();
          expectTypeOf(num).toEqualTypeOf<number>();
          expectTypeOf(bool).toEqualTypeOf<boolean>();
          return { received: true };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<[string, number, boolean]>();
    });

    it('should handle z.set', () => {
      const schema = z.set(z.string());

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input).toEqualTypeOf<Set<string>>();
          return { size: input.size };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<Set<string>>();
    });
  });

  describe('Maps and Records', () => {
    it('should handle z.record', () => {
      const schema = z.record(z.string(), z.number());

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input).toEqualTypeOf<Record<string, number>>();
          return { keys: Object.keys(input) };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<Record<string, number>>();
    });

    it('should handle z.map', () => {
      const schema = z.map(z.string(), z.object({ count: z.number() }));

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input).toEqualTypeOf<Map<string, { count: number }>>();
          return { size: input.size };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<
        Map<string, { count: number }>
      >();
    });
  });

  describe('Enum and Literal Types', () => {
    it('should handle z.enum', () => {
      const schema = z.object({
        status: z.enum(['pending', 'active', 'completed']),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.status).toEqualTypeOf<'pending' | 'active' | 'completed'>();
          return { status: input.status };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        status: 'pending' | 'active' | 'completed';
      }>();
    });

    it('should handle z.nativeEnum', () => {
      enum Status {
        Pending = 'pending',
        Active = 'active',
        Completed = 'completed',
      }

      const schema = z.object({
        status: z.nativeEnum(Status),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.status).toEqualTypeOf<Status>();
          return { status: input.status };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        status: Status;
      }>();
    });

    it('should handle z.literal', () => {
      const schema = z.object({
        type: z.literal('user'),
        version: z.literal(1),
        active: z.literal(true),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.type).toEqualTypeOf<'user'>();
          expectTypeOf(input.version).toEqualTypeOf<1>();
          expectTypeOf(input.active).toEqualTypeOf<true>();
          return input;
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        type: 'user';
        version: 1;
        active: true;
      }>();
    });
  });

  describe('Special Types', () => {
    it('should handle z.any correctly', () => {
      // Note: z.any() is generally discouraged in VeloxTS, but we test it for completeness
      const schema = z.object({
        flexible: z.any(),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          // z.any() produces `any` type
          // biome-ignore lint/suspicious/noExplicitAny: Testing z.any() behavior
          expectTypeOf(input.flexible).toEqualTypeOf<any>();
          return { received: true };
        });

      // biome-ignore lint/suspicious/noExplicitAny: Testing z.any() behavior
      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{ flexible: any }>();
    });

    it('should handle z.unknown', () => {
      const schema = z.object({
        data: z.unknown(),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.data).toEqualTypeOf<unknown>();
          return { hasData: input.data !== undefined };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{ data: unknown }>();
    });

    it('should handle z.never for output only', () => {
      // z.never() is useful for indicating impossible states
      const schema = z.object({
        value: z.string(),
        impossible: z.never().optional(), // Can be omitted, but if present, type is never
      });

      type Expected = { value: string; impossible?: never };
      expectTypeOf<z.infer<typeof schema>>().toEqualTypeOf<Expected>();
    });

    it('should handle z.void', () => {
      // z.void() is typically used for outputs that return nothing meaningful
      const proc = procedure()
        .output(z.void())
        .mutation(async () => {
          // No return needed
        });

      expectTypeOf<InferProcedureOutput<typeof proc>>().toEqualTypeOf<void>();
    });
  });

  describe('Refinements and Brands', () => {
    it('should preserve base type after z.refine', () => {
      const schema = z.string().refine((s) => s.length > 0, 'Cannot be empty');

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          // Refinements do not change the type
          expectTypeOf(input).toEqualTypeOf<string>();
          return { length: input.length };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<string>();
    });

    it('should handle branded types', () => {
      const UserId = z.string().uuid().brand<'UserId'>();
      const schema = z.object({
        userId: UserId,
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          // Branded type should be preserved
          expectTypeOf(input.userId).toMatchTypeOf<string & { __brand: 'UserId' }>();
          return { id: input.userId };
        });

      type ExpectedInput = { userId: string & z.BRAND<'UserId'> };
      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<ExpectedInput>();
    });
  });

  describe('Lazy and Recursive Types', () => {
    it('should handle z.lazy for recursive types', () => {
      interface TreeNode {
        value: string;
        children: TreeNode[];
      }

      const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
        z.object({
          value: z.string(),
          children: z.array(TreeNodeSchema),
        })
      );

      const proc = procedure()
        .input(TreeNodeSchema)
        .query(async ({ input }) => {
          expectTypeOf(input).toEqualTypeOf<TreeNode>();
          expectTypeOf(input.children).toEqualTypeOf<TreeNode[]>();
          return { depth: 1 };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<TreeNode>();
    });
  });

  describe('Intersection Types', () => {
    it('should handle z.intersection', () => {
      const BaseSchema = z.object({ id: z.string() });
      const TimestampSchema = z.object({ createdAt: z.date(), updatedAt: z.date() });
      const CombinedSchema = z.intersection(BaseSchema, TimestampSchema);

      const proc = procedure()
        .input(CombinedSchema)
        .query(async ({ input }) => {
          expectTypeOf(input.id).toEqualTypeOf<string>();
          expectTypeOf(input.createdAt).toEqualTypeOf<Date>();
          expectTypeOf(input.updatedAt).toEqualTypeOf<Date>();
          return input;
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<
        {
          id: string;
        } & {
          createdAt: Date;
          updatedAt: Date;
        }
      >();
    });

    it('should handle z.and (alias for intersection)', () => {
      const schema = z.object({ a: z.string() }).and(z.object({ b: z.number() }));

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.a).toEqualTypeOf<string>();
          expectTypeOf(input.b).toEqualTypeOf<number>();
          return { sum: input.a + input.b };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<
        { a: string } & { b: number }
      >();
    });
  });

  describe('Object Schema Modifiers', () => {
    it('should handle z.partial', () => {
      const FullSchema = z.object({
        name: z.string(),
        email: z.string(),
        age: z.number(),
      });
      const PartialSchema = FullSchema.partial();

      const proc = procedure()
        .input(PartialSchema)
        .query(async ({ input }) => {
          expectTypeOf(input.name).toEqualTypeOf<string | undefined>();
          expectTypeOf(input.email).toEqualTypeOf<string | undefined>();
          expectTypeOf(input.age).toEqualTypeOf<number | undefined>();
          return { provided: Object.keys(input).length };
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        name?: string | undefined;
        email?: string | undefined;
        age?: number | undefined;
      }>();
    });

    it('should handle z.required', () => {
      const PartialSchema = z.object({
        name: z.string().optional(),
        email: z.string().optional(),
      });
      const RequiredSchema = PartialSchema.required();

      const proc = procedure()
        .input(RequiredSchema)
        .query(async ({ input }) => {
          expectTypeOf(input.name).toEqualTypeOf<string>();
          expectTypeOf(input.email).toEqualTypeOf<string>();
          return input;
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        name: string;
        email: string;
      }>();
    });

    it('should handle z.pick', () => {
      const schema = UserSchema.pick({ id: true, name: true });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input).toEqualTypeOf<{ id: string; name: string }>();
          return input;
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        id: string;
        name: string;
      }>();
    });

    it('should handle z.omit', () => {
      const schema = UserSchema.omit({ createdAt: true });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input).toEqualTypeOf<{ id: string; name: string; email: string }>();
          return input;
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{
        id: string;
        name: string;
        email: string;
      }>();
    });

    it('should handle z.extend', () => {
      const schema = UserSchema.extend({
        role: z.enum(['admin', 'user']),
        verified: z.boolean(),
      });

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.role).toEqualTypeOf<'admin' | 'user'>();
          expectTypeOf(input.verified).toEqualTypeOf<boolean>();
          return input;
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<
        z.infer<typeof UserSchema> & { role: 'admin' | 'user'; verified: boolean }
      >();
    });

    it('should handle z.passthrough', () => {
      const schema = z.object({ known: z.string() }).passthrough();

      procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input.known).toEqualTypeOf<string>();
          // Passthrough allows additional properties
          expectTypeOf(input).toMatchTypeOf<{ known: string; [key: string]: unknown }>();
          return { known: input.known };
        });
    });

    it('should handle z.strict', () => {
      const schema = z.object({ only: z.string() }).strict();

      const proc = procedure()
        .input(schema)
        .query(async ({ input }) => {
          expectTypeOf(input).toEqualTypeOf<{ only: string }>();
          return input;
        });

      expectTypeOf<InferProcedureInput<typeof proc>>().toEqualTypeOf<{ only: string }>();
    });
  });
});

// ============================================================================
// Query vs Mutation Type Tests
// ============================================================================

describe('Type Inference - Query vs Mutation', () => {
  it('should correctly type query procedures', () => {
    const proc = procedure()
      .input(z.object({ id: z.string() }))
      .query(async () => ({ found: true }));

    expectTypeOf(proc.type).toEqualTypeOf<'query' | 'mutation'>();
    // At runtime it's 'query', but TypeScript sees the union
  });

  it('should correctly type mutation procedures', () => {
    const proc = procedure()
      .input(z.object({ data: z.string() }))
      .mutation(async () => ({ created: true }));

    expectTypeOf(proc.type).toEqualTypeOf<'query' | 'mutation'>();
    // At runtime it's 'mutation', but TypeScript sees the union
  });
});
