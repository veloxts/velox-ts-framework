/**
 * DI Providers for @veloxts/cache
 *
 * Factory provider functions for registering cache services with the DI container.
 * These providers allow services to be managed by the container for testability and flexibility.
 *
 * @module cache/providers
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerCacheProviders, CACHE_MANAGER } from '@veloxts/cache';
 *
 * const container = new Container();
 * await registerCacheProviders(container, { driver: 'memory' });
 *
 * const cache = container.resolve(CACHE_MANAGER);
 * await cache.put('key', 'value', '1h');
 * ```
 */

import type { Container } from '@veloxts/core';

import { createCacheManager } from './manager.js';
import { CACHE_CONFIG, CACHE_MANAGER } from './tokens.js';
import type { CachePluginOptions } from './types.js';

// ============================================================================
// Bulk Registration Helpers
// ============================================================================

/**
 * Registers cache providers with a container
 *
 * This handles async initialization of the cache manager and registers
 * the resolved instance directly for synchronous resolution.
 *
 * @param container - The DI container to register providers with
 * @param config - Cache plugin options (driver, prefix, etc.)
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerCacheProviders, CACHE_MANAGER } from '@veloxts/cache';
 *
 * const container = new Container();
 *
 * // Memory cache (development)
 * await registerCacheProviders(container, { driver: 'memory' });
 *
 * // Redis cache (production)
 * await registerCacheProviders(container, {
 *   driver: 'redis',
 *   config: { url: process.env.REDIS_URL },
 * });
 *
 * const cache = container.resolve(CACHE_MANAGER);
 * await cache.put('key', 'value', '30m');
 * ```
 */
export async function registerCacheProviders(
  container: Container,
  config: CachePluginOptions = {}
): Promise<void> {
  // Register config
  container.register({
    provide: CACHE_CONFIG,
    useValue: config,
  });

  // Create cache manager (async operation)
  const cacheManager = await createCacheManager(config);

  // Register the resolved cache manager instance directly
  // This allows synchronous resolution from the container
  container.register({
    provide: CACHE_MANAGER,
    useValue: cacheManager,
  });
}
