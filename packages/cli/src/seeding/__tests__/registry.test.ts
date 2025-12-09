/**
 * SeederRegistry Tests
 */

import { describe, expect, it } from 'vitest';

import { SeederError } from '../errors.js';
import { SeederRegistry } from '../registry.js';
import type { Seeder, SeederContext } from '../types.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockSeeder(name: string, dependencies: string[] = []): Seeder {
  return {
    name,
    dependencies,
    async run(_ctx: SeederContext): Promise<void> {
      // Mock implementation
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('SeederRegistry', () => {
  describe('register', () => {
    it('should register a seeder', () => {
      const registry = new SeederRegistry();
      const seeder = createMockSeeder('UserSeeder');

      registry.register(seeder);

      expect(registry.has('UserSeeder')).toBe(true);
      expect(registry.get('UserSeeder')).toBe(seeder);
    });

    it('should throw if seeder already registered', () => {
      const registry = new SeederRegistry();
      const seeder = createMockSeeder('UserSeeder');

      registry.register(seeder);

      expect(() => registry.register(seeder)).toThrow("Seeder 'UserSeeder' is already registered");
    });
  });

  describe('registerMany', () => {
    it('should register multiple seeders', () => {
      const registry = new SeederRegistry();
      const seeders = [
        createMockSeeder('UserSeeder'),
        createMockSeeder('PostSeeder'),
        createMockSeeder('CommentSeeder'),
      ];

      registry.registerMany(seeders);

      expect(registry.size).toBe(3);
      expect(registry.has('UserSeeder')).toBe(true);
      expect(registry.has('PostSeeder')).toBe(true);
      expect(registry.has('CommentSeeder')).toBe(true);
    });
  });

  describe('getOrThrow', () => {
    it('should return seeder if exists', () => {
      const registry = new SeederRegistry();
      const seeder = createMockSeeder('UserSeeder');
      registry.register(seeder);

      expect(registry.getOrThrow('UserSeeder')).toBe(seeder);
    });

    it('should throw SeederError if not found', () => {
      const registry = new SeederRegistry();

      expect(() => registry.getOrThrow('NonExistent')).toThrow(SeederError);
    });
  });

  describe('getInOrder', () => {
    it('should return seeders in dependency order', () => {
      const registry = new SeederRegistry();

      // PostSeeder depends on UserSeeder
      // CommentSeeder depends on PostSeeder and UserSeeder
      registry.register(createMockSeeder('CommentSeeder', ['PostSeeder', 'UserSeeder']));
      registry.register(createMockSeeder('PostSeeder', ['UserSeeder']));
      registry.register(createMockSeeder('UserSeeder'));

      const ordered = registry.getInOrder();

      const names = ordered.map((s) => s.name);
      expect(names.indexOf('UserSeeder')).toBeLessThan(names.indexOf('PostSeeder'));
      expect(names.indexOf('PostSeeder')).toBeLessThan(names.indexOf('CommentSeeder'));
    });

    it('should handle seeders with no dependencies', () => {
      const registry = new SeederRegistry();

      registry.register(createMockSeeder('A'));
      registry.register(createMockSeeder('B'));
      registry.register(createMockSeeder('C'));

      const ordered = registry.getInOrder();
      expect(ordered).toHaveLength(3);
    });

    it('should throw on circular dependency', () => {
      const registry = new SeederRegistry();

      // A -> B -> C -> A (circular)
      registry.register(createMockSeeder('A', ['C']));
      registry.register(createMockSeeder('B', ['A']));
      registry.register(createMockSeeder('C', ['B']));

      expect(() => registry.getInOrder()).toThrow(SeederError);
    });

    it('should throw if dependency not found', () => {
      const registry = new SeederRegistry();

      registry.register(createMockSeeder('A', ['NonExistent']));

      expect(() => registry.getInOrder()).toThrow(SeederError);
    });
  });

  describe('getByNames', () => {
    it('should return requested seeders and their dependencies in order', () => {
      const registry = new SeederRegistry();

      registry.register(createMockSeeder('UserSeeder'));
      registry.register(createMockSeeder('PostSeeder', ['UserSeeder']));
      registry.register(createMockSeeder('CommentSeeder', ['PostSeeder']));
      registry.register(createMockSeeder('UnrelatedSeeder'));

      // Request only CommentSeeder - should include UserSeeder and PostSeeder
      const ordered = registry.getByNames(['CommentSeeder']);

      const names = ordered.map((s) => s.name);
      expect(names).toContain('UserSeeder');
      expect(names).toContain('PostSeeder');
      expect(names).toContain('CommentSeeder');
      expect(names).not.toContain('UnrelatedSeeder');
    });
  });

  describe('validateDependencies', () => {
    it('should not throw for valid dependencies', () => {
      const registry = new SeederRegistry();

      registry.register(createMockSeeder('UserSeeder'));
      registry.register(createMockSeeder('PostSeeder', ['UserSeeder']));

      expect(() => registry.validateDependencies()).not.toThrow();
    });

    it('should throw for missing dependency', () => {
      const registry = new SeederRegistry();

      registry.register(createMockSeeder('PostSeeder', ['UserSeeder']));

      expect(() => registry.validateDependencies()).toThrow(SeederError);
    });
  });

  describe('environment filtering', () => {
    it('should filter seeders by environment', () => {
      const registry = new SeederRegistry();

      const devSeeder: Seeder = {
        name: 'DevSeeder',
        environments: ['development'],
        async run() {},
      };

      const prodSeeder: Seeder = {
        name: 'ProdSeeder',
        environments: ['production'],
        async run() {},
      };

      const allEnvSeeder: Seeder = {
        name: 'AllEnvSeeder',
        async run() {},
      };

      registry.register(devSeeder);
      registry.register(prodSeeder);
      registry.register(allEnvSeeder);

      const devOrdered = registry.getInOrder('development');
      const devNames = devOrdered.map((s) => s.name);
      expect(devNames).toContain('DevSeeder');
      expect(devNames).toContain('AllEnvSeeder');
      expect(devNames).not.toContain('ProdSeeder');

      const prodOrdered = registry.getInOrder('production');
      const prodNames = prodOrdered.map((s) => s.name);
      expect(prodNames).toContain('ProdSeeder');
      expect(prodNames).toContain('AllEnvSeeder');
      expect(prodNames).not.toContain('DevSeeder');
    });
  });
});
