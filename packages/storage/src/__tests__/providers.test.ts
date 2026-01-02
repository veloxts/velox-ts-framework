/**
 * Tests for Storage DI Providers
 *
 * Validates:
 * - registerStorageProviders bulk registration works correctly
 * - Services can be mocked/overridden in tests
 * - Storage manager is properly initialized
 */

import { Container } from '@veloxts/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorageManager } from '../manager.js';
import { registerStorageProviders } from '../providers.js';
import { STORAGE_CONFIG, STORAGE_MANAGER } from '../tokens.js';

describe('Storage DI Providers', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  afterEach(async () => {
    // Clean up any storage managers created
    if (container.isRegistered(STORAGE_MANAGER)) {
      const storage = container.resolve(STORAGE_MANAGER);
      await storage.close();
    }
  });

  describe('registerStorageProviders', () => {
    it('registers storage config and manager', async () => {
      await registerStorageProviders(container, { driver: 'local' });

      expect(container.isRegistered(STORAGE_CONFIG)).toBe(true);
      expect(container.isRegistered(STORAGE_MANAGER)).toBe(true);
    });

    it('config values are accessible from container', async () => {
      await registerStorageProviders(container, {
        driver: 'local',
        root: './test-uploads',
        baseUrl: '/files',
      });

      const config = container.resolve(STORAGE_CONFIG);

      expect(config.driver).toBe('local');
      expect((config as { root: string }).root).toBe('./test-uploads');
      expect((config as { baseUrl: string }).baseUrl).toBe('/files');
    });

    it('uses local driver by default', async () => {
      await registerStorageProviders(container);

      const config = container.resolve(STORAGE_CONFIG);

      expect(config.driver).toBeUndefined(); // defaults to local internally
    });

    it('storage manager is fully functional after registration', async () => {
      await registerStorageProviders(container, {
        driver: 'local',
        root: './test-storage',
      });

      const storage = container.resolve(STORAGE_MANAGER);

      // Put should work with local driver
      const path = await storage.put('test.txt', Buffer.from('Hello'));
      expect(path).toBe('test.txt');

      // Get should return content
      const content = await storage.get('test.txt');
      expect(content).toBeDefined();
      expect(content?.toString()).toBe('Hello');

      // Clean up
      await storage.delete('test.txt');
    });

    it('storage manager supports exists check', async () => {
      await registerStorageProviders(container, {
        driver: 'local',
        root: './test-storage',
      });

      const storage = container.resolve(STORAGE_MANAGER);

      // Should not exist initially
      expect(await storage.exists('nonexistent.txt')).toBe(false);

      // Create file
      await storage.put('exists-test.txt', Buffer.from('test'));
      expect(await storage.exists('exists-test.txt')).toBe(true);

      // Clean up
      await storage.delete('exists-test.txt');
    });

    it('storage manager supports copy operation', async () => {
      await registerStorageProviders(container, {
        driver: 'local',
        root: './test-storage',
      });

      const storage = container.resolve(STORAGE_MANAGER);

      // Create source file
      await storage.put('copy-source.txt', Buffer.from('copy me'));

      // Copy it
      const destPath = await storage.copy('copy-source.txt', 'copy-dest.txt');
      expect(destPath).toBe('copy-dest.txt');

      // Both should exist
      expect(await storage.exists('copy-source.txt')).toBe(true);
      expect(await storage.exists('copy-dest.txt')).toBe(true);

      // Clean up
      await storage.delete('copy-source.txt');
      await storage.delete('copy-dest.txt');
    });

    it('storage manager supports move operation', async () => {
      await registerStorageProviders(container, {
        driver: 'local',
        root: './test-storage',
      });

      const storage = container.resolve(STORAGE_MANAGER);

      // Create source file
      await storage.put('move-source.txt', Buffer.from('move me'));

      // Move it
      const destPath = await storage.move('move-source.txt', 'move-dest.txt');
      expect(destPath).toBe('move-dest.txt');

      // Only dest should exist
      expect(await storage.exists('move-source.txt')).toBe(false);
      expect(await storage.exists('move-dest.txt')).toBe(true);

      // Clean up
      await storage.delete('move-dest.txt');
    });

    it('storage manager supports deleteMany', async () => {
      await registerStorageProviders(container, {
        driver: 'local',
        root: './test-storage',
      });

      const storage = container.resolve(STORAGE_MANAGER);

      // Create multiple files
      await storage.put('batch1.txt', Buffer.from('1'));
      await storage.put('batch2.txt', Buffer.from('2'));
      await storage.put('batch3.txt', Buffer.from('3'));

      // Delete all
      const deleted = await storage.deleteMany(['batch1.txt', 'batch2.txt', 'batch3.txt']);
      expect(deleted).toBe(3);

      // Verify deleted
      expect(await storage.exists('batch1.txt')).toBe(false);
      expect(await storage.exists('batch2.txt')).toBe(false);
      expect(await storage.exists('batch3.txt')).toBe(false);
    });

    it('storage manager supports list operation', async () => {
      await registerStorageProviders(container, {
        driver: 'local',
        root: './test-storage',
      });

      const storage = container.resolve(STORAGE_MANAGER);

      // Create some files
      await storage.put('list/file1.txt', Buffer.from('1'));
      await storage.put('list/file2.txt', Buffer.from('2'));

      // List them
      const result = await storage.list('list/');
      expect(result.files.length).toBeGreaterThanOrEqual(2);

      // Clean up
      await storage.delete('list/file1.txt');
      await storage.delete('list/file2.txt');
    });

    it('storage manager supports url generation', async () => {
      await registerStorageProviders(container, {
        driver: 'local',
        root: './test-storage',
        baseUrl: 'http://localhost:3030/files',
      });

      const storage = container.resolve(STORAGE_MANAGER);

      const url = await storage.url('avatars/user.jpg');
      expect(url).toBe('http://localhost:3030/files/avatars/user.jpg');
    });
  });

  describe('Service Mocking', () => {
    it('allows mocking STORAGE_MANAGER after registration', async () => {
      await registerStorageProviders(container, { driver: 'local' });

      // Create a mock storage manager
      const mockStorageManager: Partial<StorageManager> = {
        put: vi.fn().mockResolvedValue('mock-path'),
        get: vi.fn().mockResolvedValue(Buffer.from('mock content')),
        close: vi.fn().mockResolvedValue(undefined),
      };

      container.register({ provide: STORAGE_MANAGER, useValue: mockStorageManager });

      const storage = container.resolve(STORAGE_MANAGER);

      expect(storage).toBe(mockStorageManager);

      const result = await storage.put('file.txt', Buffer.from('test'));
      expect(result).toBe('mock-path');
    });

    it('allows mocking STORAGE_CONFIG after registration', async () => {
      await registerStorageProviders(container, { driver: 'local', root: './test' });

      const mockConfig = {
        driver: 's3' as const,
        bucket: 'mock-bucket',
        region: 'us-east-1',
      };
      container.register({ provide: STORAGE_CONFIG, useValue: mockConfig });

      const config = container.resolve(STORAGE_CONFIG);

      expect(config).toBe(mockConfig);
      expect(config.driver).toBe('s3');
    });

    it('child container can override parent registrations', async () => {
      await registerStorageProviders(container, { driver: 'local' });

      const childContainer = container.createChild();

      const mockStorageManager: Partial<StorageManager> = {
        put: vi.fn().mockResolvedValue('child-path'),
        close: vi.fn().mockResolvedValue(undefined),
      };

      childContainer.register({ provide: STORAGE_MANAGER, useValue: mockStorageManager });

      const parentStorage = container.resolve(STORAGE_MANAGER);
      const childStorage = childContainer.resolve(STORAGE_MANAGER);

      expect(childStorage).toBe(mockStorageManager);
      expect(parentStorage).not.toBe(mockStorageManager);
    });

    it('child container inherits parent registrations', async () => {
      await registerStorageProviders(container, { driver: 'local' });

      const childContainer = container.createChild();

      // Should resolve from parent
      const storage = childContainer.resolve(STORAGE_MANAGER);
      const config = childContainer.resolve(STORAGE_CONFIG);

      expect(storage).toBeDefined();
      expect(config).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('throws when resolving unregistered STORAGE_MANAGER token', () => {
      expect(() => container.resolve(STORAGE_MANAGER)).toThrow(
        'No provider found for: STORAGE_MANAGER'
      );
    });

    it('throws when resolving STORAGE_CONFIG without registration', () => {
      expect(() => container.resolve(STORAGE_CONFIG)).toThrow(
        'No provider found for: STORAGE_CONFIG'
      );
    });
  });

  describe('Integration with Real Services', () => {
    it('complete storage flow works with DI-provided services', async () => {
      await registerStorageProviders(container, {
        driver: 'local',
        root: './test-storage',
        baseUrl: 'http://localhost:3030/files',
      });

      const storage = container.resolve(STORAGE_MANAGER);
      const config = container.resolve(STORAGE_CONFIG);

      // Config should be accessible
      expect(config.driver).toBe('local');
      expect((config as { root: string }).root).toBe('./test-storage');
      expect((config as { baseUrl: string }).baseUrl).toBe('http://localhost:3030/files');

      // Storage should be functional
      await storage.put('integration-test.txt', Buffer.from('Integration test'));
      expect(await storage.exists('integration-test.txt')).toBe(true);

      const content = await storage.get('integration-test.txt');
      expect(content?.toString()).toBe('Integration test');

      // Clean up
      await storage.delete('integration-test.txt');
    });

    it('multiple containers can have independent storage instances', async () => {
      const container1 = new Container();
      const container2 = new Container();

      await registerStorageProviders(container1, {
        driver: 'local',
        root: './storage1',
      });

      await registerStorageProviders(container2, {
        driver: 'local',
        root: './storage2',
      });

      const storage1 = container1.resolve(STORAGE_MANAGER);
      const storage2 = container2.resolve(STORAGE_MANAGER);

      // Different instances
      expect(storage1).not.toBe(storage2);

      // Different configs
      const config1 = container1.resolve(STORAGE_CONFIG);
      const config2 = container2.resolve(STORAGE_CONFIG);
      expect((config1 as { root: string }).root).toBe('./storage1');
      expect((config2 as { root: string }).root).toBe('./storage2');

      // Cleanup
      await storage1.close();
      await storage2.close();
    });

    it('supports visibility settings', async () => {
      await registerStorageProviders(container, {
        driver: 'local',
        root: './test-storage',
      });

      const storage = container.resolve(STORAGE_MANAGER);

      // Create file with public visibility
      await storage.put('visibility-test.txt', Buffer.from('public'), { visibility: 'public' });

      // Get visibility
      const visibility = await storage.getVisibility('visibility-test.txt');
      expect(visibility).toBe('public');

      // Set to private
      await storage.setVisibility('visibility-test.txt', 'private');
      const newVisibility = await storage.getVisibility('visibility-test.txt');
      expect(newVisibility).toBe('private');

      // Clean up
      await storage.delete('visibility-test.txt');
    });
  });
});
