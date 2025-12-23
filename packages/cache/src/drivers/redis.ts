/**
 * Redis Cache Driver
 *
 * Redis cache implementation using ioredis.
 * Best for production and multi-instance deployments.
 */

import type { Redis } from 'ioredis';
import SuperJSON from 'superjson';

import type { RedisCacheConfig, TaggableCacheStore, TTL } from '../types.js';
import { parseTtl, prefixKey, tagKey } from '../utils.js';

/**
 * Default configuration for Redis cache.
 */
const DEFAULT_CONFIG: Required<Omit<RedisCacheConfig, 'driver' | 'url' | 'password'>> = {
  host: 'localhost',
  port: 6379,
  db: 0,
  prefix: 'velox:',
  defaultTtl: '1h',
};

/**
 * Create a Redis cache store.
 *
 * @param config - Redis cache configuration
 * @returns Cache store implementation
 *
 * @example
 * ```typescript
 * const cache = await createRedisCache({
 *   url: process.env.REDIS_URL,
 *   prefix: 'myapp:',
 * });
 *
 * await cache.put('user:123', { name: 'John' }, '30m');
 * const user = await cache.get('user:123');
 * ```
 */
export async function createRedisCache(
  config: Omit<RedisCacheConfig, 'driver'>
): Promise<TaggableCacheStore> {
  const options = { ...DEFAULT_CONFIG, ...config };

  // Dynamic import of ioredis to keep it optional
  const { Redis } = await import('ioredis');

  // Create Redis client
  const redis: Redis = config.url
    ? new Redis(config.url)
    : new Redis({
        host: options.host,
        port: options.port,
        password: config.password,
        db: options.db,
      });

  const prefix = options.prefix;

  /**
   * Get prefixed key.
   */
  function key(k: string): string {
    return prefixKey(k, prefix);
  }

  /**
   * Serialize a value for storage.
   */
  function serialize<T>(value: T): string {
    return SuperJSON.stringify(value);
  }

  /**
   * Deserialize a stored value.
   */
  function deserialize<T>(data: string): T {
    return SuperJSON.parse(data) as T;
  }

  /**
   * Get the effective TTL in seconds.
   */
  function getEffectiveTtl(ttl?: TTL): number {
    return parseTtl(ttl ?? options.defaultTtl);
  }

  const store: TaggableCacheStore = {
    async get<T>(k: string): Promise<T | null> {
      const data = await redis.get(key(k));

      if (data === null) {
        return null;
      }

      return deserialize<T>(data);
    },

    async put<T>(k: string, value: T, ttl?: TTL): Promise<void> {
      const ttlSeconds = getEffectiveTtl(ttl);
      await redis.setex(key(k), ttlSeconds, serialize(value));
    },

    async has(k: string): Promise<boolean> {
      const exists = await redis.exists(key(k));
      return exists === 1;
    },

    async forget(k: string): Promise<boolean> {
      const deleted = await redis.del(key(k));
      return deleted > 0;
    },

    async increment(k: string, value = 1): Promise<number> {
      const result = await redis.incrby(key(k), value);
      return result;
    },

    async decrement(k: string, value = 1): Promise<number> {
      const result = await redis.decrby(key(k), value);
      return result;
    },

    async flush(): Promise<void> {
      // Use SCAN instead of KEYS for production safety (KEYS is O(N) and blocks Redis)
      const pattern = `${prefix}*`;
      let cursor = '0';
      const batchSize = 100;

      do {
        // SCAN returns [cursor, keys[]]
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize);
        cursor = nextCursor;

        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
    },

    async many<T>(keys: string[]): Promise<Map<string, T | null>> {
      const result = new Map<string, T | null>();

      if (keys.length === 0) {
        return result;
      }

      const prefixedKeys = keys.map((k) => key(k));
      const values = await redis.mget(...prefixedKeys);

      for (let i = 0; i < keys.length; i++) {
        const data = values[i];
        result.set(keys[i], data !== null ? deserialize<T>(data) : null);
      }

      return result;
    },

    async putMany<T>(entries: Map<string, T>, ttl?: TTL): Promise<void> {
      const ttlSeconds = getEffectiveTtl(ttl);
      const pipeline = redis.pipeline();

      for (const [k, value] of entries) {
        pipeline.setex(key(k), ttlSeconds, serialize(value));
      }

      await pipeline.exec();
    },

    async add<T>(k: string, value: T, ttl?: TTL): Promise<boolean> {
      const ttlSeconds = getEffectiveTtl(ttl);
      // Use SET with NX (only set if not exists) and EX (expiry) - atomic operation
      const result = await redis.set(key(k), serialize(value), 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    },

    async putWithTags<T>(k: string, value: T, tags: string[], ttl?: TTL): Promise<void> {
      const ttlSeconds = getEffectiveTtl(ttl);
      const prefixedKey = key(k);
      const pipeline = redis.pipeline();

      // Store the value
      pipeline.setex(prefixedKey, ttlSeconds, serialize(value));

      // Add the key to each tag set
      for (const tag of tags) {
        pipeline.sadd(tagKey(tag, prefix), prefixedKey);
      }

      await pipeline.exec();
    },

    async flushTags(tags: string[]): Promise<void> {
      if (tags.length === 0) {
        return;
      }

      // Use pipeline to fetch all tag members in one round trip (avoids N+1 pattern)
      const tagSetKeys = tags.map((tag) => tagKey(tag, prefix));
      const fetchPipeline = redis.pipeline();

      for (const tagSetKey of tagSetKeys) {
        fetchPipeline.smembers(tagSetKey);
      }

      const results = await fetchPipeline.exec();

      // Collect all keys from all tags
      const keysToDelete: string[] = [];
      if (results) {
        for (const result of results) {
          // result is [error, value] tuple
          if (result && !result[0] && Array.isArray(result[1])) {
            keysToDelete.push(...(result[1] as string[]));
          }
        }
      }

      // Build deletion pipeline for tag sets and cached values
      const deletePipeline = redis.pipeline();

      // Delete all tag sets
      for (const tagSetKey of tagSetKeys) {
        deletePipeline.del(tagSetKey);
      }

      // Delete all the cached values
      if (keysToDelete.length > 0) {
        const uniqueKeys = [...new Set(keysToDelete)];
        deletePipeline.del(...uniqueKeys);
      }

      await deletePipeline.exec();
    },

    async close(): Promise<void> {
      await redis.quit();
    },
  };

  return store;
}

/**
 * Redis cache driver name.
 */
export const DRIVER_NAME = 'redis' as const;
