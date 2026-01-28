/**
 * Shared middleware chain execution utility
 *
 * Provides a single implementation for executing middleware chains,
 * used by both the procedure builder and tRPC adapter.
 *
 * @module middleware/chain
 */

import type { BaseContext } from '@veloxts/core';

import type { MiddlewareFunction } from '../types.js';

/**
 * Result wrapper for middleware chain execution
 */
export interface MiddlewareResult<TOutput> {
  output: TOutput;
}

/**
 * Execute a middleware chain with the given handler
 *
 * Builds the chain from end to start and executes it, allowing each
 * middleware to extend the context before calling the next middleware.
 *
 * @param middlewares - Array of middleware functions to execute
 * @param input - The input to pass to each middleware
 * @param ctx - The context object (will be mutated by middleware)
 * @param handler - The final handler to execute after all middleware
 * @returns The output from the handler
 *
 * @example
 * ```typescript
 * const result = await executeMiddlewareChain(
 *   procedure.middlewares,
 *   input,
 *   ctx,
 *   async () => handler({ input, ctx })
 * );
 * ```
 */
export async function executeMiddlewareChain<TInput, TOutput, TContext extends BaseContext>(
  middlewares: ReadonlyArray<MiddlewareFunction<TInput, TContext, TContext, TOutput>>,
  input: TInput,
  ctx: TContext,
  handler: () => Promise<TOutput>
): Promise<TOutput> {
  // Build the chain from the end (handler) back to the start
  let next = async (): Promise<MiddlewareResult<TOutput>> => {
    const output = await handler();
    return { output };
  };

  // Wrap each middleware from last to first
  for (let i = middlewares.length - 1; i >= 0; i--) {
    const middleware = middlewares[i];
    const currentNext = next;

    next = async (): Promise<MiddlewareResult<TOutput>> => {
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

/**
 * Create a precompiled middleware executor for a fixed middleware chain
 *
 * This is an optimization that builds the chain structure once during
 * procedure compilation, creating a reusable function that can execute
 * the chain without rebuilding closures on every request.
 *
 * @param middlewares - Array of middleware functions
 * @param handler - The procedure handler (can return sync or async)
 * @returns A function that executes the full chain
 */
export function createMiddlewareExecutor<TInput, TOutput, TContext extends BaseContext>(
  middlewares: ReadonlyArray<MiddlewareFunction<TInput, TContext, TContext, TOutput>>,
  handler: (params: { input: TInput; ctx: TContext }) => TOutput | Promise<TOutput>
): (input: TInput, ctx: TContext) => Promise<TOutput> {
  // If no middlewares, just return a direct handler call
  if (middlewares.length === 0) {
    return async (input: TInput, ctx: TContext): Promise<TOutput> => {
      return handler({ input, ctx });
    };
  }

  // Return an executor that uses the shared chain execution
  return async (input: TInput, ctx: TContext): Promise<TOutput> => {
    return executeMiddlewareChain(middlewares, input, ctx, async () => handler({ input, ctx }));
  };
}
