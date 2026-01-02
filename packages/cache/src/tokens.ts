/**
 * DI Tokens for @veloxts/cache
 *
 * Symbol-based tokens for type-safe dependency injection.
 * These tokens allow cache services to be registered, resolved, and mocked via the DI container.
 *
 * @module cache/tokens
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { CACHE_MANAGER, registerCacheProviders } from '@veloxts/cache';
 *
 * const container = new Container();
 * await registerCacheProviders(container, { driver: 'memory' });
 *
 * const cache = container.resolve(CACHE_MANAGER);
 * await cache.put('key', 'value', '1h');
 * ```
 */

import { token } from '@veloxts/core';

import type { CacheManager } from './manager.js';
import type { CachePluginOptions, TaggableCacheStore } from './types.js';

// ============================================================================
// Core Cache Tokens
// ============================================================================

/**
 * Cache manager token
 *
 * The main cache manager instance with get/put/remember/tags/lock support.
 *
 * @example
 * ```typescript
 * const cache = container.resolve(CACHE_MANAGER);
 * await cache.put('user:123', user, '30m');
 * const cached = await cache.get('user:123');
 * ```
 */
export const CACHE_MANAGER = token.symbol<CacheManager>('CACHE_MANAGER');

/**
 * Cache store token
 *
 * The underlying cache store (memory or Redis).
 * Use CACHE_MANAGER for high-level operations; use this for direct store access.
 *
 * @example
 * ```typescript
 * const store = container.resolve(CACHE_STORE);
 * await store.putWithTags('key', value, ['users'], '1h');
 * ```
 */
export const CACHE_STORE = token.symbol<TaggableCacheStore>('CACHE_STORE');

// ============================================================================
// Configuration Tokens
// ============================================================================

/**
 * Cache configuration token
 *
 * Contains cache plugin options including driver and driver-specific config.
 *
 * @example
 * ```typescript
 * const config = container.resolve(CACHE_CONFIG);
 * console.log(config.driver); // 'memory' or 'redis'
 * ```
 */
export const CACHE_CONFIG = token.symbol<CachePluginOptions>('CACHE_CONFIG');
