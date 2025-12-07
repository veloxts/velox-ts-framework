/**
 * Lifecycle scope management for dependency injection
 *
 * Defines how service instances are created and shared:
 * - Singleton: One instance for the entire application
 * - Transient: New instance on every resolution
 * - Request: One instance per HTTP request
 *
 * @module di/scope
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';

import { VeloxError } from '../errors.js';

// ============================================================================
// Scope Enum
// ============================================================================

/**
 * Service lifecycle scope
 *
 * Determines how instances are created and shared across the application.
 *
 * @example
 * ```typescript
 * // Singleton - shared across all requests
 * container.register({
 *   provide: ConfigService,
 *   useClass: ConfigService,
 *   scope: Scope.SINGLETON
 * });
 *
 * // Transient - new instance every time
 * container.register({
 *   provide: RequestIdGenerator,
 *   useClass: RequestIdGenerator,
 *   scope: Scope.TRANSIENT
 * });
 *
 * // Request - shared within a single HTTP request
 * container.register({
 *   provide: UserContext,
 *   useClass: UserContext,
 *   scope: Scope.REQUEST
 * });
 * ```
 */
export enum Scope {
  /**
   * Singleton scope
   *
   * A single instance is created and shared across the entire application.
   * The instance is created on first resolution and reused for all subsequent
   * resolutions.
   *
   * Best for:
   * - Configuration services
   * - Database connection pools
   * - Cache clients
   * - Stateless utility services
   */
  SINGLETON = 'singleton',

  /**
   * Transient scope
   *
   * A new instance is created every time the service is resolved.
   * No caching or sharing occurs.
   *
   * Best for:
   * - Services that maintain mutable state
   * - Factories that produce unique objects
   * - Services where isolation is critical
   */
  TRANSIENT = 'transient',

  /**
   * Request scope
   *
   * A single instance is created and shared within the lifetime of an HTTP request.
   * Different requests get different instances.
   *
   * Best for:
   * - User context/session data
   * - Request-specific caching
   * - Transaction management
   * - Audit logging with request context
   *
   * Note: Resolving request-scoped services outside of a request context
   * will throw an error.
   */
  REQUEST = 'request',
}

// ============================================================================
// Scope Manager
// ============================================================================

/**
 * Request-scoped instance store key
 * Using a symbol prevents collision with user-defined properties
 */
const REQUEST_SCOPE_KEY = Symbol('velox:di:request-scope');

/**
 * Type augmentation for Fastify request to store scoped instances
 */
declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Request-scoped service instance cache
     * @internal
     */
    [REQUEST_SCOPE_KEY]?: Map<unknown, unknown>;
  }
}

/**
 * Manages service instance lifecycles
 *
 * Handles creation, caching, and cleanup of service instances
 * based on their configured scope.
 *
 * @internal
 */
export class ScopeManager {
  /**
   * Singleton instance cache
   * Maps tokens to their singleton instances
   */
  private readonly singletonCache = new Map<unknown, unknown>();

  /**
   * Whether request scope hooks have been set up
   */
  private requestScopeInitialized = false;

  /**
   * Attaches the scope manager to a Fastify server
   *
   * This sets up the request lifecycle hooks needed for request-scoped services.
   * Must be called before resolving request-scoped services.
   *
   * @param server - Fastify server instance
   */
  attachToFastify(server: FastifyInstance): void {
    if (this.requestScopeInitialized) {
      return;
    }

    // Initialize request scope cache on each request
    server.addHook('onRequest', async (request) => {
      (request as FastifyRequest)[REQUEST_SCOPE_KEY] = new Map<unknown, unknown>();
    });

    // Clean up request scope cache after response
    server.addHook('onResponse', async (request) => {
      const cache = (request as FastifyRequest)[REQUEST_SCOPE_KEY];
      if (cache) {
        cache.clear();
        delete (request as FastifyRequest)[REQUEST_SCOPE_KEY];
      }
    });

    this.requestScopeInitialized = true;
  }

  /**
   * Gets a singleton instance from cache
   *
   * @param token - The service token
   * @returns The cached instance or undefined
   */
  getSingleton<T>(token: unknown): T | undefined {
    return this.singletonCache.get(token) as T | undefined;
  }

  /**
   * Stores a singleton instance in cache
   *
   * @param token - The service token
   * @param instance - The instance to cache
   */
  setSingleton<T>(token: unknown, instance: T): void {
    this.singletonCache.set(token, instance);
  }

  /**
   * Checks if a singleton instance exists
   *
   * @param token - The service token
   * @returns true if a singleton instance is cached
   */
  hasSingleton(token: unknown): boolean {
    return this.singletonCache.has(token);
  }

  /**
   * Gets a request-scoped instance from the current request's cache
   *
   * @param token - The service token
   * @param request - The current Fastify request
   * @returns The cached instance or undefined
   */
  getRequestScoped<T>(token: unknown, request: FastifyRequest): T | undefined {
    const cache = request[REQUEST_SCOPE_KEY];
    if (!cache) {
      return undefined;
    }
    return cache.get(token) as T | undefined;
  }

  /**
   * Stores a request-scoped instance in the current request's cache
   *
   * @param token - The service token
   * @param instance - The instance to cache
   * @param request - The current Fastify request
   */
  setRequestScoped<T>(token: unknown, instance: T, request: FastifyRequest): void {
    const cache = request[REQUEST_SCOPE_KEY];
    if (!cache) {
      throw new VeloxError(
        'Request scope cache not initialized. Ensure ScopeManager is attached to Fastify.',
        500,
        'REQUEST_SCOPE_UNAVAILABLE'
      );
    }
    cache.set(token, instance);
  }

  /**
   * Checks if a request-scoped instance exists
   *
   * @param token - The service token
   * @param request - The current Fastify request
   * @returns true if a request-scoped instance is cached
   */
  hasRequestScoped(token: unknown, request: FastifyRequest): boolean {
    const cache = request[REQUEST_SCOPE_KEY];
    return cache?.has(token) ?? false;
  }

  /**
   * Validates that request scope is available and returns the request
   *
   * @param request - The current request (may be undefined outside request context)
   * @returns The validated FastifyRequest
   * @throws {VeloxError} If request scope is not available
   */
  ensureRequestScope(request: FastifyRequest | undefined): FastifyRequest {
    if (!request) {
      throw new VeloxError(
        'Cannot resolve request-scoped service outside of request context. ' +
          'Ensure you are resolving within a request handler or middleware.',
        500,
        'REQUEST_SCOPE_UNAVAILABLE'
      );
    }

    if (!request[REQUEST_SCOPE_KEY]) {
      throw new VeloxError(
        'Request scope cache not initialized. Ensure ScopeManager is attached to Fastify.',
        500,
        'REQUEST_SCOPE_UNAVAILABLE'
      );
    }

    return request;
  }

  /**
   * Clears all singleton instances
   *
   * Useful for testing or application shutdown.
   */
  clearSingletons(): void {
    this.singletonCache.clear();
  }

  /**
   * Clears all cached instances and resets state
   *
   * @internal
   */
  reset(): void {
    this.singletonCache.clear();
    this.requestScopeInitialized = false;
  }
}

// ============================================================================
// Scope Utilities
// ============================================================================

/**
 * Validates a scope value
 *
 * @param scope - The scope to validate
 * @returns true if the scope is valid
 */
export function isValidScope(scope: unknown): scope is Scope {
  return scope === Scope.SINGLETON || scope === Scope.TRANSIENT || scope === Scope.REQUEST;
}

/**
 * Gets the default scope for a provider
 *
 * @returns The default scope (SINGLETON)
 */
export function getDefaultScope(): Scope {
  return Scope.SINGLETON;
}
