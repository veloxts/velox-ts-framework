/**
 * Cache Types
 *
 * Type definitions for the VeloxTS caching system.
 */

/**
 * Supported cache drivers.
 */
export type CacheDriver = 'memory' | 'redis';

/**
 * Duration string format (e.g., '1h', '30m', '1d').
 */
export type DurationString =
  | `${number}s`
  | `${number}m`
  | `${number}h`
  | `${number}d`
  | `${number}w`;

/**
 * TTL can be specified as seconds (number) or a duration string.
 */
export type TTL = number | DurationString;

/**
 * Configuration for the memory cache driver.
 */
export interface MemoryCacheConfig {
  driver: 'memory';
  /**
   * Maximum number of items to store in cache.
   * @default 1000
   */
  maxSize?: number;
  /**
   * Maximum size in bytes (if items have size).
   */
  maxSizeBytes?: number;
  /**
   * Default TTL for cache entries.
   * @default '1h'
   */
  defaultTtl?: TTL;
}

/**
 * Configuration for the Redis cache driver.
 */
export interface RedisCacheConfig {
  driver: 'redis';
  /**
   * Redis connection URL.
   */
  url?: string;
  /**
   * Redis host.
   * @default 'localhost'
   */
  host?: string;
  /**
   * Redis port.
   * @default 6379
   */
  port?: number;
  /**
   * Redis password.
   */
  password?: string;
  /**
   * Redis database number.
   * @default 0
   */
  db?: number;
  /**
   * Key prefix for all cache entries.
   * @default 'velox:'
   */
  prefix?: string;
  /**
   * Default TTL for cache entries.
   * @default '1h'
   */
  defaultTtl?: TTL;
}

/**
 * Union of all cache configurations.
 */
export type CacheConfig = MemoryCacheConfig | RedisCacheConfig;

/**
 * Options for cache operations.
 */
export interface CacheOptions {
  /**
   * Time-to-live for the cache entry.
   */
  ttl?: TTL;
  /**
   * Tags for grouped cache invalidation.
   */
  tags?: string[];
}

/**
 * Cache entry with metadata.
 */
export interface CacheEntry<T = unknown> {
  /**
   * The cached value.
   */
  value: T;
  /**
   * Expiration timestamp in milliseconds.
   */
  expiresAt: number | null;
  /**
   * Tags associated with this entry.
   */
  tags?: string[];
}

/**
 * Interface for cache driver implementations.
 */
export interface CacheStore {
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
   * Store a value only if the key doesn't exist (atomic operation).
   * @returns true if the value was stored, false if key already exists
   */
  add<T>(key: string, value: T, ttl?: TTL): Promise<boolean>;

  /**
   * Close the cache connection (if applicable).
   */
  close(): Promise<void>;
}

/**
 * Extended cache store with tag support.
 */
export interface TaggableCacheStore extends CacheStore {
  /**
   * Store a value with tags.
   */
  putWithTags<T>(key: string, value: T, tags: string[], ttl?: TTL): Promise<void>;

  /**
   * Flush all entries with the given tags.
   */
  flushTags(tags: string[]): Promise<void>;
}

/**
 * Lock options for distributed locking.
 */
export interface LockOptions {
  /**
   * Lock timeout in seconds or duration string.
   */
  timeout: TTL;
  /**
   * Retry interval in milliseconds.
   * @default 100
   */
  retryInterval?: number;
  /**
   * Maximum number of retry attempts.
   * @default 100
   */
  maxRetries?: number;
}

/**
 * Result of a lock acquisition attempt.
 */
export interface LockResult {
  /**
   * Whether the lock was acquired.
   */
  acquired: boolean;
  /**
   * Release the lock.
   */
  release: () => Promise<void>;
}

/**
 * Base options shared across all cache configurations.
 */
export interface CacheBaseOptions {
  /**
   * Key prefix for all cache entries.
   * @default 'velox:'
   */
  prefix?: string;

  /**
   * Default TTL for cache entries.
   * @default '1h'
   */
  defaultTtl?: TTL;
}

/**
 * Cache plugin options with memory driver.
 */
export interface CacheMemoryOptions extends CacheBaseOptions {
  /**
   * Cache driver to use.
   */
  driver: 'memory';

  /**
   * Memory driver-specific configuration.
   */
  config?: Omit<MemoryCacheConfig, 'driver'>;
}

/**
 * Cache plugin options with Redis driver.
 */
export interface CacheRedisOptions extends CacheBaseOptions {
  /**
   * Cache driver to use.
   */
  driver: 'redis';

  /**
   * Redis driver-specific configuration.
   */
  config?: Omit<RedisCacheConfig, 'driver'>;
}

/**
 * Cache plugin options with default driver (memory).
 * When no driver is specified, memory is used as the default.
 */
export interface CacheDefaultOptions extends CacheBaseOptions {
  /**
   * Cache driver to use.
   * @default 'memory'
   */
  driver?: undefined;

  /**
   * Memory driver-specific configuration (default driver).
   */
  config?: Omit<MemoryCacheConfig, 'driver'>;
}

/**
 * Cache plugin options - discriminated union for type-safe driver configuration.
 *
 * The config type automatically narrows based on the selected driver:
 * - `driver: 'memory'` - config is MemoryCacheConfig (optional)
 * - `driver: 'redis'` - config is RedisCacheConfig (optional)
 * - no driver - defaults to memory, config is MemoryCacheConfig (optional)
 *
 * @example
 * ```typescript
 * // Memory driver (explicit)
 * cachePlugin({ driver: 'memory', config: { maxSize: 1000 } });
 *
 * // Redis driver
 * cachePlugin({ driver: 'redis', config: { url: 'redis://...' } });
 *
 * // Default (memory)
 * cachePlugin({ prefix: 'myapp:' });
 * ```
 */
export type CachePluginOptions = CacheMemoryOptions | CacheRedisOptions | CacheDefaultOptions;

/**
 * Cache manager options - same discriminated union for standalone usage.
 */
export type CacheManagerOptions = CachePluginOptions;
