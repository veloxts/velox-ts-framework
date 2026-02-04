/**
 * S3 Driver
 *
 * S3-compatible file storage implementation.
 * Works with AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, and other S3-compatible services.
 */

import type { Readable } from 'node:stream';

import { StorageObjectNotFoundError } from '../errors.js';
import type {
  CopyOptions,
  FileMetadata,
  FileVisibility,
  GetOptions,
  ListOptions,
  ListResult,
  PutOptions,
  S3StorageConfig,
  SignedUploadOptions,
  SignedUrlOptions,
  StorageStore,
} from '../types.js';
import {
  detectMimeType,
  isReadableStream,
  joinPath,
  normalizePath,
  streamToBuffer, // Still needed for get()
  toBuffer,
  validatePath,
} from '../utils.js';

/**
 * Default configuration for S3 storage.
 */
const DEFAULT_CONFIG: Partial<S3StorageConfig> = {
  defaultVisibility: 'private',
  forcePathStyle: false,
};

/**
 * Create an S3-compatible storage store.
 *
 * @param config - S3 storage configuration
 * @returns Storage store implementation
 *
 * @example
 * ```typescript
 * // AWS S3
 * const store = await createS3Store({
 *   driver: 's3',
 *   bucket: 'my-bucket',
 *   region: 'us-east-1',
 * });
 *
 * // Cloudflare R2
 * const r2Store = await createS3Store({
 *   driver: 's3',
 *   bucket: 'my-bucket',
 *   region: 'auto',
 *   endpoint: 'https://xxx.r2.cloudflarestorage.com',
 *   accessKeyId: process.env.R2_ACCESS_KEY_ID,
 *   secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
 * });
 *
 * // MinIO
 * const minioStore = await createS3Store({
 *   driver: 's3',
 *   bucket: 'my-bucket',
 *   region: 'us-east-1',
 *   endpoint: 'http://localhost:9000',
 *   forcePathStyle: true,
 * });
 * ```
 */
export async function createS3Store(config: S3StorageConfig): Promise<StorageStore> {
  const options = { ...DEFAULT_CONFIG, ...config };
  const {
    bucket,
    region,
    endpoint,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
    defaultVisibility,
    prefix,
    publicUrl,
  } = options;

  // Dynamic import of AWS SDK (peer dependency)
  const {
    S3Client,
    CopyObjectCommand,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
  } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

  // Create S3 client
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials:
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
          }
        : undefined,
  });

  /**
   * Get the full S3 key with optional prefix.
   */
  function getKey(path: string): string {
    validatePath(path);
    const normalized = normalizePath(path);
    return prefix ? joinPath(prefix, normalized) : normalized;
  }

  /**
   * Remove the prefix from an S3 key to get the path.
   */
  function keyToPath(key: string): string {
    if (prefix && key.startsWith(`${prefix}/`)) {
      return key.slice(prefix.length + 1);
    }
    return key;
  }

  /**
   * Convert visibility to S3 ACL.
   */
  function visibilityToAcl(visibility: FileVisibility): 'public-read' | 'private' {
    return visibility === 'public' ? 'public-read' : 'private';
  }

  /**
   * Get base URL for public access.
   */
  function getBaseUrl(): string {
    if (endpoint) {
      // Custom endpoint (R2, MinIO, etc.)
      if (forcePathStyle) {
        return `${endpoint}/${bucket}`;
      }
      // Virtual-hosted style
      const url = new URL(endpoint);
      return `${url.protocol}//${bucket}.${url.host}`;
    }
    // Standard AWS S3
    return `https://${bucket}.s3.${region}.amazonaws.com`;
  }

  // Import Upload for streaming multipart uploads (prevents memory exhaustion for large files)
  const { Upload } = await import('@aws-sdk/lib-storage');

  const store: StorageStore = {
    async init(): Promise<void> {
      // Verify connectivity by listing a single object
      try {
        await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            MaxKeys: 1,
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`S3 storage init failed for bucket "${bucket}": ${message}`);
      }
    },

    async put(
      path: string,
      content: Buffer | string | Readable,
      putOptions: PutOptions = {}
    ): Promise<string> {
      const key = getKey(path);
      const visibility = putOptions.visibility ?? defaultVisibility ?? 'private';

      // For streams, use multipart upload to avoid buffering entire file in memory
      // This prevents memory exhaustion for large files (100MB+)
      if (isReadableStream(content)) {
        const upload = new Upload({
          client,
          params: {
            Bucket: bucket,
            Key: key,
            Body: content,
            ContentType: putOptions.contentType ?? detectMimeType(path),
            CacheControl: putOptions.cacheControl,
            ACL: visibilityToAcl(visibility),
            Metadata: putOptions.metadata,
          },
          // 5MB part size (minimum for S3 multipart)
          partSize: 5 * 1024 * 1024,
          // Upload up to 4 parts concurrently
          queueSize: 4,
        });

        await upload.done();
      } else {
        // For buffers/strings, use simple put (already in memory)
        const body = toBuffer(content as Buffer | string);

        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: putOptions.contentType ?? detectMimeType(path),
            CacheControl: putOptions.cacheControl,
            ACL: visibilityToAcl(visibility),
            Metadata: putOptions.metadata,
          })
        );
      }

      return normalizePath(path);
    },

    async get(path: string, options: GetOptions = {}): Promise<Buffer | null> {
      try {
        const key = getKey(path);
        const range =
          options.start !== undefined || options.end !== undefined
            ? `bytes=${options.start ?? 0}-${options.end ?? ''}`
            : undefined;

        const response = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            Range: range,
          })
        );

        if (!response.Body) {
          return null;
        }

        // Convert readable stream to buffer
        return await streamToBuffer(response.Body as NodeJS.ReadableStream);
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },

    async stream(path: string, options: GetOptions = {}): Promise<Readable | null> {
      try {
        const key = getKey(path);
        const range =
          options.start !== undefined || options.end !== undefined
            ? `bytes=${options.start ?? 0}-${options.end ?? ''}`
            : undefined;

        const response = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            Range: range,
          })
        );

        return (response.Body as Readable) ?? null;
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },

    async exists(path: string): Promise<boolean> {
      try {
        const key = getKey(path);
        await client.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );
        return true;
      } catch (error) {
        if (isNotFoundError(error)) {
          return false;
        }
        throw error;
      }
    },

    async delete(path: string): Promise<boolean> {
      try {
        const key = getKey(path);

        // Check if exists first
        const exists = await store.exists(path);
        if (!exists) {
          return false;
        }

        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );

        return true;
      } catch {
        return false;
      }
    },

    async deleteMany(paths: string[]): Promise<number> {
      if (paths.length === 0) {
        return 0;
      }

      // S3 supports batch delete of up to 1000 objects per request
      const BATCH_SIZE = 1000;
      let totalDeleted = 0;

      // Process in batches to respect S3 API limit
      for (let i = 0; i < paths.length; i += BATCH_SIZE) {
        const batch = paths.slice(i, i + BATCH_SIZE);
        const keys = batch.map((path) => ({ Key: getKey(path) }));

        try {
          const response = await client.send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: {
                Objects: keys,
                Quiet: false,
              },
            })
          );

          totalDeleted += response.Deleted?.length ?? 0;
        } catch {
          // Fall back to individual deletes if batch fails
          const results = await Promise.all(batch.map((path) => store.delete(path)));
          for (const deleted of results) {
            if (deleted) totalDeleted++;
          }
        }
      }

      return totalDeleted;
    },

    async copy(
      source: string,
      destination: string,
      copyOptions: CopyOptions = {}
    ): Promise<string> {
      const sourceKey = getKey(source);
      const destKey = getKey(destination);

      // Get source metadata for visibility
      const sourceMeta = await store.metadata(source);
      const visibility =
        copyOptions.visibility ?? sourceMeta?.visibility ?? defaultVisibility ?? 'private';

      await client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          // CopySource format: bucket/key - encode key segments but not the bucket/key separator
          CopySource: `${bucket}/${sourceKey
            .split('/')
            .map((s) => encodeURIComponent(s))
            .join('/')}`,
          Key: destKey,
          ACL: visibilityToAcl(visibility),
        })
      );

      return normalizePath(destination);
    },

    async move(
      source: string,
      destination: string,
      copyOptions: CopyOptions = {}
    ): Promise<string> {
      await store.copy(source, destination, copyOptions);
      await store.delete(source);
      return normalizePath(destination);
    },

    async metadata(path: string): Promise<FileMetadata | null> {
      try {
        const key = getKey(path);

        const response = await client.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );

        return {
          path: normalizePath(path),
          size: response.ContentLength ?? 0,
          lastModified: response.LastModified ?? new Date(),
          contentType: response.ContentType,
          metadata: response.Metadata,
        };
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },

    async head(path: string): Promise<FileMetadata> {
      const result = await store.metadata(path);
      if (result === null) {
        throw new StorageObjectNotFoundError(path);
      }
      return result;
    },

    async list(listPrefix = '', listOptions: ListOptions = {}): Promise<ListResult> {
      const { recursive = false, limit = 1000, cursor } = listOptions;

      const fullPrefix = prefix ? joinPath(prefix, listPrefix) : listPrefix;

      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: fullPrefix ? `${fullPrefix}/` : undefined,
          MaxKeys: limit,
          ContinuationToken: cursor,
          Delimiter: recursive ? undefined : '/',
        })
      );

      const files: FileMetadata[] = [];
      for (const item of response.Contents ?? []) {
        if (item.Key && !item.Key.endsWith('/')) {
          files.push({
            path: keyToPath(item.Key),
            size: item.Size ?? 0,
            lastModified: item.LastModified ?? new Date(),
          });
        }
      }

      return {
        files,
        cursor: response.NextContinuationToken,
        hasMore: response.IsTruncated ?? false,
      };
    },

    async url(path: string): Promise<string> {
      const key = getKey(path);
      // URL-encode each path segment separately to preserve `/` delimiters
      // but properly encode special characters like spaces, ?, #, etc.
      const encodedKey = key
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');

      // Use custom publicUrl (e.g., CDN) if provided, otherwise use S3 URL
      if (publicUrl) {
        const base = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
        return `${base}/${encodedKey}`;
      }

      return `${getBaseUrl()}/${encodedKey}`;
    },

    async signedUrl(path: string, signedOptions: SignedUrlOptions = {}): Promise<string> {
      const key = getKey(path);
      const { expiresIn = 3600, responseContentType, responseContentDisposition } = signedOptions;

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentType: responseContentType,
        ResponseContentDisposition: responseContentDisposition,
      });

      return await getSignedUrl(client, command, { expiresIn });
    },

    async signedUploadUrl(options: SignedUploadOptions): Promise<string> {
      const { key, expiresIn = 3600, contentType } = options;
      const fullKey = getKey(key);

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: fullKey,
        ContentType: contentType,
      });

      return await getSignedUrl(client, command, { expiresIn });
    },

    async setVisibility(path: string, visibility: FileVisibility): Promise<void> {
      const key = getKey(path);

      // S3 requires copying the object to itself to change ACL
      await client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          // CopySource format: bucket/key - encode key segments but not the bucket/key separator
          CopySource: `${bucket}/${key
            .split('/')
            .map((s) => encodeURIComponent(s))
            .join('/')}`,
          Key: key,
          ACL: visibilityToAcl(visibility),
          MetadataDirective: 'COPY',
        })
      );
    },

    async getVisibility(_path: string): Promise<FileVisibility | null> {
      // S3 doesn't have a simple way to get ACL without GetObjectAcl permission
      // For simplicity, we return null (visibility unknown)
      // In production, you might want to use GetObjectAcl
      return null;
    },

    async close(): Promise<void> {
      client.destroy();
    },
  };

  return store;
}

/**
 * Check if an error is a "not found" error.
 */
function isNotFoundError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    return (
      err.name === 'NotFound' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404
    );
  }
  return false;
}

/**
 * S3 storage driver name.
 */
export const DRIVER_NAME = 's3' as const;
