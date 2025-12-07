/**
 * Type tests for procedure builder
 *
 * These tests verify that TypeScript type inference works correctly
 * through the fluent procedure builder API.
 */

import { expectAssignable, expectType } from 'tsd';
import { z } from 'zod';

// Import from the compiled dist folders directly
import type { BaseContext } from '../../../core/dist/index.js';
import type { CompiledProcedure, ProcedureBuilder } from '../../dist/index.js';
import { defineProcedures, procedure } from '../../dist/index.js';

// ============================================================================
// Basic Procedure Builder Types
// ============================================================================

// procedure() returns a ProcedureBuilder
expectType<ProcedureBuilder<unknown, unknown, BaseContext>>(procedure());

// ============================================================================
// Input Schema Type Inference
// ============================================================================

// .input() should infer the input type from the Zod schema
const withInput = procedure().input(z.object({ id: z.string() }));
expectType<ProcedureBuilder<{ id: string }, unknown, BaseContext>>(withInput);

// Complex input schema
const complexInput = procedure().input(
  z.object({
    name: z.string(),
    age: z.number().optional(),
    tags: z.array(z.string()),
    metadata: z.record(z.unknown()),
  })
);
expectType<
  ProcedureBuilder<
    {
      name: string;
      age?: number | undefined;
      tags: string[];
      metadata: Record<string, unknown>;
    },
    unknown,
    BaseContext
  >
>(complexInput);

// ============================================================================
// Output Schema Type Inference
// ============================================================================

// .output() should infer the output type from the Zod schema
const withOutput = procedure().output(z.object({ success: z.boolean() }));
expectType<ProcedureBuilder<unknown, { success: boolean }, BaseContext>>(withOutput);

// Chained input and output
const withBoth = procedure()
  .input(z.object({ id: z.string() }))
  .output(z.object({ name: z.string(), email: z.string() }));

expectType<ProcedureBuilder<{ id: string }, { name: string; email: string }, BaseContext>>(
  withBoth
);

// ============================================================================
// Handler Type Checking
// ============================================================================

// Handler should receive correctly typed input
procedure()
  .input(z.object({ userId: z.string().uuid() }))
  .query(async ({ input }) => {
    // input.userId should be string
    expectType<string>(input.userId);
    return { user: input.userId };
  });

// Handler should have access to context
procedure()
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx }) => {
    // ctx should have request property
    expectAssignable<{ request: unknown }>(ctx);
    return null;
  });

// ============================================================================
// Output Type Enforcement
// ============================================================================

// Handler return type should match output schema
procedure()
  .output(z.object({ id: z.string(), name: z.string() }))
  .query(async () => {
    // Must return matching type
    return { id: '1', name: 'Test' };
  });

// ============================================================================
// Query vs Mutation
// ============================================================================

// Both .query() and .mutation() should return CompiledProcedure
// When no output schema is specified, output type is unknown
const queryProc = procedure()
  .input(z.object({ id: z.string() }))
  .query(async ({ input }) => input);

const mutationProc = procedure()
  .input(z.object({ name: z.string() }))
  .mutation(async ({ input }) => input);

// Without output schema, the output type is unknown
expectAssignable<CompiledProcedure<{ id: string }, unknown, BaseContext>>(queryProc);
expectAssignable<CompiledProcedure<{ name: string }, unknown, BaseContext>>(mutationProc);

// With output schema, output type is inferred
const queryWithOutput = procedure()
  .input(z.object({ id: z.string() }))
  .output(z.object({ id: z.string() }))
  .query(async ({ input }) => input);

expectAssignable<CompiledProcedure<{ id: string }, { id: string }, BaseContext>>(queryWithOutput);

// ============================================================================
// REST Override
// ============================================================================

// .rest() should return same builder type
const withRest = procedure()
  .input(z.object({ id: z.string() }))
  .rest({ method: 'POST', path: '/custom' });

expectType<ProcedureBuilder<{ id: string }, unknown, BaseContext>>(withRest);

// ============================================================================
// defineProcedures Type Inference
// ============================================================================

// defineProcedures should preserve procedure types
const userProcedures = defineProcedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string() }))
    .output(z.object({ id: z.string(), name: z.string() }))
    .query(async ({ input }) => ({ id: input.id, name: 'Test' })),

  createUser: procedure()
    .input(z.object({ name: z.string(), email: z.string() }))
    .output(z.object({ id: z.string() }))
    .mutation(async () => ({ id: '1' })),
});

// Collection should have namespace (typed as string, not literal)
expectType<string>(userProcedures.namespace);

// Procedures should be accessible
expectAssignable<CompiledProcedure<{ id: string }, { id: string; name: string }, BaseContext>>(
  userProcedures.procedures.getUser
);

expectAssignable<CompiledProcedure<{ name: string; email: string }, { id: string }, BaseContext>>(
  userProcedures.procedures.createUser
);

// ============================================================================
// Middleware Context Extension
// ============================================================================

// Custom context type
interface AuthContext extends BaseContext {
  user: { id: string; email: string };
}

// .use() should extend context type
const withMiddleware = procedure().use<AuthContext>(async ({ ctx, next }) => {
  return next({
    ctx: {
      ...ctx,
      user: { id: '1', email: 'test@example.com' },
    },
  });
});

// Handler should have access to extended context
withMiddleware.query(async ({ ctx }) => {
  expectType<{ id: string; email: string }>(ctx.user);
  return ctx.user;
});

// ============================================================================
// Guard Type Compatibility
// ============================================================================

// Guard interface for testing
interface TestGuard {
  name: string;
  check: (ctx: BaseContext) => Promise<boolean> | boolean;
}

const testGuard: TestGuard = {
  name: 'test',
  check: () => true,
};

// .guard() should accept compatible guards
const withGuard = procedure().guard(testGuard);
expectType<ProcedureBuilder<unknown, unknown, BaseContext>>(withGuard);

// ============================================================================
// Schema Inference Edge Cases
// ============================================================================

// Optional fields should be correctly typed
const optionalInput = procedure().input(
  z.object({
    required: z.string(),
    optional: z.string().optional(),
    nullable: z.string().nullable(),
    optionalNullable: z.string().optional().nullable(),
  })
);

optionalInput.query(async ({ input }) => {
  expectType<string>(input.required);
  expectType<string | undefined>(input.optional);
  expectType<string | null>(input.nullable);
  expectType<string | null | undefined>(input.optionalNullable);
  return input;
});

// Transform should change the type
const transformedInput = procedure().input(
  z.object({
    date: z.string().transform((s) => new Date(s)),
  })
);

transformedInput.query(async ({ input }) => {
  expectType<Date>(input.date);
  return { date: input.date.toISOString() };
});

// Union types
const unionInput = procedure().input(
  z.object({
    status: z.union([z.literal('active'), z.literal('inactive'), z.literal('pending')]),
  })
);

unionInput.query(async ({ input }) => {
  expectType<'active' | 'inactive' | 'pending'>(input.status);
  return input;
});

// Enum
const enumSchema = z.enum(['small', 'medium', 'large']);
const enumInput = procedure().input(z.object({ size: enumSchema }));

enumInput.query(async ({ input }) => {
  expectType<'small' | 'medium' | 'large'>(input.size);
  return input;
});

// ============================================================================
// Discriminated Unions
// ============================================================================

const discriminatedInput = procedure().input(
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('email'), email: z.string() }),
    z.object({ type: z.literal('sms'), phone: z.string() }),
  ])
);

discriminatedInput.query(async ({ input }) => {
  if (input.type === 'email') {
    expectType<string>(input.email);
  } else {
    expectType<string>(input.phone);
  }
  return input;
});

// ============================================================================
// No Input/Output Procedures
// ============================================================================

// Procedure without input should have unknown input type
procedure().query(async ({ input }) => {
  expectType<unknown>(input);
  return 'ok';
});

// Procedure without output schema has unknown output type
// (The handler return type doesn't automatically become the output type)
const noOutput = procedure().query(async () => {
  return { result: 'success' } as const;
});

expectAssignable<CompiledProcedure<unknown, unknown, BaseContext>>(noOutput);
