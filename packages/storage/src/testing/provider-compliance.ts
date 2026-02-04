/**
 * Storage Provider Compliance Test Suite
 *
 * This module exports a test helper that verifies a StorageStore implementation
 * conforms to the expected interface contract. Use this to test custom providers
 * or verify third-party provider implementations.
 *
 * @example
 * ```typescript
 * import { runProviderTests } from '@veloxts/storage/testing';
 * import { createLocalStore } from '@veloxts/storage/drivers/local';
 *
 * runProviderTests('Local', () =>
 *   createLocalStore({ driver: 'local', root: '/tmp/test-storage' })
 * );
 * ```
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { StorageObjectNotFoundError } from '../errors.js';
import type { StorageStore } from '../types.js';

/**
 * Options for the provider compliance test suite.
 */
export interface ProviderTestOptions {
  /**
   * Skip presigned URL tests (for providers that don't support them).
   * Default: false
   */
  skipPresignedUrls?: boolean;

  /**
   * Skip init/destroy lifecycle tests.
   * Default: false
   */
  skipLifecycle?: boolean;

  /**
   * Timeout for async operations in milliseconds.
   * Default: 5000
   */
  timeout?: number;
}

/**
 * Run the provider compliance test suite against a StorageStore implementation.
 *
 * This function runs a comprehensive set of tests to verify that a storage provider
 * correctly implements the StorageStore interface. It covers:
 *
 * - Basic CRUD operations (put, get, delete, deleteMany)
 * - Metadata operations (metadata, head, exists)
 * - Listing files with pagination
 * - Presigned URLs (download and upload)
 * - Copy and move operations
 * - Lifecycle hooks (init, close)
 *
 * @param name - Name of the provider being tested (for test output)
 * @param createProvider - Factory function that creates a new provider instance
 * @param options - Optional test configuration
 *
 * @example
 * ```typescript
 * // Test the local driver
 * runProviderTests('Local', () =>
 *   createLocalStore({ driver: 'local', root: '/tmp/test-storage' })
 * );
 *
 * // Test with options
 * runProviderTests('MinIO', async () => minio({
 *   bucket: 'test',
 *   endpoint: 'http://localhost:9000',
 *   accessKeyId: 'minioadmin',
 *   secretAccessKey: 'minioadmin',
 * }), { timeout: 10000 });
 * ```
 */
export function runProviderTests(
  name: string,
  createProvider: () => StorageStore | Promise<StorageStore>,
  options: ProviderTestOptions = {}
): void {
  const { skipPresignedUrls = false, skipLifecycle = false, timeout = 5000 } = options;

  describe(`StorageProvider compliance: ${name}`, { timeout }, () => {
    let provider: StorageStore;
    const testPrefix = `compliance-test-${Date.now()}`;

    // Helper to generate unique test keys
    const testKey = (suffix: string) => `${testPrefix}/${suffix}`;

    // Helper to clean up test files
    const cleanup = async () => {
      try {
        const result = await provider.list(testPrefix, { recursive: true });
        if (result.files.length > 0) {
          await provider.deleteMany(result.files.map((f) => f.path));
        }
      } catch {
        // Ignore cleanup errors
      }
    };

    beforeAll(async () => {
      provider = await createProvider();
      if (!skipLifecycle && provider.init) {
        await provider.init();
      }
    });

    afterAll(async () => {
      await cleanup();
      await provider.close();
    });

    beforeEach(async () => {
      // Clean state before each test
    });

    afterEach(async () => {
      // Clean up any test files created during the test
    });

    // =========================================================================
    // Basic Operations
    // =========================================================================

    describe('put/get operations', () => {
      it('should put and get a buffer', async () => {
        const key = testKey('buffer-test.txt');
        const content = Buffer.from('Hello, World!');

        const path = await provider.put(key, content, { contentType: 'text/plain' });
        expect(path).toBe(key);

        const result = await provider.get(key);
        expect(result).not.toBeNull();
        expect(result?.toString()).toBe('Hello, World!');
      });

      it('should put and get a string', async () => {
        const key = testKey('string-test.txt');
        const content = 'String content here';

        await provider.put(key, content, { contentType: 'text/plain' });

        const result = await provider.get(key);
        expect(result).not.toBeNull();
        expect(result?.toString()).toBe('String content here');
      });

      it('should return null for non-existent key', async () => {
        const result = await provider.get(testKey('does-not-exist.txt'));
        expect(result).toBeNull();
      });

      it('should overwrite existing file', async () => {
        const key = testKey('overwrite-test.txt');

        await provider.put(key, 'First content');
        await provider.put(key, 'Second content');

        const result = await provider.get(key);
        expect(result?.toString()).toBe('Second content');
      });
    });

    // =========================================================================
    // Metadata Operations
    // =========================================================================

    describe('metadata operations', () => {
      it('should return metadata for existing file', async () => {
        const key = testKey('metadata-test.txt');
        const content = 'Test content for metadata';

        await provider.put(key, content, { contentType: 'text/plain' });

        const meta = await provider.metadata(key);
        expect(meta).not.toBeNull();
        expect(meta?.path).toBe(key);
        expect(meta?.size).toBe(content.length);
        expect(meta?.lastModified).toBeInstanceOf(Date);
      });

      it('should return null for non-existent file', async () => {
        const meta = await provider.metadata(testKey('metadata-not-found.txt'));
        expect(meta).toBeNull();
      });
    });

    describe('head() method', () => {
      it('should return metadata for existing file', async () => {
        const key = testKey('head-test.txt');
        const content = 'Test content for head';

        await provider.put(key, content, { contentType: 'text/plain' });

        const meta = await provider.head(key);
        expect(meta.path).toBe(key);
        expect(meta.size).toBe(content.length);
        expect(meta.lastModified).toBeInstanceOf(Date);
      });

      it('should throw StorageObjectNotFoundError for non-existent file', async () => {
        const key = testKey('head-not-found.txt');

        await expect(provider.head(key)).rejects.toThrow(StorageObjectNotFoundError);
        await expect(provider.head(key)).rejects.toMatchObject({ key });
      });
    });

    describe('exists() method', () => {
      it('should return true for existing file', async () => {
        const key = testKey('exists-test.txt');
        await provider.put(key, 'Test content');

        const exists = await provider.exists(key);
        expect(exists).toBe(true);
      });

      it('should return false for non-existent file', async () => {
        const exists = await provider.exists(testKey('exists-not-found.txt'));
        expect(exists).toBe(false);
      });
    });

    // =========================================================================
    // Delete Operations
    // =========================================================================

    describe('delete operations', () => {
      it('should delete an existing file', async () => {
        const key = testKey('delete-test.txt');
        await provider.put(key, 'Delete me');

        const deleted = await provider.delete(key);
        expect(deleted).toBe(true);

        const exists = await provider.exists(key);
        expect(exists).toBe(false);
      });

      it('should return false when deleting non-existent file', async () => {
        const deleted = await provider.delete(testKey('delete-not-found.txt'));
        expect(deleted).toBe(false);
      });

      it('should batch delete multiple files with deleteMany', async () => {
        const keys = [
          testKey('batch-delete-1.txt'),
          testKey('batch-delete-2.txt'),
          testKey('batch-delete-3.txt'),
        ];

        // Create files
        await Promise.all(keys.map((key) => provider.put(key, `Content for ${key}`)));

        // Delete them
        const count = await provider.deleteMany(keys);
        expect(count).toBe(3);

        // Verify they're gone
        for (const key of keys) {
          const exists = await provider.exists(key);
          expect(exists).toBe(false);
        }
      });

      it('should handle deleteMany with empty array (no-op)', async () => {
        const count = await provider.deleteMany([]);
        expect(count).toBe(0);
      });

      it('should handle deleteMany with mix of existing and non-existing files', async () => {
        const key = testKey('batch-mixed-1.txt');
        await provider.put(key, 'Content');

        const count = await provider.deleteMany([key, testKey('batch-mixed-not-found.txt')]);
        // Should delete at least the existing file
        expect(count).toBeGreaterThanOrEqual(1);
      });
    });

    // =========================================================================
    // List Operations
    // =========================================================================

    describe('list operations', () => {
      const listPrefix = `${testPrefix}/list-test`;

      beforeAll(async () => {
        // Create some test files for listing
        await provider.put(`${listPrefix}/file1.txt`, 'File 1');
        await provider.put(`${listPrefix}/file2.txt`, 'File 2');
        await provider.put(`${listPrefix}/subdir/file3.txt`, 'File 3');
      });

      it('should list files with prefix', async () => {
        const result = await provider.list(listPrefix);
        expect(result.files.length).toBeGreaterThanOrEqual(2);
        expect(result.hasMore).toBeDefined();
      });

      it('should list files recursively', async () => {
        const result = await provider.list(listPrefix, { recursive: true });
        expect(result.files.length).toBeGreaterThanOrEqual(3);
      });

      it('should respect limit option', async () => {
        const result = await provider.list(listPrefix, { recursive: true, limit: 1 });
        expect(result.files.length).toBe(1);
      });

      it('should return file metadata in list results', async () => {
        const result = await provider.list(listPrefix, { recursive: true });
        for (const file of result.files) {
          expect(file.path).toBeDefined();
          expect(file.size).toBeDefined();
          expect(typeof file.size).toBe('number');
        }
      });
    });

    // =========================================================================
    // Copy/Move Operations
    // =========================================================================

    describe('copy/move operations', () => {
      it('should copy a file', async () => {
        const source = testKey('copy-source.txt');
        const dest = testKey('copy-dest.txt');

        await provider.put(source, 'Copy me');

        const resultPath = await provider.copy(source, dest);
        expect(resultPath).toBe(dest);

        // Both should exist
        expect(await provider.exists(source)).toBe(true);
        expect(await provider.exists(dest)).toBe(true);

        // Content should match
        const content = await provider.get(dest);
        expect(content?.toString()).toBe('Copy me');
      });

      it('should move a file', async () => {
        const source = testKey('move-source.txt');
        const dest = testKey('move-dest.txt');

        await provider.put(source, 'Move me');

        const resultPath = await provider.move(source, dest);
        expect(resultPath).toBe(dest);

        // Source should be gone, dest should exist
        expect(await provider.exists(source)).toBe(false);
        expect(await provider.exists(dest)).toBe(true);

        // Content should match
        const content = await provider.get(dest);
        expect(content?.toString()).toBe('Move me');
      });
    });

    // =========================================================================
    // URL Operations
    // =========================================================================

    describe('URL operations', () => {
      it('should generate public URL', async () => {
        const key = testKey('url-test.txt');
        await provider.put(key, 'URL test content');

        const url = await provider.url(key);
        expect(typeof url).toBe('string');
        expect(url.length).toBeGreaterThan(0);
      });

      if (!skipPresignedUrls) {
        it('should generate presigned download URL', async () => {
          const key = testKey('signed-download.txt');
          await provider.put(key, 'Signed download content');

          const signedUrl = await provider.signedUrl(key, { expiresIn: 300 });
          expect(typeof signedUrl).toBe('string');
          expect(signedUrl.length).toBeGreaterThan(0);
        });

        it('should generate presigned upload URL', async () => {
          const key = testKey('signed-upload.txt');

          const uploadUrl = await provider.signedUploadUrl({
            key,
            contentType: 'text/plain',
            expiresIn: 300,
          });

          expect(typeof uploadUrl).toBe('string');
          expect(uploadUrl.length).toBeGreaterThan(0);
        });
      }
    });

    // =========================================================================
    // Stream Operations
    // =========================================================================

    describe('stream operations', () => {
      it('should return readable stream for existing file', async () => {
        const key = testKey('stream-test.txt');
        const content = 'Streamed content';

        await provider.put(key, content);

        const stream = await provider.stream(key);
        expect(stream).not.toBeNull();

        // Read stream to verify content
        if (stream) {
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const result = Buffer.concat(chunks).toString();
          expect(result).toBe(content);
        }
      });

      it('should return null for non-existent file', async () => {
        const stream = await provider.stream(testKey('stream-not-found.txt'));
        expect(stream).toBeNull();
      });
    });

    // =========================================================================
    // Visibility Operations
    // =========================================================================

    describe('visibility operations', () => {
      it('should set and get visibility', async () => {
        const key = testKey('visibility-test.txt');
        await provider.put(key, 'Visibility test');

        await provider.setVisibility(key, 'public');
        // Note: getVisibility may return null for some providers (like S3)
        // that don't easily expose ACL info
        const visibility = await provider.getVisibility(key);
        // Only check if visibility is returned
        if (visibility !== null) {
          expect(visibility).toBe('public');
        }
      });
    });

    // =========================================================================
    // Lifecycle
    // =========================================================================

    if (!skipLifecycle) {
      describe('lifecycle', () => {
        it('should have init method (optional)', () => {
          // init is optional, just verify it exists or doesn't
          expect(typeof provider.init === 'function' || provider.init === undefined).toBe(true);
        });

        it('should have close method', () => {
          expect(typeof provider.close).toBe('function');
        });
      });
    }
  });
}
