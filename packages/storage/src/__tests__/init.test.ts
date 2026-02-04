/**
 * Tests for init() lifecycle method
 */

import { access, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createLocalStore } from '../drivers/local.js';

const TEST_ROOT = join(process.cwd(), '.test-storage-init');

describe('init() lifecycle method', () => {
  afterAll(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  describe('Local driver', () => {
    it('should create root directory on init', async () => {
      const store = createLocalStore({
        driver: 'local',
        root: TEST_ROOT,
        baseUrl: 'http://localhost:3030/files',
      });

      // Directory should not exist yet
      await expect(access(TEST_ROOT)).rejects.toThrow();

      // Call init
      await store.init?.();

      // Directory should now exist
      await expect(access(TEST_ROOT)).resolves.not.toThrow();
    });

    it('should not fail if directory already exists', async () => {
      await mkdir(TEST_ROOT, { recursive: true });

      const store = createLocalStore({
        driver: 'local',
        root: TEST_ROOT,
        baseUrl: 'http://localhost:3030/files',
      });

      // Should not throw
      await expect(store.init?.()).resolves.not.toThrow();
    });

    it('should create nested directory structure', async () => {
      const nestedRoot = join(TEST_ROOT, 'a', 'b', 'c');

      const store = createLocalStore({
        driver: 'local',
        root: nestedRoot,
        baseUrl: 'http://localhost:3030/files',
      });

      await store.init?.();

      await expect(access(nestedRoot)).resolves.not.toThrow();
    });
  });

  describe('StorageStore interface', () => {
    it('should have optional init method', () => {
      const store = createLocalStore({
        driver: 'local',
        root: TEST_ROOT,
        baseUrl: 'http://localhost:3030/files',
      });

      // init should exist and be a function
      expect(store.init).toBeDefined();
      expect(typeof store.init).toBe('function');
    });

    it('should be callable even if not needed', async () => {
      await mkdir(TEST_ROOT, { recursive: true });

      const store = createLocalStore({
        driver: 'local',
        root: TEST_ROOT,
        baseUrl: 'http://localhost:3030/files',
      });

      // Should be safe to call multiple times
      await store.init?.();
      await store.init?.();
      await store.init?.();
    });
  });
});

describe('init() in Manager', () => {
  afterAll(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  it('should call init through manager', async () => {
    const { createStorageManager } = await import('../manager.js');

    const manager = await createStorageManager({
      driver: 'local',
      root: TEST_ROOT,
      baseUrl: 'http://localhost:3030/files',
    });

    // Manager should expose init
    expect(typeof manager.init).toBe('function');

    // Should work even if init was not called (manager handles undefined)
    await expect(manager.init()).resolves.not.toThrow();

    // Directory should be created
    await expect(access(TEST_ROOT)).resolves.not.toThrow();
  });
});
