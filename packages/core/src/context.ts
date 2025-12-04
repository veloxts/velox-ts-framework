/**
 * Context system for request-scoped state
 * Supports TypeScript declaration merging for plugin extensions
 * @module context
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Base context interface available in all request handlers
 *
 * Plugins extend this via TypeScript declaration merging to add
 * their own properties (e.g., database clients, user sessions, etc.)
 *
 * @example
 * ```typescript
 * // In a plugin file:
 * declare module '@veloxts/core' {
 *   interface BaseContext {
 *     db: PrismaClient;
 *     user?: User;
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In a route handler:
 * server.get('/users', async (request) => {
 *   const users = await request.context.db.user.findMany();
 *   return users;
 * });
 * ```
 */
export interface BaseContext {
  /**
   * Fastify request object
   * Provides access to request data (params, query, body, headers, etc.)
   */
  request: FastifyRequest;

  /**
   * Fastify reply object
   * Provides access to response methods (send, status, header, etc.)
   */
  reply: FastifyReply;
}

/**
 * Creates a context object for the current request
 *
 * This function is called automatically by the framework for each request
 * via the `onRequest` hook. Users typically don't need to call this directly.
 *
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * @returns Context object with request and reply
 *
 * @internal
 */
export function createContext(request: FastifyRequest, reply: FastifyReply): BaseContext {
  return {
    request,
    reply,
  };
}

/**
 * Type guard to check if a value is a valid context object
 *
 * Uses the `in` operator for safe property access with proper null checks.
 *
 * @param value - Value to check
 * @returns true if value is a valid BaseContext
 *
 * @example
 * ```typescript
 * if (isContext(someValue)) {
 *   // TypeScript knows someValue has request and reply properties
 *   console.log(someValue.request.url);
 * }
 * ```
 */
export function isContext(value: unknown): value is BaseContext {
  // Early return for non-objects
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // Check properties exist using 'in' operator
  if (!('request' in value) || !('reply' in value)) {
    return false;
  }

  // After 'in' checks, safely access properties
  const ctx = value as { request: unknown; reply: unknown };

  // Verify request and reply are non-null objects
  return (
    typeof ctx.request === 'object' &&
    ctx.request !== null &&
    typeof ctx.reply === 'object' &&
    ctx.reply !== null
  );
}

/**
 * Augment Fastify's Request interface to include context
 * This enables `request.context` in route handlers
 */
declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Request-scoped context object
     * Contains request/reply and plugin-provided properties
     */
    context: BaseContext;
  }
}
