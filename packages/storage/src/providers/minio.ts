/**
 * MinIO Storage Provider
 *
 * Factory function that creates an S3-compatible storage store configured
 * for MinIO.
 */

import { z } from 'zod';

import { createS3Store } from '../drivers/s3.js';
import type { StorageStore } from '../types.js';

/**
 * MinIO configuration schema.
 */
const MinIOConfigSchema = z.object({
  /** MinIO bucket name */
  bucket: z.string().min(1, 'Bucket name is required'),
  /** MinIO endpoint (e.g., 'http://localhost:9000') */
  endpoint: z.string().url('Endpoint must be a valid URL'),
  /** MinIO access key ID */
  accessKeyId: z.string().min(1, 'Access key ID is required'),
  /** MinIO secret access key */
  secretAccessKey: z.string().min(1, 'Secret access key is required'),
  /** AWS region (default: 'us-east-1') */
  region: z.string().default('us-east-1'),
  /** Custom public URL for accessing files */
  publicUrl: z.string().url().optional(),
  /** Key prefix for all operations */
  prefix: z.string().optional(),
});

/**
 * MinIO configuration options.
 */
export type MinIOConfig = z.input<typeof MinIOConfigSchema>;

/**
 * Create a MinIO storage store.
 *
 * @param config - MinIO configuration
 * @returns Storage store implementation
 *
 * @example
 * ```typescript
 * import { minio } from '@veloxts/storage/providers/minio';
 *
 * const storage = await minio({
 *   bucket: 'my-bucket',
 *   endpoint: 'http://localhost:9000',
 *   accessKeyId: 'minioadmin',
 *   secretAccessKey: 'minioadmin',
 * });
 *
 * await storage.init();
 * await storage.put('uploads/file.txt', 'Hello World');
 * ```
 */
export async function minio(config: MinIOConfig): Promise<StorageStore> {
  // Validate configuration with Zod
  const validated = MinIOConfigSchema.parse(config);

  // Create S3-compatible store with MinIO-specific configuration
  return createS3Store({
    driver: 's3',
    bucket: validated.bucket,
    region: validated.region,
    endpoint: validated.endpoint,
    accessKeyId: validated.accessKeyId,
    secretAccessKey: validated.secretAccessKey,
    forcePathStyle: true, // MinIO requires path-style URLs
    prefix: validated.prefix,
    publicUrl: validated.publicUrl,
  });
}

/**
 * MinIO provider name identifier.
 */
export const PROVIDER_NAME = 'minio' as const;
