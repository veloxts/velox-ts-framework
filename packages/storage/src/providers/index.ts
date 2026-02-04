/**
 * Storage Providers
 *
 * Re-exports all storage provider factory functions.
 *
 * @example
 * ```typescript
 * import { r2, minio } from '@veloxts/storage/providers';
 *
 * // Cloudflare R2
 * const r2Storage = await r2({
 *   bucket: 'my-bucket',
 *   accountId: 'xxx',
 *   accessKeyId: 'xxx',
 *   secretAccessKey: 'xxx',
 * });
 *
 * // MinIO
 * const minioStorage = await minio({
 *   bucket: 'my-bucket',
 *   endpoint: 'http://localhost:9000',
 *   accessKeyId: 'minioadmin',
 *   secretAccessKey: 'minioadmin',
 * });
 * ```
 */

// Re-export the base drivers for convenience
export { createLocalStore, DRIVER_NAME as LOCAL_DRIVER } from '../drivers/local.js';
export { createS3Store, DRIVER_NAME as S3_DRIVER } from '../drivers/s3.js';
// Provider factories
export { type MinIOConfig, minio, PROVIDER_NAME as MINIO_PROVIDER } from './minio.js';
export { PROVIDER_NAME as R2_PROVIDER, type R2Config, r2 } from './r2.js';
