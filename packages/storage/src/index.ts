/**
 * @veloxts/storage
 *
 * Multi-driver file storage abstraction for VeloxTS framework.
 *
 * Features:
 * - Unified API across all storage backends
 * - Local filesystem driver for development
 * - S3-compatible driver (AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces)
 * - File visibility (public/private)
 * - Signed URLs for temporary access
 * - Streaming support for large files
 *
 * @example
 * ```typescript
 * import { storagePlugin } from '@veloxts/storage';
 *
 * // Register plugin
 * app.register(storagePlugin, {
 *   driver: 's3',
 *   bucket: 'my-bucket',
 *   region: 'us-east-1',
 * });
 *
 * // Use in procedures
 * const uploadAvatar = procedure
 *   .input(z.object({ userId: z.string() }))
 *   .mutation(async ({ input, ctx }) => {
 *     const path = `avatars/${input.userId}.jpg`;
 *     await ctx.storage.put(path, imageBuffer, {
 *       visibility: 'public',
 *       contentType: 'image/jpeg',
 *     });
 *     return { url: await ctx.storage.url(path) };
 *   });
 * ```
 *
 * @packageDocumentation
 */

// Drivers
export { createLocalStore, DRIVER_NAME as LOCAL_DRIVER } from './drivers/local.js';
export { createS3Store, DRIVER_NAME as S3_DRIVER } from './drivers/s3.js';
// Errors
export {
  FileExistsError,
  FileNotFoundError,
  InvalidPathError,
  isFileNotFoundError,
  isPermissionDeniedError,
  isStorageError,
  PermissionDeniedError,
  QuotaExceededError,
  S3Error,
  StorageConfigError,
  StorageError,
} from './errors.js';
// Manager
export { createStorageManager, type StorageManager, storage } from './manager.js';
// Plugin
export {
  _resetStandaloneStorage,
  closeStorage,
  getStorage,
  getStorageFromInstance,
  storagePlugin,
} from './plugin.js';
// Types
export type {
  CopyOptions,
  FileMetadata,
  FileVisibility,
  GetOptions,
  ListOptions,
  ListResult,
  // Config types (discriminated unions)
  LocalStorageConfig,
  // Options
  PutOptions,
  S3StorageConfig,
  SignedUrlOptions,
  // Plugin options
  StorageBaseOptions,
  StorageConfig,
  StorageDefaultOptions,
  // Driver types
  StorageDriver,
  StorageLocalOptions,
  StorageManagerOptions,
  StoragePluginOptions,
  StorageS3Options,
  // Store interface
  StorageStore,
} from './types.js';
/**
 * Utility functions for storage operations.
 *
 * @deprecated Import from '@veloxts/storage/utils' instead. Will be removed in v2.0.
 *
 * @example
 * ```typescript
 * // Old (deprecated):
 * import { formatBytes, detectMimeType } from '@veloxts/storage';
 *
 * // New:
 * import { formatBytes, detectMimeType } from '@veloxts/storage/utils';
 * ```
 */
export {
  basename,
  detectMimeType,
  dirname,
  extname,
  formatBytes,
  joinPath,
  normalizePath,
  uniqueFileName,
  validatePath,
} from './utils.js';

// ============================================================================
// Dependency Injection
// ============================================================================

/**
 * DI tokens and providers for @veloxts/storage
 *
 * Use these to integrate storage services with the @veloxts/core DI container.
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

// Provider exports - factory functions for registering services
export { registerStorageProviders } from './providers.js';
// Token exports - unique identifiers for DI resolution
export { STORAGE_CONFIG, STORAGE_MANAGER, STORAGE_STORE } from './tokens.js';
