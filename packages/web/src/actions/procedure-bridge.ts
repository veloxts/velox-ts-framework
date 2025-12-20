/**
 * Direct Procedure Bridge for Server Actions
 *
 * Enables server actions to execute VeloxTS procedures directly (same-process),
 * without HTTP overhead. This provides the best of both worlds:
 * - Procedure validation, guards, and middleware
 * - Server action ergonomics and progressive enhancement
 *
 * @module @veloxts/web/actions/procedure-bridge
 */

import type { BaseContext } from '@veloxts/core';
import type {
  CompiledProcedure,
  InferProcedureInput,
  InferProcedureOutput,
} from '@veloxts/router';

import { toActionError } from './error-classifier.js';
import type { ActionContext, ActionResult, AuthenticatedActionContext } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for executing a procedure from a server action
 */
export interface ExecuteProcedureOptions {
  /**
   * Skip guard execution (for procedures without HTTP context)
   * @default false
   */
  skipGuards?: boolean;

  /**
   * Custom context extensions to merge
   */
  contextExtensions?: Record<string, unknown>;
}

/**
 * Mock Fastify request for procedure execution
 * Provides minimal interface needed for guards and middleware
 */
interface MockFastifyRequest {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly method: string;
  readonly url: string;
  readonly body: unknown;
  readonly params: Record<string, string>;
  readonly query: Record<string, string>;
}

/**
 * Mock Fastify reply for procedure execution
 * Provides minimal interface needed for guards and middleware
 */
interface MockFastifyReply {
  statusCode: number;
  readonly sent: boolean;
  status(code: number): MockFastifyReply;
  send(payload: unknown): MockFastifyReply;
  header(name: string, value: string): MockFastifyReply;
}

// ============================================================================
// Context Bridge
// ============================================================================

/**
 * Creates a mock Fastify request from an ActionContext
 */
function createMockFastifyRequest(actionCtx: ActionContext): MockFastifyRequest {
  const headersRecord: Record<string, string | string[] | undefined> = {};

  // Convert Headers to Record
  actionCtx.headers.forEach((value, key) => {
    headersRecord[key] = value;
  });

  // Parse URL for query params
  let url = '/';
  let queryParams: Record<string, string> = {};

  try {
    const parsedUrl = new URL(actionCtx.request.url);
    url = parsedUrl.pathname;
    parsedUrl.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
  } catch {
    // URL parsing failed, use defaults
  }

  return {
    headers: headersRecord,
    method: actionCtx.request.method,
    url,
    body: undefined,
    params: {},
    query: queryParams,
  };
}

/**
 * Creates a mock Fastify reply for procedure execution
 */
function createMockFastifyReply(): MockFastifyReply {
  const reply: MockFastifyReply = {
    statusCode: 200,
    sent: false,
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(_payload: unknown) {
      return reply;
    },
    header(_name: string, _value: string) {
      return reply;
    },
  };
  return reply;
}

/**
 * Creates a BaseContext from ActionContext for procedure execution.
 *
 * Maps the Web API Request from actions to the Fastify-like context
 * that procedures expect. Includes user info if authenticated.
 */
export function createProcedureContext(
  actionCtx: ActionContext,
  extensions?: Record<string, unknown>
): BaseContext {
  const request = createMockFastifyRequest(actionCtx);
  const reply = createMockFastifyReply();

  // Build base context with mock Fastify objects
  const baseContext: BaseContext = {
    request: request as unknown as BaseContext['request'],
    reply: reply as unknown as BaseContext['reply'],
  };

  // Add user if authenticated
  if ('user' in actionCtx && actionCtx.user) {
    (baseContext as BaseContext & { user: unknown }).user = (
      actionCtx as AuthenticatedActionContext
    ).user;
  }

  // Merge any additional extensions
  if (extensions) {
    Object.assign(baseContext, extensions);
  }

  return baseContext;
}

// ============================================================================
// Procedure Execution
// ============================================================================

/**
 * Executes a VeloxTS procedure directly from a server action.
 *
 * This function bridges the gap between server actions (which run in H3/Vinxi context)
 * and VeloxTS procedures (which expect Fastify context). It:
 *
 * 1. Creates a compatible context from the action context
 * 2. Validates input using the procedure's schema
 * 3. Executes guards (if not skipped)
 * 4. Runs the procedure handler
 * 5. Validates output (if schema provided)
 * 6. Returns an ActionResult for consistent error handling
 *
 * @template TInput - The procedure's input type
 * @template TOutput - The procedure's output type
 *
 * @param procedure - The compiled procedure to execute
 * @param input - The input data (will be validated against procedure's schema)
 * @param actionCtx - The server action context
 * @param options - Execution options
 *
 * @returns ActionResult containing either the output or an error
 *
 * @example
 * ```typescript
 * import { executeProcedureDirectly } from '@veloxts/web';
 * import { userProcedures } from './procedures/users';
 *
 * export async function getUser(id: string) {
 *   'use server';
 *
 *   const ctx = await createH3Context();
 *   return executeProcedureDirectly(
 *     userProcedures.procedures.getUser,
 *     { id },
 *     ctx
 *   );
 * }
 * ```
 */
export async function executeProcedureDirectly<
  TInput,
  TOutput,
  TContext extends BaseContext = BaseContext,
>(
  procedure: CompiledProcedure<TInput, TOutput, TContext>,
  input: unknown,
  actionCtx: ActionContext,
  options: ExecuteProcedureOptions = {}
): Promise<ActionResult<TOutput>> {
  const { skipGuards = false, contextExtensions } = options;

  try {
    // Create procedure-compatible context
    const ctx = createProcedureContext(actionCtx, contextExtensions) as TContext;

    // Step 1: Execute guards (unless skipped)
    if (!skipGuards && procedure.guards.length > 0) {
      for (const guard of procedure.guards) {
        const passed = await guard.check(ctx, ctx.request, ctx.reply);
        if (!passed) {
          const message = guard.message ?? `Guard "${guard.name}" check failed`;
          return {
            success: false,
            error: {
              code: guard.statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
              message,
            },
          };
        }
      }
    }

    // Step 2: Validate input
    let validatedInput: TInput;
    if (procedure.inputSchema) {
      try {
        validatedInput = procedure.inputSchema.parse(input);
      } catch (err) {
        return toActionError(err);
      }
    } else {
      validatedInput = input as TInput;
    }

    // Step 3: Execute handler
    let result: TOutput;
    if (procedure._precompiledExecutor) {
      // Use pre-compiled middleware chain (most efficient)
      result = await procedure._precompiledExecutor(validatedInput, ctx);
    } else if (procedure.middlewares.length === 0) {
      // No middleware - execute handler directly
      result = await procedure.handler({ input: validatedInput, ctx });
    } else {
      // Execute middleware chain manually
      result = await executeMiddlewareChain(
        procedure.middlewares,
        validatedInput,
        ctx,
        async (args) => procedure.handler(args)
      );
    }

    // Step 4: Validate output
    if (procedure.outputSchema) {
      try {
        result = procedure.outputSchema.parse(result);
      } catch (err) {
        console.error('[VeloxTS] Procedure output validation failed:', err);
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Output validation failed',
          },
        };
      }
    }

    return { success: true, data: result };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Executes a middleware chain for a procedure.
 * Used as fallback when _precompiledExecutor is not available.
 */
async function executeMiddlewareChain<TInput, TOutput, TContext extends BaseContext>(
  middlewares: ReadonlyArray<unknown>,
  input: TInput,
  ctx: TContext,
  handler: (args: { input: TInput; ctx: TContext }) => Promise<TOutput>
): Promise<TOutput> {
  // Build the chain from the end (handler) back to the start
  type MiddlewareFn = (args: {
    input: TInput;
    ctx: TContext;
    next: (opts?: { ctx?: Partial<TContext> }) => Promise<{ output: TOutput }>;
  }) => Promise<{ output: TOutput }>;

  let next = async (): Promise<{ output: TOutput }> => {
    const output = await handler({ input, ctx });
    return { output };
  };

  // Build the chain in reverse order
  for (let i = middlewares.length - 1; i >= 0; i--) {
    const middleware = middlewares[i] as MiddlewareFn;
    const currentNext = next;
    next = async () => {
      return middleware({
        input,
        ctx,
        next: async (opts) => {
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
// Type Inference Helpers
// ============================================================================

/**
 * Infers the input type from a compiled procedure
 */
export type InferProcedureInputType<T> = T extends CompiledProcedure<infer I, unknown, BaseContext>
  ? I
  : never;

/**
 * Infers the output type from a compiled procedure
 */
export type InferProcedureOutputType<T> = T extends CompiledProcedure<unknown, infer O, BaseContext>
  ? O
  : never;

/**
 * Re-export router inference types for convenience
 */
export type { InferProcedureInput, InferProcedureOutput };
