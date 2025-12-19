/**
 * API Router
 *
 * Handles API requests by delegating to the embedded Fastify instance.
 * This module provides utilities for configuring the API router.
 */

import type { FastifyInstance } from 'fastify';

import { createApiHandler } from '../adapters/fastify-adapter.js';
import type { VinxiHandler } from '../types.js';

/**
 * Options for creating the API router handler
 */
export interface ApiRouterOptions {
  /**
   * The Fastify application instance
   */
  app: FastifyInstance;

  /**
   * Base path for API routes
   * @default '/api'
   */
  basePath?: string;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Enable request logging
   * @default true in development
   */
  logging?: boolean;
}

/**
 * Creates the API router handler for Vinxi.
 *
 * This is typically used in the API handler module that gets
 * referenced in the Vinxi configuration.
 *
 * @example
 * ```typescript
 * // src/api.handler.ts
 * import { createApiRouter } from '@veloxts/web';
 * import { createApp } from '@veloxts/core';
 * import { userProcedures } from './procedures/users';
 *
 * const app = await createApp();
 * // Register your procedures...
 *
 * export default createApiRouter({
 *   app,
 *   basePath: '/api',
 * });
 * ```
 */
export function createApiRouter(options: ApiRouterOptions): VinxiHandler {
  const { app, basePath = '/api', timeout = 30_000, logging } = options;

  const shouldLog = logging ?? process.env.NODE_ENV !== 'production';

  // Create the base handler
  const handler = createApiHandler({ app, basePath, timeout });

  // Wrap with logging if enabled
  if (shouldLog) {
    return async function loggingHandler(request: Request): Promise<Response> {
      const startTime = performance.now();
      const url = new URL(request.url);

      try {
        const response = await handler(request);
        const elapsed = performance.now() - startTime;

        console.log(
          `[API] ${request.method} ${url.pathname} → ${response.status} (${elapsed.toFixed(1)}ms)`
        );

        return response;
      } catch (error) {
        const elapsed = performance.now() - startTime;
        console.error(
          `[API] ${request.method} ${url.pathname} → ERROR (${elapsed.toFixed(1)}ms)`,
          error
        );
        throw error;
      }
    };
  }

  return handler;
}

/**
 * Type guard for checking if an error is an API error
 */
export function isApiError(error: unknown): error is { statusCode: number; message: string } {
  return typeof error === 'object' && error !== null && 'statusCode' in error && 'message' in error;
}
