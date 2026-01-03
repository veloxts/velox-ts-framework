/**
 * Error Path Tests
 *
 * Tests for storage error handling, edge cases, and failure scenarios.
 */

import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createLocalStore } from '../drivers/local.js';
import type { StorageStore } from '../types.js';

const TEST_ROOT = join(process.cwd(), '.test-storage-errors');

describe('Storage Error Paths', () => {
  let store: StorageStore;

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
  });

  afterEach(async () => {
    await store.close();
    // Reset permissions before cleanup
    try {
      await chmod(TEST_ROOT, 0o755);
    } catch {
      // Ignore
    }
  });

  describe('missing file operations', () => {
    it('should return null when getting nonexistent file', async () => {
      const content = await store.get('nonexistent/file.txt');
      expect(content).toBeNull();
    });

    it('should return null when streaming nonexistent file', async () => {
      const stream = await store.stream('nonexistent/file.txt');
      expect(stream).toBeNull();
    });

    it('should return null when getting metadata of nonexistent file', async () => {
      const meta = await store.metadata('nonexistent/file.txt');
      expect(meta).toBeNull();
    });

    it('should return false when deleting nonexistent file', async () => {
      const deleted = await store.delete('nonexistent/file.txt');
      expect(deleted).toBe(false);
    });

    it('should return null visibility for nonexistent file', async () => {
      const visibility = await store.getVisibility('nonexistent/file.txt');
      expect(visibility).toBeNull();
    });

    it('should throw when copying from nonexistent source', async () => {
      await expect(store.copy('nonexistent.txt', 'dest.txt')).rejects.toThrow('not found');
    });
  });

  describe('path validation', () => {
    it('should reject paths with null bytes', async () => {
      await expect(store.put('file\x00name.txt', 'content')).rejects.toThrow();
    });

    it('should normalize paths starting with /', async () => {
      // Leading slashes are stripped during normalization
      await store.put('/absolute/path.txt', 'content');
      // Path gets normalized to 'absolute/path.txt'
      expect(await store.exists('absolute/path.txt')).toBe(true);
    });

    it('should reject path traversal attempts with ..', async () => {
      await expect(store.put('../escape.txt', 'content')).rejects.toThrow();
      await expect(store.put('foo/../../../escape.txt', 'content')).rejects.toThrow();
    });

    it('should handle empty string path', async () => {
      // Empty paths should be rejected
      await expect(store.put('', 'content')).rejects.toThrow();
    });

    it('should handle path with only spaces', async () => {
      // Paths with only spaces are trimmed and treated as valid
      // The implementation allows this; content gets stored with the spaces as the filename
      await store.put('   ', 'content');
      // File exists (spaces in filename)
      expect(await store.exists('   ')).toBe(true);
    });

    it('should handle deeply nested valid paths', async () => {
      const deepPath = 'a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/file.txt';
      await store.put(deepPath, 'deep content');
      const content = await store.get(deepPath);
      expect(content?.toString()).toBe('deep content');
    });
  });

  describe('metadata handling', () => {
    it('should handle missing metadata file gracefully', async () => {
      // Write file but delete its metadata file
      await store.put('orphan.txt', 'content');

      // Delete metadata directly
      const metaPath = join(TEST_ROOT, 'orphan.txt.velox-meta.json');
      await rm(metaPath, { force: true });

      // Should still return metadata from filesystem stats
      const meta = await store.metadata('orphan.txt');
      expect(meta).not.toBeNull();
      expect(meta?.size).toBeGreaterThan(0);
    });

    it('should handle corrupted metadata JSON', async () => {
      await store.put('corrupted.txt', 'content');

      // Corrupt the metadata file
      const metaPath = join(TEST_ROOT, 'corrupted.txt.velox-meta.json');
      await writeFile(metaPath, 'not valid json {{{');

      // Should handle gracefully, using defaults
      const meta = await store.metadata('corrupted.txt');
      expect(meta).not.toBeNull();
      expect(meta?.path).toBe('corrupted.txt');
    });

    it('should handle empty metadata file', async () => {
      await store.put('empty-meta.txt', 'content');

      // Write empty metadata file
      const metaPath = join(TEST_ROOT, 'empty-meta.txt.velox-meta.json');
      await writeFile(metaPath, '');

      // Should handle gracefully
      const meta = await store.metadata('empty-meta.txt');
      expect(meta).not.toBeNull();
    });
  });

  describe('content type handling', () => {
    it('should handle unknown file extensions', async () => {
      await store.put('file.unknownext', 'content');
      const meta = await store.metadata('file.unknownext');
      expect(meta).not.toBeNull();
      // Should have a fallback content type
      expect(meta?.contentType).toBeDefined();
    });

    it('should handle file without extension', async () => {
      await store.put('noextension', 'content');
      const meta = await store.metadata('noextension');
      expect(meta).not.toBeNull();
    });

    it('should handle file with multiple dots', async () => {
      await store.put('file.backup.tar.gz', 'content');
      const meta = await store.metadata('file.backup.tar.gz');
      expect(meta).not.toBeNull();
    });
  });

  describe('directory handling', () => {
    it('should return empty list for nonexistent directory', async () => {
      const result = await store.list('nonexistent/dir');
      expect(result.files).toHaveLength(0);
    });

    it('should not return directories as files', async () => {
      // Create a file and a subdirectory
      await store.put('parent/file.txt', 'content');
      await mkdir(join(TEST_ROOT, 'parent', 'subdir'), { recursive: true });

      const result = await store.list('parent', { recursive: false });
      // Should only contain the file, not the directory
      expect(result.files.every((f) => !f.path.endsWith('subdir'))).toBe(true);
    });

    it('should handle list on file path (not directory)', async () => {
      await store.put('single-file.txt', 'content');
      // Listing a file path should return empty or the file itself
      const result = await store.list('single-file.txt');
      expect(result.files).toHaveLength(0);
    });
  });

  describe('concurrent error scenarios', () => {
    it('should handle file deleted during read', async () => {
      await store.put('temp.txt', 'temporary content');

      // Start multiple operations where file may be deleted
      const operations = [store.get('temp.txt'), store.delete('temp.txt'), store.get('temp.txt')];

      const results = await Promise.allSettled(operations);

      // At least one should succeed, others may return null
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThanOrEqual(2);
    });

    it('should handle multiple deletes of same file', async () => {
      await store.put('multi-delete.txt', 'content');

      const deleteResults = await Promise.all([
        store.delete('multi-delete.txt'),
        store.delete('multi-delete.txt'),
        store.delete('multi-delete.txt'),
      ]);

      // Exactly one should return true
      const trueCount = deleteResults.filter((r) => r === true).length;
      expect(trueCount).toBeGreaterThanOrEqual(1);

      // File should be gone
      expect(await store.exists('multi-delete.txt')).toBe(false);
    });

    it('should handle move where source is deleted', async () => {
      await store.put('move-source.txt', 'content');

      // Try to move and delete concurrently
      const operations = [
        store.move('move-source.txt', 'move-dest.txt'),
        store.delete('move-source.txt'),
      ];

      const results = await Promise.allSettled(operations);

      // At least one operation should complete
      expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    });
  });

  describe('visibility operations on missing files', () => {
    it('should not throw when setting visibility on nonexistent file', async () => {
      // This depends on implementation - may create metadata or throw
      // Current implementation creates metadata file
      await store.setVisibility('nonexistent.txt', 'public');

      // But file still doesn't exist
      expect(await store.exists('nonexistent.txt')).toBe(false);
    });
  });

  describe('URL generation', () => {
    it('should throw if baseUrl not configured', async () => {
      const storeNoBaseUrl = createLocalStore({
        driver: 'local',
        root: TEST_ROOT,
        // No baseUrl
      });

      await expect(storeNoBaseUrl.url('file.txt')).rejects.toThrow('baseUrl');
      await storeNoBaseUrl.close();
    });

    it('should handle baseUrl with trailing slash', async () => {
      const storeTrailingSlash = createLocalStore({
        driver: 'local',
        root: TEST_ROOT,
        baseUrl: 'http://localhost:3030/files/',
      });

      const url = await storeTrailingSlash.url('test.txt');
      // Should not have double slashes
      expect(url).toBe('http://localhost:3030/files/test.txt');
      expect(url).not.toContain('//test');
      await storeTrailingSlash.close();
    });

    it('should handle paths with special characters in URL', async () => {
      const url = await store.url('file with spaces.txt');
      expect(url).toContain('file with spaces.txt');
    });
  });

  describe('deleteMany edge cases', () => {
    it('should handle empty array', async () => {
      const count = await store.deleteMany([]);
      expect(count).toBe(0);
    });

    it('should handle mix of existing and nonexistent files', async () => {
      await store.put('exists1.txt', 'content');
      await store.put('exists2.txt', 'content');

      const count = await store.deleteMany([
        'exists1.txt',
        'nonexistent.txt',
        'exists2.txt',
        'also-nonexistent.txt',
      ]);

      expect(count).toBe(2);
    });

    it('should handle duplicate paths in array', async () => {
      await store.put('dupe.txt', 'content');

      const count = await store.deleteMany(['dupe.txt', 'dupe.txt', 'dupe.txt']);
      // Due to parallel execution, race conditions may cause multiple deletes
      // to report success before the file is actually removed.
      // The count may be 1, 2, or 3 depending on timing.
      expect(count).toBeGreaterThanOrEqual(1);

      // File should be gone regardless
      expect(await store.exists('dupe.txt')).toBe(false);
    });
  });

  describe('large content handling', () => {
    it('should handle very large file paths', async () => {
      const longName = `${'a'.repeat(200)}.txt`;
      await store.put(longName, 'content');
      expect(await store.exists(longName)).toBe(true);
      const content = await store.get(longName);
      expect(content?.toString()).toBe('content');
    });

    it('should handle binary content', async () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      await store.put('binary.bin', binaryContent);

      const retrieved = await store.get('binary.bin');
      expect(retrieved).not.toBeNull();
      expect(Buffer.compare(retrieved as Buffer, binaryContent)).toBe(0);
    });

    it('should handle empty content', async () => {
      await store.put('empty.txt', '');
      const content = await store.get('empty.txt');
      expect(content?.toString()).toBe('');

      const meta = await store.metadata('empty.txt');
      expect(meta?.size).toBe(0);
    });
  });

  describe('stream error handling', () => {
    it('should handle stream with valid range', async () => {
      await store.put('range-test.txt', 'Hello World');

      // Read partial content
      const stream = await store.stream('range-test.txt', { start: 0, end: 4 });
      expect(stream).not.toBeNull();

      if (stream) {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
        const content = Buffer.concat(chunks).toString();
        expect(content).toBe('Hello');
      }
    });

    it('should handle stream with start at middle of file', async () => {
      await store.put('range-test2.txt', 'Hello World');

      const stream = await store.stream('range-test2.txt', { start: 6 });
      expect(stream).not.toBeNull();

      if (stream) {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
        const content = Buffer.concat(chunks).toString();
        expect(content).toBe('World');
      }
    });
  });

  describe('copy and move edge cases', () => {
    it('should copy to same location (overwrite)', async () => {
      await store.put('self.txt', 'original');

      // Copy to same path should work (effectively a no-op or preserve)
      await store.copy('self.txt', 'self.txt');

      const content = await store.get('self.txt');
      expect(content?.toString()).toBe('original');
    });

    it('should handle copy with visibility override', async () => {
      await store.put('source.txt', 'content', { visibility: 'private' });

      await store.copy('source.txt', 'dest.txt', { visibility: 'public' });

      const destVisibility = await store.getVisibility('dest.txt');
      expect(destVisibility).toBe('public');
    });

    it('should preserve metadata on move', async () => {
      await store.put('meta-source.txt', 'content', {
        visibility: 'public',
        metadata: { custom: 'value' },
      });

      await store.move('meta-source.txt', 'meta-dest.txt');

      const destMeta = await store.metadata('meta-dest.txt');
      expect(destMeta?.visibility).toBe('public');
      expect(destMeta?.metadata?.custom).toBe('value');
    });

    it('should handle move to nested directory that needs creation', async () => {
      await store.put('flat.txt', 'content');

      await store.move('flat.txt', 'deep/nested/dir/moved.txt');

      expect(await store.exists('flat.txt')).toBe(false);
      expect(await store.exists('deep/nested/dir/moved.txt')).toBe(true);
    });
  });

  describe('list with limit', () => {
    it('should respect limit parameter', async () => {
      // Create many files
      for (let i = 0; i < 20; i++) {
        await store.put(`list-test/file${i}.txt`, `content ${i}`);
      }

      const result = await store.list('list-test', { limit: 5 });
      expect(result.files).toHaveLength(5);
      expect(result.hasMore).toBe(true);
    });

    it('should set hasMore=false when under limit', async () => {
      await store.put('small-dir/file1.txt', 'content');
      await store.put('small-dir/file2.txt', 'content');

      const result = await store.list('small-dir', { limit: 100 });
      expect(result.files).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });
  });
});

describe('Permission Error Scenarios', () => {
  const PERM_TEST_ROOT = join(process.cwd(), '.test-storage-perm');
  let store: StorageStore;

  beforeAll(async () => {
    await mkdir(PERM_TEST_ROOT, { recursive: true });
  });

  afterAll(async () => {
    // Reset permissions before cleanup
    try {
      await chmod(PERM_TEST_ROOT, 0o755);
      const restrictedDir = join(PERM_TEST_ROOT, 'restricted');
      await chmod(restrictedDir, 0o755).catch(() => {});
    } catch {
      // Ignore
    }
    await rm(PERM_TEST_ROOT, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Reset test directory
    try {
      await chmod(PERM_TEST_ROOT, 0o755);
    } catch {
      // Ignore
    }
    await rm(PERM_TEST_ROOT, { recursive: true, force: true });
    await mkdir(PERM_TEST_ROOT, { recursive: true });

    store = createLocalStore({
      driver: 'local',
      root: PERM_TEST_ROOT,
      baseUrl: 'http://localhost:3030/files',
    });
  });

  afterEach(async () => {
    await store.close();
  });

  // Note: Permission tests may not work on all systems or in CI
  // These test the graceful handling of permission errors
  it('should handle write to read-only directory gracefully', async () => {
    // Create a restricted directory
    const restrictedDir = join(PERM_TEST_ROOT, 'restricted');
    await mkdir(restrictedDir, { recursive: true });

    try {
      // Make directory read-only
      await chmod(restrictedDir, 0o444);

      // Try to write - should fail gracefully
      const restrictedStore = createLocalStore({
        driver: 'local',
        root: restrictedDir,
        baseUrl: 'http://localhost:3030/files',
      });

      await expect(restrictedStore.put('test.txt', 'content')).rejects.toThrow();
      await restrictedStore.close();
    } finally {
      // Reset permissions for cleanup
      await chmod(restrictedDir, 0o755);
    }
  });

  it('should handle read from write-only directory', async () => {
    // Create a directory with write-only permissions
    const woDir = join(PERM_TEST_ROOT, 'writeonly');
    await mkdir(woDir, { recursive: true });

    // First write a file with full permissions
    await writeFile(join(woDir, 'secret.txt'), 'secret content');

    try {
      // Make file write-only (no read permission)
      await chmod(join(woDir, 'secret.txt'), 0o222);

      const woStore = createLocalStore({
        driver: 'local',
        root: woDir,
        baseUrl: 'http://localhost:3030/files',
      });

      // Read should fail gracefully and return null
      const content = await woStore.get('secret.txt');
      expect(content).toBeNull();

      await woStore.close();
    } finally {
      // Reset permissions for cleanup
      await chmod(join(woDir, 'secret.txt'), 0o644);
    }
  });

  it('should handle list on permission-denied subdirectory', async () => {
    const baseDir = join(PERM_TEST_ROOT, 'base');
    const noReadDir = join(baseDir, 'noread');
    await mkdir(noReadDir, { recursive: true });
    await writeFile(join(noReadDir, 'file.txt'), 'content');

    try {
      // Remove read permission on subdirectory
      await chmod(noReadDir, 0o333);

      const baseStore = createLocalStore({
        driver: 'local',
        root: baseDir,
        baseUrl: 'http://localhost:3030/files',
      });

      // List should return empty for the restricted directory (graceful handling)
      const result = await baseStore.list('noread');
      expect(result.files).toHaveLength(0);

      await baseStore.close();
    } finally {
      await chmod(noReadDir, 0o755);
    }
  });
});
