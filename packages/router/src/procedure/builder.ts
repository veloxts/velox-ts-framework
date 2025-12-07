/**
 * Procedure builder implementation
 *
 * Implements the fluent builder pattern for defining type-safe procedures.
 * Uses a functional approach where each method returns a new builder instance
 * with accumulated state, enabling immutable building with proper type inference.
 *
 * @module procedure/builder
 */

import type { BaseContext } from '@veloxts/core';

import { GuardError } from '../errors.js';
import type {
  CompiledProcedure,
  GuardLike,
  MiddlewareFunction,
  ProcedureCollection,
  ProcedureHandler,
  RestRouteOverride,
} from '../types.js';
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
 * @returns New procedure builder with void input, unknown output, and BaseContext
 *
 * @example
 * ```typescript
 * const getUser = procedure()
 *   .input(z.object({ id: z.string().uuid() }))
 *   .output(UserSchema)
 *   .query(async ({ input, ctx }) => {
 *     // input is { id: string }
 *     // ctx is BaseContext
 *     // return type must match UserSchema
 *     return ctx.db.user.findUnique({ where: { id: input.id } });
 *   });
 * ```
 */
export function procedure(): ProcedureBuilder<unknown, unknown, BaseContext> {
  return createBuilder({
    inputSchema: undefined,
    outputSchema: undefined,
    middlewares: [],
    guards: [],
    restOverride: undefined,
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
     * Sets REST route override
     */
    rest(config: RestRouteOverride): ProcedureBuilder<TInput, TOutput, TContext> {
      return createBuilder<TInput, TOutput, TContext>({
        ...state,
        restOverride: config,
      });
    },

    /**
     * Finalizes as a query procedure
     */
    query(
      handler: ProcedureHandler<TInput, TOutput, TContext>
    ): CompiledProcedure<TInput, TOutput, TContext> {
      return compileProcedure('query', handler, state);
    },

    /**
     * Finalizes as a mutation procedure
     */
    mutation(
      handler: ProcedureHandler<TInput, TOutput, TContext>
    ): CompiledProcedure<TInput, TOutput, TContext> {
      return compileProcedure('mutation', handler, state);
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
function compileProcedure<TInput, TOutput, TContext extends BaseContext>(
  type: 'query' | 'mutation',
  handler: ProcedureHandler<TInput, TOutput, TContext>,
  state: BuilderRuntimeState
): CompiledProcedure<TInput, TOutput, TContext> {
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
  const procedure: CompiledProcedure<TInput, TOutput, TContext> = {
    type,
    handler,
    inputSchema: state.inputSchema as { parse: (input: unknown) => TInput } | undefined,
    outputSchema: state.outputSchema as { parse: (output: unknown) => TOutput } | undefined,
    middlewares: typedMiddlewares,
    guards: state.guards as ReadonlyArray<GuardLike<TContext>>,
    restOverride: state.restOverride,
    // Store pre-compiled executor for performance
    _precompiledExecutor: precompiledExecutor,
  };

  return procedure;
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
  // Pre-build the chain executor once
  return async (input: TInput, ctx: TContext): Promise<TOutput> => {
    // Create mutable context copy for middleware extensions
    const mutableCtx = ctx;

    // Build the handler wrapper
    const executeHandler = async (): Promise<{ output: TOutput }> => {
      const output = await handler({ input, ctx: mutableCtx });
      return { output };
    };

    // Build chain from end to start (only done once per request, not per middleware)
    let next = executeHandler;

    for (let i = middlewares.length - 1; i >= 0; i--) {
      const middleware = middlewares[i];
      const currentNext = next;

      next = async (): Promise<{ output: TOutput }> => {
        return middleware({
          input,
          ctx: mutableCtx,
          next: async (opts) => {
            if (opts?.ctx) {
              Object.assign(mutableCtx, opts.ctx);
            }
            return currentNext();
          },
        });
      };
    }

    const result = await next();
    return result.output;
  };
}

// ============================================================================
// Procedure Collection Factory
// ============================================================================

/**
 * Defines a collection of procedures under a namespace
 *
 * Groups related procedures together for registration with routers.
 * The namespace determines the base path for REST routes.
 *
 * @template TProcedures - The record of named procedures
 * @param namespace - Resource namespace (e.g., 'users', 'posts')
 * @param procedures - Object containing named procedures
 * @returns Procedure collection with preserved types
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
 * // userProcedures.procedures.getUser.inputSchema -> { id: string }
 * // userProcedures.procedures.createUser -> mutation type
 * ```
 */
export function defineProcedures<TProcedures extends ProcedureDefinitions>(
  namespace: string,
  procedures: TProcedures
): ProcedureCollection<InferProcedures<TProcedures>> {
  return {
    namespace,
    procedures: procedures as InferProcedures<TProcedures>,
  };
}

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
    }
  }

  // Step 2: Validate input if schema provided
  const input: TInput = procedure.inputSchema
    ? procedure.inputSchema.parse(rawInput)
    : (rawInput as TInput);

  // Step 3: Execute handler (with or without middleware)
  let result: TOutput;

  if (procedure._precompiledExecutor) {
    // PERFORMANCE: Use pre-compiled middleware chain executor
    result = await procedure._precompiledExecutor(input, ctx);
  } else if (procedure.middlewares.length === 0) {
    // No middleware - execute handler directly
    result = await procedure.handler({ input, ctx });
  } else {
    // Fallback: Build middleware chain dynamically (should not normally happen)
    result = await executeMiddlewareChainFallback(
      procedure.middlewares as MiddlewareFunction<TInput, TContext, TContext, TOutput>[],
      input,
      ctx,
      async () => procedure.handler({ input, ctx })
    );
  }

  // Step 4: Validate output if schema provided
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
  // Build the chain from the end (handler) back to the start
  let next = async (): Promise<{ output: TOutput }> => {
    const output = await handler();
    return { output };
  };

  // Wrap each middleware from last to first
  for (let i = middlewares.length - 1; i >= 0; i--) {
    const middleware = middlewares[i];
    const currentNext = next;

    next = async (): Promise<{ output: TOutput }> => {
      return middleware({
        input,
        ctx,
        next: async (opts) => {
          // Allow middleware to extend context
          if (opts?.ctx) {
            Object.assign(ctx, opts.ctx);
          }
          return currentNext();
        },
      });
    };
  }

  const result = await next();
  return result.output;
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
