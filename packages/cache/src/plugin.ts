/**
 * Cache Plugin
 *
 * VeloxTS plugin for integrating caching into the framework.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { type CacheManager, createCacheManager } from './manager.js';
import type { CachePluginOptions } from './types.js';

/**
 * Symbol for storing cache manager on Fastify instance.
 * Using a symbol prevents naming conflicts with other plugins.
 */
const CACHE_MANAGER_KEY = Symbol.for('@veloxts/cache:manager');

/**
 * Extend Fastify types with cache manager.
 */
declare module 'fastify' {
  interface FastifyInstance {
    [CACHE_MANAGER_KEY]?: CacheManager;
  }

  interface FastifyRequest {
    cache?: CacheManager;
  }
}

/**
 * Standalone cache instance for CLI commands and background jobs.
 * This is separate from the plugin to avoid test isolation issues.
 */
let standaloneCacheInstance: CacheManager | null = null;

/**
 * Create the cache plugin for VeloxTS.
 *
 * Each Fastify instance gets its own cache manager, ensuring proper test isolation
 * and supporting multiple Fastify instances in the same process.
 *
 * @param options - Cache plugin options
 * @returns Fastify plugin
 *
 * @example
 * ```typescript
 * import { createApp } from '@veloxts/core';
 * import { cachePlugin } from '@veloxts/cache';
 *
 * const app = createApp();
 *
 * app.use(cachePlugin({
 *   driver: 'redis',
 *   config: { url: process.env.REDIS_URL },
 * }));
 *
 * // In procedures:
 * const user = await ctx.cache.remember('user:123', '1h', async () => {
 *   return ctx.db.user.findUnique({ where: { id: '123' } });
 * });
 * ```
 */
export function cachePlugin(options: CachePluginOptions = {}) {
  return fp(
    async (fastify: FastifyInstance) => {
      // Create a new cache manager for this Fastify instance
      const cacheManager = await createCacheManager(options);

      // Store on Fastify instance using symbol key
      (fastify as unknown as Record<symbol, CacheManager>)[CACHE_MANAGER_KEY] = cacheManager;

      // Decorate the request with cache manager
      fastify.decorateRequest('cache', undefined);

      // Add cache to request context
      fastify.addHook('onRequest', async (request: FastifyRequest) => {
        request.cache = cacheManager;
      });

      // Close cache on server shutdown
      fastify.addHook('onClose', async () => {
        await cacheManager.close();
      });
    },
    {
      name: '@veloxts/cache',
      fastify: '5.x',
    }
  );
}

/**
 * Get the cache manager from a Fastify instance.
 *
 * @param fastify - Fastify instance with cache plugin registered
 * @throws Error if cache plugin is not registered
 */
export function getCacheFromInstance(fastify: FastifyInstance): CacheManager {
  const cache = (fastify as unknown as Record<symbol, CacheManager | undefined>)[CACHE_MANAGER_KEY];
  if (!cache) {
    throw new Error(
      'Cache not initialized on this Fastify instance. Make sure to register cachePlugin first.'
    );
  }
  return cache;
}

/**
 * Initialize cache manager standalone (without Fastify).
 *
 * Useful for CLI commands or background jobs. This creates a separate
 * cache instance that is independent from any Fastify instances.
 *
 * @example
 * ```typescript
 * import { initCache, closeCache } from '@veloxts/cache';
 *
 * const cache = await initCache({
 *   driver: 'redis',
 *   config: { url: process.env.REDIS_URL },
 * });
 *
 * // Use cache directly
 * await cache.put('key', 'value');
 *
 * // Clean up when done
 * await closeCache();
 * ```
 */
export async function initCache(options: CachePluginOptions = {}): Promise<CacheManager> {
  if (!standaloneCacheInstance) {
    standaloneCacheInstance = await createCacheManager(options);
  }
  return standaloneCacheInstance;
}

/**
 * Get the standalone cache manager.
 *
 * @throws Error if cache is not initialized via initCache()
 */
export function getCache(): CacheManager {
  if (!standaloneCacheInstance) {
    throw new Error(
      'Standalone cache not initialized. Call initCache() first, or use getCacheFromInstance() for Fastify-based usage.'
    );
  }
  return standaloneCacheInstance;
}

/**
 * Close the standalone cache connection.
 */
export async function closeCache(): Promise<void> {
  if (standaloneCacheInstance) {
    await standaloneCacheInstance.close();
    standaloneCacheInstance = null;
  }
}

/**
 * Reset standalone cache instance (for testing purposes).
 * @internal
 */
export function _resetStandaloneCache(): void {
  standaloneCacheInstance = null;
}
