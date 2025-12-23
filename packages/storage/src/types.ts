/**
 * Storage Types
 *
 * Type definitions for the storage package with discriminated unions
 * for type-safe driver configuration.
 */

import type { Readable } from 'node:stream';

/**
 * Supported storage drivers.
 */
export type StorageDriver = 'local' | 's3';

/**
 * File visibility options.
 */
export type FileVisibility = 'public' | 'private';

/**
 * File metadata returned from storage operations.
 */
export interface FileMetadata {
  /** File path/key */
  path: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  lastModified: Date;
  /** MIME content type */
  contentType?: string;
  /** File visibility */
  visibility?: FileVisibility;
  /** Custom metadata */
  metadata?: Record<string, string>;
}

/**
 * Options for file upload operations.
 */
export interface PutOptions {
  /** File visibility (public or private) */
  visibility?: FileVisibility;
  /** MIME content type (auto-detected if not specified) */
  contentType?: string;
  /** Cache-Control header value */
  cacheControl?: string;
  /** Custom metadata key-value pairs */
  metadata?: Record<string, string>;
}

/**
 * Options for file download operations.
 */
export interface GetOptions {
  /** Byte range start */
  start?: number;
  /** Byte range end */
  end?: number;
}

/**
 * Options for listing files.
 */
export interface ListOptions {
  /** List files recursively in subdirectories */
  recursive?: boolean;
  /** Maximum number of files to return */
  limit?: number;
  /** Continuation token for pagination */
  cursor?: string;
}

/**
 * Result of listing files.
 */
export interface ListResult {
  /** List of file metadata */
  files: FileMetadata[];
  /** Continuation token for next page (if more results exist) */
  cursor?: string;
  /** Whether more results are available */
  hasMore: boolean;
}

/**
 * Options for generating signed URLs.
 */
export interface SignedUrlOptions {
  /** URL expiration time in seconds (default: 3600 = 1 hour) */
  expiresIn?: number;
  /** Response content type override */
  responseContentType?: string;
  /** Response content disposition override */
  responseContentDisposition?: string;
}

/**
 * Options for copying files.
 */
export interface CopyOptions {
  /** Destination visibility (inherits source if not specified) */
  visibility?: FileVisibility;
}

// =============================================================================
// Driver Configuration Types (Discriminated Unions)
// =============================================================================

/**
 * Local filesystem driver configuration.
 */
export interface LocalStorageConfig {
  /** Storage driver type */
  driver: 'local';
  /** Root directory for file storage */
  root: string;
  /** Base URL for public file access (optional) */
  baseUrl?: string;
  /** Default visibility for new files */
  defaultVisibility?: FileVisibility;
}

/**
 * S3-compatible driver configuration.
 * Works with AWS S3, MinIO, Cloudflare R2, DigitalOcean Spaces, etc.
 */
export interface S3StorageConfig {
  /** Storage driver type */
  driver: 's3';
  /** S3 bucket name */
  bucket: string;
  /** AWS region (e.g., 'us-east-1') */
  region: string;
  /** Custom endpoint for S3-compatible services */
  endpoint?: string;
  /** AWS access key ID (uses AWS_ACCESS_KEY_ID env var if not set) */
  accessKeyId?: string;
  /** AWS secret access key (uses AWS_SECRET_ACCESS_KEY env var if not set) */
  secretAccessKey?: string;
  /** Force path-style URLs (required for MinIO, some S3-compatible services) */
  forcePathStyle?: boolean;
  /** Default visibility for new files */
  defaultVisibility?: FileVisibility;
  /** Key prefix for all operations */
  prefix?: string;
}

/**
 * Union type for all storage configurations.
 */
export type StorageConfig = LocalStorageConfig | S3StorageConfig;

// =============================================================================
// Storage Store Interface
// =============================================================================

/**
 * Low-level storage store interface implemented by drivers.
 */
export interface StorageStore {
  /**
   * Upload a file.
   * @param path - Destination path/key
   * @param content - File content as Buffer, string, or readable stream
   * @param options - Upload options
   * @returns The path where the file was stored
   */
  put(path: string, content: Buffer | string | Readable, options?: PutOptions): Promise<string>;

  /**
   * Download a file as a Buffer.
   * @param path - File path/key
   * @param options - Download options
   * @returns File content as Buffer, or null if not found
   */
  get(path: string, options?: GetOptions): Promise<Buffer | null>;

  /**
   * Get a readable stream for a file.
   * @param path - File path/key
   * @param options - Download options
   * @returns Readable stream, or null if not found
   */
  stream(path: string, options?: GetOptions): Promise<Readable | null>;

  /**
   * Check if a file exists.
   * @param path - File path/key
   * @returns true if file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Delete a file.
   * @param path - File path/key
   * @returns true if file was deleted, false if it didn't exist
   */
  delete(path: string): Promise<boolean>;

  /**
   * Delete multiple files.
   * @param paths - Array of file paths/keys
   * @returns Number of files deleted
   */
  deleteMany(paths: string[]): Promise<number>;

  /**
   * Copy a file.
   * @param source - Source path/key
   * @param destination - Destination path/key
   * @param options - Copy options
   * @returns The destination path
   */
  copy(source: string, destination: string, options?: CopyOptions): Promise<string>;

  /**
   * Move a file.
   * @param source - Source path/key
   * @param destination - Destination path/key
   * @param options - Copy options
   * @returns The destination path
   */
  move(source: string, destination: string, options?: CopyOptions): Promise<string>;

  /**
   * Get file metadata.
   * @param path - File path/key
   * @returns File metadata, or null if not found
   */
  metadata(path: string): Promise<FileMetadata | null>;

  /**
   * List files in a directory/prefix.
   * @param prefix - Directory prefix
   * @param options - List options
   * @returns List result with files and pagination info
   */
  list(prefix?: string, options?: ListOptions): Promise<ListResult>;

  /**
   * Get the public URL for a file.
   * @param path - File path/key
   * @returns Public URL string
   */
  url(path: string): Promise<string>;

  /**
   * Get a signed/temporary URL for private file access.
   * @param path - File path/key
   * @param options - Signed URL options
   * @returns Signed URL string
   */
  signedUrl(path: string, options?: SignedUrlOptions): Promise<string>;

  /**
   * Set file visibility.
   * @param path - File path/key
   * @param visibility - New visibility setting
   */
  setVisibility(path: string, visibility: FileVisibility): Promise<void>;

  /**
   * Get file visibility.
   * @param path - File path/key
   * @returns Current visibility, or null if file not found
   */
  getVisibility(path: string): Promise<FileVisibility | null>;

  /**
   * Close/cleanup the storage connection.
   */
  close(): Promise<void>;
}

// =============================================================================
// Plugin Options (Discriminated Unions for Type-Safe Config)
// =============================================================================

/**
 * Base options shared by all storage plugin configurations.
 */
export interface StorageBaseOptions {
  /** Key prefix for all operations */
  prefix?: string;
  /** Default visibility for new files */
  defaultVisibility?: FileVisibility;
}

/**
 * Local driver plugin options.
 */
export interface StorageLocalOptions extends StorageBaseOptions {
  /** Storage driver type */
  driver: 'local';
  /** Root directory for file storage */
  root: string;
  /** Base URL for public file access */
  baseUrl?: string;
}

/**
 * S3 driver plugin options.
 */
export interface StorageS3Options extends StorageBaseOptions {
  /** Storage driver type */
  driver: 's3';
  /** S3 bucket name */
  bucket: string;
  /** AWS region */
  region: string;
  /** Custom endpoint for S3-compatible services (R2, MinIO, etc.) */
  endpoint?: string;
  /** AWS access key ID */
  accessKeyId?: string;
  /** AWS secret access key */
  secretAccessKey?: string;
  /** Force path-style URLs */
  forcePathStyle?: boolean;
}

/**
 * Default plugin options (defaults to local driver).
 */
export interface StorageDefaultOptions extends StorageBaseOptions {
  /** Storage driver type (omit for default local driver) */
  driver?: undefined;
  /** Root directory for file storage */
  root?: string;
  /** Base URL for public file access */
  baseUrl?: string;
}

/**
 * Union type for all storage plugin options.
 */
export type StoragePluginOptions = StorageLocalOptions | StorageS3Options | StorageDefaultOptions;

/**
 * Storage manager options (alias for plugin options).
 */
export type StorageManagerOptions = StoragePluginOptions;
