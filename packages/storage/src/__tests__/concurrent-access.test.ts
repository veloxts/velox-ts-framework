/**
 * Concurrent Access Tests
 *
 * Tests for parallel operations, race conditions, and concurrent access patterns.
 */

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createLocalStore } from '../drivers/local.js';
import { createStorageManager, type StorageManager } from '../manager.js';
import type { StorageStore } from '../types.js';

const TEST_ROOT = join(process.cwd(), '.test-storage-concurrent');

describe('Concurrent Access', () => {
  let store: StorageStore;
  let manager: StorageManager;

  beforeAll(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
    await mkdir(TEST_ROOT, { recursive: true });

    store = createLocalStore({
      driver: 'local',
      root: TEST_ROOT,
      baseUrl: 'http://localhost:3030/files',
    });

    manager = await createStorageManager({
      driver: 'local',
      root: TEST_ROOT,
      baseUrl: 'http://localhost:3030/files',
    });
  });

  afterEach(async () => {
    await store.close();
    await manager.close();
  });

  describe('parallel write operations', () => {
    it('should handle many parallel put operations', async () => {
      const promises = Array.from({ length: 50 }, (_, i) =>
        store.put(`parallel-${i}.txt`, `Content for file ${i}`)
      );

      await Promise.all(promises);

      // Verify all files were created
      for (let i = 0; i < 50; i++) {
        expect(await store.exists(`parallel-${i}.txt`)).toBe(true);
        const content = await store.get(`parallel-${i}.txt`);
        expect(content?.toString()).toBe(`Content for file ${i}`);
      }
    });

    it('should handle parallel puts to different directories', async () => {
      const directories = ['uploads', 'images', 'documents', 'temp'];
      const promises: Promise<string>[] = [];

      for (const dir of directories) {
        for (let i = 0; i < 10; i++) {
          promises.push(store.put(`${dir}/file-${i}.txt`, `${dir}-${i}`));
        }
      }

      await Promise.all(promises);

      // Verify all files exist
      for (const dir of directories) {
        for (let i = 0; i < 10; i++) {
          expect(await store.exists(`${dir}/file-${i}.txt`)).toBe(true);
        }
      }
    });

    it('should handle parallel puts to deeply nested paths', async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        store.put(`a/b/c/d/e/f/file-${i}.txt`, `Nested content ${i}`)
      );

      await Promise.all(promises);

      for (let i = 0; i < 20; i++) {
        expect(await store.exists(`a/b/c/d/e/f/file-${i}.txt`)).toBe(true);
      }
    });

    it('should handle parallel writes to same file (last write wins)', async () => {
      const writes = Array.from({ length: 20 }, (_, i) =>
        store.put('contested.txt', `Content version ${i}`)
      );

      await Promise.all(writes);

      // Some version should have won
      const content = await store.get('contested.txt');
      expect(content?.toString()).toMatch(/Content version \d+/);
    });
  });

  describe('parallel read operations', () => {
    it('should handle many parallel get operations', async () => {
      // Setup data
      for (let i = 0; i < 30; i++) {
        await store.put(`read-${i}.txt`, `Read content ${i}`);
      }

      // Read all in parallel
      const promises = Array.from({ length: 30 }, (_, i) => store.get(`read-${i}.txt`));
      const results = await Promise.all(promises);

      // Verify all reads succeeded
      results.forEach((result, i) => {
        expect(result?.toString()).toBe(`Read content ${i}`);
      });
    });

    it('should handle parallel exists() checks', async () => {
      await store.put('exists-file.txt', 'content');

      const promises = [
        ...Array.from({ length: 20 }, () => store.exists('exists-file.txt')),
        ...Array.from({ length: 20 }, () => store.exists('nonexistent.txt')),
      ];

      const results = await Promise.all(promises);

      expect(results.slice(0, 20).every((r) => r === true)).toBe(true);
      expect(results.slice(20).every((r) => r === false)).toBe(true);
    });

    it('should handle parallel metadata() calls', async () => {
      for (let i = 0; i < 10; i++) {
        await store.put(`meta-${i}.txt`, `Content ${i}`);
      }

      const promises = Array.from({ length: 10 }, (_, i) => store.metadata(`meta-${i}.txt`));
      const results = await Promise.all(promises);

      results.forEach((meta, i) => {
        expect(meta).not.toBeNull();
        expect(meta?.path).toBe(`meta-${i}.txt`);
      });
    });

    it('should handle parallel stream() calls', async () => {
      for (let i = 0; i < 5; i++) {
        await store.put(`stream-${i}.txt`, `Streaming data ${i}`);
      }

      const streamPromises = Array.from({ length: 5 }, (_, i) => store.stream(`stream-${i}.txt`));
      const streams = await Promise.all(streamPromises);

      // Read all streams in parallel
      const readPromises = streams.map(async (stream, i) => {
        if (!stream) return null;
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks).toString();
      });

      const results = await Promise.all(readPromises);

      results.forEach((content, i) => {
        expect(content).toBe(`Streaming data ${i}`);
      });
    });
  });

  describe('mixed read/write operations', () => {
    it('should handle interleaved reads and writes to different files', async () => {
      // Use different files to avoid race conditions during file overwrite
      const writePromises = Array.from({ length: 20 }, (_, i) =>
        store.put(`mixed-${i}.txt`, `Content ${i}`)
      );

      await Promise.all(writePromises);

      // Now interleave reads and writes to different files
      const operations = Array.from({ length: 40 }, (_, i) => {
        if (i % 2 === 0) {
          return store.put(`new-${i}.txt`, `New content ${i}`);
        }
        return store.get(`mixed-${i % 20}.txt`);
      });

      const results = await Promise.all(operations);

      // Reads should return content
      const reads = results.filter((_, i) => i % 2 === 1);
      reads.forEach((result, idx) => {
        expect(result).not.toBeNull();
        expect(result?.toString()).toMatch(/Content \d+/);
      });
    });

    it('should handle concurrent copy and read', async () => {
      await store.put('source.txt', 'Source content');

      const operations = [
        store.copy('source.txt', 'copy1.txt'),
        store.copy('source.txt', 'copy2.txt'),
        store.copy('source.txt', 'copy3.txt'),
        store.get('source.txt'),
        store.get('source.txt'),
      ];

      const results = await Promise.all(operations);

      // All copies should succeed
      expect(await store.exists('copy1.txt')).toBe(true);
      expect(await store.exists('copy2.txt')).toBe(true);
      expect(await store.exists('copy3.txt')).toBe(true);

      // Source should still be readable
      const content = await store.get('source.txt');
      expect(content?.toString()).toBe('Source content');
    });
  });

  describe('parallel delete operations', () => {
    it('should handle many parallel delete operations', async () => {
      // Setup files
      for (let i = 0; i < 30; i++) {
        await store.put(`delete-${i}.txt`, `Content ${i}`);
      }

      // Delete all in parallel
      const promises = Array.from({ length: 30 }, (_, i) => store.delete(`delete-${i}.txt`));
      const results = await Promise.all(promises);

      // All deletes should succeed
      expect(results.every((r) => r === true)).toBe(true);

      // Verify all files are gone
      for (let i = 0; i < 30; i++) {
        expect(await store.exists(`delete-${i}.txt`)).toBe(false);
      }
    });

    it('should handle parallel deleteMany operations', async () => {
      // Setup files in batches
      for (let batch = 0; batch < 5; batch++) {
        for (let i = 0; i < 10; i++) {
          await store.put(`batch${batch}/file${i}.txt`, 'Content');
        }
      }

      // Delete batches in parallel
      const batchPromises = Array.from({ length: 5 }, (_, batch) => {
        const paths = Array.from({ length: 10 }, (_, i) => `batch${batch}/file${i}.txt`);
        return store.deleteMany(paths);
      });

      const results = await Promise.all(batchPromises);

      // Each batch should have deleted 10 files
      expect(results.every((r) => r === 10)).toBe(true);
    });

    it('should handle concurrent delete of same file', async () => {
      await store.put('single.txt', 'Content');

      // Multiple deletes of same file
      const promises = Array.from({ length: 10 }, () => store.delete('single.txt'));
      const results = await Promise.all(promises);

      // Only one should succeed, rest should return false
      const successCount = results.filter((r) => r === true).length;
      expect(successCount).toBeGreaterThanOrEqual(1);

      // File should be gone
      expect(await store.exists('single.txt')).toBe(false);
    });
  });

  describe('parallel visibility operations', () => {
    it('should handle parallel visibility changes', async () => {
      // Setup files
      for (let i = 0; i < 20; i++) {
        await store.put(`vis-${i}.txt`, 'Content', { visibility: 'private' });
      }

      // Change visibility in parallel
      const promises = Array.from({ length: 20 }, (_, i) =>
        store.setVisibility(`vis-${i}.txt`, i % 2 === 0 ? 'public' : 'private')
      );

      await Promise.all(promises);

      // Verify visibility was set correctly
      for (let i = 0; i < 20; i++) {
        const visibility = await store.getVisibility(`vis-${i}.txt`);
        expect(visibility).toBe(i % 2 === 0 ? 'public' : 'private');
      }
    });

    it('should handle parallel getVisibility calls', async () => {
      await store.put('check-vis.txt', 'Content', { visibility: 'public' });

      const promises = Array.from({ length: 30 }, () => store.getVisibility('check-vis.txt'));
      const results = await Promise.all(promises);

      expect(results.every((r) => r === 'public')).toBe(true);
    });
  });

  describe('parallel list operations', () => {
    it('should handle parallel list() calls', async () => {
      // Setup files in multiple directories
      for (const dir of ['list-a', 'list-b', 'list-c']) {
        for (let i = 0; i < 5; i++) {
          await store.put(`${dir}/file${i}.txt`, 'Content');
        }
      }

      // List all directories in parallel
      const promises = ['list-a', 'list-b', 'list-c'].map((dir) => store.list(dir));
      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result.files).toHaveLength(5);
      });
    });

    it('should handle list during concurrent writes', async () => {
      await mkdir(join(TEST_ROOT, 'dynamic'), { recursive: true });

      // Write and list concurrently
      const writePromises = Array.from({ length: 10 }, (_, i) =>
        store.put(`dynamic/file${i}.txt`, 'Content')
      );

      const listPromises = Array.from({ length: 5 }, () =>
        store.list('dynamic', { recursive: true })
      );

      await Promise.all([...writePromises, ...listPromises]);

      // Final list should show all files
      const finalList = await store.list('dynamic');
      expect(finalList.files.length).toBe(10);
    });
  });

  describe('stress tests', () => {
    it('should handle high volume of mixed operations', async () => {
      const operations: Promise<unknown>[] = [];

      // 50 puts
      for (let i = 0; i < 50; i++) {
        operations.push(store.put(`stress/${i}.txt`, `Stress content ${i}`));
      }

      await Promise.all(operations);
      operations.length = 0;

      // 30 gets
      for (let i = 0; i < 30; i++) {
        operations.push(store.get(`stress/${i}.txt`));
      }

      // 20 exists checks
      for (let i = 30; i < 50; i++) {
        operations.push(store.exists(`stress/${i}.txt`));
      }

      // 10 metadata calls
      for (let i = 0; i < 10; i++) {
        operations.push(store.metadata(`stress/${i}.txt`));
      }

      const results = await Promise.all(operations);

      // Verify gets returned content
      for (let i = 0; i < 30; i++) {
        const content = results[i] as Buffer | null;
        expect(content?.toString()).toBe(`Stress content ${i}`);
      }

      // Verify exists returned true
      for (let i = 30; i < 50; i++) {
        expect(results[i]).toBe(true);
      }
    });

    it('should maintain consistency under concurrent move operations', async () => {
      // Setup source files
      for (let i = 0; i < 20; i++) {
        await store.put(`src/file${i}.txt`, `Move content ${i}`);
      }

      // Move all files to destination
      const movePromises = Array.from({ length: 20 }, (_, i) =>
        store.move(`src/file${i}.txt`, `dest/file${i}.txt`)
      );

      await Promise.all(movePromises);

      // All source files should be gone
      for (let i = 0; i < 20; i++) {
        expect(await store.exists(`src/file${i}.txt`)).toBe(false);
      }

      // All destination files should exist with correct content
      for (let i = 0; i < 20; i++) {
        expect(await store.exists(`dest/file${i}.txt`)).toBe(true);
        const content = await store.get(`dest/file${i}.txt`);
        expect(content?.toString()).toBe(`Move content ${i}`);
      }
    });
  });

  describe('buffer and stream handling', () => {
    it('should handle parallel large buffer writes', async () => {
      const largeBuffer = Buffer.alloc(1024 * 100, 'A'); // 100KB

      const promises = Array.from({ length: 10 }, (_, i) =>
        store.put(`large-${i}.bin`, largeBuffer)
      );

      await Promise.all(promises);

      // Verify all files have correct size
      for (let i = 0; i < 10; i++) {
        const meta = await store.metadata(`large-${i}.bin`);
        expect(meta?.size).toBe(1024 * 100);
      }
    });

    it('should handle parallel reads of same large file', async () => {
      const largeContent = 'X'.repeat(50000);
      await store.put('shared-large.txt', largeContent);

      // Read the same file many times in parallel
      const promises = Array.from({ length: 20 }, () => store.get('shared-large.txt'));
      const results = await Promise.all(promises);

      // All should return the same content
      results.forEach((result) => {
        expect(result?.toString()).toBe(largeContent);
      });
    });
  });
});
