/**
 * Core type definitions for @veloxts/router
 *
 * Provides foundational types for the procedure system, context handling,
 * and router configuration.
 *
 * @module types
 */

import type { BaseContext } from '@veloxts/core';
import type { HttpMethod } from '@veloxts/validation';

// ============================================================================
// Procedure Types
// ============================================================================

/**
 * Procedure operation types
 *
 * - query: Read-only operations (maps to GET in REST)
 * - mutation: Write operations (maps to POST/PUT/DELETE in REST)
 */
export type ProcedureType = 'query' | 'mutation';

/**
 * HTTP methods supported by the REST adapter
 *
 * Full REST support: GET, POST, PUT, PATCH, DELETE
 *
 * @see {@link PROCEDURE_METHOD_MAP} for naming convention mapping
 */
export type { HttpMethod };

/**
 * Maps procedure naming conventions to HTTP methods
 *
 * Re-exported from @veloxts/validation for consistency across router and client.
 *
 * @see {@link @veloxts/validation!PROCEDURE_METHOD_MAP} for the canonical definition
 *
 * @example
 * - getUser -> GET
 * - listUsers -> GET
 * - createUser -> POST
 * - updateUser -> PUT
 * - patchUser -> PATCH
 * - deleteUser -> DELETE
 */
export { PROCEDURE_METHOD_MAP } from '@veloxts/validation';

// ============================================================================
// Context Types
// ============================================================================

/**
 * Extended context type that can be augmented by middleware
 *
 * Starts with BaseContext and can be extended through the middleware chain.
 *
 * @template TExtensions - Additional context properties added by middleware
 */
export type ExtendedContext<TExtensions extends object = object> = BaseContext & TExtensions;

/**
 * Context factory function type
 *
 * Creates the initial context for a request. Can be customized to add
 * application-specific context properties.
 */
export type ContextFactory<TContext extends BaseContext = BaseContext> = (
  baseContext: BaseContext
) => TContext | Promise<TContext>;

// ============================================================================
// Handler Types
// ============================================================================

/**
 * Arguments passed to procedure handlers
 *
 * @template TInput - The validated input type
 * @template TContext - The context type available in the handler
 */
export interface ProcedureHandlerArgs<TInput, TContext extends BaseContext = BaseContext> {
  /** Validated input data (from request body/params/query) */
  readonly input: TInput;
  /** Request context with framework and plugin-provided properties */
  readonly ctx: TContext;
}

/**
 * Procedure handler function signature
 *
 * @template TInput - The validated input type
 * @template TOutput - The handler return type
 * @template TContext - The context type
 */
export type ProcedureHandler<TInput, TOutput, TContext extends BaseContext = BaseContext> = (
  args: ProcedureHandlerArgs<TInput, TContext>
) => TOutput | Promise<TOutput>;

// ============================================================================
// Guard Types
// ============================================================================

/**
 * Guard check function type
 *
 * The function receives the context, request, and reply objects.
 * Request and reply are typed as `any` to enable compatibility with more
 * specific types (like FastifyRequest/FastifyReply from @veloxts/auth).
 *
 * This design allows guards defined with specific Fastify types to be
 * used interchangeably with guards that use generic types.
 *
 * @template TContext - The context type the guard operates on
 */
export type GuardCheckFunction<TContext = unknown> = (
  ctx: TContext,
  // biome-ignore lint/suspicious/noExplicitAny: Using `any` for interoperability - allows guards typed with specific FastifyRequest/FastifyReply to work with generic guards without contravariance issues in function parameters
  request: any,
  // biome-ignore lint/suspicious/noExplicitAny: Using `any` for interoperability - see comment above
  reply: any
) => boolean | Promise<boolean>;

/**
 * Guard-like type for authorization checks
 *
 * This interface is compatible with @veloxts/auth guards but doesn't create
 * a hard dependency. Any object matching this shape can be used as a guard.
 *
 * @template TContext - The context type the guard operates on
 */
export interface GuardLike<TContext = unknown> {
  /** Guard name for error messages */
  name: string;
  /** Guard check function - returns true if access is allowed */
  check: GuardCheckFunction<TContext>;
  /** Custom error message (optional) */
  message?: string;
  /** HTTP status code on failure (default: 403) */
  statusCode?: number;
}

// ============================================================================
// Middleware Types
// ============================================================================

/**
 * Result returned by the next() function in middleware
 *
 * @template TOutput - The output type from the handler
 */
export interface MiddlewareResult<TOutput> {
  /** The output from the handler or subsequent middleware */
  readonly output: TOutput;
}

/**
 * Computes the context extensions added by middleware
 *
 * This utility type extracts properties that exist in TNewContext but not in TContext.
 * It enables type-safe context extension in middleware.
 *
 * @template TContext - The current context type
 * @template TNewContext - The extended context type after middleware
 */
export type ContextExtensions<TContext extends BaseContext, TNewContext extends BaseContext> = Omit<
  TNewContext,
  keyof TContext
>;

/**
 * Next function passed to middleware
 *
 * The next function accepts optional context extensions that will be merged
 * into the request context. The extensions are typed based on the difference
 * between the input context (TContext) and output context (TNewContext).
 *
 * @template TContext - The current context type before middleware
 * @template TNewContext - The context type after middleware modifications
 * @template TOutput - Expected output type
 */
export type MiddlewareNext<
  TContext extends BaseContext = BaseContext,
  TNewContext extends BaseContext = TContext,
  TOutput = unknown,
> = (opts?: {
  /**
   * Context extensions to merge into the request context.
   *
   * When TNewContext extends TContext with additional properties,
   * this parameter accepts either:
   * - The new properties (type-safe extension)
   * - A partial of the new context (for flexibility)
   */
  ctx?: ContextExtensions<TContext, TNewContext> | Partial<TNewContext>;
}) => Promise<MiddlewareResult<TOutput>>;

/**
 * Arguments passed to middleware functions
 *
 * @template TInput - The input type
 * @template TContext - The current context type before middleware
 * @template TNewContext - The context type after middleware modifications
 * @template TOutput - The expected output type
 */
export interface MiddlewareArgs<
  TInput,
  TContext extends BaseContext = BaseContext,
  TNewContext extends BaseContext = TContext,
  TOutput = unknown,
> {
  /** Input data (may not be validated yet depending on middleware position) */
  readonly input: TInput;
  /** Current request context */
  readonly ctx: TContext;
  /**
   * Function to call the next middleware or handler
   *
   * The next function accepts context extensions that transform TContext into TNewContext.
   * This enables type-safe context extension through the middleware chain.
   */
  readonly next: MiddlewareNext<TContext, TNewContext, TOutput>;
}

/**
 * Middleware function signature
 *
 * Middleware can:
 * - Modify context before passing to handler
 * - Modify output after handler execution
 * - Short-circuit the chain by not calling next()
 * - Throw errors to abort processing
 *
 * The TNewContext parameter tracks context extensions for type safety.
 * When using .use<TNewContext>(), the builder captures this type and ensures
 * subsequent middleware and handlers see the extended context.
 *
 * @template TInput - The input type
 * @template TContext - The current context type before middleware
 * @template TNewContext - Context type after middleware modifications
 * @template TOutput - The output type
 */
export type MiddlewareFunction<
  TInput,
  TContext extends BaseContext = BaseContext,
  TNewContext extends BaseContext = TContext,
  TOutput = unknown,
> = (
  args: MiddlewareArgs<TInput, TContext, TNewContext, TOutput>
) => Promise<MiddlewareResult<TOutput>>;

// ============================================================================
// Procedure Definition Types
// ============================================================================

/**
 * REST route override configuration
 *
 * Allows manual override of auto-generated REST routes.
 */
export interface RestRouteOverride {
  /** HTTP method to use */
  method?: HttpMethod;
  /** Custom path pattern (e.g., '/users/:id/activate') */
  path?: string;
}

/**
 * Parent resource configuration for nested routes
 *
 * Defines a single parent resource relationship for generating nested REST routes
 * like `/posts/:postId/comments/:id`.
 *
 * @example
 * ```typescript
 * // Default param name: posts -> postId
 * procedure().parent('posts')
 *
 * // Custom param name
 * procedure().parent('posts', 'post_id')
 * ```
 */
export interface ParentResourceConfig {
  /**
   * Parent resource name (e.g., 'posts', 'users')
   * Used to build the parent path segment: `/${resource}/:${param}`
   */
  readonly resource: string;

  /**
   * Parent resource parameter name in the path
   * Defaults to `${singularResource}Id` if not specified
   * (e.g., 'posts' -> 'postId', 'users' -> 'userId')
   */
  readonly param: string;
}

/**
 * Multi-level parent resource configuration for deeply nested routes
 *
 * Defines multiple parent resources for generating deeply nested REST routes
 * like `/organizations/:orgId/projects/:projectId/tasks/:id`.
 *
 * @example
 * ```typescript
 * // Multi-level nesting
 * procedure().parents([
 *   { resource: 'organizations', param: 'orgId' },
 *   { resource: 'projects', param: 'projectId' },
 * ])
 * // Generates: /organizations/:orgId/projects/:projectId/tasks/:id
 * ```
 */
export interface ParentResourceChain {
  /**
   * Array of parent resources from outermost to innermost
   * E.g., [organizations, projects] for /organizations/:orgId/projects/:projectId/tasks
   */
  readonly parents: readonly ParentResourceConfig[];
}

/**
 * Compiled procedure with all metadata and handlers
 *
 * This is the final output of the procedure builder, ready for registration
 * with both tRPC and REST adapters.
 *
 * @template TInput - The validated input type
 * @template TOutput - The handler output type
 * @template TContext - The context type
 * @template TType - The procedure type literal ('query' or 'mutation')
 */
export interface CompiledProcedure<
  TInput = unknown,
  TOutput = unknown,
  TContext extends BaseContext = BaseContext,
  TType extends ProcedureType = ProcedureType,
> {
  /** Whether this is a query or mutation */
  readonly type: TType;
  /** The procedure handler function */
  readonly handler: ProcedureHandler<TInput, TOutput, TContext>;
  /** Input validation schema (if specified) */
  readonly inputSchema?: { parse: (input: unknown) => TInput };
  /** Output validation schema (if specified) */
  readonly outputSchema?: { parse: (output: unknown) => TOutput };
  /** Middleware chain to execute before handler */
  readonly middlewares: ReadonlyArray<MiddlewareFunction<TInput, TContext, TContext, TOutput>>;
  /** Guards to execute before handler (checked before middleware) */
  readonly guards: ReadonlyArray<GuardLike<TContext>>;
  /** REST route override (if specified) */
  readonly restOverride?: RestRouteOverride;
  /** Whether this procedure is deprecated */
  readonly deprecated?: boolean;
  /** Deprecation message explaining why and what to use instead */
  readonly deprecationMessage?: string;
  /**
   * Parent resource configuration for nested routes (single level)
   *
   * When specified, the REST path will be prefixed with the parent resource:
   * `/${parent.namespace}/:${parent.paramName}/${childNamespace}/:id`
   *
   * @example
   * ```typescript
   * // With parentResource: { namespace: 'posts', paramName: 'postId' }
   * // and namespace: 'comments'
   * // Generates: /posts/:postId/comments/:id
   * ```
   */
  readonly parentResource?: ParentResourceConfig;
  /**
   * Multi-level parent resource configuration for deeply nested routes
   *
   * When specified, the REST path will be prefixed with all parent resources:
   * `/${parent1.namespace}/:${parent1.paramName}/${parent2.namespace}/:${parent2.paramName}/...`
   *
   * @example
   * ```typescript
   * // With parentResources: [
   * //   { namespace: 'organizations', paramName: 'orgId' },
   * //   { namespace: 'projects', paramName: 'projectId' }
   * // ]
   * // and namespace: 'tasks'
   * // Generates: /organizations/:orgId/projects/:projectId/tasks/:id
   * ```
   */
  readonly parentResources?: readonly ParentResourceConfig[];
  /**
   * Pre-compiled middleware chain executor
   *
   * PERFORMANCE: This function is created once during procedure compilation
   * and reused for every request, avoiding the overhead of building the
   * middleware chain dynamically on each invocation.
   *
   * @internal
   */
  readonly _precompiledExecutor?: (input: TInput, ctx: TContext) => Promise<TOutput>;
  /**
   * Resource schema for auto-projection
   *
   * When set via `.resource()`, the procedure executor will automatically
   * project the handler's return value based on `ctx.__accessLevel`.
   *
   * This enables the elegant chained API:
   * ```typescript
   * procedure()
   *   .guardNarrow(authenticatedNarrow)
   *   .resource(UserSchema)
   *   .query(async ({ ctx }) => {
   *     return ctx.db.user.findUnique(...);
   *     // Auto-projected based on __accessLevel
   *   });
   * ```
   *
   * @internal
   */
  // biome-ignore lint/suspicious/noExplicitAny: ResourceSchema type would create circular dependency
  readonly _resourceSchema?: any;
}

// ============================================================================
// Procedure Collection Types
// ============================================================================

/**
 * Record of named procedures
 *
 * NOTE: Uses `any` for variance compatibility - see ProcedureDefinitions for explanation.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for variance compatibility in Record type
export type ProcedureRecord = Record<string, CompiledProcedure<any, any, any, any>>;

/**
 * Procedure collection with namespace
 *
 * Groups related procedures under a common namespace for routing.
 *
 * @template TNamespace - The literal namespace string (e.g., 'users', 'posts')
 * @template TProcedures - The record of named procedures
 */
export interface ProcedureCollection<
  TNamespace extends string = string,
  TProcedures extends ProcedureRecord = ProcedureRecord,
> {
  /** Resource namespace (e.g., 'users', 'posts') */
  readonly namespace: TNamespace;
  /** Named procedures in this collection */
  readonly procedures: TProcedures;
}

// ============================================================================
// Type Inference Helpers
// ============================================================================

/**
 * Extracts the input type from a compiled procedure
 */
export type InferProcedureInput<T> =
  T extends CompiledProcedure<infer I, unknown, BaseContext, ProcedureType> ? I : never;

/**
 * Extracts the output type from a compiled procedure
 */
export type InferProcedureOutput<T> =
  T extends CompiledProcedure<unknown, infer O, BaseContext, ProcedureType> ? O : never;

/**
 * Extracts the context type from a compiled procedure
 */
export type InferProcedureContext<T> =
  T extends CompiledProcedure<unknown, unknown, infer C, ProcedureType> ? C : never;

/**
 * Extracts the type (query/mutation) from a compiled procedure
 */
export type InferProcedureType<T> =
  T extends CompiledProcedure<unknown, unknown, BaseContext, infer TType> ? TType : never;

/**
 * Extracts procedure types from a collection
 */
export type InferProcedureTypes<T extends ProcedureCollection> = {
  [K in keyof T['procedures']]: {
    input: InferProcedureInput<T['procedures'][K]>;
    output: InferProcedureOutput<T['procedures'][K]>;
  };
};
