/**
 * Tests for head() method
 */

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createLocalStore } from '../drivers/local.js';
import { isStorageObjectNotFoundError, StorageObjectNotFoundError } from '../errors.js';
import type { StorageStore } from '../types.js';

const TEST_ROOT = join(process.cwd(), '.test-storage-head');

describe('head() method', () => {
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
      defaultVisibility: 'private',
    });
  });

  it('should return metadata for existing file', async () => {
    const content = 'Hello, World!';
    await store.put('test.txt', content);

    const meta = await store.head('test.txt');
    expect(meta.path).toBe('test.txt');
    expect(meta.size).toBe(content.length);
    expect(meta.lastModified).toBeInstanceOf(Date);
  });

  it('should return content type for existing file', async () => {
    await store.put('data.json', '{"foo": "bar"}', { contentType: 'application/json' });

    const meta = await store.head('data.json');
    expect(meta.contentType).toBe('application/json');
  });

  it('should throw StorageObjectNotFoundError for non-existent file', async () => {
    await expect(store.head('nonexistent.txt')).rejects.toThrow(StorageObjectNotFoundError);
  });

  it('should include key in StorageObjectNotFoundError', async () => {
    try {
      await store.head('missing-file.txt');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isStorageObjectNotFoundError(error)).toBe(true);
      if (isStorageObjectNotFoundError(error)) {
        expect(error.key).toBe('missing-file.txt');
        expect(error.code).toBe('STORAGE_OBJECT_NOT_FOUND');
      }
    }
  });

  it('should return visibility metadata', async () => {
    await store.put('public-file.txt', 'Public content', { visibility: 'public' });

    const meta = await store.head('public-file.txt');
    expect(meta.visibility).toBe('public');
  });

  it('should return custom metadata', async () => {
    await store.put('file-with-meta.txt', 'Content', {
      metadata: { author: 'Test User', version: '1.0' },
    });

    const meta = await store.head('file-with-meta.txt');
    expect(meta.metadata?.author).toBe('Test User');
    expect(meta.metadata?.version).toBe('1.0');
  });

  it('should handle nested paths', async () => {
    await store.put('a/b/c/nested.txt', 'Nested content');

    const meta = await store.head('a/b/c/nested.txt');
    expect(meta.path).toBe('a/b/c/nested.txt');
  });

  it('should throw for path that is a directory', async () => {
    await store.put('dir/file.txt', 'Content');

    // Trying to head the directory itself should throw
    await expect(store.head('dir')).rejects.toThrow(StorageObjectNotFoundError);
  });
});
