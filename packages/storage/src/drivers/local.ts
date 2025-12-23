/**
 * Local Filesystem Driver
 *
 * File storage implementation using the local filesystem.
 * Best for development or single-server deployments.
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import type { Readable } from 'node:stream';

import type {
  CopyOptions,
  FileMetadata,
  FileVisibility,
  GetOptions,
  ListOptions,
  ListResult,
  LocalStorageConfig,
  PutOptions,
  SignedUrlOptions,
  StorageStore,
} from '../types.js';
import {
  detectMimeType,
  isReadableStream,
  normalizePath,
  toBuffer,
  validatePath,
} from '../utils.js';

/**
 * Default configuration for local storage.
 */
const DEFAULT_CONFIG: Partial<LocalStorageConfig> = {
  defaultVisibility: 'private',
};

/**
 * Metadata file suffix for storing file metadata.
 */
const METADATA_SUFFIX = '.velox-meta.json';

/**
 * Stored metadata structure.
 */
interface StoredMetadata {
  visibility: FileVisibility;
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * Create a local filesystem storage store.
 *
 * @param config - Local storage configuration
 * @returns Storage store implementation
 *
 * @example
 * ```typescript
 * const store = createLocalStore({
 *   driver: 'local',
 *   root: './storage',
 *   baseUrl: 'http://localhost:3030/files',
 * });
 *
 * await store.put('uploads/avatar.jpg', buffer, {
 *   visibility: 'public',
 * });
 * ```
 */
export function createLocalStore(config: LocalStorageConfig): StorageStore {
  const options = { ...DEFAULT_CONFIG, ...config };
  const { root, baseUrl, defaultVisibility } = options;

  /**
   * Get the full filesystem path for a storage path.
   */
  function getFullPath(path: string): string {
    validatePath(path);
    return join(root, normalizePath(path));
  }

  /**
   * Get the metadata file path for a file.
   */
  function getMetadataPath(path: string): string {
    return getFullPath(path) + METADATA_SUFFIX;
  }

  /**
   * Ensure directory exists for a file path.
   */
  async function ensureDir(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });
  }

  /**
   * Read stored metadata for a file.
   */
  async function readStoredMetadata(path: string): Promise<StoredMetadata | null> {
    try {
      const metaPath = getMetadataPath(path);
      const content = await readFile(metaPath, 'utf-8');
      return JSON.parse(content) as StoredMetadata;
    } catch {
      return null;
    }
  }

  /**
   * Write metadata for a file.
   */
  async function writeStoredMetadata(path: string, metadata: StoredMetadata): Promise<void> {
    const metaPath = getMetadataPath(path);
    await ensureDir(metaPath);
    await writeFile(metaPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Delete metadata file for a file.
   */
  async function deleteStoredMetadata(path: string): Promise<void> {
    try {
      await unlink(getMetadataPath(path));
    } catch {
      // Ignore if metadata file doesn't exist
    }
  }

  const store: StorageStore = {
    async put(
      path: string,
      content: Buffer | string | Readable,
      putOptions: PutOptions = {}
    ): Promise<string> {
      const fullPath = getFullPath(path);
      await ensureDir(fullPath);

      // Handle different content types
      if (isReadableStream(content)) {
        // Stream content to file
        await new Promise<void>((resolve, reject) => {
          const writeStream = createWriteStream(fullPath);
          (content as NodeJS.ReadableStream).pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });
      } else {
        // Write buffer/string directly
        await writeFile(fullPath, toBuffer(content as Buffer | string));
      }

      // Store metadata
      const metadata: StoredMetadata = {
        visibility: putOptions.visibility ?? defaultVisibility ?? 'private',
        contentType: putOptions.contentType ?? detectMimeType(path),
        metadata: putOptions.metadata,
      };
      await writeStoredMetadata(path, metadata);

      return normalizePath(path);
    },

    async get(path: string, _options: GetOptions = {}): Promise<Buffer | null> {
      try {
        const fullPath = getFullPath(path);
        return await readFile(fullPath);
      } catch {
        return null;
      }
    },

    async stream(path: string, options: GetOptions = {}): Promise<Readable | null> {
      try {
        const fullPath = getFullPath(path);
        await stat(fullPath); // Check if file exists

        const streamOptions: { start?: number; end?: number } = {};
        if (options.start !== undefined) {
          streamOptions.start = options.start;
        }
        if (options.end !== undefined) {
          streamOptions.end = options.end;
        }

        return createReadStream(fullPath, streamOptions);
      } catch {
        return null;
      }
    },

    async exists(path: string): Promise<boolean> {
      try {
        const fullPath = getFullPath(path);
        await stat(fullPath);
        return true;
      } catch {
        return false;
      }
    },

    async delete(path: string): Promise<boolean> {
      try {
        const fullPath = getFullPath(path);
        await unlink(fullPath);
        await deleteStoredMetadata(path);
        return true;
      } catch {
        return false;
      }
    },

    async deleteMany(paths: string[]): Promise<number> {
      let count = 0;
      // Use Promise.all for parallel deletion
      const results = await Promise.all(paths.map((path) => store.delete(path)));
      for (const deleted of results) {
        if (deleted) count++;
      }
      return count;
    },

    async copy(
      source: string,
      destination: string,
      copyOptions: CopyOptions = {}
    ): Promise<string> {
      const content = await store.get(source);
      if (content === null) {
        throw new Error(`Source file not found: ${source}`);
      }

      const sourceMeta = await readStoredMetadata(source);
      const visibility = copyOptions.visibility ?? sourceMeta?.visibility ?? defaultVisibility;

      await store.put(destination, content, {
        visibility,
        contentType: sourceMeta?.contentType,
        metadata: sourceMeta?.metadata,
      });

      return normalizePath(destination);
    },

    async move(
      source: string,
      destination: string,
      copyOptions: CopyOptions = {}
    ): Promise<string> {
      const sourcePath = getFullPath(source);
      const destPath = getFullPath(destination);

      await ensureDir(destPath);

      // Try atomic rename first (same filesystem)
      try {
        await rename(sourcePath, destPath);

        // Move metadata file too
        const sourceMeta = await readStoredMetadata(source);
        if (sourceMeta) {
          if (copyOptions.visibility) {
            sourceMeta.visibility = copyOptions.visibility;
          }
          await writeStoredMetadata(destination, sourceMeta);
          await deleteStoredMetadata(source);
        }

        return normalizePath(destination);
      } catch {
        // Fall back to copy + delete
        await store.copy(source, destination, copyOptions);
        await store.delete(source);
        return normalizePath(destination);
      }
    },

    async metadata(path: string): Promise<FileMetadata | null> {
      try {
        const fullPath = getFullPath(path);
        const stats = await stat(fullPath);

        if (!stats.isFile()) {
          return null;
        }

        const storedMeta = await readStoredMetadata(path);

        return {
          path: normalizePath(path),
          size: stats.size,
          lastModified: stats.mtime,
          contentType: storedMeta?.contentType ?? detectMimeType(path),
          visibility: storedMeta?.visibility ?? defaultVisibility,
          metadata: storedMeta?.metadata,
        };
      } catch {
        return null;
      }
    },

    async list(prefix = '', listOptions: ListOptions = {}): Promise<ListResult> {
      const { recursive = false, limit = 1000 } = listOptions;
      const files: FileMetadata[] = [];
      const fullPrefix = getFullPath(prefix);

      async function scanDir(dir: string): Promise<void> {
        try {
          const entries = await readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            if (files.length >= limit) return;

            // Skip metadata files
            if (entry.name.endsWith(METADATA_SUFFIX)) continue;

            const entryPath = join(dir, entry.name);

            if (entry.isFile()) {
              const relativePath = relative(root, entryPath);
              const meta = await store.metadata(relativePath);
              if (meta) {
                files.push(meta);
              }
            } else if (entry.isDirectory() && recursive) {
              await scanDir(entryPath);
            }
          }
        } catch {
          // Directory doesn't exist or not readable
        }
      }

      await scanDir(fullPrefix);

      return {
        files,
        hasMore: files.length >= limit,
      };
    },

    async url(path: string): Promise<string> {
      if (!baseUrl) {
        throw new Error('baseUrl is not configured for local storage');
      }
      // Don't use joinPath for URLs as it removes protocol slashes
      const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const filePath = normalizePath(path);
      return `${base}/${filePath}`;
    },

    async signedUrl(path: string, _options: SignedUrlOptions = {}): Promise<string> {
      // Local storage doesn't support true signed URLs
      // In production, you'd implement a token-based verification endpoint
      return store.url(path);
    },

    async setVisibility(path: string, visibility: FileVisibility): Promise<void> {
      const storedMeta = (await readStoredMetadata(path)) ?? {
        visibility,
        contentType: detectMimeType(path),
      };

      storedMeta.visibility = visibility;
      await writeStoredMetadata(path, storedMeta);
    },

    async getVisibility(path: string): Promise<FileVisibility | null> {
      const storedMeta = await readStoredMetadata(path);
      return storedMeta?.visibility ?? null;
    },

    async close(): Promise<void> {
      // No cleanup needed for local filesystem
    },
  };

  return store;
}

/**
 * Local storage driver name.
 */
export const DRIVER_NAME = 'local' as const;
