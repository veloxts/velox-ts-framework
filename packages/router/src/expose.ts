/**
 * Unified API Registration
 *
 * Serves procedure collections as both REST and tRPC endpoints
 * with a single, elegant function call.
 *
 * @module serve
 */

import { fail, type VeloxApp } from '@veloxts/core';

import { rest } from './rest/index.js';
import {
  type AnyRouter,
  appRouter,
  type InferRouterFromCollections,
  registerTRPCPlugin,
  trpc,
} from './trpc/index.js';
import type { ProcedureCollection } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for serving procedures
 */
export interface ServeOptions {
  /**
   * REST API prefix
   *
   * - `string`: Custom prefix (e.g., '/v1', '/api/v2')
   * - `false`: Disable REST endpoints entirely
   *
   * @default '/api'
   */
  api?: string | false;

  /**
   * tRPC endpoint prefix
   *
   * - `string`: Custom prefix (e.g., '/rpc')
   * - `false`: Disable tRPC endpoints entirely
   *
   * @default '/trpc'
   */
  rpc?: string | false;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Serve procedures as REST and tRPC endpoints
 *
 * This is the recommended way to register your API.
 * Define your procedures once, serve them everywhere.
 *
 * **IMPORTANT**: Use `as const` on the procedures array to preserve
 * literal types for full type inference on the returned router.
 *
 * @param app - VeloxTS application instance
 * @param procedures - Array of procedure collections to serve (use `as const`)
 * @param options - Optional configuration for API and RPC prefixes
 * @returns The typed tRPC router for type exports
 *
 * @example
 * ```typescript
 * // Both REST (/api) and tRPC (/trpc) with zero config
 * const router = await serve(app, [healthProcedures, userProcedures] as const);
 * export type AppRouter = typeof router; // Fully typed!
 * ```
 *
 * @example
 * ```typescript
 * // REST only (external API)
 * await serve(app, [healthProcedures, userProcedures] as const, { rpc: false });
 * ```
 *
 * @example
 * ```typescript
 * // tRPC only (internal app)
 * const router = await serve(app, [healthProcedures, userProcedures] as const, { api: false });
 * export type AppRouter = typeof router;
 * ```
 *
 * @example
 * ```typescript
 * // Custom prefixes
 * const router = await serve(app, [healthProcedures, userProcedures] as const, {
 *   api: '/v1',
 *   rpc: '/rpc',
 * });
 * ```
 */
export async function serve<const T extends readonly ProcedureCollection[]>(
  app: VeloxApp,
  procedures: T,
  options: ServeOptions = {}
): Promise<AnyRouter & InferRouterFromCollections<T>> {
  const { api: apiPrefix = '/api', rpc: rpcPrefix = '/trpc' } = options;

  // Validate inputs - using fail() for catalog-driven errors
  if (procedures.length === 0) {
    throw fail('VELOX-2006');
  }

  if (apiPrefix === false && rpcPrefix === false) {
    throw fail('VELOX-2007');
  }

  // Router is created even when rpc is disabled - needed for AppRouter type export
  const t = trpc();
  const router = appRouter(t, procedures);

  // Register tRPC routes if enabled
  if (rpcPrefix !== false) {
    await registerTRPCPlugin(app.server, {
      prefix: rpcPrefix,
      router,
    });
  }

  // Register REST routes if enabled
  if (apiPrefix !== false) {
    // Need to spread to convert readonly tuple to mutable array for rest()
    app.routes(rest([...procedures], { prefix: apiPrefix }));
  }

  return router;
}
