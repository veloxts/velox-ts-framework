/**
 * DI Tokens for @veloxts/storage
 *
 * Symbol-based tokens for type-safe dependency injection.
 * These tokens allow storage services to be registered, resolved, and mocked via the DI container.
 *
 * @module storage/tokens
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { STORAGE_MANAGER, registerStorageProviders } from '@veloxts/storage';
 *
 * const container = new Container();
 * await registerStorageProviders(container, { driver: 'local', config: { root: './uploads' } });
 *
 * const storage = container.resolve(STORAGE_MANAGER);
 * await storage.put('file.txt', Buffer.from('Hello'));
 * ```
 */

import { token } from '@veloxts/core';

import type { StorageManager } from './manager.js';
import type { StoragePluginOptions, StorageStore } from './types.js';

// ============================================================================
// Core Storage Tokens
// ============================================================================

/**
 * Storage manager token
 *
 * The main storage manager instance for file operations.
 *
 * @example
 * ```typescript
 * const storage = container.resolve(STORAGE_MANAGER);
 * await storage.put('avatars/user-123.jpg', imageBuffer);
 * const url = await storage.url('avatars/user-123.jpg');
 * ```
 */
export const STORAGE_MANAGER = token.symbol<StorageManager>('STORAGE_MANAGER');

/**
 * Storage store token
 *
 * The underlying storage driver (local filesystem or S3-compatible).
 * Use STORAGE_MANAGER for high-level operations; use this for direct driver access.
 *
 * @example
 * ```typescript
 * const store = container.resolve(STORAGE_STORE);
 * await store.put('file.txt', Buffer.from('content'), { visibility: 'public' });
 * ```
 */
export const STORAGE_STORE = token.symbol<StorageStore>('STORAGE_STORE');

// ============================================================================
// Configuration Tokens
// ============================================================================

/**
 * Storage configuration token
 *
 * Contains storage plugin options including driver and driver-specific config.
 *
 * @example
 * ```typescript
 * const config = container.resolve(STORAGE_CONFIG);
 * console.log(config.driver); // 'local' or 's3'
 * ```
 */
export const STORAGE_CONFIG = token.symbol<StoragePluginOptions>('STORAGE_CONFIG');
