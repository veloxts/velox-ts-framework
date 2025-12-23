/**
 * Memory Cache Driver
 *
 * In-memory cache implementation using LRU-cache.
 * Best for development or single-instance deployments.
 */

import { LRUCache } from 'lru-cache';
import SuperJSON from 'superjson';

import type { MemoryCacheConfig, TaggableCacheStore, TTL } from '../types.js';
import { calculateExpiration, isExpired } from '../utils.js';

/**
 * Internal cache entry structure.
 */
interface MemoryCacheEntry {
  value: string; // Serialized value
  expiresAt: number | null;
  tags: string[];
}

/**
 * Default configuration for memory cache.
 */
const DEFAULT_CONFIG: Required<Omit<MemoryCacheConfig, 'driver'>> = {
  maxSize: 1000,
  maxSizeBytes: undefined as unknown as number,
  defaultTtl: '1h',
};

/**
 * Create a memory cache store.
 *
 * @param config - Memory cache configuration
 * @returns Cache store implementation
 *
 * @example
 * ```typescript
 * const cache = createMemoryCache({ maxSize: 500 });
 *
 * await cache.put('user:123', { name: 'John' }, '30m');
 * const user = await cache.get('user:123');
 * ```
 */
export function createMemoryCache(
  config: Omit<MemoryCacheConfig, 'driver'> = {}
): TaggableCacheStore {
  const options = { ...DEFAULT_CONFIG, ...config };

  // Create LRU cache
  const cache = new LRUCache<string, MemoryCacheEntry>({
    max: options.maxSize,
    // Custom TTL handling - we manage expiration ourselves for tag support
    ttl: 0,
    // Size calculation if maxSizeBytes is set
    ...(options.maxSizeBytes && {
      maxSize: options.maxSizeBytes,
      sizeCalculation: (entry) => Buffer.byteLength(entry.value, 'utf8'),
    }),
  });

  // Tag to keys mapping
  const tagToKeys = new Map<string, Set<string>>();

  // Cleanup interval reference for proper disposal
  let cleanupInterval: ReturnType<typeof setInterval> | null = null;

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
   * Get the effective TTL.
   */
  function getEffectiveTtl(ttl?: TTL): TTL {
    return ttl ?? options.defaultTtl;
  }

  /**
   * Clean up expired entries.
   */
  function cleanupExpired(): void {
    for (const [key, entry] of cache.entries()) {
      if (isExpired(entry.expiresAt)) {
        cache.delete(key);
        // Clean up tag mappings
        for (const tag of entry.tags) {
          const keys = tagToKeys.get(tag);
          if (keys) {
            keys.delete(key);
            if (keys.size === 0) {
              tagToKeys.delete(tag);
            }
          }
        }
      }
    }
  }

  /**
   * Add a key to tag mappings.
   */
  function addToTags(key: string, tags: string[]): void {
    for (const tag of tags) {
      let keys = tagToKeys.get(tag);
      if (!keys) {
        keys = new Set();
        tagToKeys.set(tag, keys);
      }
      keys.add(key);
    }
  }

  /**
   * Remove a key from tag mappings.
   */
  function removeFromTags(key: string, tags: string[]): void {
    for (const tag of tags) {
      const keys = tagToKeys.get(tag);
      if (keys) {
        keys.delete(key);
        if (keys.size === 0) {
          tagToKeys.delete(tag);
        }
      }
    }
  }

  const store: TaggableCacheStore = {
    async get<T>(key: string): Promise<T | null> {
      const entry = cache.get(key);

      if (!entry) {
        return null;
      }

      // Check if expired
      if (isExpired(entry.expiresAt)) {
        cache.delete(key);
        removeFromTags(key, entry.tags);
        return null;
      }

      return deserialize<T>(entry.value);
    },

    async put<T>(key: string, value: T, ttl?: TTL): Promise<void> {
      const effectiveTtl = getEffectiveTtl(ttl);
      const expiresAt = calculateExpiration(effectiveTtl);

      // Remove old entry's tags if it exists
      const existing = cache.get(key);
      if (existing) {
        removeFromTags(key, existing.tags);
      }

      const entry: MemoryCacheEntry = {
        value: serialize(value),
        expiresAt,
        tags: [],
      };

      cache.set(key, entry);
    },

    async has(key: string): Promise<boolean> {
      const entry = cache.get(key);

      if (!entry) {
        return false;
      }

      // Check if expired
      if (isExpired(entry.expiresAt)) {
        cache.delete(key);
        removeFromTags(key, entry.tags);
        return false;
      }

      return true;
    },

    async forget(key: string): Promise<boolean> {
      const entry = cache.get(key);

      if (entry) {
        removeFromTags(key, entry.tags);
      }

      return cache.delete(key);
    },

    async increment(key: string, value = 1): Promise<number> {
      // Optimized: Direct entry manipulation avoids serialization overhead
      const entry = cache.get(key);
      let currentValue = 0;

      if (entry && !isExpired(entry.expiresAt)) {
        // Entry exists and not expired - get current numeric value
        currentValue = deserialize<number>(entry.value) ?? 0;
      }

      const newValue = currentValue + value;

      // Update with same TTL characteristics
      const effectiveTtl = getEffectiveTtl();
      const expiresAt = calculateExpiration(effectiveTtl);

      cache.set(key, {
        value: serialize(newValue),
        expiresAt,
        tags: entry?.tags ?? [],
      });

      return newValue;
    },

    async decrement(key: string, value = 1): Promise<number> {
      // Optimized: Direct entry manipulation avoids serialization overhead
      const entry = cache.get(key);
      let currentValue = 0;

      if (entry && !isExpired(entry.expiresAt)) {
        // Entry exists and not expired - get current numeric value
        currentValue = deserialize<number>(entry.value) ?? 0;
      }

      const newValue = currentValue - value;

      // Update with same TTL characteristics
      const effectiveTtl = getEffectiveTtl();
      const expiresAt = calculateExpiration(effectiveTtl);

      cache.set(key, {
        value: serialize(newValue),
        expiresAt,
        tags: entry?.tags ?? [],
      });

      return newValue;
    },

    async flush(): Promise<void> {
      cache.clear();
      tagToKeys.clear();
    },

    async many<T>(keys: string[]): Promise<Map<string, T | null>> {
      const result = new Map<string, T | null>();

      if (keys.length === 0) {
        return result;
      }

      // Process all keys in parallel for better performance
      const values = await Promise.all(keys.map((key) => store.get<T>(key)));

      for (let i = 0; i < keys.length; i++) {
        result.set(keys[i], values[i]);
      }

      return result;
    },

    async putMany<T>(entries: Map<string, T>, ttl?: TTL): Promise<void> {
      if (entries.size === 0) {
        return;
      }

      // Process all entries in parallel for better performance
      await Promise.all(
        Array.from(entries.entries()).map(([key, value]) => store.put(key, value, ttl))
      );
    },

    async add<T>(key: string, value: T, ttl?: TTL): Promise<boolean> {
      // Atomic check-and-set (safe in single-threaded Node.js)
      const existing = cache.get(key);

      // Check if key exists and is not expired
      if (existing && !isExpired(existing.expiresAt)) {
        return false;
      }

      // If expired, clean up first
      if (existing) {
        removeFromTags(key, existing.tags);
      }

      const effectiveTtl = getEffectiveTtl(ttl);
      const expiresAt = calculateExpiration(effectiveTtl);

      const entry: MemoryCacheEntry = {
        value: serialize(value),
        expiresAt,
        tags: [],
      };

      cache.set(key, entry);
      return true;
    },

    async putWithTags<T>(key: string, value: T, tags: string[], ttl?: TTL): Promise<void> {
      const effectiveTtl = getEffectiveTtl(ttl);
      const expiresAt = calculateExpiration(effectiveTtl);

      // Remove old entry's tags if it exists
      const existing = cache.get(key);
      if (existing) {
        removeFromTags(key, existing.tags);
      }

      const entry: MemoryCacheEntry = {
        value: serialize(value),
        expiresAt,
        tags,
      };

      cache.set(key, entry);
      addToTags(key, tags);
    },

    async flushTags(tags: string[]): Promise<void> {
      for (const tag of tags) {
        const keys = tagToKeys.get(tag);
        if (keys) {
          for (const key of keys) {
            cache.delete(key);
          }
          tagToKeys.delete(tag);
        }
      }
    },

    async close(): Promise<void> {
      // Clear the cleanup interval first
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
      }
      cache.clear();
      tagToKeys.clear();
    },
  };

  // Periodic cleanup of expired entries (every 60 seconds)
  cleanupInterval = setInterval(cleanupExpired, 60000);
  cleanupInterval.unref(); // Don't prevent process exit

  return store;
}

/**
 * Memory cache driver name.
 */
export const DRIVER_NAME = 'memory' as const;
