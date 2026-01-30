/**
 * Cache Manager
 *
 * High-level cache API with remember, tags, and lock support.
 */

import { createMemoryCache } from './drivers/memory.js';
import { createRedisCache } from './drivers/redis.js';
import type {
  CachePluginOptions,
  LockOptions,
  LockResult,
  TaggableCacheStore,
  TTL,
} from './types.js';
import { generateLockToken, prefixKey } from './utils.js';

/**
 * Cache manager interface.
 */
export interface CacheManager {
  /**
   * Get a value from the cache.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store a value in the cache.
   */
  put<T>(key: string, value: T, ttl?: TTL): Promise<void>;

  /**
   * Check if a key exists in the cache.
   */
  has(key: string): Promise<boolean>;

  /**
   * Remove a key from the cache.
   */
  forget(key: string): Promise<boolean>;

  /**
   * Increment a numeric value.
   */
  increment(key: string, value?: number): Promise<number>;

  /**
   * Decrement a numeric value.
   */
  decrement(key: string, value?: number): Promise<number>;

  /**
   * Clear all entries from the cache.
   */
  flush(): Promise<void>;

  /**
   * Get multiple values from the cache.
   */
  many<T>(keys: string[]): Promise<Map<string, T | null>>;

  /**
   * Store multiple values in the cache.
   */
  putMany<T>(entries: Map<string, T>, ttl?: TTL): Promise<void>;

  /**
   * Get a value or compute and cache it if not present.
   */
  remember<T>(key: string, ttl: TTL, callback: () => Promise<T>): Promise<T>;

  /**
   * Get a value or compute and cache it forever if not present.
   */
  rememberForever<T>(key: string, callback: () => Promise<T>): Promise<T>;

  /**
   * Delete a value and return it.
   */
  pull<T>(key: string): Promise<T | null>;

  /**
   * Store a value only if the key doesn't exist.
   */
  add<T>(key: string, value: T, ttl?: TTL): Promise<boolean>;

  /**
   * Create a tagged cache instance.
   */
  tags(tags: string[]): TaggedCache;

  /**
   * Acquire a distributed lock.
   */
  lock(key: string, options: LockOptions): Promise<LockResult>;

  /**
   * Execute a callback with a lock.
   */
  lockAndRun<T>(key: string, ttl: TTL, callback: () => Promise<T>): Promise<T>;

  /**
   * Close the cache connection.
   */
  close(): Promise<void>;
}

/**
 * Tagged cache interface for grouped invalidation.
 */
export interface TaggedCache {
  /**
   * Get a value from the tagged cache.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store a value with the configured tags.
   */
  put<T>(key: string, value: T, ttl?: TTL): Promise<void>;

  /**
   * Get a value or compute and cache it with tags.
   */
  remember<T>(key: string, ttl: TTL, callback: () => Promise<T>): Promise<T>;

  /**
   * Flush all entries with the configured tags.
   */
  flush(): Promise<void>;
}

/**
 * Create a cache manager.
 *
 * @param options - Cache plugin options
 * @returns Cache manager instance
 *
 * @example
 * ```typescript
 * // Memory cache (development)
 * const cache = await createCacheManager({ driver: 'memory' });
 *
 * // Redis cache (production)
 * const cache = await createCacheManager({
 *   driver: 'redis',
 *   config: { url: process.env.REDIS_URL },
 * });
 *
 * // Basic usage
 * await cache.put('user:123', { name: 'John' }, '30m');
 * const user = await cache.get('user:123');
 *
 * // Remember pattern
 * const user = await cache.remember('user:123', '1h', async () => {
 *   return await db.user.findUnique({ where: { id: '123' } });
 * });
 *
 * // Tags for grouped invalidation
 * await cache.tags(['users']).put('user:123', user);
 * await cache.tags(['users']).flush(); // Invalidates all user entries
 *
 * // Distributed lock
 * await cache.lockAndRun('process:payment', '30s', async () => {
 *   // Only one process can run this at a time
 * });
 * ```
 */
export async function createCacheManager(options: CachePluginOptions = {}): Promise<CacheManager> {
  // Use top-level options with fallback to defaults
  const prefix = options.prefix ?? 'velox:';
  const defaultTtl = options.defaultTtl ?? '1h';

  let store: TaggableCacheStore;

  // Create the appropriate driver with type-safe config narrowing
  if (options.driver === 'redis') {
    // Type narrows: options.config is Omit<RedisCacheConfig, 'driver'> | undefined
    store = await createRedisCache({
      ...options.config,
      prefix: options.config?.prefix ?? prefix,
      defaultTtl: options.config?.defaultTtl ?? defaultTtl,
    });
  } else {
    // Type narrows: options.config is Omit<MemoryCacheConfig, 'driver'> | undefined
    // (driver is 'memory' or undefined)
    store = createMemoryCache({
      ...options.config,
      defaultTtl: options.config?.defaultTtl ?? defaultTtl,
    });
  }

  /**
   * Create a tagged cache wrapper.
   */
  function createTaggedCache(tags: string[]): TaggedCache {
    return {
      async get<T>(key: string): Promise<T | null> {
        return store.get<T>(key);
      },

      async put<T>(key: string, value: T, ttl?: TTL): Promise<void> {
        await store.putWithTags(key, value, tags, ttl ?? defaultTtl);
      },

      async remember<T>(key: string, ttl: TTL, callback: () => Promise<T>): Promise<T> {
        const cached = await store.get<T>(key);
        if (cached !== null) {
          return cached;
        }

        const value = await callback();
        await store.putWithTags(key, value, tags, ttl);
        return value;
      },

      async flush(): Promise<void> {
        await store.flushTags(tags);
      },
    };
  }

  const manager: CacheManager = {
    async get<T>(key: string): Promise<T | null> {
      return store.get<T>(key);
    },

    async put<T>(key: string, value: T, ttl?: TTL): Promise<void> {
      await store.put(key, value, ttl ?? defaultTtl);
    },

    async has(key: string): Promise<boolean> {
      return store.has(key);
    },

    async forget(key: string): Promise<boolean> {
      return store.forget(key);
    },

    async increment(key: string, value = 1): Promise<number> {
      return store.increment(key, value);
    },

    async decrement(key: string, value = 1): Promise<number> {
      return store.decrement(key, value);
    },

    async flush(): Promise<void> {
      await store.flush();
    },

    async many<T>(keys: string[]): Promise<Map<string, T | null>> {
      return store.many<T>(keys);
    },

    async putMany<T>(entries: Map<string, T>, ttl?: TTL): Promise<void> {
      await store.putMany(entries, ttl ?? defaultTtl);
    },

    async remember<T>(key: string, ttl: TTL, callback: () => Promise<T>): Promise<T> {
      const cached = await store.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      const value = await callback();
      await store.put(key, value, ttl);
      return value;
    },

    async rememberForever<T>(key: string, callback: () => Promise<T>): Promise<T> {
      const cached = await store.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      const value = await callback();
      // Use a very long TTL (10 years) with atomic add to prevent race conditions
      const added = await store.add(key, value, '3650d');
      if (!added) {
        // Another process set the value - return that instead
        const existing = await store.get<T>(key);
        if (existing !== null) {
          return existing;
        }
      }
      return value;
    },

    async pull<T>(key: string): Promise<T | null> {
      const value = await store.get<T>(key);
      if (value !== null) {
        await store.forget(key);
      }
      return value;
    },

    async add<T>(key: string, value: T, ttl?: TTL): Promise<boolean> {
      // Use the store's atomic add() to prevent race conditions
      return store.add(key, value, ttl ?? defaultTtl);
    },

    tags(tags: string[]): TaggedCache {
      return createTaggedCache(tags);
    },

    async lock(key: string, options: LockOptions): Promise<LockResult> {
      const lockKey = prefixKey(`lock:${key}`, prefix);
      const token = generateLockToken();
      const baseRetryInterval = options.retryInterval ?? 50;
      const maxRetryInterval = 2000; // Cap at 2 seconds
      const maxRetries = options.maxRetries ?? 100;

      let acquired = false;
      let retries = 0;

      while (!acquired && retries < maxRetries) {
        // Try to set the lock (only if it doesn't exist)
        const added = await manager.add(lockKey, token, options.timeout);
        if (added) {
          acquired = true;
          break;
        }

        // Exponential backoff with jitter to prevent thundering herd
        // Formula: min(maxDelay, baseDelay * 2^retries) + random jitter
        const exponentialDelay = Math.min(maxRetryInterval, baseRetryInterval * 2 ** retries);
        const jitter = Math.random() * exponentialDelay * 0.1; // 10% jitter
        const delay = exponentialDelay + jitter;

        await new Promise((resolve) => setTimeout(resolve, delay));
        retries++;
      }

      return {
        acquired,
        release: async () => {
          // Only release if we own the lock
          const currentToken = await store.get<string>(lockKey);
          if (currentToken === token) {
            await store.forget(lockKey);
          }
        },
      };
    },

    async lockAndRun<T>(key: string, ttl: TTL, callback: () => Promise<T>): Promise<T> {
      const lock = await manager.lock(key, { timeout: ttl });

      if (!lock.acquired) {
        throw new Error(`Failed to acquire lock: ${key}`);
      }

      try {
        return await callback();
      } finally {
        await lock.release();
      }
    },

    async close(): Promise<void> {
      await store.close();
    },
  };

  return manager;
}

/**
 * Alias for createCacheManager.
 */
export const cache = createCacheManager;
