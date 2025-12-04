/**
 * Procedure builder type definitions
 *
 * Provides the generic type accumulation system that enables type-safe
 * procedure building with automatic inference through the fluent API chain.
 *
 * The key insight is using a "state" generic that accumulates type information
 * as methods are called, without requiring explicit type annotations from users.
 *
 * @module procedure/types
 */

import type { BaseContext } from '@veloxts/core';
import type { ZodType, ZodTypeDef } from 'zod';

import type {
  CompiledProcedure,
  MiddlewareFunction,
  ProcedureHandler,
  RestRouteOverride,
} from '../types.js';

// ============================================================================
// Builder State Type
// ============================================================================

/**
 * Internal state type that accumulates type information through the builder chain
 *
 * This is the core type that enables inference flow. Each builder method returns
 * a new ProcedureBuilder with updated state, preserving type information.
 *
 * @template TInput - The validated input type (unknown if no input schema)
 * @template TOutput - The validated output type (unknown if no output schema)
 * @template TContext - The context type (starts as BaseContext, extended by middleware)
 */
export interface ProcedureBuilderState<
  TInput = unknown,
  TOutput = unknown,
  TContext extends BaseContext = BaseContext,
> {
  /** Marker for state identification */
  readonly _brand: 'ProcedureBuilderState';
  /** Phantom type holders - not used at runtime */
  readonly _input: TInput;
  readonly _output: TOutput;
  readonly _context: TContext;
}

// ============================================================================
// Schema Type Constraints
// ============================================================================

/**
 * Constraint for valid input/output schemas
 *
 * Accepts any Zod schema type. The generic parameters allow us to
 * extract the inferred type for state accumulation.
 */
export type ValidSchema<T = unknown> = ZodType<T, ZodTypeDef, unknown>;

/**
 * Extracts the output type from a Zod schema
 *
 * This is used internally to update builder state when .input() or .output() is called.
 */
export type InferSchemaOutput<T> = T extends ZodType<infer O, ZodTypeDef, unknown> ? O : never;

// ============================================================================
// Procedure Builder Interface
// ============================================================================

/**
 * Fluent procedure builder interface
 *
 * This interface defines all methods available on the procedure builder.
 * Each method returns a new builder with updated type state, enabling
 * full type inference through the chain.
 *
 * @template TInput - Current input type
 * @template TOutput - Current output type
 * @template TContext - Current context type
 *
 * @example
 * ```typescript
 * procedure()
 *   .input(z.object({ id: z.string() }))  // TInput becomes { id: string }
 *   .output(UserSchema)                    // TOutput becomes User
 *   .query(async ({ input, ctx }) => {     // input: { id: string }, ctx: BaseContext
 *     return user;                         // must return User
 *   })
 * ```
 */
export interface ProcedureBuilder<
  TInput = unknown,
  TOutput = unknown,
  TContext extends BaseContext = BaseContext,
> {
  /**
   * Defines the input validation schema for the procedure
   *
   * The input type is automatically inferred from the Zod schema.
   * Can only be called once per procedure.
   *
   * @template TSchema - The Zod schema type
   * @param schema - Zod schema for input validation
   * @returns New builder with updated input type
   *
   * @example
   * ```typescript
   * procedure()
   *   .input(z.object({
   *     id: z.string().uuid(),
   *     name: z.string().optional(),
   *   }))
   *   // input is now typed as { id: string; name?: string }
   * ```
   */
  input<TSchema extends ValidSchema>(
    schema: TSchema
  ): ProcedureBuilder<InferSchemaOutput<TSchema>, TOutput, TContext>;

  /**
   * Defines the output validation schema for the procedure
   *
   * The output type is automatically inferred from the Zod schema.
   * The handler return type will be validated against this schema.
   *
   * @template TSchema - The Zod schema type
   * @param schema - Zod schema for output validation
   * @returns New builder with updated output type
   *
   * @example
   * ```typescript
   * procedure()
   *   .output(z.object({
   *     id: z.string(),
   *     name: z.string(),
   *   }))
   *   // handler must return { id: string; name: string }
   * ```
   */
  output<TSchema extends ValidSchema>(
    schema: TSchema
  ): ProcedureBuilder<TInput, InferSchemaOutput<TSchema>, TContext>;

  /**
   * Adds middleware to the procedure chain
   *
   * Middleware executes before the handler and can:
   * - Extend the context with new properties
   * - Perform authentication/authorization
   * - Log requests
   * - Modify input (though input schema runs first)
   * - Transform output
   *
   * Multiple middlewares are executed in order of definition.
   *
   * @template TNewContext - The extended context type
   * @param middleware - Middleware function
   * @returns New builder with updated context type
   *
   * @example
   * ```typescript
   * procedure()
   *   .use(async ({ ctx, next }) => {
   *     // Add user to context
   *     const user = await getUser(ctx.request);
   *     return next({ ctx: { user } });
   *   })
   *   .query(async ({ ctx }) => {
   *     // ctx.user is now available
   *   })
   * ```
   */
  use<TNewContext extends BaseContext = TContext>(
    middleware: MiddlewareFunction<TInput, TContext, TNewContext, TOutput>
  ): ProcedureBuilder<TInput, TOutput, TNewContext>;

  /**
   * Configures REST route override
   *
   * By default, REST routes are auto-generated from procedure names.
   * Use this to customize the HTTP method or path.
   *
   * @param config - REST route configuration
   * @returns Same builder (no type changes)
   *
   * @example
   * ```typescript
   * procedure()
   *   .rest({ method: 'POST', path: '/users/:id/activate' })
   * ```
   */
  rest(config: RestRouteOverride): ProcedureBuilder<TInput, TOutput, TContext>;

  /**
   * Finalizes the procedure as a query (read-only operation)
   *
   * Queries map to GET requests in REST and should not modify data.
   * The handler receives the validated input and context.
   *
   * @param handler - The query handler function
   * @returns Compiled procedure ready for registration
   *
   * @example
   * ```typescript
   * procedure()
   *   .input(z.object({ id: z.string() }))
   *   .query(async ({ input, ctx }) => {
   *     return ctx.db.user.findUnique({ where: { id: input.id } });
   *   })
   * ```
   */
  query(
    handler: ProcedureHandler<TInput, TOutput, TContext>
  ): CompiledProcedure<TInput, TOutput, TContext>;

  /**
   * Finalizes the procedure as a mutation (write operation)
   *
   * Mutations map to POST/PUT/DELETE in REST and can modify data.
   * The handler receives the validated input and context.
   *
   * @param handler - The mutation handler function
   * @returns Compiled procedure ready for registration
   *
   * @example
   * ```typescript
   * procedure()
   *   .input(CreateUserSchema)
   *   .mutation(async ({ input, ctx }) => {
   *     return ctx.db.user.create({ data: input });
   *   })
   * ```
   */
  mutation(
    handler: ProcedureHandler<TInput, TOutput, TContext>
  ): CompiledProcedure<TInput, TOutput, TContext>;
}

// ============================================================================
// Internal Builder State
// ============================================================================

/**
 * Internal runtime state for the procedure builder
 *
 * This holds the actual values during building, separate from the type state.
 * The type state (generics) and runtime state are kept in sync by the builder.
 */
export interface BuilderRuntimeState {
  /** Input validation schema */
  inputSchema?: ValidSchema;
  /** Output validation schema */
  outputSchema?: ValidSchema;
  /** Middleware chain */
  middlewares: MiddlewareFunction<unknown, BaseContext, BaseContext, unknown>[];
  /** REST route override */
  restOverride?: RestRouteOverride;
}

// ============================================================================
// defineProcedures Types
// ============================================================================

/**
 * Type for the procedures object passed to defineProcedures
 *
 * Each value must be a CompiledProcedure (result of .query() or .mutation()).
 *
 * NOTE: We use `any` here intentionally for the type parameters because:
 * 1. CompiledProcedure has contravariant input types (handler params)
 * 2. TypeScript's Record type requires assignability in both directions
 * 3. Using `unknown` would prevent any concrete procedure from being assigned
 *
 * The actual type safety is preserved through InferProcedures<T> which captures
 * the concrete types at definition time. This `any` only allows the assignment.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for variance compatibility in Record type
export type ProcedureDefinitions = Record<string, CompiledProcedure<any, any, any>>;

/**
 * Type helper to preserve procedure types in a collection
 *
 * This ensures that when you call defineProcedures, the full type information
 * of each procedure is preserved and accessible.
 */
export type InferProcedures<T extends ProcedureDefinitions> = {
  [K in keyof T]: T[K];
};
