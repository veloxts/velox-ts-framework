/**
 * Storage Manager Tests
 */

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createStorageManager, type StorageManager } from '../manager.js';

const TEST_ROOT = join(process.cwd(), '.test-storage-manager');

describe('Storage Manager', () => {
  let storage: StorageManager;

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
  });

  describe('createStorageManager', () => {
    it('should create local storage by default', async () => {
      storage = await createStorageManager({
        root: TEST_ROOT,
      });

      await storage.put('test.txt', 'Hello');
      expect(await storage.exists('test.txt')).toBe(true);

      await storage.close();
    });

    it('should create local storage with explicit driver', async () => {
      storage = await createStorageManager({
        driver: 'local',
        root: TEST_ROOT,
        baseUrl: 'http://localhost:3030/files',
      });

      await storage.put('test.txt', 'Hello');
      const url = await storage.url('test.txt');
      expect(url).toBe('http://localhost:3030/files/test.txt');

      await storage.close();
    });

    it('should use default root when not specified', async () => {
      // This should use ./storage as default root
      storage = await createStorageManager({});

      // Just verify it was created without errors
      expect(storage).toBeDefined();
      expect(typeof storage.put).toBe('function');

      await storage.close();
    });
  });

  describe('type-safe config narrowing', () => {
    it('should accept local driver options', async () => {
      storage = await createStorageManager({
        driver: 'local',
        root: TEST_ROOT,
        baseUrl: 'http://localhost:3030/files',
        defaultVisibility: 'public',
      });

      await storage.put('test.txt', 'Content');
      const visibility = await storage.getVisibility('test.txt');
      expect(visibility).toBe('public');

      await storage.close();
    });

    it('should accept default options (no driver)', async () => {
      storage = await createStorageManager({
        root: TEST_ROOT,
        defaultVisibility: 'private',
      });

      await storage.put('test.txt', 'Content');
      expect(await storage.exists('test.txt')).toBe(true);

      await storage.close();
    });
  });

  describe('unified API', () => {
    beforeEach(async () => {
      storage = await createStorageManager({
        driver: 'local',
        root: TEST_ROOT,
        baseUrl: 'http://localhost:3030/files',
      });
    });

    afterEach(async () => {
      await storage.close();
    });

    it('should put and get files', async () => {
      await storage.put('document.txt', 'Hello, Storage!');
      const content = await storage.get('document.txt');
      expect(content?.toString()).toBe('Hello, Storage!');
    });

    it('should stream files', async () => {
      await storage.put('large.txt', 'Streaming content');
      const stream = await storage.stream('large.txt');
      expect(stream).not.toBeNull();

      const chunks: Buffer[] = [];
      if (stream) {
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
      }
      expect(Buffer.concat(chunks).toString()).toBe('Streaming content');
    });

    it('should check file existence', async () => {
      expect(await storage.exists('missing.txt')).toBe(false);

      await storage.put('exists.txt', 'Here');
      expect(await storage.exists('exists.txt')).toBe(true);
    });

    it('should delete files', async () => {
      await storage.put('delete-me.txt', 'Goodbye');
      expect(await storage.exists('delete-me.txt')).toBe(true);

      await storage.delete('delete-me.txt');
      expect(await storage.exists('delete-me.txt')).toBe(false);
    });

    it('should delete multiple files', async () => {
      await storage.put('batch1.txt', 'Content');
      await storage.put('batch2.txt', 'Content');

      const count = await storage.deleteMany(['batch1.txt', 'batch2.txt']);
      expect(count).toBe(2);
    });

    it('should copy files', async () => {
      await storage.put('original.txt', 'Copy me');

      await storage.copy('original.txt', 'copied.txt');
      expect(await storage.exists('original.txt')).toBe(true);
      expect(await storage.exists('copied.txt')).toBe(true);
    });

    it('should move files', async () => {
      await storage.put('old-location.txt', 'Move me');

      await storage.move('old-location.txt', 'new-location.txt');
      expect(await storage.exists('old-location.txt')).toBe(false);
      expect(await storage.exists('new-location.txt')).toBe(true);
    });

    it('should get file metadata', async () => {
      await storage.put('meta.txt', 'Metadata test');

      const meta = await storage.metadata('meta.txt');
      expect(meta).not.toBeNull();
      expect(meta?.path).toBe('meta.txt');
      expect(meta?.size).toBe(13);
    });

    it('should list files', async () => {
      await storage.put('dir/file1.txt', 'Content');
      await storage.put('dir/file2.txt', 'Content');

      const result = await storage.list('dir');
      expect(result.files).toHaveLength(2);
    });

    it('should generate URLs', async () => {
      await storage.put('public.jpg', Buffer.from([0xff]));

      const url = await storage.url('public.jpg');
      expect(url).toContain('public.jpg');
    });

    it('should manage visibility', async () => {
      await storage.put('file.txt', 'Content', { visibility: 'private' });
      expect(await storage.getVisibility('file.txt')).toBe('private');

      await storage.setVisibility('file.txt', 'public');
      expect(await storage.getVisibility('file.txt')).toBe('public');
    });
  });
});

describe('storage alias', () => {
  it('should export storage as alias for createStorageManager', async () => {
    const { storage } = await import('../manager.js');
    expect(storage).toBe(createStorageManager);
  });
});
