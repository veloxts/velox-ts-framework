/**
 * DI Providers for @veloxts/router
 *
 * Factory provider functions for registering router services with the DI container.
 * These providers allow services to be managed by the container for testability and flexibility.
 *
 * @module router/providers
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerRouterProviders, TRPC_INSTANCE, APP_ROUTER } from '@veloxts/router';
 *
 * const container = new Container();
 * registerRouterProviders(container, {
 *   procedures: [userProcedures, postProcedures],
 * });
 *
 * const t = container.resolve(TRPC_INSTANCE);
 * const router = container.resolve(APP_ROUTER);
 * ```
 */

import { type Container, type FactoryProvider, Scope } from '@veloxts/core';

import type { RouterConfig } from './tokens.js';
import {
  APP_ROUTER,
  PROCEDURE_COLLECTIONS,
  REST_ADAPTER_CONFIG,
  ROUTER_CONFIG,
  TRPC_INSTANCE,
  TRPC_PLUGIN_OPTIONS,
} from './tokens.js';
import type { AnyRouter, TRPCInstance, TRPCPluginOptions } from './trpc/index.js';
import { appRouter, trpc } from './trpc/index.js';
import type { ProcedureCollection } from './types.js';

// ============================================================================
// Core Router Providers
// ============================================================================

/**
 * Creates a factory provider for the tRPC instance
 *
 * The tRPC instance is the foundation for building type-safe routers.
 *
 * @example
 * ```typescript
 * container.register(trpcInstanceProvider());
 * const t = container.resolve(TRPC_INSTANCE);
 * ```
 */
export function trpcInstanceProvider(): FactoryProvider<TRPCInstance> {
  return {
    provide: TRPC_INSTANCE,
    useFactory: () => trpc(),
    inject: [],
    scope: Scope.SINGLETON,
  };
}

/**
 * Creates a factory provider for the app router
 *
 * Requires TRPC_INSTANCE and PROCEDURE_COLLECTIONS to be registered.
 *
 * @example
 * ```typescript
 * container.register({ provide: PROCEDURE_COLLECTIONS, useValue: [userProcedures] });
 * container.register(trpcInstanceProvider());
 * container.register(appRouterProvider());
 *
 * const router = container.resolve(APP_ROUTER);
 * export type AppRouter = typeof router;
 * ```
 */
export function appRouterProvider(): FactoryProvider<AnyRouter> {
  return {
    provide: APP_ROUTER,
    useFactory: (t: TRPCInstance, collections: ProcedureCollection[]) => appRouter(t, collections),
    inject: [TRPC_INSTANCE, PROCEDURE_COLLECTIONS],
    scope: Scope.SINGLETON,
  };
}

/**
 * Creates a factory provider for tRPC plugin options
 *
 * Requires APP_ROUTER and ROUTER_CONFIG to be registered.
 *
 * @example
 * ```typescript
 * const options = container.resolve(TRPC_PLUGIN_OPTIONS);
 * await registerTRPCPlugin(server, options);
 * ```
 */
export function trpcPluginOptionsProvider(): FactoryProvider<TRPCPluginOptions> {
  return {
    provide: TRPC_PLUGIN_OPTIONS,
    useFactory: (router: AnyRouter, config: RouterConfig): TRPCPluginOptions => ({
      prefix: config.rpcPrefix ?? '/trpc',
      router,
    }),
    inject: [APP_ROUTER, ROUTER_CONFIG],
    scope: Scope.SINGLETON,
  };
}

// ============================================================================
// Bulk Registration Helpers
// ============================================================================

/**
 * Registers core router providers with a container
 *
 * This registers the tRPC instance and app router for DI-enabled routing.
 *
 * @param container - The DI container to register providers with
 * @param config - Router configuration with procedure collections
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerRouterProviders, TRPC_INSTANCE, APP_ROUTER } from '@veloxts/router';
 *
 * const container = new Container();
 * registerRouterProviders(container, {
 *   procedures: [userProcedures, postProcedures],
 *   apiPrefix: '/api',
 *   rpcPrefix: '/trpc',
 * });
 *
 * const t = container.resolve(TRPC_INSTANCE);
 * const router = container.resolve(APP_ROUTER);
 * ```
 */
export function registerRouterProviders(container: Container, config: RouterConfig = {}): void {
  // Register config
  container.register({
    provide: ROUTER_CONFIG,
    useValue: config,
  });

  // Register procedure collections
  container.register({
    provide: PROCEDURE_COLLECTIONS,
    useValue: config.procedures ?? [],
  });

  // Register REST adapter config
  container.register({
    provide: REST_ADAPTER_CONFIG,
    useValue: {
      prefix: config.apiPrefix ?? '/api',
    },
  });

  // Register tRPC instance provider
  container.register(trpcInstanceProvider());

  // Only register app router if procedures are provided
  if (config.procedures && config.procedures.length > 0) {
    container.register(appRouterProvider());
    container.register(trpcPluginOptionsProvider());
  }
}
