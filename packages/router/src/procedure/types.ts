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
  GuardLike,
  MiddlewareFunction,
  ParentResourceConfig,
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
   * Adds an authorization guard to the procedure
   *
   * Guards are executed before the handler and middleware chain.
   * If the guard check fails, a 401/403 error is returned.
   *
   * Guards are compatible with @veloxts/auth guards (authenticated, hasRole, etc.)
   * but can be any object implementing the GuardLike interface.
   *
   * The guard type parameter accepts guards that require a subset of the current
   * context (contravariant). This allows guards typed for `{ auth?: AuthContext }`
   * to work with the full `BaseContext` since BaseContext extends that shape.
   *
   * @template TGuardContext - The context type required by the guard (must be a subset of TContext)
   * @param guard - Guard definition to apply
   * @returns Same builder (no type changes)
   *
   * @example
   * ```typescript
   * import { authenticated, hasRole } from '@veloxts/auth';
   *
   * // Require authentication
   * procedure()
   *   .guard(authenticated)
   *   .query(async ({ ctx }) => { ... });
   *
   * // Require admin role
   * procedure()
   *   .guard(hasRole('admin'))
   *   .mutation(async ({ input, ctx }) => { ... });
   * ```
   */
  guard<TGuardContext extends Partial<TContext>>(
    guard: GuardLike<TGuardContext>
  ): ProcedureBuilder<TInput, TOutput, TContext>;

  /**
   * Adds an authorization guard with type narrowing (EXPERIMENTAL)
   *
   * Unlike `.guard()`, this method narrows the context type based on
   * what the guard guarantees. For example, `authenticatedNarrow` narrows
   * `ctx.user` from `User | undefined` to `User`.
   *
   * **EXPERIMENTAL**: This API may change. Consider using middleware
   * for context type extension as the current stable alternative.
   *
   * @template TNarrowedContext - The context type guaranteed by the guard
   * @param guard - Narrowing guard definition with `_narrows` type
   * @returns New builder with narrowed context type
   *
   * @example
   * ```typescript
   * import { authenticatedNarrow, hasRoleNarrow } from '@veloxts/auth';
   *
   * // ctx.user is guaranteed non-null after guard passes
   * procedure()
   *   .guardNarrow(authenticatedNarrow)
   *   .query(({ ctx }) => {
   *     return { email: ctx.user.email }; // No null check needed!
   *   });
   *
   * // Chain multiple narrowing guards
   * procedure()
   *   .guardNarrow(authenticatedNarrow)
   *   .guardNarrow(hasRoleNarrow('admin'))
   *   .mutation(({ ctx }) => { ... });
   * ```
   */
  guardNarrow<TNarrowedContext>(
    guard: GuardLike<Partial<TContext>> & { readonly _narrows: TNarrowedContext }
  ): ProcedureBuilder<TInput, TOutput, TContext & TNarrowedContext>;

  /**
   * Adds multiple authorization guards at once
   *
   * This is a convenience method equivalent to chaining multiple `.guard()` calls.
   * Guards execute left-to-right. All must pass for the procedure to execute.
   *
   * @param guards - Guard definitions to apply (spread)
   * @returns Same builder (no type changes)
   *
   * @example
   * ```typescript
   * import { authenticated, hasRole, emailVerified } from '@veloxts/auth';
   *
   * // Multiple guards in one call
   * procedure()
   *   .guards(authenticated, hasRole('admin'), emailVerified)
   *   .mutation(async ({ input, ctx }) => { ... });
   *
   * // Equivalent to:
   * procedure()
   *   .guard(authenticated)
   *   .guard(hasRole('admin'))
   *   .guard(emailVerified)
   *   .mutation(async ({ input, ctx }) => { ... });
   * ```
   */
  guards<TGuards extends GuardLike<Partial<TContext>>[]>(
    ...guards: TGuards
  ): ProcedureBuilder<TInput, TOutput, TContext>;

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
   * Declares a parent resource for nested routes (single level)
   *
   * When a procedure has a parent resource, the REST path will be nested
   * under the parent: `/${parentNamespace}/:${parentParam}/${childNamespace}/:id`
   *
   * The input schema should include the parent parameter (e.g., `postId`) for
   * proper type safety and runtime validation.
   *
   * @param namespace - Parent resource namespace (e.g., 'posts', 'users')
   * @param paramName - Optional custom parameter name (default: `${singularNamespace}Id`)
   * @returns Same builder (no type changes)
   *
   * @example
   * ```typescript
   * // Generates: GET /posts/:postId/comments/:id
   * const getComment = procedure()
   *   .parent('posts')
   *   .input(z.object({ postId: z.string(), id: z.string() }))
   *   .query(async ({ input }) => { ... });
   *
   * // With custom param name: GET /posts/:post_id/comments/:id
   * const getComment = procedure()
   *   .parent('posts', 'post_id')
   *   .input(z.object({ post_id: z.string(), id: z.string() }))
   *   .query(async ({ input }) => { ... });
   * ```
   */
  parent(namespace: string, paramName?: string): ProcedureBuilder<TInput, TOutput, TContext>;

  /**
   * Declares multiple parent resources for deeply nested routes
   *
   * When a procedure has multiple parent resources, the REST path will be
   * deeply nested: `/${parent1}/:${param1}/${parent2}/:${param2}/.../${child}/:id`
   *
   * The input schema should include ALL parent parameters for proper type safety.
   *
   * @param config - Array of parent resource configurations from outermost to innermost
   * @returns Same builder (no type changes)
   *
   * @example
   * ```typescript
   * // Generates: GET /organizations/:orgId/projects/:projectId/tasks/:id
   * const getTask = procedure()
   *   .parents([
   *     { resource: 'organizations', param: 'orgId' },
   *     { resource: 'projects', param: 'projectId' },
   *   ])
   *   .input(z.object({
   *     orgId: z.string(),
   *     projectId: z.string(),
   *     id: z.string()
   *   }))
   *   .query(async ({ input }) => { ... });
   * ```
   */
  parents(
    config: Array<{ resource: string; param?: string }>
  ): ProcedureBuilder<TInput, TOutput, TContext>;

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
  ): CompiledProcedure<TInput, TOutput, TContext, 'query'>;

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
  ): CompiledProcedure<TInput, TOutput, TContext, 'mutation'>;
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
  /** Guards to execute before handler */
  guards: GuardLike<unknown>[];
  /** REST route override */
  restOverride?: RestRouteOverride;
  /** Parent resource configuration for nested routes (single level) */
  parentResource?: ParentResourceConfig;
  /** Multi-level parent resource configuration for deeply nested routes */
  parentResources?: ParentResourceConfig[];
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
export type ProcedureDefinitions = Record<string, CompiledProcedure<any, any, any, any>>;

/**
 * Type helper to preserve procedure types in a collection
 *
 * This ensures that when you call defineProcedures, the full type information
 * of each procedure is preserved and accessible.
 */
export type InferProcedures<T extends ProcedureDefinitions> = {
  [K in keyof T]: T[K];
};
