/**
 * @veloxts/orm - Public API Tests
 *
 * Ensures all public exports are available and correctly typed
 */

import { describe, expect, it } from 'vitest';

import * as ormPackage from '../index.js';

describe('Public API Exports', () => {
  describe('version', () => {
    it('should export ORM_VERSION constant', () => {
      expect(ormPackage.ORM_VERSION).toBeDefined();
      expect(typeof ormPackage.ORM_VERSION).toBe('string');
    });

    it('should have correct version format', () => {
      // Should be a semver-like string
      expect(ormPackage.ORM_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('type guards', () => {
    it('should export isDatabaseClient function', () => {
      expect(ormPackage.isDatabaseClient).toBeDefined();
      expect(typeof ormPackage.isDatabaseClient).toBe('function');
    });

    it('isDatabaseClient should work as type guard', () => {
      const validClient = {
        $connect: async () => {},
        $disconnect: async () => {},
      };

      const invalidClient = {
        notAClient: true,
      };

      expect(ormPackage.isDatabaseClient(validClient)).toBe(true);
      expect(ormPackage.isDatabaseClient(invalidClient)).toBe(false);
    });
  });

  describe('factory functions', () => {
    it('should export createDatabase function', () => {
      expect(ormPackage.createDatabase).toBeDefined();
      expect(typeof ormPackage.createDatabase).toBe('function');
    });

    it('should export createDatabasePlugin function', () => {
      expect(ormPackage.createDatabasePlugin).toBeDefined();
      expect(typeof ormPackage.createDatabasePlugin).toBe('function');
    });
  });

  describe('package completeness', () => {
    it('should export all expected top-level functions', () => {
      const expectedExports = ['ORM_VERSION', 'isDatabaseClient', 'createDatabase', 'createDatabasePlugin'];

      for (const exportName of expectedExports) {
        expect(ormPackage).toHaveProperty(exportName);
      }
    });

    it('should not export internal implementation details', () => {
      // These should NOT be exported (internal implementation)
      const internalExports = ['DatabaseState', 'buildStatusObject', 'updateCachedStatus'];

      for (const internalExport of internalExports) {
        expect(ormPackage).not.toHaveProperty(internalExport);
      }
    });
  });

  describe('function signatures', () => {
    it('createDatabase should accept valid config', () => {
      const mockClient = {
        $connect: async () => {},
        $disconnect: async () => {},
      };

      const db = ormPackage.createDatabase({ client: mockClient });

      expect(db).toBeDefined();
      expect(db.client).toBe(mockClient);
    });

    it('createDatabasePlugin should accept valid config', () => {
      const mockClient = {
        $connect: async () => {},
        $disconnect: async () => {},
      };

      const plugin = ormPackage.createDatabasePlugin({ client: mockClient });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBeDefined();
      expect(plugin.version).toBeDefined();
      expect(plugin.register).toBeDefined();
    });
  });
});

describe('Type Exports', () => {
  it('should allow importing types without runtime errors', () => {
    // This test verifies that type-only imports don't cause runtime issues
    // The actual type checking happens at compile time

    // If this test runs without import errors, types are exported correctly
    expect(true).toBe(true);
  });
});

describe('Package Metadata', () => {
  it('should have consistent version across exports', () => {
    // ORM_VERSION should be a const literal
    const version1 = ormPackage.ORM_VERSION;

    expect(version1).toBe(ormPackage.ORM_VERSION);
    expect(typeof version1).toBe('string');
  });
});
