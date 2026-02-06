/**
 * Procedure builder implementation
 *
 * Implements the fluent builder pattern for defining type-safe procedures.
 * Uses a functional approach where each method returns a new builder instance
 * with accumulated state, enabling immutable building with proper type inference.
 *
 * @module procedure/builder
 */

import { type BaseContext, ConfigurationError, logWarning } from '@veloxts/core';

import { GuardError } from '../errors.js';
import { createMiddlewareExecutor, executeMiddlewareChain } from '../middleware/chain.js';
import {
  type AccessLevel,
  type OutputForTag,
  Resource,
  type ResourceSchema,
} from '../resource/index.js';
import type { ContextTag, ExtractTag, TaggedContext } from '../resource/tags.js';
import type {
  CompiledProcedure,
  GuardLike,
  MiddlewareFunction,
  ParentResourceConfig,
  ProcedureCollection,
  ProcedureHandler,
  RestRouteOverride,
} from '../types.js';
import { deriveParentParamName } from '../utils/pluralization.js';
import {
  analyzeNamingConvention,
  isDevelopment,
  normalizeWarningOption,
  type WarningOption,
} from '../warnings.js';
import type {
  BuilderRuntimeState,
  InferProcedures,
  InferSchemaOutput,
  ProcedureBuilder,
  ProcedureDefinitions,
  ValidSchema,
} from './types.js';

// ============================================================================
// Builder Factory
// ============================================================================

/**
 * Creates a new procedure builder instance
 *
 * This is the primary entry point for defining procedures. The builder uses
 * TypeScript's generic inference to track types through the fluent chain.
 *
 * @template TContext - The context type (defaults to BaseContext)
 * @returns New procedure builder with unknown input, unknown output, and TContext
 *
 * @example
 * ```typescript
 * // Basic usage with BaseContext
 * const getUser = procedure()
 *   .input(z.object({ id: z.string().uuid() }))
 *   .output(UserSchema)
 *   .query(async ({ input, ctx }) => {
 *     // input is { id: string }
 *     // ctx is BaseContext
 *     // return type must match UserSchema
 *     return ctx.db.user.findUnique({ where: { id: input.id } });
 *   });
 *
 * // With custom context type
 * const getUserTyped = procedure<AppContext>()
 *   .query(async ({ ctx }) => {
 *     // ctx is AppContext with full autocomplete
 *     return ctx.db.user.findMany();
 *   });
 * ```
 */
export function procedure<TContext extends BaseContext = BaseContext>(): ProcedureBuilder<
  unknown,
  unknown,
  TContext
> {
  return createBuilder<unknown, unknown, TContext>({
    inputSchema: undefined,
    outputSchema: undefined,
    resourceSchema: undefined,
    middlewares: [],
    guards: [],
    restOverride: undefined,
    parentResource: undefined,
    parentResources: undefined,
    deprecated: undefined,
    deprecationMessage: undefined,
  });
}

// ============================================================================
// Internal Builder Implementation
// ============================================================================

/**
 * Creates a builder instance with the given runtime state
 *
 * This internal function constructs the builder object with all methods bound
 * to the current state. Each method returns a new builder with updated state.
 *
 * @internal
 */
function createBuilder<TInput, TOutput, TContext extends BaseContext>(
  state: BuilderRuntimeState
): ProcedureBuilder<TInput, TOutput, TContext> {
  return {
    /**
     * Sets the input validation schema
     */
    input<TSchema extends ValidSchema>(
      schema: TSchema
    ): ProcedureBuilder<InferSchemaOutput<TSchema>, TOutput, TContext> {
      // Return new builder with updated input schema
      // The type parameter extracts the schema's output type
      return createBuilder<InferSchemaOutput<TSchema>, TOutput, TContext>({
        ...state,
        inputSchema: schema,
      });
    },

    /**
     * Sets the output validation schema
     */
    output<TSchema extends ValidSchema>(
      schema: TSchema
    ): ProcedureBuilder<TInput, InferSchemaOutput<TSchema>, TContext> {
      // Return new builder with updated output schema
      return createBuilder<TInput, InferSchemaOutput<TSchema>, TContext>({
        ...state,
        outputSchema: schema,
      });
    },

    /**
     * Adds middleware to the chain
     */
    use<TNewContext extends BaseContext = TContext>(
      middleware: MiddlewareFunction<TInput, TContext, TNewContext, TOutput>
    ): ProcedureBuilder<TInput, TOutput, TNewContext> {
      // Add middleware to the chain
      // Cast is safe because we're building up the chain incrementally
      const typedMiddleware = middleware as MiddlewareFunction<
        unknown,
        BaseContext,
        BaseContext,
        unknown
      >;

      return createBuilder<TInput, TOutput, TNewContext>({
        ...state,
        middlewares: [...state.middlewares, typedMiddleware],
      });
    },

    /**
     * Adds an authorization guard
     *
     * Accepts guards with partial context types (contravariant).
     * Guards typed for `{ auth?: AuthContext }` work with full `BaseContext`.
     */
    guard<TGuardContext extends Partial<TContext>>(
      guardDef: GuardLike<TGuardContext>
    ): ProcedureBuilder<TInput, TOutput, TContext> {
      return createBuilder<TInput, TOutput, TContext>({
        ...state,
        guards: [...state.guards, guardDef as GuardLike<unknown>],
      });
    },

    /**
     * Adds an authorization guard with type narrowing (EXPERIMENTAL)
     *
     * Unlike `guard()`, this method narrows the context type based on
     * what the guard guarantees after it passes.
     */
    guardNarrow<TNarrowedContext>(
      guardDef: GuardLike<Partial<TContext>> & { readonly _narrows: TNarrowedContext }
    ): ProcedureBuilder<TInput, TOutput, TContext & TNarrowedContext> {
      return createBuilder<TInput, TOutput, TContext & TNarrowedContext>({
        ...state,
        guards: [...state.guards, guardDef as GuardLike<unknown>],
      });
    },

    /**
     * Adds multiple authorization guards at once
     *
     * Convenience method equivalent to chaining multiple `.guard()` calls.
     * Guards execute left-to-right. All must pass for the procedure to execute.
     */
    guards<TGuards extends GuardLike<Partial<TContext>>[]>(
      ...guardDefs: TGuards
    ): ProcedureBuilder<TInput, TOutput, TContext> {
      return createBuilder<TInput, TOutput, TContext>({
        ...state,
        guards: [...state.guards, ...(guardDefs as GuardLike<unknown>[])],
      });
    },

    /**
     * Sets REST route override
     */
    rest(config: RestRouteOverride): ProcedureBuilder<TInput, TOutput, TContext> {
      return createBuilder<TInput, TOutput, TContext>({
        ...state,
        restOverride: config,
      });
    },

    /**
     * Marks the procedure as deprecated
     */
    deprecated(message?: string): ProcedureBuilder<TInput, TOutput, TContext> {
      return createBuilder<TInput, TOutput, TContext>({
        ...state,
        deprecated: true,
        deprecationMessage: message,
      });
    },

    /**
     * Declares a parent resource for nested routes (single level)
     */
    parent(resource: string, param?: string): ProcedureBuilder<TInput, TOutput, TContext> {
      const parentConfig: ParentResourceConfig = {
        resource,
        param: param ?? deriveParentParamName(resource),
      };

      return createBuilder<TInput, TOutput, TContext>({
        ...state,
        parentResource: parentConfig,
      });
    },

    /**
     * Declares multiple parent resources for deeply nested routes
     */
    parents(
      config: Array<{ resource: string; param?: string }>
    ): ProcedureBuilder<TInput, TOutput, TContext> {
      const parentConfigs: ParentResourceConfig[] = config.map((item) => ({
        resource: item.resource,
        param: item.param ?? deriveParentParamName(item.resource),
      }));

      return createBuilder<TInput, TOutput, TContext>({
        ...state,
        parentResources: parentConfigs,
      });
    },

    /**
     * Finalizes as a query procedure
     */
    query(
      handler: ProcedureHandler<TInput, TOutput, TContext>
    ): CompiledProcedure<TInput, TOutput, TContext, 'query'> {
      return compileProcedure('query', handler, state);
    },

    /**
     * Finalizes as a mutation procedure
     */
    mutation(
      handler: ProcedureHandler<TInput, TOutput, TContext>
    ): CompiledProcedure<TInput, TOutput, TContext, 'mutation'> {
      return compileProcedure('mutation', handler, state);
    },

    /**
     * Sets the output type based on a resource schema
     *
     * This method stores the resource schema for potential OpenAPI generation
     * and narrows the output type based on the context's phantom tag.
     */
    resource<TSchema extends ResourceSchema>(
      schema: TSchema
    ): ProcedureBuilder<
      TInput,
      TContext extends TaggedContext<infer TTag>
        ? TTag extends ContextTag
          ? OutputForTag<TSchema, TTag>
          : OutputForTag<TSchema, ExtractTag<TContext>>
        : OutputForTag<TSchema, ExtractTag<TContext>>,
      TContext
    > {
      // Store the resource schema for OpenAPI generation
      // The actual output type is computed at the type level
      return createBuilder<
        TInput,
        TContext extends TaggedContext<infer TTag>
          ? TTag extends ContextTag
            ? OutputForTag<TSchema, TTag>
            : OutputForTag<TSchema, ExtractTag<TContext>>
          : OutputForTag<TSchema, ExtractTag<TContext>>,
        TContext
      >({
        ...state,
        resourceSchema: schema,
      });
    },
  };
}

/**
 * Compiles a procedure from the builder state
 *
 * Creates the final CompiledProcedure object with all metadata and handlers.
 * PERFORMANCE: Pre-compiles the middleware chain during procedure definition
 * instead of building it on every request.
 *
 * @internal
 */
function compileProcedure<
  TInput,
  TOutput,
  TContext extends BaseContext,
  TType extends 'query' | 'mutation',
>(
  type: TType,
  handler: ProcedureHandler<TInput, TOutput, TContext>,
  state: BuilderRuntimeState
): CompiledProcedure<TInput, TOutput, TContext, TType> {
  const typedMiddlewares = state.middlewares as ReadonlyArray<
    MiddlewareFunction<TInput, TContext, TContext, TOutput>
  >;

  // Pre-compile the middleware chain executor if middlewares exist
  // This avoids rebuilding the chain on every request
  const precompiledExecutor =
    typedMiddlewares.length > 0
      ? createPrecompiledMiddlewareExecutor(typedMiddlewares, handler)
      : undefined;

  // Create the final procedure object
  return {
    type,
    handler,
    inputSchema: state.inputSchema as { parse: (input: unknown) => TInput } | undefined,
    outputSchema: state.outputSchema as { parse: (output: unknown) => TOutput } | undefined,
    middlewares: typedMiddlewares,
    guards: state.guards as ReadonlyArray<GuardLike<TContext>>,
    restOverride: state.restOverride,
    deprecated: state.deprecated,
    deprecationMessage: state.deprecationMessage,
    parentResource: state.parentResource,
    parentResources: state.parentResources,
    // Store pre-compiled executor for performance
    _precompiledExecutor: precompiledExecutor,
    // Store resource schema for auto-projection
    _resourceSchema: state.resourceSchema,
  };
}

/**
 * Creates a pre-compiled middleware chain executor
 *
 * PERFORMANCE: This function builds the middleware chain once during procedure
 * compilation, creating a single reusable function that executes the entire chain.
 * This eliminates the need to rebuild closures on every request.
 *
 * @internal
 */
function createPrecompiledMiddlewareExecutor<TInput, TOutput, TContext extends BaseContext>(
  middlewares: ReadonlyArray<MiddlewareFunction<TInput, TContext, TContext, TOutput>>,
  handler: ProcedureHandler<TInput, TOutput, TContext>
): (input: TInput, ctx: TContext) => Promise<TOutput> {
  return createMiddlewareExecutor(middlewares, handler);
}

// ============================================================================
// Procedure Collection Factory
// ============================================================================

/**
 * Options for defining a procedure collection
 */
export interface DefineProceduresOptions {
  /**
   * Configuration for naming convention warnings
   *
   * Accepts three forms:
   * - `false` - Disable all warnings
   * - `'strict'` - Treat warnings as errors (fail fast)
   * - `{ ... }` - Full configuration object
   *
   * @example
   * ```typescript
   * // Shorthand: disable warnings
   * defineProcedures('legacy', procs, { warnings: false });
   *
   * // Shorthand: strict mode (CI/CD)
   * defineProcedures('api', procs, { warnings: 'strict' });
   *
   * // Full config with exceptions
   * defineProcedures('custom', procs, {
   *   warnings: { strict: true, except: ['customAction'] }
   * });
   * ```
   */
  warnings?: WarningOption;
}

/**
 * Defines a collection of procedures under a namespace
 *
 * Groups related procedures together for registration with routers.
 * The namespace determines the base path for REST routes.
 *
 * In development mode, emits warnings for procedure names that don't follow
 * naming conventions (which means they won't generate REST routes).
 *
 * @template TNamespace - The literal namespace string (inferred from argument)
 * @template TProcedures - The record of named procedures
 * @param namespace - Resource namespace (e.g., 'users', 'posts')
 * @param procedures - Object containing named procedures
 * @param options - Optional configuration for warnings
 * @returns Procedure collection with preserved types including literal namespace
 *
 * @example
 * ```typescript
 * export const userProcedures = defineProcedures('users', {
 *   getUser: procedure()
 *     .input(z.object({ id: z.string().uuid() }))
 *     .query(async ({ input, ctx }) => {
 *       return ctx.db.user.findUnique({ where: { id: input.id } });
 *     }),
 *
 *   createUser: procedure()
 *     .input(CreateUserSchema)
 *     .mutation(async ({ input, ctx }) => {
 *       return ctx.db.user.create({ data: input });
 *     }),
 * });
 *
 * // Types are fully preserved:
 * // userProcedures.namespace -> 'users' (literal type)
 * // userProcedures.procedures.getUser.inputSchema -> { id: string }
 * // userProcedures.procedures.createUser -> mutation type
 * ```
 *
 * @example Disabling warnings
 * ```typescript
 * // Shorthand
 * export const legacyProcedures = defineProcedures('legacy', procs, {
 *   warnings: false
 * });
 * ```
 *
 * @example Excluding specific procedures
 * ```typescript
 * export const customProcedures = defineProcedures('custom', {
 *   doCustomThing: procedure().mutation(handler),
 * }, {
 *   warnings: { except: ['doCustomThing'] }
 * });
 * ```
 *
 * @example Strict mode for CI/CD
 * ```typescript
 * // Shorthand
 * export const strictProcedures = defineProcedures('api', procs, {
 *   warnings: 'strict'
 * });
 *
 * // Or with exceptions
 * export const strictProcedures = defineProcedures('api', procs, {
 *   warnings: { strict: true, except: ['legacyEndpoint'] }
 * });
 * ```
 */
export function defineProcedures<
  const TNamespace extends string,
  TProcedures extends ProcedureDefinitions,
>(
  namespace: TNamespace,
  procedures: TProcedures,
  options?: DefineProceduresOptions
): ProcedureCollection<TNamespace, InferProcedures<TProcedures>> {
  // Normalize warning options (handles shorthands)
  const warnings = normalizeWarningOption(options?.warnings);

  // Analyze naming conventions in development mode
  if (isDevelopment() && !warnings.disabled) {
    for (const [name, proc] of Object.entries(procedures)) {
      // Skip if this procedure name is explicitly excluded
      if (warnings.except?.includes(name)) {
        continue;
      }

      // Skip if procedure has explicit .rest() override with both method and path
      const compiledProc = proc as CompiledProcedure;
      if (compiledProc.restOverride?.method && compiledProc.restOverride?.path) {
        continue;
      }

      // Analyze the naming convention
      const warning = analyzeNamingConvention(name, compiledProc.type, namespace);

      if (warning) {
        if (warnings.strict) {
          throw new ConfigurationError(
            `[${namespace}/${warning.procedureName}] ${warning.message}. ${warning.suggestion}`
          );
        }

        logWarning(
          `[${namespace}/${warning.procedureName}] ${warning.message}`,
          warning.suggestion
        );
      }
    }
  }

  return {
    namespace,
    procedures: procedures as InferProcedures<TProcedures>,
  };
}

/**
 * Short alias for defineProcedures
 *
 * Laravel-inspired concise syntax for daily use.
 *
 * @example
 * ```typescript
 * // These are equivalent:
 * export const users = procedures('users', { ... });
 * export const users = defineProcedures('users', { ... });
 * ```
 */
export const procedures = defineProcedures;

// ============================================================================
// Procedure Execution
// ============================================================================

/**
 * Executes a compiled procedure with the given input and context
 *
 * This function handles:
 * 1. Input validation (if schema provided)
 * 2. Middleware chain execution (using pre-compiled executor when available)
 * 3. Handler execution
 * 4. Output validation (if schema provided)
 *
 * PERFORMANCE: Uses pre-compiled middleware executor when available,
 * eliminating the overhead of building the middleware chain on every request.
 *
 * @template TInput - The input type
 * @template TOutput - The output type
 * @template TContext - The context type
 * @param procedure - The compiled procedure to execute
 * @param rawInput - Raw input data to validate and pass to handler
 * @param ctx - Request context
 * @returns Promise resolving to the handler output
 *
 * @example
 * ```typescript
 * const result = await executeProcedure(
 *   userProcedures.procedures.getUser,
 *   { id: '123' },
 *   context
 * );
 * ```
 */
export async function executeProcedure<TInput, TOutput, TContext extends BaseContext>(
  procedure: CompiledProcedure<TInput, TOutput, TContext>,
  rawInput: unknown,
  ctx: TContext
): Promise<TOutput> {
  // Track the highest access level from narrowing guards
  let accessLevel: AccessLevel = 'public';

  // Step 1: Execute guards if any
  if (procedure.guards.length > 0) {
    // Defensive check: ensure request and reply exist in context
    // These are required for guard execution but may be missing in test contexts
    const request = ctx.request;
    const reply = ctx.reply;

    if (!request || !reply) {
      throw new GuardError(
        'context',
        'Guard execution requires request and reply in context. ' +
          'Ensure the procedure is being called from a valid HTTP context.',
        500
      );
    }

    for (const guard of procedure.guards) {
      const passed = await guard.check(ctx, request, reply);
      if (!passed) {
        const statusCode = guard.statusCode ?? 403;
        const message = guard.message ?? `Guard "${guard.name}" check failed`;
        throw new GuardError(guard.name, message, statusCode);
      }

      // Track highest access level from narrowing guards
      const guardWithLevel = guard as { accessLevel?: AccessLevel };
      if (guardWithLevel.accessLevel) {
        // Admin > authenticated > public
        if (
          guardWithLevel.accessLevel === 'admin' ||
          (guardWithLevel.accessLevel === 'authenticated' && accessLevel === 'public')
        ) {
          accessLevel = guardWithLevel.accessLevel;
        }
      }
    }
  }

  // Set __accessLevel on context for auto-projection
  const ctxWithLevel = ctx as TContext & { __accessLevel?: AccessLevel };
  ctxWithLevel.__accessLevel = accessLevel;

  // Step 2: Validate input if schema provided
  const input: TInput = procedure.inputSchema
    ? procedure.inputSchema.parse(rawInput)
    : (rawInput as TInput);

  // Step 3: Execute handler (with or without middleware)
  let result: TOutput;

  if (procedure._precompiledExecutor) {
    // PERFORMANCE: Use pre-compiled middleware chain executor
    result = await procedure._precompiledExecutor(input, ctxWithLevel as TContext);
  } else if (procedure.middlewares.length === 0) {
    // No middleware - execute handler directly
    result = await procedure.handler({ input, ctx: ctxWithLevel as TContext });
  } else {
    // Fallback: Build middleware chain dynamically (should not normally happen)
    result = await executeMiddlewareChainFallback(
      procedure.middlewares as MiddlewareFunction<TInput, TContext, TContext, TOutput>[],
      input,
      ctxWithLevel as TContext,
      async () => procedure.handler({ input, ctx: ctxWithLevel as TContext })
    );
  }

  // Step 4: Auto-project if resource schema is set
  if (procedure._resourceSchema) {
    const schema = procedure._resourceSchema as ResourceSchema;

    const projectOne = (item: Record<string, unknown>): Record<string, unknown> => {
      const r = new Resource(item, schema);
      switch (accessLevel) {
        case 'admin':
          return r.forAdmin() as Record<string, unknown>;
        case 'authenticated':
          return r.forAuthenticated() as Record<string, unknown>;
        default:
          return r.forAnonymous() as Record<string, unknown>;
      }
    };

    if (Array.isArray(result)) {
      result = result.map((item) => projectOne(item as Record<string, unknown>)) as TOutput;
    } else {
      result = projectOne(result as Record<string, unknown>) as TOutput;
    }
  }

  // Step 5: Validate output if schema provided
  if (procedure.outputSchema) {
    return procedure.outputSchema.parse(result);
  }

  return result;
}

/**
 * Fallback middleware chain executor for edge cases
 *
 * This function is only used when _precompiledExecutor is not available,
 * which should be rare in normal operation.
 *
 * @internal
 */
async function executeMiddlewareChainFallback<TInput, TOutput, TContext extends BaseContext>(
  middlewares: MiddlewareFunction<TInput, TContext, TContext, TOutput>[],
  input: TInput,
  ctx: TContext,
  handler: () => Promise<TOutput>
): Promise<TOutput> {
  return executeMiddlewareChain(middlewares, input, ctx, handler);
}

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Type guard to check if a value is a compiled procedure
 */
export function isCompiledProcedure(value: unknown): value is CompiledProcedure {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    (obj.type === 'query' || obj.type === 'mutation') &&
    typeof obj.handler === 'function' &&
    Array.isArray(obj.middlewares) &&
    Array.isArray(obj.guards)
  );
}

/**
 * Type guard to check if a value is a procedure collection
 */
export function isProcedureCollection(value: unknown): value is ProcedureCollection {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.namespace === 'string' &&
    typeof obj.procedures === 'object' &&
    obj.procedures !== null
  );
}
