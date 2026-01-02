/**
 * DI Tokens for @veloxts/router
 *
 * Symbol-based tokens for type-safe dependency injection.
 * These tokens allow router services to be registered, resolved, and mocked via the DI container.
 *
 * @module router/tokens
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { TRPC_INSTANCE, trpcInstanceProvider, registerRouterProviders } from '@veloxts/router';
 *
 * const container = new Container();
 * registerRouterProviders(container);
 *
 * const t = container.resolve(TRPC_INSTANCE);
 * ```
 */

import { token } from '@veloxts/core';

import type { AnyRouter, TRPCInstance, TRPCPluginOptions } from './trpc/index.js';
import type { ProcedureCollection } from './types.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Router configuration for DI registration
 */
export interface RouterConfig {
  /**
   * Procedure collections to register
   */
  procedures?: ProcedureCollection[];

  /**
   * REST API prefix
   * @default '/api'
   */
  apiPrefix?: string;

  /**
   * tRPC endpoint prefix
   * @default '/trpc'
   */
  rpcPrefix?: string;
}

/**
 * REST adapter configuration for DI
 */
export interface RestAdapterConfig {
  /**
   * API prefix for routes
   * @default '/api'
   */
  prefix?: string;
}

// ============================================================================
// Core Router Tokens
// ============================================================================

/**
 * tRPC instance token
 *
 * The tRPC instance used for building routers and procedures.
 * This is created by `trpc()` and provides the base for procedure definitions.
 *
 * @example
 * ```typescript
 * const t = container.resolve(TRPC_INSTANCE);
 * const router = t.router({
 *   hello: t.procedure.query(() => 'Hello World'),
 * });
 * ```
 */
export const TRPC_INSTANCE = token.symbol<TRPCInstance>('TRPC_INSTANCE');

/**
 * App router token
 *
 * The merged tRPC router from all procedure collections.
 * This is the router exported for type inference on the client.
 *
 * @example
 * ```typescript
 * const router = container.resolve(APP_ROUTER);
 * export type AppRouter = typeof router;
 * ```
 */
export const APP_ROUTER = token.symbol<AnyRouter>('APP_ROUTER');

// ============================================================================
// Configuration Tokens
// ============================================================================

/**
 * Router configuration token
 *
 * Contains router settings including procedure collections and prefixes.
 */
export const ROUTER_CONFIG = token.symbol<RouterConfig>('ROUTER_CONFIG');

/**
 * REST adapter configuration token
 *
 * Configuration for the REST adapter including prefix settings.
 */
export const REST_ADAPTER_CONFIG = token.symbol<RestAdapterConfig>('REST_ADAPTER_CONFIG');

/**
 * tRPC plugin options token
 *
 * Configuration for the tRPC Fastify plugin including prefix and router.
 */
export const TRPC_PLUGIN_OPTIONS = token.symbol<TRPCPluginOptions>('TRPC_PLUGIN_OPTIONS');

/**
 * Procedure collections token
 *
 * Array of procedure collections to register with the router.
 */
export const PROCEDURE_COLLECTIONS = token.symbol<ProcedureCollection[]>('PROCEDURE_COLLECTIONS');
