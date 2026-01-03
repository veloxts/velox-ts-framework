/**
 * Storage Manager
 *
 * High-level file storage API with unified interface across all drivers.
 */

import type { Readable } from 'node:stream';

import { createLocalStore } from './drivers/local.js';
import { createS3Store } from './drivers/s3.js';
import type {
  CopyOptions,
  FileMetadata,
  FileVisibility,
  GetOptions,
  ListOptions,
  ListResult,
  PutOptions,
  SignedUrlOptions,
  StorageDefaultOptions,
  StorageLocalOptions,
  StorageManagerOptions,
  StorageS3Options,
  StorageStore,
} from './types.js';

/**
 * Type guard to check if options are for S3 driver.
 */
function isS3Options(options: StorageManagerOptions): options is StorageS3Options {
  return options.driver === 's3';
}

/**
 * Type guard to check if options are for local driver.
 */
function isLocalOptions(
  options: StorageManagerOptions
): options is StorageLocalOptions | StorageDefaultOptions {
  return options.driver === 'local' || options.driver === undefined;
}

/**
 * Storage manager interface providing a unified file storage API.
 */
export interface StorageManager {
  /**
   * Upload a file.
   *
   * @param path - Destination path/key
   * @param content - File content as Buffer, string, or readable stream
   * @param options - Upload options
   * @returns The path where the file was stored
   *
   * @example
   * ```typescript
   * // Upload from buffer
   * await storage.put('uploads/avatar.jpg', imageBuffer, {
   *   visibility: 'public',
   *   contentType: 'image/jpeg',
   * });
   *
   * // Upload from string
   * await storage.put('config/settings.json', JSON.stringify(settings));
   *
   * // Upload from stream
   * await storage.put('uploads/large-file.zip', fileStream);
   * ```
   */
  put(path: string, content: Buffer | string | Readable, options?: PutOptions): Promise<string>;

  /**
   * Download a file as a Buffer.
   *
   * @param path - File path/key
   * @param options - Download options (byte range)
   * @returns File content as Buffer, or null if not found
   *
   * @example
   * ```typescript
   * const content = await storage.get('documents/report.pdf');
   * if (content) {
   *   // Process file content
   * }
   * ```
   */
  get(path: string, options?: GetOptions): Promise<Buffer | null>;

  /**
   * Get a readable stream for a file.
   * Use this for large files to avoid loading into memory.
   *
   * @param path - File path/key
   * @param options - Download options (byte range)
   * @returns Readable stream, or null if not found
   *
   * @example
   * ```typescript
   * const stream = await storage.stream('videos/large-file.mp4');
   * if (stream) {
   *   stream.pipe(response);
   * }
   * ```
   */
  stream(path: string, options?: GetOptions): Promise<Readable | null>;

  /**
   * Check if a file exists.
   *
   * @param path - File path/key
   * @returns true if file exists
   *
   * @example
   * ```typescript
   * if (await storage.exists('config/settings.json')) {
   *   // File exists
   * }
   * ```
   */
  exists(path: string): Promise<boolean>;

  /**
   * Delete a file.
   *
   * @param path - File path/key
   * @returns true if file was deleted, false if it didn't exist
   *
   * @example
   * ```typescript
   * await storage.delete('temp/upload.tmp');
   * ```
   */
  delete(path: string): Promise<boolean>;

  /**
   * Delete multiple files.
   *
   * @param paths - Array of file paths/keys
   * @returns Number of files deleted
   *
   * @example
   * ```typescript
   * const deleted = await storage.deleteMany([
   *   'temp/file1.tmp',
   *   'temp/file2.tmp',
   * ]);
   * console.log(`Deleted ${deleted} files`);
   * ```
   */
  deleteMany(paths: string[]): Promise<number>;

  /**
   * Copy a file.
   *
   * @param source - Source path/key
   * @param destination - Destination path/key
   * @param options - Copy options
   * @returns The destination path
   *
   * @example
   * ```typescript
   * await storage.copy('old/path.jpg', 'new/path.jpg');
   * ```
   */
  copy(source: string, destination: string, options?: CopyOptions): Promise<string>;

  /**
   * Move a file.
   *
   * @param source - Source path/key
   * @param destination - Destination path/key
   * @param options - Move options
   * @returns The destination path
   *
   * @example
   * ```typescript
   * await storage.move('temp/upload.jpg', 'permanent/avatar.jpg');
   * ```
   */
  move(source: string, destination: string, options?: CopyOptions): Promise<string>;

  /**
   * Get file metadata.
   *
   * @param path - File path/key
   * @returns File metadata, or null if not found
   *
   * @example
   * ```typescript
   * const meta = await storage.metadata('uploads/image.jpg');
   * if (meta) {
   *   console.log(`Size: ${meta.size}, Modified: ${meta.lastModified}`);
   * }
   * ```
   */
  metadata(path: string): Promise<FileMetadata | null>;

  /**
   * List files in a directory/prefix.
   *
   * @param prefix - Directory prefix
   * @param options - List options (recursive, limit, cursor)
   * @returns List result with files and pagination info
   *
   * @example
   * ```typescript
   * // List files in uploads directory
   * const result = await storage.list('uploads/', { recursive: true });
   * for (const file of result.files) {
   *   console.log(file.path);
   * }
   *
   * // Paginate through results
   * let cursor: string | undefined;
   * do {
   *   const result = await storage.list('uploads/', { cursor, limit: 100 });
   *   // Process result.files
   *   cursor = result.cursor;
   * } while (result.hasMore);
   * ```
   */
  list(prefix?: string, options?: ListOptions): Promise<ListResult>;

  /**
   * Get the public URL for a file.
   *
   * @param path - File path/key
   * @returns Public URL string
   *
   * @example
   * ```typescript
   * const url = await storage.url('uploads/avatar.jpg');
   * // Returns: https://bucket.s3.region.amazonaws.com/uploads/avatar.jpg
   * ```
   */
  url(path: string): Promise<string>;

  /**
   * Get a signed/temporary URL for private file access.
   *
   * @param path - File path/key
   * @param options - Signed URL options (expiration, response headers)
   * @returns Signed URL string
   *
   * @example
   * ```typescript
   * const signedUrl = await storage.signedUrl('private/document.pdf', {
   *   expiresIn: 3600, // 1 hour
   *   responseContentDisposition: 'attachment; filename="report.pdf"',
   * });
   * ```
   */
  signedUrl(path: string, options?: SignedUrlOptions): Promise<string>;

  /**
   * Set file visibility.
   *
   * @param path - File path/key
   * @param visibility - New visibility setting
   *
   * @example
   * ```typescript
   * await storage.setVisibility('uploads/image.jpg', 'public');
   * ```
   */
  setVisibility(path: string, visibility: FileVisibility): Promise<void>;

  /**
   * Get file visibility.
   *
   * @param path - File path/key
   * @returns Current visibility, or null if not determinable
   */
  getVisibility(path: string): Promise<FileVisibility | null>;

  /**
   * Make a file publicly accessible.
   * Convenience method that calls setVisibility(path, 'public').
   *
   * @param path - File path/key
   *
   * @example
   * ```typescript
   * await storage.makePublic('uploads/avatar.jpg');
   * const url = await storage.url('uploads/avatar.jpg');
   * ```
   */
  makePublic(path: string): Promise<void>;

  /**
   * Make a file private (not publicly accessible).
   * Convenience method that calls setVisibility(path, 'private').
   *
   * @param path - File path/key
   *
   * @example
   * ```typescript
   * await storage.makePrivate('documents/sensitive.pdf');
   * // Use signedUrl() for temporary access
   * const signedUrl = await storage.signedUrl('documents/sensitive.pdf');
   * ```
   */
  makePrivate(path: string): Promise<void>;

  /**
   * Close/cleanup the storage connection.
   */
  close(): Promise<void>;
}

/**
 * Create a storage manager with the specified driver.
 *
 * @param options - Storage manager options (driver configuration)
 * @returns Storage manager instance
 *
 * @example
 * ```typescript
 * // Local filesystem storage
 * const localStorage = await createStorageManager({
 *   driver: 'local',
 *   root: './storage',
 *   baseUrl: 'http://localhost:3030/files',
 * });
 *
 * // AWS S3 storage
 * const s3Storage = await createStorageManager({
 *   driver: 's3',
 *   bucket: 'my-bucket',
 *   region: 'us-east-1',
 * });
 *
 * // Cloudflare R2 (S3-compatible)
 * const r2Storage = await createStorageManager({
 *   driver: 's3',
 *   bucket: 'my-bucket',
 *   region: 'auto',
 *   endpoint: 'https://xxx.r2.cloudflarestorage.com',
 *   accessKeyId: process.env.R2_ACCESS_KEY_ID,
 *   secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
 * });
 * ```
 */
export async function createStorageManager(
  options: StorageManagerOptions = {}
): Promise<StorageManager> {
  let store: StorageStore;

  // Type-safe driver configuration with type guards
  if (isS3Options(options)) {
    // S3 driver - type guard narrows to StorageS3Options
    store = await createS3Store({
      driver: 's3',
      bucket: options.bucket,
      region: options.region,
      endpoint: options.endpoint,
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      forcePathStyle: options.forcePathStyle,
      defaultVisibility: options.defaultVisibility,
      prefix: options.prefix,
    });
  } else if (isLocalOptions(options)) {
    // Local driver - type guard narrows to StorageLocalOptions | StorageDefaultOptions
    const root = 'root' in options && options.root ? options.root : './storage';
    const baseUrl = 'baseUrl' in options ? options.baseUrl : undefined;

    store = createLocalStore({
      driver: 'local',
      root,
      baseUrl,
      defaultVisibility: options.defaultVisibility,
    });
  } else {
    // This should never happen - exhaustive check
    const _exhaustiveCheck: never = options;
    throw new Error(`Unknown storage driver: ${JSON.stringify(_exhaustiveCheck)}`);
  }

  // Create manager that delegates to the store
  const manager: StorageManager = {
    put: (path, content, putOptions) => store.put(path, content, putOptions),
    get: (path, getOptions) => store.get(path, getOptions),
    stream: (path, streamOptions) => store.stream(path, streamOptions),
    exists: (path) => store.exists(path),
    delete: (path) => store.delete(path),
    deleteMany: (paths) => store.deleteMany(paths),
    copy: (source, destination, copyOptions) => store.copy(source, destination, copyOptions),
    move: (source, destination, moveOptions) => store.move(source, destination, moveOptions),
    metadata: (path) => store.metadata(path),
    list: (prefix, listOptions) => store.list(prefix, listOptions),
    url: (path) => store.url(path),
    signedUrl: (path, signedOptions) => store.signedUrl(path, signedOptions),
    setVisibility: (path, visibility) => store.setVisibility(path, visibility),
    getVisibility: (path) => store.getVisibility(path),
    makePublic: (path) => store.setVisibility(path, 'public'),
    makePrivate: (path) => store.setVisibility(path, 'private'),
    close: () => store.close(),
  };

  return manager;
}

/**
 * Shorthand alias for createStorageManager.
 */
export const storage = createStorageManager;
