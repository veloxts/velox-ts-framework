/**
 * RPC helper for type-safe tRPC registration
 *
 * Provides a symmetric API to `rest()` for registering tRPC endpoints
 * with full type preservation for client inference.
 *
 * @module rpc
 */

import { fail, type VeloxApp } from '@veloxts/core';
import type { FastifyInstance } from 'fastify';

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
 * Options for RPC registration
 */
export interface RpcOptions {
  /**
   * tRPC endpoint prefix
   *
   * @default '/trpc'
   */
  prefix?: string;
}

/**
 * Result of rpc() for type-safe router access
 *
 * Contains both the typed router (for type export) and an async
 * registration function (for registering with Fastify).
 */
export interface RpcResult<T extends readonly ProcedureCollection[]> {
  /**
   * The typed tRPC router
   *
   * Use `typeof router` to export the AppRouter type for clients.
   *
   * @example
   * ```typescript
   * const { router } = rpc([userProcedures, postProcedures] as const);
   * export type AppRouter = typeof router;
   * ```
   */
  readonly router: AnyRouter & InferRouterFromCollections<T>;

  /**
   * Register the tRPC routes with a Fastify instance
   *
   * This is an async function that registers the tRPC plugin.
   *
   * @param server - Fastify instance or VeloxApp
   *
   * @example
   * ```typescript
   * const { register } = rpc([userProcedures] as const);
   * await register(app.server);
   * ```
   */
  readonly register: (server: FastifyInstance) => Promise<void>;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Create a type-safe tRPC router from procedure collections
 *
 * This is the RPC equivalent of `rest()`. It returns a typed router
 * and a registration function, enabling proper type inference for
 * client-side usage.
 *
 * **IMPORTANT**: Use `as const` on the collections array to preserve
 * literal types for full type inference.
 *
 * @param collections - Array of procedure collections (use `as const`)
 * @param options - Optional RPC configuration
 * @returns RpcResult with typed router and register function
 *
 * @example Basic usage with VeloxApp
 * ```typescript
 * import { veloxApp } from '@veloxts/core';
 * import { rpc } from '@veloxts/router';
 *
 * const app = await veloxApp({ port: 3030 });
 *
 * const { router, register } = rpc([
 *   userProcedures,
 *   postProcedures,
 * ] as const);
 *
 * // Register tRPC routes
 * await register(app.server);
 *
 * // Export type for clients - fully typed!
 * export type AppRouter = typeof router;
 *
 * await app.start();
 * ```
 *
 * @example With custom prefix
 * ```typescript
 * const { router, register } = rpc([userProcedures] as const, {
 *   prefix: '/api/trpc',
 * });
 *
 * await register(app.server);
 * export type AppRouter = typeof router;
 * ```
 *
 * @example Combined with REST
 * ```typescript
 * // Serve same procedures via both REST and tRPC
 * const collections = [userProcedures, postProcedures] as const;
 *
 * // REST endpoints at /api/*
 * app.routes(rest([...collections], { prefix: '/api' }));
 *
 * // tRPC endpoints at /trpc/*
 * const { router, register } = rpc(collections);
 * await register(app.server);
 *
 * export type AppRouter = typeof router;
 * ```
 */
export function rpc<const T extends readonly ProcedureCollection[]>(
  collections: T,
  options: RpcOptions = {}
): RpcResult<T> {
  const { prefix = '/trpc' } = options;

  // Validate inputs
  if (collections.length === 0) {
    throw fail('VELOX-2006');
  }

  // Create the typed router immediately
  const t = trpc();
  const router = appRouter(t, collections);

  // Create the registration function
  const register = async (server: FastifyInstance): Promise<void> => {
    await registerTRPCPlugin(server, {
      prefix,
      router,
    });
  };

  return {
    router,
    register,
  };
}

// ============================================================================
// Async Helper (Alternative API)
// ============================================================================

/**
 * Register tRPC routes and return the typed router
 *
 * This is a convenience function that combines router creation and
 * registration in a single async call. Use this when you don't need
 * to separate router creation from registration.
 *
 * **IMPORTANT**: Use `as const` on the collections array to preserve
 * literal types for full type inference.
 *
 * @param app - VeloxApp instance
 * @param collections - Array of procedure collections (use `as const`)
 * @param options - Optional RPC configuration
 * @returns The typed tRPC router
 *
 * @example
 * ```typescript
 * const router = await registerRpc(app, [
 *   userProcedures,
 *   postProcedures,
 * ] as const);
 *
 * export type AppRouter = typeof router;
 * ```
 */
export async function registerRpc<const T extends readonly ProcedureCollection[]>(
  app: VeloxApp,
  collections: T,
  options: RpcOptions = {}
): Promise<AnyRouter & InferRouterFromCollections<T>> {
  const { router, register } = rpc(collections, options);
  await register(app.server);
  return router;
}
