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

import type { BaseContext, DomainError } from '@veloxts/core';
import type { ZodType } from 'zod';

import type { OutputForLevel, ResourceSchema, TaggedResourceSchema } from '../resource/index.js';
import type {
  CompiledProcedure,
  GuardLike,
  MiddlewareFunction,
  ParentResourceConfig,
  PolicyActionLike,
  ProcedureHandler,
  RestRouteOverride,
  TransactionalOptions,
} from '../types.js';
import type { PipelineStep } from './pipeline.js';

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
 * @template TErrors - Union of domain error types (defaults to never)
 */
export interface ProcedureBuilderState<
  TInput = unknown,
  TOutput = unknown,
  TContext extends BaseContext = BaseContext,
  TErrors = never,
> {
  /** Marker for state identification */
  readonly _brand: 'ProcedureBuilderState';
  /** Phantom type holders - not used at runtime */
  readonly _input: TInput;
  readonly _output: TOutput;
  readonly _context: TContext;
  readonly _errors: TErrors;
}

// ============================================================================
// Schema Type Constraints
// ============================================================================

/**
 * Constraint for valid input/output schemas
 *
 * Uses ZodType without version-specific generics for compatibility with
 * both Zod 3 (ZodType<Output, Def, Input>) and Zod 4 (ZodType<Output, Input, Internals>).
 * The actual output type is extracted structurally via InferSchemaOutput.
 */
export type ValidSchema = ZodType;

/**
 * Extracts the output type from a Zod schema
 *
 * Uses structural matching on the parse method return type instead of
 * ZodType generic parameters. This works across Zod versions since
 * all Zod schemas have a parse() method that returns the output type.
 */
export type InferSchemaOutput<T> = T extends { parse: (data: unknown) => infer O } ? O : never;

/**
 * Valid types for `.output()` — Zod schemas, tagged resource views, or untagged resource schemas
 */
export type ValidOutputSchema = ValidSchema | TaggedResourceSchema | ResourceSchema;

/**
 * Infers the output type from a schema passed to `.output()`
 *
 * - Zod schema → uses structural `parse()` matching
 * - Tagged resource view → uses `OutputForLevel` to compute projected fields
 * - Untagged resource schema → falls back to `unknown` (Level 3 branching resolves at runtime)
 */
export type InferOutputSchema<T> = T extends TaggedResourceSchema
  ? OutputForLevel<T>
  : T extends { parse: (data: unknown) => infer O }
    ? O
    : unknown;

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
 * @template TErrors - Union of domain error types (defaults to never)
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
  TErrors = never,
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
  ): ProcedureBuilder<InferSchemaOutput<TSchema>, TOutput, TContext, TErrors>;

  /**
   * Defines the output schema for the procedure
   *
   * Accepts two schema variants:
   * 1. **Zod schema** — validates handler return value, all callers see same fields
   * 2. **Tagged resource view** (e.g., `UserSchema.authenticated`) — auto-projects fields by access level
   *
   * @template TSchema - The Zod or tagged resource schema type
   * @param schema - Zod schema or tagged resource view
   * @returns New builder with updated output type
   *
   * @example Zod schema
   * ```typescript
   * procedure()
   *   .output(z.object({ id: z.string(), name: z.string() }))
   *   .query(handler) // handler must return { id: string; name: string }
   * ```
   *
   * @example Tagged resource view
   * ```typescript
   * procedure()
   *   .output(UserSchema.authenticated) // auto-projects to { id, name, email }
   *   .query(handler)
   * ```
   */
  output<TSchema extends ValidOutputSchema>(
    schema: TSchema
  ): ProcedureBuilder<TInput, InferOutputSchema<TSchema>, TContext, TErrors>;

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
  ): ProcedureBuilder<TInput, TOutput, TNewContext, TErrors>;

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
  ): ProcedureBuilder<TInput, TOutput, TContext, TErrors>;

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
  ): ProcedureBuilder<TInput, TOutput, TContext, TErrors>;

  /**
   * Adds a policy action check to the procedure
   *
   * Policy actions are checked during execution after guards but before
   * the pipeline and handler. The policy looks up the resource on the
   * context by lowercase resource name (e.g., `PostPolicy` → `ctx.post`).
   *
   * If the policy check fails, a ForbiddenError is thrown.
   *
   * @param action - Policy action reference (from definePolicy)
   * @returns Same builder (no type changes)
   *
   * @example
   * ```typescript
   * import { PostPolicy } from './policies';
   *
   * procedure()
   *   .guard(authenticated)
   *   .policy(PostPolicy.update)
   *   .mutation(async ({ input, ctx }) => { ... });
   * ```
   */
  policy(action: PolicyActionLike): ProcedureBuilder<TInput, TOutput, TContext, TErrors>;

  /**
   * Declares domain error classes that this procedure may throw
   *
   * Stores error class references on the compiled procedure for:
   * - OpenAPI error response generation (per-endpoint error schemas)
   * - Client-side error type narrowing (`InferProcedureErrors<T>`)
   *
   * Can be called multiple times — error classes accumulate across calls.
   *
   * @template TDomainErrors - Union of domain error types declared
   * @param errorClasses - Domain error constructors this procedure may throw
   * @returns New builder with updated TErrors union
   *
   * @example
   * ```typescript
   * procedure()
   *   .input(z.object({ sku: z.string(), qty: z.number() }))
   *   .throws(InsufficientStock, PaymentFailed)
   *   .mutation(async ({ input }) => {
   *     // handler may throw InsufficientStock or PaymentFailed
   *   })
   * ```
   */
  throws<TDomainErrors extends DomainError<Record<string, unknown>>>(
    ...errorClasses: Array<new (data: Record<string, unknown>) => TDomainErrors>
  ): ProcedureBuilder<TInput, TOutput, TContext, TErrors | TDomainErrors>;

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
  rest(config: RestRouteOverride): ProcedureBuilder<TInput, TOutput, TContext, TErrors>;

  /**
   * Configures the procedure as a webhook endpoint
   *
   * Sugar for `.rest({ method: 'POST', path })` with a webhook flag.
   * Webhook procedures expect raw body access for signature verification.
   *
   * @param path - The webhook endpoint path (e.g., '/webhooks/stripe')
   * @returns New builder with webhook configuration
   *
   * @example
   * ```typescript
   * procedure()
   *   .webhook('/webhooks/stripe')
   *   .mutation(async ({ input, ctx }) => {
   *     const isValid = verifySignature(ctx.request.rawBody, ctx.request.headers['stripe-signature']);
   *     // ...
   *   })
   * ```
   */
  webhook(path: string): ProcedureBuilder<TInput, TOutput, TContext, TErrors>;

  /**
   * Marks the procedure as deprecated
   *
   * Deprecated procedures will be marked in OpenAPI documentation with the
   * deprecated flag, helping API consumers know they should migrate to alternatives.
   *
   * @param message - Optional message explaining the deprecation and suggesting alternatives
   * @returns Same builder (no type changes)
   *
   * @example
   * ```typescript
   * // Simple deprecation
   * procedure()
   *   .deprecated()
   *   .query(handler);
   *
   * // With migration message
   * procedure()
   *   .deprecated('Use getUserById instead. This endpoint will be removed in v2.0.')
   *   .query(handler);
   * ```
   */
  deprecated(message?: string): ProcedureBuilder<TInput, TOutput, TContext, TErrors>;

  /**
   * Declares a parent resource for nested routes (single level)
   *
   * When a procedure has a parent resource, the REST path will be nested
   * under the parent: `/${parentResource}/:${parentParam}/${childResource}/:id`
   *
   * The input schema should include the parent parameter (e.g., `postId`) for
   * proper type safety and runtime validation.
   *
   * @param resource - Parent resource name (e.g., 'posts', 'users')
   * @param param - Optional custom parameter name (default: `${singularResource}Id`)
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
  parent(resource: string, param?: string): ProcedureBuilder<TInput, TOutput, TContext, TErrors>;

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
  ): ProcedureBuilder<TInput, TOutput, TContext, TErrors>;

  /**
   * Declares a domain event to emit after successful handler execution
   *
   * Events fire AFTER the handler returns its result (and AFTER transaction
   * commit when `.transactional()` is used). Multiple `.emits()` calls
   * accumulate — all declared events are emitted in order.
   *
   * Emission errors are caught and logged; they never fail the request.
   *
   * @template TEventData - The event's data payload type
   * @param eventClass - Domain event class constructor
   * @param mapper - Optional function to transform the handler result into event data.
   *   When omitted, the handler result is used directly as event data.
   * @returns Same builder (no type changes)
   *
   * @example With mapper (recommended)
   * ```typescript
   * procedure()
   *   .emits(OrderCreated, (result) => ({ orderId: result.id, total: result.total }))
   *   .mutation(handler)
   * ```
   *
   * @example Without mapper (result type must match event data type)
   * ```typescript
   * procedure()
   *   .emits(OrderCreated)
   *   .mutation(handler)
   * ```
   */
  emits<TEventData extends Record<string, unknown>>(
    eventClass: {
      new (data: TEventData, options?: { correlationId?: string }): unknown;
      readonly eventName: string;
    },
    mapper?: (result: TOutput) => TEventData
  ): ProcedureBuilder<TInput, TOutput, TContext, TErrors>;

  /**
   * Wraps the handler in a database transaction via `ctx.db.$transaction()`
   *
   * When set, `executeProcedure` replaces `ctx.db` with the transactional
   * client inside the handler. On throw the transaction auto-rollbacks;
   * on return it auto-commits.
   *
   * Gracefully degrades: if `ctx.db` or `ctx.db.$transaction` is missing,
   * the handler runs without transaction wrapping.
   *
   * @param options - Optional isolation level and timeout
   * @returns Same builder (no type changes)
   *
   * @example
   * ```typescript
   * procedure()
   *   .input(CreateOrderSchema)
   *   .transactional({ isolationLevel: 'Serializable', timeout: 10000 })
   *   .mutation(async ({ input, ctx }) => {
   *     // ctx.db is the transactional client — all queries share the same tx
   *     const order = await ctx.db.order.create({ data: input });
   *     await ctx.db.inventory.update({ ... });
   *     return order; // auto-commit on success
   *   })
   * ```
   */
  transactional(
    options?: TransactionalOptions
  ): ProcedureBuilder<TInput, TOutput, TContext, TErrors>;

  /**
   * Adds pipeline steps that execute BEFORE the handler
   *
   * Steps run in declaration order. Each step's output becomes the next
   * step's input, and the final step's output is passed to the handler
   * as its `input`. If a step fails, revert actions for previously
   * completed steps run in reverse order (compensation pattern).
   *
   * Can be called multiple times — steps accumulate across calls.
   *
   * @param steps - Pipeline steps to execute before the handler
   * @returns Same builder (no type changes)
   *
   * @example
   * ```typescript
   * procedure()
   *   .input(CreateOrderSchema)
   *   .through(validateInventory, chargePayment.onRevert(refund))
   *   .mutation(async ({ input, ctx }) => {
   *     // input has been transformed by pipeline steps
   *     return ctx.db.order.create({ data: input });
   *   })
   * ```
   */
  through(...steps: PipelineStep[]): ProcedureBuilder<TInput, TOutput, TContext, TErrors>;

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
    handler:
      | ProcedureHandler<TInput, TOutput, TContext>
      | Record<string, ProcedureHandler<TInput, TOutput, TContext>>
  ): CompiledProcedure<TInput, TOutput, TContext, 'query', TErrors>;

  /**
   * Finalizes the procedure as a mutation (write operation)
   *
   * Mutations map to POST/PUT/DELETE in REST and can modify data.
   * The handler receives the validated input and context.
   *
   * In Level 3 branching mode (when `.output()` receives an untagged resource schema),
   * accepts a handler map keyed by `[Schema.level.key]` instead of a single handler.
   *
   * @param handler - The mutation handler function or handler map
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
    handler:
      | ProcedureHandler<TInput, TOutput, TContext>
      | Record<string, ProcedureHandler<TInput, TOutput, TContext>>
  ): CompiledProcedure<TInput, TOutput, TContext, 'mutation', TErrors>;
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
  /** Resource schema for context-dependent output */
  resourceSchema?: ResourceSchema;
  /** Explicit resource level from tagged schema (e.g., UserSchema.authenticated) */
  resourceLevel?: string;
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
  /** Whether this procedure is deprecated */
  deprecated?: boolean;
  /** Deprecation message */
  deprecationMessage?: string;
  /** Whether this procedure is a webhook endpoint (metadata marker) */
  isWebhook?: boolean;
  /** Whether .output() received an untagged resource schema (Level 3 branching mode) */
  branchingMode?: boolean;
  /** Error classes declared via .throws() */
  errorClasses?: Array<new (data: Record<string, unknown>) => unknown>;
  /** Whether the handler should be wrapped in a database transaction */
  transactional?: boolean;
  /** Options for the database transaction (isolation level, timeout) */
  transactionalOptions?: TransactionalOptions;
  /** Domain events to emit after successful handler execution */
  emittedEvents?: Array<{
    eventClass: {
      new (data: Record<string, unknown>, options?: { correlationId?: string }): unknown;
      readonly eventName: string;
    };
    mapper?: (result: unknown) => Record<string, unknown>;
  }>;
  /** Pipeline steps declared via .through() */
  pipelineSteps?: PipelineStep[];
  /** Policy action reference for declarative authorization */
  policyAction?: PolicyActionLike;
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
export type ProcedureDefinitions = Record<string, CompiledProcedure<any, any, any, any, any>>;

/**
 * Type helper to preserve procedure types in a collection
 *
 * This ensures that when you call defineProcedures, the full type information
 * of each procedure is preserved and accessible.
 */
export type InferProcedures<T extends ProcedureDefinitions> = {
  [K in keyof T]: T[K];
};
