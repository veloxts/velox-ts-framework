/**
 * @veloxts/cache
 *
 * Multi-driver caching layer for VeloxTS framework.
 *
 * Features:
 * - Multiple drivers: memory (lru-cache), Redis (ioredis)
 * - Type-safe cache operations with automatic serialization
 * - Cache tags for grouped invalidation
 * - Distributed locks for exclusive access
 * - `remember()` pattern for cache-aside
 * - Human-readable TTL strings ('1h', '30m', '1d')
 *
 * @example
 * ```typescript
 * import { cachePlugin } from '@veloxts/cache';
 *
 * // Register plugin
 * app.use(cachePlugin({
 *   driver: 'redis',
 *   config: { url: process.env.REDIS_URL },
 * }));
 *
 * // In procedures:
 * const user = await ctx.cache.remember('user:123', '1h', async () => {
 *   return ctx.db.user.findUnique({ where: { id: '123' } });
 * });
 *
 * // Tags for grouped invalidation
 * await ctx.cache.tags(['users']).put('user:123', user);
 * await ctx.cache.tags(['users']).flush();
 *
 * // Distributed locks
 * await ctx.cache.lockAndRun('payment:process', '30s', async () => {
 *   // Only one process can run this at a time
 * });
 * ```
 *
 * @packageDocumentation
 */

// Drivers
export { createMemoryCache, DRIVER_NAME as MEMORY_DRIVER } from './drivers/memory.js';
export { createRedisCache, DRIVER_NAME as REDIS_DRIVER } from './drivers/redis.js';
// Manager
export {
  type CacheManager,
  cache,
  createCacheManager,
  type TaggedCache,
} from './manager.js';
// Plugin
export {
  cachePlugin,
  closeCache,
  getCache,
  getCacheFromInstance,
  initCache,
} from './plugin.js';
// Types
export type {
  CacheConfig,
  CacheDriver,
  CacheEntry,
  CacheOptions,
  CachePluginOptions,
  CacheStore,
  DurationString,
  LockOptions,
  LockResult,
  MemoryCacheConfig,
  RedisCacheConfig,
  TaggableCacheStore,
  TTL,
} from './types.js';
/**
 * Utility functions for TTL parsing and formatting.
 *
 * @deprecated Import from '@veloxts/cache/utils' instead. Will be removed in v2.0.
 *
 * @example
 * ```typescript
 * // Old (deprecated):
 * import { parseTtl, formatTtl } from '@veloxts/cache';
 *
 * // New:
 * import { parseTtl, formatTtl } from '@veloxts/cache/utils';
 * ```
 */
export {
  formatTtl,
  isDurationString,
  parseTtl,
  parseTtlMs,
} from './utils.js';
