/**
 * Local Storage Driver Tests
 */

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createLocalStore } from '../drivers/local.js';
import type { StorageStore } from '../types.js';

const TEST_ROOT = join(process.cwd(), '.test-storage');

describe('Local Storage Driver', () => {
  let store: StorageStore;

  beforeAll(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Clean test directory
    await rm(TEST_ROOT, { recursive: true, force: true });
    await mkdir(TEST_ROOT, { recursive: true });

    store = createLocalStore({
      driver: 'local',
      root: TEST_ROOT,
      baseUrl: 'http://localhost:3030/files',
      defaultVisibility: 'private',
    });
  });

  describe('put', () => {
    it('should store a file from buffer', async () => {
      const content = Buffer.from('Hello, World!');
      const path = await store.put('test.txt', content);

      expect(path).toBe('test.txt');
      expect(await store.exists('test.txt')).toBe(true);
    });

    it('should store a file from string', async () => {
      const path = await store.put('test.txt', 'Hello, World!');

      expect(path).toBe('test.txt');
      const content = await store.get('test.txt');
      expect(content?.toString()).toBe('Hello, World!');
    });

    it('should store a file from stream', async () => {
      const stream = Readable.from(['Hello, ', 'World!']);
      const path = await store.put('test.txt', stream);

      expect(path).toBe('test.txt');
      const content = await store.get('test.txt');
      expect(content?.toString()).toBe('Hello, World!');
    });

    it('should create nested directories', async () => {
      const path = await store.put('a/b/c/test.txt', 'Nested');

      expect(path).toBe('a/b/c/test.txt');
      expect(await store.exists('a/b/c/test.txt')).toBe(true);
    });

    it('should store file with custom content type', async () => {
      await store.put('data.json', '{"foo": "bar"}', {
        contentType: 'application/json',
      });

      const meta = await store.metadata('data.json');
      expect(meta?.contentType).toBe('application/json');
    });

    it('should store file with visibility', async () => {
      await store.put('public-file.txt', 'Public', { visibility: 'public' });

      const visibility = await store.getVisibility('public-file.txt');
      expect(visibility).toBe('public');
    });

    it('should store file with custom metadata', async () => {
      await store.put('file.txt', 'Content', {
        metadata: { author: 'Test', version: '1.0' },
      });

      const meta = await store.metadata('file.txt');
      expect(meta?.metadata?.author).toBe('Test');
      expect(meta?.metadata?.version).toBe('1.0');
    });
  });

  describe('get', () => {
    it('should retrieve file content', async () => {
      await store.put('test.txt', 'Hello, World!');

      const content = await store.get('test.txt');
      expect(content?.toString()).toBe('Hello, World!');
    });

    it('should return null for non-existent file', async () => {
      const content = await store.get('nonexistent.txt');
      expect(content).toBeNull();
    });
  });

  describe('stream', () => {
    it('should return a readable stream', async () => {
      await store.put('test.txt', 'Hello, World!');

      const stream = await store.stream('test.txt');
      expect(stream).not.toBeNull();

      const chunks: Buffer[] = [];
      if (stream) {
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
      }
      expect(Buffer.concat(chunks).toString()).toBe('Hello, World!');
    });

    it('should return null for non-existent file', async () => {
      const stream = await store.stream('nonexistent.txt');
      expect(stream).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      await store.put('test.txt', 'Hello');
      expect(await store.exists('test.txt')).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      expect(await store.exists('nonexistent.txt')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete a file', async () => {
      await store.put('test.txt', 'Hello');
      expect(await store.exists('test.txt')).toBe(true);

      const deleted = await store.delete('test.txt');
      expect(deleted).toBe(true);
      expect(await store.exists('test.txt')).toBe(false);
    });

    it('should return false for non-existent file', async () => {
      const deleted = await store.delete('nonexistent.txt');
      expect(deleted).toBe(false);
    });

    it('should delete metadata file', async () => {
      await store.put('test.txt', 'Hello', { visibility: 'public' });
      await store.delete('test.txt');

      const visibility = await store.getVisibility('test.txt');
      expect(visibility).toBeNull();
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple files', async () => {
      await store.put('file1.txt', 'Content 1');
      await store.put('file2.txt', 'Content 2');
      await store.put('file3.txt', 'Content 3');

      const count = await store.deleteMany(['file1.txt', 'file2.txt', 'file3.txt']);
      expect(count).toBe(3);

      expect(await store.exists('file1.txt')).toBe(false);
      expect(await store.exists('file2.txt')).toBe(false);
      expect(await store.exists('file3.txt')).toBe(false);
    });

    it('should handle partial deletes', async () => {
      await store.put('file1.txt', 'Content 1');

      const count = await store.deleteMany(['file1.txt', 'nonexistent.txt']);
      expect(count).toBe(1);
    });

    it('should handle empty array', async () => {
      const count = await store.deleteMany([]);
      expect(count).toBe(0);
    });
  });

  describe('copy', () => {
    it('should copy a file', async () => {
      await store.put('source.txt', 'Hello, World!');

      const destPath = await store.copy('source.txt', 'destination.txt');
      expect(destPath).toBe('destination.txt');

      expect(await store.exists('source.txt')).toBe(true);
      expect(await store.exists('destination.txt')).toBe(true);

      const content = await store.get('destination.txt');
      expect(content?.toString()).toBe('Hello, World!');
    });

    it('should copy visibility', async () => {
      await store.put('source.txt', 'Hello', { visibility: 'public' });

      await store.copy('source.txt', 'dest.txt');
      const visibility = await store.getVisibility('dest.txt');
      expect(visibility).toBe('public');
    });

    it('should override visibility', async () => {
      await store.put('source.txt', 'Hello', { visibility: 'public' });

      await store.copy('source.txt', 'dest.txt', { visibility: 'private' });
      const visibility = await store.getVisibility('dest.txt');
      expect(visibility).toBe('private');
    });

    it('should throw for non-existent source', async () => {
      await expect(store.copy('nonexistent.txt', 'dest.txt')).rejects.toThrow();
    });
  });

  describe('move', () => {
    it('should move a file', async () => {
      await store.put('source.txt', 'Hello, World!');

      const destPath = await store.move('source.txt', 'destination.txt');
      expect(destPath).toBe('destination.txt');

      expect(await store.exists('source.txt')).toBe(false);
      expect(await store.exists('destination.txt')).toBe(true);

      const content = await store.get('destination.txt');
      expect(content?.toString()).toBe('Hello, World!');
    });

    it('should preserve metadata', async () => {
      await store.put('source.txt', 'Hello', {
        visibility: 'public',
        metadata: { key: 'value' },
      });

      await store.move('source.txt', 'dest.txt');
      const meta = await store.metadata('dest.txt');
      expect(meta?.metadata?.key).toBe('value');
    });
  });

  describe('metadata', () => {
    it('should return file metadata', async () => {
      await store.put('test.txt', 'Hello, World!');

      const meta = await store.metadata('test.txt');
      expect(meta).not.toBeNull();
      expect(meta?.path).toBe('test.txt');
      expect(meta?.size).toBe(13); // "Hello, World!" length
      expect(meta?.lastModified).toBeInstanceOf(Date);
    });

    it('should return null for non-existent file', async () => {
      const meta = await store.metadata('nonexistent.txt');
      expect(meta).toBeNull();
    });

    it('should detect content type', async () => {
      await store.put('image.jpg', Buffer.from([0xff, 0xd8, 0xff]));

      const meta = await store.metadata('image.jpg');
      expect(meta?.contentType).toBe('image/jpeg');
    });
  });

  describe('list', () => {
    it('should list files in directory', async () => {
      await store.put('uploads/file1.txt', 'Content 1');
      await store.put('uploads/file2.txt', 'Content 2');
      await store.put('other/file3.txt', 'Content 3');

      const result = await store.list('uploads');
      expect(result.files).toHaveLength(2);
      expect(result.files.map((f) => f.path)).toContain('uploads/file1.txt');
      expect(result.files.map((f) => f.path)).toContain('uploads/file2.txt');
    });

    it('should list recursively', async () => {
      await store.put('a/file1.txt', 'Content 1');
      await store.put('a/b/file2.txt', 'Content 2');
      await store.put('a/b/c/file3.txt', 'Content 3');

      const result = await store.list('a', { recursive: true });
      expect(result.files).toHaveLength(3);
    });

    it('should respect limit', async () => {
      await store.put('dir/file1.txt', 'Content');
      await store.put('dir/file2.txt', 'Content');
      await store.put('dir/file3.txt', 'Content');

      const result = await store.list('dir', { limit: 2 });
      expect(result.files).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it('should handle empty directory', async () => {
      const result = await store.list('empty');
      expect(result.files).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('url', () => {
    it('should return public URL', async () => {
      await store.put('uploads/image.jpg', Buffer.from([0xff]));

      const url = await store.url('uploads/image.jpg');
      expect(url).toBe('http://localhost:3030/files/uploads/image.jpg');
    });

    it('should throw if baseUrl not configured', async () => {
      const noUrlStore = createLocalStore({
        driver: 'local',
        root: TEST_ROOT,
      });

      await expect(noUrlStore.url('test.txt')).rejects.toThrow('baseUrl is not configured');
    });
  });

  describe('visibility', () => {
    it('should set visibility', async () => {
      await store.put('test.txt', 'Hello');
      await store.setVisibility('test.txt', 'public');

      const visibility = await store.getVisibility('test.txt');
      expect(visibility).toBe('public');
    });

    it('should get visibility', async () => {
      await store.put('test.txt', 'Hello', { visibility: 'private' });

      const visibility = await store.getVisibility('test.txt');
      expect(visibility).toBe('private');
    });

    it('should return null for non-existent file', async () => {
      const visibility = await store.getVisibility('nonexistent.txt');
      expect(visibility).toBeNull();
    });
  });

  describe('path validation', () => {
    it('should reject path traversal', async () => {
      await expect(store.put('../escape.txt', 'Malicious')).rejects.toThrow('path traversal');
    });

    it('should reject null bytes', async () => {
      await expect(store.put('file\0name.txt', 'Malicious')).rejects.toThrow('null byte');
    });

    it('should reject empty path', async () => {
      await expect(store.put('', 'Content')).rejects.toThrow('cannot be empty');
    });
  });

  describe('close', () => {
    it('should close without error', async () => {
      await expect(store.close()).resolves.not.toThrow();
    });
  });
});
