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
 * ## Implementation Notes: Closure Capture Pattern
 *
 * This function uses a deliberate closure capture pattern in the loop:
 *
 * ```typescript
 * for (let i = middlewares.length - 1; i >= 0; i--) {
 *   const middleware = middlewares[i];  // Captured in closure
 *   const currentNext = next;           // Captured in closure
 *   next = async () => { ... };         // Creates new closure
 * }
 * ```
 *
 * **Why closures in a loop?**
 * Each iteration creates a new closure that captures:
 * 1. `middleware` - The specific middleware function for that position
 * 2. `currentNext` - The accumulated chain from previous iterations
 *
 * This builds the chain backwards (handler → last middleware → ... → first middleware)
 * so that when executed, it runs forwards (first middleware → ... → handler).
 *
 * **Why not use Array.reduceRight?**
 * The closure pattern is more explicit and easier to debug. Each closure
 * captures exactly what it needs, and the chain structure is visible.
 *
 * @param middlewares - Array of middleware functions to execute
 * @param input - The input to pass to each middleware
 * @param ctx - The context object (will be mutated by middleware via Object.assign)
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
  // Start with the handler wrapped in a MiddlewareResult
  let next = async (): Promise<MiddlewareResult<TOutput>> => {
    const output = await handler();
    return { output };
  };

  // Wrap each middleware from last to first
  // Each iteration captures `middleware` and `currentNext` in a new closure
  // This builds: handler <- MW[n] <- MW[n-1] <- ... <- MW[0]
  // So execution flows: MW[0] -> MW[1] -> ... -> MW[n] -> handler
  for (let i = middlewares.length - 1; i >= 0; i--) {
    const middleware = middlewares[i];
    const currentNext = next; // Capture the accumulated chain so far

    // Create a new closure that wraps the middleware with the chain
    next = async (): Promise<MiddlewareResult<TOutput>> => {
      return middleware({
        input,
        ctx,
        next: async (opts) => {
          // Allow middleware to extend context via Object.assign
          // This mutates ctx in place, which is intentional
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
