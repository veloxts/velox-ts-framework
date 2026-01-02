/**
 * DI Providers for @veloxts/storage
 *
 * Factory provider functions for registering storage services with the DI container.
 * These providers allow services to be managed by the container for testability and flexibility.
 *
 * @module storage/providers
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerStorageProviders, STORAGE_MANAGER } from '@veloxts/storage';
 *
 * const container = new Container();
 * await registerStorageProviders(container, {
 *   driver: 'local',
 *   config: { root: './uploads' },
 * });
 *
 * const storage = container.resolve(STORAGE_MANAGER);
 * await storage.put('file.txt', Buffer.from('Hello'));
 * ```
 */

import type { Container } from '@veloxts/core';

import { createStorageManager } from './manager.js';
import { STORAGE_CONFIG, STORAGE_MANAGER } from './tokens.js';
import type { StoragePluginOptions } from './types.js';

// ============================================================================
// Bulk Registration Helpers
// ============================================================================

/**
 * Registers storage providers with a container
 *
 * This handles async initialization of the storage manager and registers
 * the resolved instance directly for synchronous resolution.
 *
 * @param container - The DI container to register providers with
 * @param config - Storage plugin options (driver, config, etc.)
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerStorageProviders, STORAGE_MANAGER } from '@veloxts/storage';
 *
 * const container = new Container();
 *
 * // Local filesystem driver
 * await registerStorageProviders(container, {
 *   driver: 'local',
 *   config: { root: './uploads', baseUrl: '/files' },
 * });
 *
 * // S3-compatible driver (AWS S3, Cloudflare R2, MinIO)
 * await registerStorageProviders(container, {
 *   driver: 's3',
 *   config: {
 *     bucket: 'my-bucket',
 *     region: 'us-east-1',
 *     credentials: {
 *       accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
 *       secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
 *     },
 *   },
 * });
 *
 * const storage = container.resolve(STORAGE_MANAGER);
 * await storage.put('avatars/user-123.jpg', imageBuffer);
 * ```
 */
export async function registerStorageProviders(
  container: Container,
  config: StoragePluginOptions = {}
): Promise<void> {
  // Register config
  container.register({
    provide: STORAGE_CONFIG,
    useValue: config,
  });

  // Create storage manager (async operation)
  const storageManager = await createStorageManager(config);

  // Register the resolved storage manager instance directly
  // This allows synchronous resolution from the container
  container.register({
    provide: STORAGE_MANAGER,
    useValue: storageManager,
  });
}
