/**
 * Tests for React Flight Protocol Utilities
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  type ClientManifest,
  createEmptyModuleMap,
  createModuleMap,
  type FlightModuleMap,
  getClientComponentChunks,
  isClientComponent,
  loadClientManifest,
  resolveClientManifest,
} from './flight.js';

describe('flight utilities', () => {
  describe('createModuleMap', () => {
    it('should create an empty module map when no manifest is provided', () => {
      const moduleMap = createModuleMap();
      expect(moduleMap).toEqual({});
    });

    it('should create an empty module map when undefined is passed', () => {
      const moduleMap = createModuleMap(undefined);
      expect(moduleMap).toEqual({});
    });

    it('should return the manifest as module map when provided', () => {
      const manifest: ClientManifest = {
        'module-1': {
          id: 'module-1',
          chunks: ['chunk-1.js', 'chunk-2.js'],
          name: 'default',
        },
        'module-2': {
          id: 'module-2',
          chunks: ['chunk-3.js'],
          name: 'Component',
        },
      };

      const moduleMap = createModuleMap(manifest);
      expect(moduleMap).toEqual(manifest);
    });

    it('should handle manifest with single module', () => {
      const manifest: ClientManifest = {
        'single-module': {
          id: 'single-module',
          chunks: ['main.js'],
          name: 'App',
        },
      };

      const moduleMap = createModuleMap(manifest);
      expect(moduleMap['single-module']).toBeDefined();
      expect(moduleMap['single-module'].chunks).toEqual(['main.js']);
    });
  });

  describe('createEmptyModuleMap', () => {
    it('should create an empty module map', () => {
      const moduleMap = createEmptyModuleMap();
      expect(moduleMap).toEqual({});
    });

    it('should return a new object each time', () => {
      const map1 = createEmptyModuleMap();
      const map2 = createEmptyModuleMap();
      expect(map1).not.toBe(map2);
    });
  });

  describe('resolveClientManifest', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should return undefined in development mode', () => {
      process.env.NODE_ENV = 'development';
      const manifestPath = resolveClientManifest();
      expect(manifestPath).toBeUndefined();
    });

    it('should return manifest path in production mode', () => {
      process.env.NODE_ENV = 'production';
      const manifestPath = resolveClientManifest();
      expect(manifestPath).toBe('./.vinxi/manifest/client-manifest.json');
    });

    it('should return undefined when NODE_ENV is not set', () => {
      process.env.NODE_ENV = '';
      const manifestPath = resolveClientManifest();
      // Empty string is truthy check, so it's considered "not production"
      expect(manifestPath).toBeUndefined();
    });
  });

  describe('loadClientManifest', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should return empty map in development mode', async () => {
      process.env.NODE_ENV = 'development';
      const moduleMap = await loadClientManifest();
      expect(moduleMap).toEqual({});
    });

    it('should return empty map when manifest file does not exist', async () => {
      process.env.NODE_ENV = 'production';
      // File doesn't exist, should fall back to empty map
      const moduleMap = await loadClientManifest();
      expect(moduleMap).toEqual({});
    });
  });

  describe('isClientComponent', () => {
    it('should return true if module is in the module map', () => {
      const moduleMap: FlightModuleMap = {
        'client-component': {
          id: 'client-component',
          chunks: ['chunk.js'],
          name: 'Component',
        },
      };

      expect(isClientComponent('client-component', moduleMap)).toBe(true);
    });

    it('should return false if module is not in the module map', () => {
      const moduleMap: FlightModuleMap = {
        'client-component': {
          id: 'client-component',
          chunks: ['chunk.js'],
          name: 'Component',
        },
      };

      expect(isClientComponent('server-component', moduleMap)).toBe(false);
    });

    it('should return false for empty module map', () => {
      const moduleMap = createEmptyModuleMap();
      expect(isClientComponent('any-module', moduleMap)).toBe(false);
    });
  });

  describe('getClientComponentChunks', () => {
    it('should return chunks for a client component', () => {
      const moduleMap: FlightModuleMap = {
        'my-component': {
          id: 'my-component',
          chunks: ['vendor.js', 'component.js'],
          name: 'MyComponent',
        },
      };

      const chunks = getClientComponentChunks('my-component', moduleMap);
      expect(chunks).toEqual(['vendor.js', 'component.js']);
    });

    it('should return empty array for unknown module', () => {
      const moduleMap: FlightModuleMap = {
        'known-module': {
          id: 'known-module',
          chunks: ['chunk.js'],
          name: 'Known',
        },
      };

      const chunks = getClientComponentChunks('unknown-module', moduleMap);
      expect(chunks).toEqual([]);
    });

    it('should return empty array for empty module map', () => {
      const moduleMap = createEmptyModuleMap();
      const chunks = getClientComponentChunks('any-module', moduleMap);
      expect(chunks).toEqual([]);
    });

    it('should handle module with no chunks', () => {
      const moduleMap: FlightModuleMap = {
        'no-chunks': {
          id: 'no-chunks',
          chunks: [],
          name: 'NoChunks',
        },
      };

      const chunks = getClientComponentChunks('no-chunks', moduleMap);
      expect(chunks).toEqual([]);
    });

    it('should handle module with single chunk', () => {
      const moduleMap: FlightModuleMap = {
        'single-chunk': {
          id: 'single-chunk',
          chunks: ['only-one.js'],
          name: 'SingleChunk',
        },
      };

      const chunks = getClientComponentChunks('single-chunk', moduleMap);
      expect(chunks).toEqual(['only-one.js']);
    });
  });

  describe('type safety', () => {
    it('should maintain type safety for module entries', () => {
      const manifest: ClientManifest = {
        test: {
          id: 'test',
          chunks: ['a.js'],
          name: 'Test',
        },
      };

      const moduleMap = createModuleMap(manifest);
      const entry = moduleMap.test;

      // Type assertions
      expect(typeof entry.id).toBe('string');
      expect(Array.isArray(entry.chunks)).toBe(true);
      expect(typeof entry.name).toBe('string');
    });
  });
});
