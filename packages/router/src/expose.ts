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
import { type AnyRouter, createAppRouter, createTRPC, registerTRPCPlugin } from './trpc/index.js';
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
 * @param app - VeloxTS application instance
 * @param procedures - Array of procedure collections to serve
 * @param options - Optional configuration for API and RPC prefixes
 * @returns The tRPC router for type exports
 *
 * @example
 * ```typescript
 * // Both REST (/api) and tRPC (/trpc) with zero config
 * const router = await serve(app, [healthProcedures, userProcedures]);
 * export type AppRouter = typeof router;
 * ```
 *
 * @example
 * ```typescript
 * // REST only (external API)
 * await serve(app, [healthProcedures, userProcedures], { rpc: false });
 * ```
 *
 * @example
 * ```typescript
 * // tRPC only (internal app)
 * const router = await serve(app, [healthProcedures, userProcedures], { api: false });
 * export type AppRouter = typeof router;
 * ```
 *
 * @example
 * ```typescript
 * // Custom prefixes
 * const router = await serve(app, [healthProcedures, userProcedures], {
 *   api: '/v1',
 *   rpc: '/rpc',
 * });
 * ```
 */
export async function serve(
  app: VeloxApp,
  procedures: ProcedureCollection[],
  options: ServeOptions = {}
): Promise<AnyRouter> {
  const { api: apiPrefix = '/api', rpc: rpcPrefix = '/trpc' } = options;

  // Validate inputs - using fail() for catalog-driven errors
  if (procedures.length === 0) {
    throw fail('VELOX-2006');
  }

  if (apiPrefix === false && rpcPrefix === false) {
    throw fail('VELOX-2007');
  }

  // Router is created even when rpc is disabled - needed for AppRouter type export
  const t = createTRPC();
  const appRouter = createAppRouter(t, procedures);

  // Register tRPC routes if enabled
  if (rpcPrefix !== false) {
    await registerTRPCPlugin(app.server, {
      prefix: rpcPrefix,
      router: appRouter,
    });
  }

  // Register REST routes if enabled
  if (apiPrefix !== false) {
    app.routes(rest(procedures, { prefix: apiPrefix }));
  }

  return appRouter;
}

// ============================================================================
// Backward Compatibility
// ============================================================================

/** @deprecated Use `serve()` instead */
export const expose = serve;

/** @deprecated Use `ServeOptions` instead */
export type ExposeOptions = ServeOptions;

/** @deprecated Use `ServeOptions` instead */
export type ExposeResult<TRouter extends AnyRouter = AnyRouter> = {
  router: TRouter;
};
