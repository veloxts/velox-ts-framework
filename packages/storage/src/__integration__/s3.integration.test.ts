/**
 * S3/MinIO Storage Driver Integration Tests
 *
 * Tests the S3-compatible storage driver against a real MinIO instance
 * using testcontainers. MinIO provides 100% S3 API compatibility.
 */

import { Readable } from 'node:stream';

import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import {
  isDockerAvailable,
  type MinioContainerResult,
  startMinioContainer,
} from '@veloxts/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createS3Store } from '../drivers/s3.js';
import type { StorageStore } from '../types.js';

// Check Docker availability at module load time
const dockerAvailable = await isDockerAvailable();

// Skip entire suite if Docker is not available
const describeIntegration = dockerAvailable ? describe : describe.skip;

describeIntegration('S3 storage driver (integration)', () => {
  let minio: MinioContainerResult;
  let store: StorageStore;
  const TEST_BUCKET = 'test-bucket';

  beforeAll(async () => {
    // Start MinIO container
    minio = await startMinioContainer();

    // Create the test bucket using S3 SDK
    const client = new S3Client({
      endpoint: minio.endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: minio.accessKey,
        secretAccessKey: minio.secretKey,
      },
    });

    await client.send(new CreateBucketCommand({ Bucket: TEST_BUCKET }));
    client.destroy();
  }, 60000); // 60s timeout for container startup

  afterAll(async () => {
    // Clean up with try/catch to prevent test hangs on cleanup failures
    try {
      if (store) await store.close();
    } catch {
      /* ignore cleanup errors */
    }
    try {
      if (minio) await minio.stop();
    } catch {
      /* ignore cleanup errors */
    }
  });

  beforeEach(async () => {
    // Create fresh store for each test
    if (store) {
      await store.close();
    }

    store = await createS3Store({
      driver: 's3',
      bucket: TEST_BUCKET,
      region: 'us-east-1',
      endpoint: minio.endpoint,
      accessKeyId: minio.accessKey,
      secretAccessKey: minio.secretKey,
      forcePathStyle: true,
      defaultVisibility: 'private',
    });
  });

  // ==========================================================================
  // Basic Put/Get Operations
  // ==========================================================================

  describe('put and get', () => {
    it('should store and retrieve a buffer', async () => {
      const content = Buffer.from('Hello, MinIO!');
      const path = await store.put('test/hello.txt', content);

      expect(path).toBe('test/hello.txt');

      const retrieved = await store.get('test/hello.txt');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.toString()).toBe('Hello, MinIO!');
    });

    it('should store and retrieve a string', async () => {
      const content = 'Hello from string!';
      await store.put('test/string.txt', content);

      const retrieved = await store.get('test/string.txt');
      expect(retrieved?.toString()).toBe('Hello from string!');
    });

    it('should store and retrieve a stream', async () => {
      const content = 'Stream content here';
      const stream = Readable.from([content]);

      await store.put('test/stream.txt', stream);

      const retrieved = await store.get('test/stream.txt');
      expect(retrieved?.toString()).toBe('Stream content here');
    });

    it('should return null for non-existent file', async () => {
      const result = await store.get('non-existent/file.txt');
      expect(result).toBeNull();
    });

    it('should store with custom content type', async () => {
      await store.put('test/data.json', '{"key": "value"}', {
        contentType: 'application/json',
      });

      const metadata = await store.metadata('test/data.json');
      expect(metadata?.contentType).toBe('application/json');
    });

    it('should store with custom metadata', async () => {
      await store.put('test/with-meta.txt', 'content', {
        metadata: { 'x-custom-header': 'custom-value' },
      });

      const metadata = await store.metadata('test/with-meta.txt');
      expect(metadata?.metadata?.['x-custom-header']).toBe('custom-value');
    });
  });

  // ==========================================================================
  // Streaming
  // ==========================================================================

  describe('streaming', () => {
    it('should stream file content', async () => {
      const content = 'Stream this content';
      await store.put('test/to-stream.txt', content);

      const stream = await store.stream('test/to-stream.txt');
      expect(stream).not.toBeNull();

      // Consume stream - use if guard instead of non-null assertion
      if (stream) {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk as Buffer);
        }
        const result = Buffer.concat(chunks).toString();
        expect(result).toBe('Stream this content');
      }
    });

    it('should return null when streaming non-existent file', async () => {
      const stream = await store.stream('non-existent.txt');
      expect(stream).toBeNull();
    });

    it('should support range requests', async () => {
      await store.put('test/range.txt', '0123456789');

      // Get bytes 2-5 (inclusive)
      const partial = await store.get('test/range.txt', { start: 2, end: 5 });
      expect(partial?.toString()).toBe('2345');
    });
  });

  // ==========================================================================
  // Existence and Deletion
  // ==========================================================================

  describe('exists and delete', () => {
    it('should check file existence', async () => {
      await store.put('test/exists.txt', 'content');

      expect(await store.exists('test/exists.txt')).toBe(true);
      expect(await store.exists('non-existent.txt')).toBe(false);
    });

    it('should delete a file', async () => {
      await store.put('test/to-delete.txt', 'delete me');

      expect(await store.exists('test/to-delete.txt')).toBe(true);

      const deleted = await store.delete('test/to-delete.txt');
      expect(deleted).toBe(true);

      expect(await store.exists('test/to-delete.txt')).toBe(false);
    });

    it('should return false when deleting non-existent file', async () => {
      const deleted = await store.delete('non-existent-delete.txt');
      expect(deleted).toBe(false);
    });

    it('should delete multiple files', async () => {
      await store.put('batch/1.txt', 'one');
      await store.put('batch/2.txt', 'two');
      await store.put('batch/3.txt', 'three');

      const count = await store.deleteMany(['batch/1.txt', 'batch/2.txt', 'batch/3.txt']);
      expect(count).toBe(3);

      expect(await store.exists('batch/1.txt')).toBe(false);
      expect(await store.exists('batch/2.txt')).toBe(false);
      expect(await store.exists('batch/3.txt')).toBe(false);
    });
  });

  // ==========================================================================
  // Copy and Move
  // ==========================================================================

  describe('copy and move', () => {
    it('should copy a file', async () => {
      await store.put('source/copy-me.txt', 'copy content');

      const destPath = await store.copy('source/copy-me.txt', 'dest/copied.txt');
      expect(destPath).toBe('dest/copied.txt');

      // Both files should exist
      expect(await store.exists('source/copy-me.txt')).toBe(true);
      expect(await store.exists('dest/copied.txt')).toBe(true);

      // Content should be identical
      const sourceContent = await store.get('source/copy-me.txt');
      const destContent = await store.get('dest/copied.txt');
      expect(destContent?.toString()).toBe(sourceContent?.toString());
    });

    it('should move a file', async () => {
      await store.put('source/move-me.txt', 'move content');

      const destPath = await store.move('source/move-me.txt', 'dest/moved.txt');
      expect(destPath).toBe('dest/moved.txt');

      // Source should not exist, destination should
      expect(await store.exists('source/move-me.txt')).toBe(false);
      expect(await store.exists('dest/moved.txt')).toBe(true);

      const content = await store.get('dest/moved.txt');
      expect(content?.toString()).toBe('move content');
    });
  });

  // ==========================================================================
  // Metadata
  // ==========================================================================

  describe('metadata', () => {
    it('should retrieve file metadata', async () => {
      const content = 'metadata test content';
      await store.put('test/metadata.txt', content);

      const metadata = await store.metadata('test/metadata.txt');

      expect(metadata).not.toBeNull();
      expect(metadata?.path).toBe('test/metadata.txt');
      expect(metadata?.size).toBe(Buffer.byteLength(content));
      expect(metadata?.lastModified).toBeInstanceOf(Date);
    });

    it('should return null for non-existent file metadata', async () => {
      const metadata = await store.metadata('non-existent-meta.txt');
      expect(metadata).toBeNull();
    });
  });

  // ==========================================================================
  // Listing
  // ==========================================================================

  describe('list', () => {
    beforeEach(async () => {
      // Create test files for listing
      await store.put('list-test/a/1.txt', 'a1');
      await store.put('list-test/a/2.txt', 'a2');
      await store.put('list-test/b/1.txt', 'b1');
      await store.put('list-test/root.txt', 'root');
    });

    it('should list files in a directory', async () => {
      const result = await store.list('list-test');

      // Should only find root.txt at this level (not recursive)
      expect(result.files.some((f) => f.path.endsWith('root.txt'))).toBe(true);
    });

    it('should list files recursively', async () => {
      const result = await store.list('list-test', { recursive: true });

      expect(result.files.length).toBeGreaterThanOrEqual(4);
      expect(result.files.some((f) => f.path.includes('a/1.txt'))).toBe(true);
      expect(result.files.some((f) => f.path.includes('b/1.txt'))).toBe(true);
    });

    it('should support pagination', async () => {
      const result1 = await store.list('list-test', { recursive: true, limit: 2 });

      expect(result1.files.length).toBeLessThanOrEqual(2);

      if (result1.hasMore && result1.cursor) {
        const result2 = await store.list('list-test', {
          recursive: true,
          limit: 2,
          cursor: result1.cursor,
        });
        expect(result2.files.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // URLs
  // ==========================================================================

  describe('urls', () => {
    it('should generate a public URL', async () => {
      await store.put('url-test/public.txt', 'public content');

      const url = await store.url('url-test/public.txt');
      expect(url).toContain('url-test/public.txt');
      expect(url).toContain(TEST_BUCKET);
    });

    it('should generate a signed URL', async () => {
      await store.put('url-test/signed.txt', 'signed content');

      const signedUrl = await store.signedUrl('url-test/signed.txt', { expiresIn: 3600 });
      expect(signedUrl).toContain('url-test/signed.txt');
      expect(signedUrl).toContain('X-Amz-Signature');
      expect(signedUrl).toContain('X-Amz-Expires');
    });

    it('should generate signed URL with custom response headers', async () => {
      await store.put('url-test/download.txt', 'downloadable');

      const signedUrl = await store.signedUrl('url-test/download.txt', {
        expiresIn: 3600,
        responseContentDisposition: 'attachment; filename="download.txt"',
      });

      expect(signedUrl).toContain('response-content-disposition');
    });
  });

  // ==========================================================================
  // Visibility
  // ==========================================================================

  describe('visibility', () => {
    it('should store with initial visibility', async () => {
      // Test that we can set visibility during upload
      await store.put('visibility/public.txt', 'public content', { visibility: 'public' });
      await store.put('visibility/private.txt', 'private content', { visibility: 'private' });

      // Both files should exist
      expect(await store.exists('visibility/public.txt')).toBe(true);
      expect(await store.exists('visibility/private.txt')).toBe(true);
    });

    it('should return null from getVisibility (not implemented)', async () => {
      await store.put('visibility/check.txt', 'content');

      // getVisibility returns null as noted in the implementation
      const visibility = await store.getVisibility('visibility/check.txt');
      expect(visibility).toBeNull();
    });

    // Note: setVisibility doesn't work on MinIO without changing metadata
    // This is a known S3 API limitation - copying to self requires metadata change
    // Skip this test for MinIO, would work on real S3
    it.skip('should change visibility after upload (S3 only)', async () => {
      await store.put('visibility/change.txt', 'content', { visibility: 'private' });
      await store.setVisibility('visibility/change.txt', 'public');
    });
  });

  // ==========================================================================
  // Prefix Support
  // ==========================================================================

  describe('prefix', () => {
    it('should support storage prefix', async () => {
      // Create a store with prefix
      const prefixedStore = await createS3Store({
        driver: 's3',
        bucket: TEST_BUCKET,
        region: 'us-east-1',
        endpoint: minio.endpoint,
        accessKeyId: minio.accessKey,
        secretAccessKey: minio.secretKey,
        forcePathStyle: true,
        prefix: 'my-prefix',
      });

      try {
        await prefixedStore.put('file.txt', 'prefixed content');

        // Should be accessible via the prefixed store
        const content = await prefixedStore.get('file.txt');
        expect(content?.toString()).toBe('prefixed content');

        // URL should include prefix
        const url = await prefixedStore.url('file.txt');
        expect(url).toContain('my-prefix/file.txt');
      } finally {
        await prefixedStore.close();
      }
    });
  });

  // ==========================================================================
  // Large File Handling
  // ==========================================================================

  describe('large files', () => {
    it('should handle larger files with multipart upload', async () => {
      // Create a 6MB buffer (exceeds 5MB part size)
      const size = 6 * 1024 * 1024;
      const largeBuffer = Buffer.alloc(size, 'x');

      // Upload as stream to test multipart
      const stream = Readable.from([largeBuffer]);
      await store.put('large/multipart.bin', stream);

      const metadata = await store.metadata('large/multipart.bin');
      expect(metadata?.size).toBe(size);

      // Verify we can retrieve it
      const exists = await store.exists('large/multipart.bin');
      expect(exists).toBe(true);
    }, 30000); // 30s timeout for large file
  });
});
