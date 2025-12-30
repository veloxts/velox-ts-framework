/**
 * VeloxTS Web Application Factory
 *
 * Creates a Vinxi application with three routers:
 * 1. API router - Embeds Fastify for /api/* and /trpc/*
 * 2. Client router - Serves static assets from /_build/*
 * 3. SSR router - Renders React Server Components for all other routes
 */

import { serverFunctions } from '@vinxi/server-functions/plugin';
import { createApp } from 'vinxi';
import tsconfigPaths from 'vite-tsconfig-paths';

import type { ResolvedVeloxWebConfig, VeloxWebConfig, VinxiApp, VinxiRouter } from '../types.js';
import { getEnvConfig, resolveConfig, validateConfig } from './config.js';

/**
 * Server configuration options
 */
export interface ServerConfig {
  /**
   * Port to run the server on
   * @default 3030
   */
  port?: number;

  /**
   * Host to bind the server to
   * @default 'localhost'
   */
  host?: string;
}

/**
 * Routing configuration options
 */
export interface RoutingConfig {
  /**
   * Directory containing page components
   * @default 'app/pages'
   */
  pagesDir?: string;

  /**
   * Directory containing layout components
   * @default 'app/layouts'
   */
  layoutsDir?: string;

  /**
   * Directory containing server actions
   * @default 'app/actions'
   */
  actionsDir?: string;
}

/**
 * API configuration options
 */
export interface ApiConfig {
  /**
   * Base path prefix for API routes
   * @default '/api'
   */
  prefix?: string;

  /**
   * Path to the API handler module
   * @default './src/api/handler'
   */
  handlerPath?: string;
}

/**
 * Build configuration options
 */
export interface BuildConfig {
  /**
   * Output directory for builds
   * @default 'dist'
   */
  outDir?: string;

  /**
   * Base path for static assets (client bundle)
   * @default '/_build'
   */
  buildBase?: string;
}

/**
 * Options for defineVeloxApp (nested config format - legacy)
 */
export interface DefineVeloxAppNestedOptions {
  server?: ServerConfig;
  routing?: RoutingConfig;
  api?: ApiConfig;
  build?: BuildConfig;
  serverEntry?: string;
  clientEntry?: string;
  dev?: boolean;
}

/**
 * Flat options for defineVeloxApp (preferred, Laravel-style)
 *
 * All options have sensible defaults. You only need to specify what you want to change.
 */
export interface DefineVeloxAppOptions {
  /**
   * Port to run the server on
   * @default 3030
   */
  port?: number;

  /**
   * Host to bind the server to
   * @default 'localhost'
   */
  host?: string;

  /**
   * Directory containing page components
   * @default 'app/pages'
   */
  pagesDir?: string;

  /**
   * Directory containing layout components
   * @default 'app/layouts'
   */
  layoutsDir?: string;

  /**
   * Directory containing server actions
   * @default 'app/actions'
   */
  actionsDir?: string;

  /**
   * Base path prefix for API routes
   * @default '/api'
   */
  apiPrefix?: string;

  /**
   * Path to the API handler module
   * @default './src/api/handler'
   */
  apiHandler?: string;

  /**
   * Output directory for builds
   * @default 'dist'
   */
  outDir?: string;

  /**
   * Base path for static assets
   * @default '/_build'
   */
  buildBase?: string;

  /**
   * Path to the server entry point
   * @default './src/entry.server'
   */
  serverEntry?: string;

  /**
   * Path to the client entry point
   * @default './src/entry.client'
   */
  clientEntry?: string;

  /**
   * Enable development mode features (HMR, source maps)
   * @default process.env.NODE_ENV !== 'production'
   */
  dev?: boolean;

  // Nested options for backward compatibility
  server?: ServerConfig;
  routing?: RoutingConfig;
  api?: ApiConfig;
  build?: BuildConfig;
}

/**
 * Creates a Vinxi application configuration for VeloxTS.
 *
 * This is the main entry point for configuring a full-stack VeloxTS app
 * with React Server Components.
 *
 * @example Minimal (all defaults)
 * ```typescript
 * import { defineVeloxApp } from '@veloxts/web';
 * export default defineVeloxApp();
 * ```
 *
 * @example Flat config (preferred, Laravel-style)
 * ```typescript
 * import { defineVeloxApp } from '@veloxts/web';
 *
 * export default defineVeloxApp({
 *   port: 3030,
 *   apiPrefix: '/api',
 *   pagesDir: 'app/pages',
 * });
 * ```
 *
 * @example Nested config (backward compatible)
 * ```typescript
 * import { defineVeloxApp } from '@veloxts/web';
 *
 * export default defineVeloxApp({
 *   server: { port: 3030 },
 *   api: { prefix: '/api' },
 * });
 * ```
 */
export function defineVeloxApp(options: DefineVeloxAppOptions = {}): VinxiApp {
  // Merge environment config with provided options
  const envConfig = getEnvConfig();

  // Support both flat and nested config (flat takes precedence)
  const flatConfig: VeloxWebConfig = {
    // Flat options take precedence, then nested, then env defaults
    port: options.port ?? options.server?.port ?? envConfig.port,
    host: options.host ?? options.server?.host ?? envConfig.host,
    apiBase: options.apiPrefix ?? options.api?.prefix ?? envConfig.apiBase,
    buildBase: options.buildBase ?? options.build?.buildBase ?? envConfig.buildBase,
    pagesDir: options.pagesDir ?? options.routing?.pagesDir,
    layoutsDir: options.layoutsDir ?? options.routing?.layoutsDir,
    actionsDir: options.actionsDir ?? options.routing?.actionsDir,
    dev: options.dev ?? envConfig.dev,
  };

  // Resolve and validate configuration
  const config = resolveConfig(flatConfig);
  validateConfig(config);

  // Extract handler paths with defaults (flat takes precedence)
  const apiHandler = options.apiHandler ?? options.api?.handlerPath ?? './src/api/handler';
  const serverEntry = options.serverEntry ?? './src/entry.server';
  const clientEntry = options.clientEntry ?? './src/entry.client';

  // Build routers
  const routers = createRouters(config, {
    apiHandler,
    serverEntry,
    clientEntry,
  });

  // Create and return a proper Vinxi app with hooks, dev(), build() methods, etc.
  // Pass port/host through server config to make them available to the Vinxi dev server.
  // While Vinxi primarily uses CLI args and env vars for port, passing it in server config
  // ensures consistency and allows the config to be used in deployment scripts.
  return createApp({
    name: 'velox-app',
    server: {
      port: config.port,
      host: config.host,
    },
    routers,
  });
}

/**
 * Creates the four routers for the Vinxi application
 *
 * Router architecture:
 * 1. API - Fastify for /api/* and /trpc/*
 * 2. Client - Static assets and client bundle
 * 3. SSR - Server-side rendering for pages
 * 4. Server Functions - Handles 'use server' directives (RPC for server actions)
 */
function createRouters(
  config: ResolvedVeloxWebConfig,
  handlers: {
    apiHandler: string;
    serverEntry: string;
    clientEntry: string;
  }
): VinxiRouter[] {
  return [
    // Router 1: API routes (Fastify embedded)
    createApiRouter(config, handlers.apiHandler),

    // Router 2: Client-side assets
    createClientRouter(config, handlers.clientEntry),

    // Router 3: SSR/RSC handler
    createSsrRouter(config, handlers.serverEntry),

    // Router 4: Server Functions (handles 'use server' directives)
    createServerFunctionsRouter(),
  ];
}

/**
 * Creates the API router configuration
 *
 * This router handles both /api/* and /trpc/* routes by
 * embedding the Fastify application.
 */
function createApiRouter(config: ResolvedVeloxWebConfig, handlerPath: string): VinxiRouter {
  return {
    name: 'api',
    type: 'http',
    handler: handlerPath,
    target: 'server',
    base: config.apiBase,
    // Enable tsconfig path aliases (e.g., @/* → ./src/*)
    plugins: () => [tsconfigPaths()],
  };
}

/**
 * Creates the client router configuration
 *
 * This router serves the client-side JavaScript bundle
 * and other static assets.
 *
 * CRITICAL: Includes serverFunctions.client() plugin to:
 * - Transform 'use server' directives into RPC calls
 * - Prevent server-only code from being bundled
 * - Replace server action imports with client stubs
 *
 * Note: Server/client separation is enforced via:
 * - `@veloxts/web/server` - Server-only exports (uses browser export condition)
 * - `@veloxts/web/client` - Browser-safe hooks and utilities
 * - `@veloxts/web/types` - Isomorphic type definitions
 * - `'use server'` directive - Marks server-only files
 */
function createClientRouter(config: ResolvedVeloxWebConfig, entryPath: string): VinxiRouter {
  return {
    name: 'client',
    type: 'client',
    handler: entryPath,
    target: 'browser',
    base: config.buildBase,
    plugins: () => [
      // CRITICAL: Must come first - transforms 'use server' directives
      serverFunctions.client(),
      // Enable tsconfig path aliases (e.g., @/* → ./src/*)
      tsconfigPaths(),
    ],
  };
}

/**
 * Creates the SSR router configuration
 *
 * This router handles all other routes by rendering
 * React Server Components.
 *
 * IMPORTANT: Includes serverFunctions.client() to support server actions
 * called from Server Components during SSR.
 */
function createSsrRouter(_config: ResolvedVeloxWebConfig, entryPath: string): VinxiRouter {
  return {
    name: 'ssr',
    type: 'http',
    handler: entryPath,
    target: 'server',
    // No base = handles all routes not matched by other routers
    plugins: () => [
      // Server functions support (for server actions in RSC)
      serverFunctions.client(),
      // Enable tsconfig path aliases (e.g., @/* → ./src/*, @/app/* → ./app/*)
      tsconfigPaths(),
    ],
  };
}

/**
 * Creates the Server Functions router
 *
 * This dedicated router handles RPC calls to server actions
 * (files/functions with 'use server' directive).
 *
 * The serverFunctions.router() creates a special HTTP router that:
 * - Receives serialized function calls from the client
 * - Executes the actual server-side function
 * - Returns serialized results
 *
 * This is the bridge that makes 'use server' work - it's what prevents
 * server action code from being bundled into the client.
 */
function createServerFunctionsRouter(): VinxiRouter {
  return serverFunctions.router({
    plugins: () => [
      // Enable tsconfig path aliases for server function files
      tsconfigPaths(),
    ],
  }) as VinxiRouter;
}

/**
 * Re-export for convenience
 */
export { getEnvConfig, resolveConfig, validateConfig } from './config.js';
