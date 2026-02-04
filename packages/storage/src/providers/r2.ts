/**
 * Cloudflare R2 Storage Provider
 *
 * Factory function that creates an S3-compatible storage store configured
 * for Cloudflare R2.
 */

import { z } from 'zod';

import { createS3Store } from '../drivers/s3.js';
import type { StorageStore } from '../types.js';

/**
 * Cloudflare R2 configuration schema.
 */
const R2ConfigSchema = z.object({
  /** R2 bucket name */
  bucket: z.string().min(1, 'Bucket name is required'),
  /** Cloudflare account ID */
  accountId: z.string().min(1, 'Account ID is required'),
  /** R2 API token access key ID */
  accessKeyId: z.string().min(1, 'Access key ID is required'),
  /** R2 API token secret access key */
  secretAccessKey: z.string().min(1, 'Secret access key is required'),
  /** Custom domain / CDN URL for public objects */
  publicUrl: z.string().url().optional(),
  /** Regional jurisdiction (affects endpoint URL) */
  jurisdiction: z.enum(['eu', 'fedramp']).optional(),
  /** Key prefix for all operations */
  prefix: z.string().optional(),
});

/**
 * Cloudflare R2 configuration options.
 */
export type R2Config = z.infer<typeof R2ConfigSchema>;

/**
 * Create a Cloudflare R2 storage store.
 *
 * @param config - R2 configuration
 * @returns Storage store implementation
 *
 * @example
 * ```typescript
 * import { r2 } from '@veloxts/storage/providers/r2';
 *
 * const storage = await r2({
 *   bucket: 'my-bucket',
 *   accountId: process.env.CF_ACCOUNT_ID!,
 *   accessKeyId: process.env.R2_ACCESS_KEY_ID!,
 *   secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
 *   publicUrl: 'https://cdn.example.com',
 * });
 *
 * await storage.init();
 * await storage.put('uploads/file.txt', 'Hello World');
 * ```
 */
export async function r2(config: R2Config): Promise<StorageStore> {
  // Validate configuration with Zod
  const validated = R2ConfigSchema.parse(config);

  // Build R2 endpoint URL
  // Format: https://{accountId}[.{jurisdiction}].r2.cloudflarestorage.com
  const jurisdictionPart = validated.jurisdiction ? `.${validated.jurisdiction}` : '';
  const endpoint = `https://${validated.accountId}${jurisdictionPart}.r2.cloudflarestorage.com`;

  // Create S3-compatible store with R2-specific configuration
  return createS3Store({
    driver: 's3',
    bucket: validated.bucket,
    region: 'auto', // R2 always uses 'auto' region
    endpoint,
    accessKeyId: validated.accessKeyId,
    secretAccessKey: validated.secretAccessKey,
    forcePathStyle: false, // R2 uses virtual-hosted style URLs
    prefix: validated.prefix,
    publicUrl: validated.publicUrl,
  });
}

/**
 * R2 provider name identifier.
 */
export const PROVIDER_NAME = 'r2' as const;
