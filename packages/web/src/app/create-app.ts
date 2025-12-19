/**
 * VeloxTS Web Application Factory
 *
 * Creates a Vinxi application configuration with three routers:
 * 1. API router - Embeds Fastify for /api/* and /trpc/*
 * 2. Client router - Serves static assets from /_build/*
 * 3. SSR router - Renders React Server Components for all other routes
 */

import type { ResolvedVeloxWebConfig, VeloxWebConfig, VinxiRouter } from '../types.js';
import { getEnvConfig, resolveConfig, validateConfig } from './config.js';

/**
 * Vinxi app configuration type (simplified for our use case)
 */
interface VinxiAppConfig {
  name: string;
  server: {
    port: number;
    host: string;
  };
  routers: VinxiRouter[];
}

/**
 * Options for defineVeloxApp
 */
export interface DefineVeloxAppOptions extends VeloxWebConfig {
  /**
   * Path to the API handler module
   * @default './src/api.handler'
   */
  apiHandler?: string;

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
}

/**
 * Creates a Vinxi application configuration for VeloxTS.
 *
 * This is the main entry point for configuring a full-stack VeloxTS app
 * with React Server Components.
 *
 * @example
 * ```typescript
 * // app.config.ts
 * import { defineVeloxApp } from '@veloxts/web';
 *
 * export default defineVeloxApp({
 *   port: 3030,
 *   apiHandler: './src/api.handler',
 *   serverEntry: './src/entry.server',
 *   clientEntry: './src/entry.client',
 * });
 * ```
 */
export function defineVeloxApp(options: DefineVeloxAppOptions = {}): VinxiAppConfig {
  // Merge environment config with provided options
  const envConfig = getEnvConfig();
  const mergedOptions = { ...envConfig, ...options };

  // Resolve and validate configuration
  const config = resolveConfig(mergedOptions);
  validateConfig(config);

  // Extract handler paths with defaults
  const apiHandler = options.apiHandler ?? './src/api.handler';
  const serverEntry = options.serverEntry ?? './src/entry.server';
  const clientEntry = options.clientEntry ?? './src/entry.client';

  // Build routers
  const routers = createRouters(config, {
    apiHandler,
    serverEntry,
    clientEntry,
  });

  return {
    name: 'velox-app',
    server: {
      port: config.port,
      host: config.host,
    },
    routers,
  };
}

/**
 * Creates the three routers for the Vinxi application
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
  };
}

/**
 * Creates the client router configuration
 *
 * This router serves the client-side JavaScript bundle
 * and other static assets.
 */
function createClientRouter(config: ResolvedVeloxWebConfig, entryPath: string): VinxiRouter {
  return {
    name: 'client',
    type: 'client',
    handler: entryPath,
    target: 'browser',
    base: config.buildBase,
  };
}

/**
 * Creates the SSR router configuration
 *
 * This router handles all other routes by rendering
 * React Server Components.
 */
function createSsrRouter(_config: ResolvedVeloxWebConfig, entryPath: string): VinxiRouter {
  return {
    name: 'ssr',
    type: 'http',
    handler: entryPath,
    target: 'server',
    // No base = handles all routes not matched by other routers
  };
}

/**
 * Re-export for convenience
 */
export { getEnvConfig, resolveConfig, validateConfig } from './config.js';
