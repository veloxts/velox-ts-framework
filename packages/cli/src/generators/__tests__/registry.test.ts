/**
 * Generator Registry - Unit Tests
 *
 * Tests for generator registration, lookup, and listing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registry,
  registerGenerator,
  getGenerator,
  getAllGenerators,
  getGeneratorsByCategory,
  findSimilarGenerators,
} from '../registry.js';
import { createProcedureGenerator } from '../generators/procedure.js';
import { createSchemaGenerator } from '../generators/schema.js';
import { createMigrationGenerator } from '../generators/migration.js';
import { createResourceGenerator } from '../generators/resource.js';

describe('Generator Registry', () => {
  // Reset registry before each test
  beforeEach(() => {
    registry.clear();
  });

  describe('registerGenerator', () => {
    it('should register a generator by name', () => {
      const generator = createProcedureGenerator();
      registerGenerator(generator);

      const retrieved = getGenerator('procedure');
      expect(retrieved).toBe(generator);
    });

    it('should register a generator by aliases', () => {
      const generator = createProcedureGenerator();
      registerGenerator(generator);

      // Should be retrievable by alias
      expect(getGenerator('p')).toBe(generator);
      expect(getGenerator('proc')).toBe(generator);
    });

    it('should handle multiple generators', () => {
      const procedureGen = createProcedureGenerator();
      const schemaGen = createSchemaGenerator();

      registerGenerator(procedureGen);
      registerGenerator(schemaGen);

      expect(getGenerator('procedure')).toBe(procedureGen);
      expect(getGenerator('schema')).toBe(schemaGen);
      expect(getGenerator('p')).toBe(procedureGen);
      expect(getGenerator('s')).toBe(schemaGen);
    });
  });

  describe('getGenerator', () => {
    it('should return undefined for unknown generator', () => {
      expect(getGenerator('unknown')).toBeUndefined();
    });

    it('should be case-insensitive', () => {
      const generator = createProcedureGenerator();
      registerGenerator(generator);

      expect(getGenerator('PROCEDURE')).toBe(generator);
      expect(getGenerator('Procedure')).toBe(generator);
      expect(getGenerator('P')).toBe(generator);
    });
  });

  describe('getAllGenerators', () => {
    it('should return empty array when no generators registered', () => {
      expect(getAllGenerators()).toEqual([]);
    });

    it('should return all registered generators', () => {
      registerGenerator(createProcedureGenerator());
      registerGenerator(createSchemaGenerator());
      registerGenerator(createMigrationGenerator());

      const all = getAllGenerators();
      expect(all).toHaveLength(3);

      const names = all.map((g) => g.name);
      expect(names).toContain('procedure');
      expect(names).toContain('schema');
      expect(names).toContain('migration');
    });

    it('should include generator instance in result', () => {
      const generator = createProcedureGenerator();
      registerGenerator(generator);

      const all = getAllGenerators();
      expect(all[0].generator).toBe(generator);
    });
  });

  describe('getGeneratorsByCategory', () => {
    beforeEach(() => {
      registerGenerator(createProcedureGenerator());
      registerGenerator(createSchemaGenerator());
      registerGenerator(createMigrationGenerator());
      registerGenerator(createResourceGenerator());
    });

    it('should return generators in specified category', () => {
      const resourceGenerators = getGeneratorsByCategory('resource');

      const names = resourceGenerators.map((g) => g.name);
      expect(names).toContain('procedure');
      expect(names).toContain('schema');
      expect(names).toContain('resource');
    });

    it('should return database generators', () => {
      const dbGenerators = getGeneratorsByCategory('database');

      const names = dbGenerators.map((g) => g.name);
      expect(names).toContain('migration');
    });

    it('should return empty array for unknown category', () => {
      const unknown = getGeneratorsByCategory('nonexistent');
      expect(unknown).toEqual([]);
    });
  });

  describe('findSimilarGenerators', () => {
    beforeEach(() => {
      registerGenerator(createProcedureGenerator());
      registerGenerator(createSchemaGenerator());
      registerGenerator(createMigrationGenerator());
      registerGenerator(createResourceGenerator());
    });

    it('should find similar generators for typos', () => {
      const similar = findSimilarGenerators('procedur');
      expect(similar).toContain('procedure');
    });

    it('should find similar generators for partial matches', () => {
      const similar = findSimilarGenerators('proc');
      expect(similar).toContain('procedure');
    });

    it('should find similar generators for schema typo', () => {
      const similar = findSimilarGenerators('schem');
      expect(similar).toContain('schema');
    });

    it('should return empty array for completely different input', () => {
      const similar = findSimilarGenerators('xyz123');
      expect(similar).toEqual([]);
    });

    it('should be case-insensitive', () => {
      const similar = findSimilarGenerators('PROC');
      expect(similar).toContain('procedure');
    });
  });

  describe('registry.clear', () => {
    it('should clear all registered generators', () => {
      registerGenerator(createProcedureGenerator());
      registerGenerator(createSchemaGenerator());

      expect(getAllGenerators()).toHaveLength(2);

      registry.clear();

      expect(getAllGenerators()).toHaveLength(0);
      expect(getGenerator('procedure')).toBeUndefined();
    });
  });

  describe('generator metadata', () => {
    it('should preserve all metadata fields', () => {
      const generator = createProcedureGenerator();
      registerGenerator(generator);

      const registered = getAllGenerators()[0];

      expect(registered.name).toBe('procedure');
      expect(registered.generator.metadata.description).toBeDefined();
      expect(registered.generator.metadata.category).toBe('resource');
      expect(registered.generator.metadata.aliases).toContain('p');
    });
  });
});
