/**
 * Storage Plugin
 *
 * Fastify plugin for file storage integration.
 * Extends BaseContext with storage manager access.
 */

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

// Side-effect import for declaration merging
import '@veloxts/core';

import { createStorageManager, type StorageManager } from './manager.js';
import type { StoragePluginOptions } from './types.js';

/**
 * Extend BaseContext with storage manager.
 *
 * After registering the storage plugin, `ctx.storage` becomes available
 * in all procedures:
 *
 * @example
 * ```typescript
 * const uploadFile = procedure
 *   .input(z.object({ fileName: z.string() }))
 *   .mutation(async ({ input, ctx }) => {
 *     await ctx.storage.put(`uploads/${input.fileName}`, buffer);
 *     return { success: true };
 *   });
 * ```
 */
declare module '@veloxts/core' {
  interface BaseContext {
    /** Storage manager for file operations */
    storage: StorageManager;
  }
}

/**
 * Symbol for accessing storage from Fastify instance.
 */
const STORAGE_KEY = Symbol.for('velox.storage');

/**
 * Storage plugin for Fastify.
 *
 * Registers a storage manager and makes it available on request context.
 *
 * @param options - Storage plugin options (driver configuration)
 *
 * @example
 * ```typescript
 * import { storagePlugin } from '@veloxts/storage';
 *
 * // Local filesystem (development)
 * app.register(storagePlugin, {
 *   driver: 'local',
 *   root: './storage',
 *   baseUrl: 'http://localhost:3030/files',
 * });
 *
 * // AWS S3 (production)
 * app.register(storagePlugin, {
 *   driver: 's3',
 *   bucket: process.env.S3_BUCKET,
 *   region: process.env.AWS_REGION,
 * });
 *
 * // Cloudflare R2
 * app.register(storagePlugin, {
 *   driver: 's3',
 *   bucket: process.env.R2_BUCKET,
 *   region: 'auto',
 *   endpoint: process.env.R2_ENDPOINT,
 *   accessKeyId: process.env.R2_ACCESS_KEY_ID,
 *   secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
 * });
 * ```
 */
export function storagePlugin(options: StoragePluginOptions = {}) {
  return fp(
    async (fastify: FastifyInstance) => {
      // Create storage manager
      const storage = await createStorageManager(options);

      // Store on fastify instance
      (fastify as unknown as Record<symbol, StorageManager>)[STORAGE_KEY] = storage;

      // Decorate request with storage accessor
      fastify.decorateRequest('storage', {
        getter() {
          return storage;
        },
      });

      // Register cleanup hook
      fastify.addHook('onClose', async () => {
        await storage.close();
      });
    },
    {
      name: '@veloxts/storage',
      fastify: '5.x',
    }
  );
}

/**
 * Get the storage manager from a Fastify instance.
 *
 * @param fastify - Fastify instance
 * @returns Storage manager
 * @throws If storage plugin is not registered
 *
 * @example
 * ```typescript
 * const storage = getStorageFromInstance(fastify);
 * await storage.put('test.txt', 'Hello World');
 * ```
 */
export function getStorageFromInstance(fastify: FastifyInstance): StorageManager {
  const storage = (fastify as unknown as Record<symbol, StorageManager>)[STORAGE_KEY];

  if (!storage) {
    throw new Error(
      'Storage plugin not registered. Register it with: app.register(storagePlugin, { ... })'
    );
  }

  return storage;
}

// =============================================================================
// Standalone Storage (outside Fastify context)
// =============================================================================

/**
 * Singleton storage instance for standalone usage.
 */
let standaloneStorage: StorageManager | null = null;

/**
 * Get or create a standalone storage manager.
 *
 * This is useful when you need storage access outside of a Fastify request
 * context, such as in CLI commands, background jobs, or scripts.
 *
 * @param options - Storage options (only used on first call)
 * @returns Storage manager instance
 *
 * @example
 * ```typescript
 * import { getStorage } from '@veloxts/storage';
 *
 * // In a background job
 * const storage = await getStorage({ driver: 'local', root: './storage' });
 * await storage.put('reports/daily.pdf', pdfBuffer);
 * ```
 */
export async function getStorage(options?: StoragePluginOptions): Promise<StorageManager> {
  if (!standaloneStorage) {
    standaloneStorage = await createStorageManager(options ?? {});
  }
  return standaloneStorage;
}

/**
 * Close the standalone storage instance.
 *
 * Call this when shutting down your application to release resources.
 *
 * @example
 * ```typescript
 * import { closeStorage } from '@veloxts/storage';
 *
 * // On shutdown
 * await closeStorage();
 * ```
 */
export async function closeStorage(): Promise<void> {
  if (standaloneStorage) {
    await standaloneStorage.close();
    standaloneStorage = null;
  }
}

/**
 * Reset the standalone storage instance.
 * Primarily used for testing.
 *
 * @deprecated Use `closeStorage()` instead. Will be removed in v2.0.
 */
export async function _resetStandaloneStorage(): Promise<void> {
  await closeStorage();
}
