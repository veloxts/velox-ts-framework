/**
 * Migration Generator - Unit Tests
 *
 * Tests for migration template generation including name parsing.
 */

import { describe, expect, it } from 'vitest';

import { createMigrationGenerator } from '../generators/migration.js';
import type { GeneratorConfig, ProjectContext } from '../types.js';

describe('MigrationGenerator', () => {
  const generator = createMigrationGenerator();

  // Mock project context
  const mockProject: ProjectContext = {
    hasVeloxConfig: true,
    hasPrisma: true,
    hasTsConfig: true,
    srcDir: 'src',
    isMonorepo: false,
  };

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(generator.metadata.name).toBe('migration');
    });

    it('should have aliases', () => {
      expect(generator.metadata.aliases).toContain('mig');
    });

    it('should be in database category', () => {
      expect(generator.metadata.category).toBe('database');
    });
  });

  describe('validateEntityName', () => {
    it('should accept snake_case names', () => {
      expect(generator.validateEntityName('create_users')).toBeUndefined();
      expect(generator.validateEntityName('add_email_to_users')).toBeUndefined();
      expect(generator.validateEntityName('remove_name_from_posts')).toBeUndefined();
    });

    it('should accept simple names', () => {
      expect(generator.validateEntityName('init')).toBeUndefined();
      expect(generator.validateEntityName('baseline')).toBeUndefined();
    });

    it('should accept kebab-case names', () => {
      // Implementation allows both snake_case and kebab-case
      expect(generator.validateEntityName('create-users')).toBeUndefined();
    });

    it('should reject names with spaces or special characters', () => {
      expect(generator.validateEntityName('create users')).toBeDefined();
      expect(generator.validateEntityName('create@users')).toBeDefined();
    });
  });

  describe('validateOptions', () => {
    it('should default to sqlite', () => {
      const options = generator.validateOptions({});
      expect(options.database).toBe('sqlite');
    });

    it('should accept valid database types', () => {
      expect(generator.validateOptions({ database: 'sqlite' }).database).toBe('sqlite');
      expect(generator.validateOptions({ database: 'postgresql' }).database).toBe('postgresql');
      expect(generator.validateOptions({ database: 'mysql' }).database).toBe('mysql');
    });
  });

  describe('generate - CREATE TABLE migrations', () => {
    it('should generate CREATE TABLE SQL for create_* pattern', async () => {
      const config: GeneratorConfig = {
        entityName: 'create_users',
        options: { database: 'sqlite' },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(2);

      // Up migration
      const upMigration = output.files[0];
      expect(upMigration.path).toContain('migration.sql');
      expect(upMigration.content).toContain('CREATE TABLE');
      expect(upMigration.content).toContain('"users"');

      // Down migration (rollback)
      const downMigration = output.files[1];
      expect(downMigration.path).toContain('down.sql');
      expect(downMigration.content).toContain('DROP TABLE');
    });

    it('should use UUID type for PostgreSQL', async () => {
      const config: GeneratorConfig = {
        entityName: 'create_posts',
        options: { database: 'postgresql' },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('UUID');
      expect(content).toContain('gen_random_uuid');
    });
  });

  describe('generate - ADD COLUMN migrations', () => {
    it('should generate ADD COLUMN SQL for add_*_to_* pattern', async () => {
      const config: GeneratorConfig = {
        entityName: 'add_email_to_users',
        options: { database: 'sqlite' },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      // Up migration
      const upMigration = output.files[0];
      expect(upMigration.content).toContain('ADD COLUMN');
      expect(upMigration.content).toContain('"email"');
      expect(upMigration.content).toContain('"users"');

      // Down migration (rollback)
      const downMigration = output.files[1];
      expect(downMigration.content).toContain('DROP COLUMN');
    });
  });

  describe('generate - REMOVE COLUMN migrations', () => {
    it('should generate DROP COLUMN SQL for remove_*_from_* pattern', async () => {
      const config: GeneratorConfig = {
        entityName: 'remove_name_from_users',
        options: { database: 'postgresql' },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      // Up migration
      const upMigration = output.files[0];
      expect(upMigration.content).toContain('DROP COLUMN');
      expect(upMigration.content).toContain('"name"');

      // Down migration (rollback) - should add column back
      const downMigration = output.files[1];
      expect(downMigration.content).toContain('ADD COLUMN');
      expect(downMigration.content).toContain('WARNING');
    });

    it('should include SQLite workaround for DROP COLUMN', async () => {
      const config: GeneratorConfig = {
        entityName: 'remove_status_from_posts',
        options: { database: 'sqlite' },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      // SQLite needs table recreation for DROP COLUMN
      expect(content).toContain("SQLite doesn't support DROP COLUMN");
      expect(content).toContain('recreate the table');
    });
  });

  describe('generate - RENAME TABLE migrations', () => {
    it('should generate RENAME TABLE SQL for rename_*_to_* pattern', async () => {
      const config: GeneratorConfig = {
        entityName: 'rename_users_to_accounts',
        options: { database: 'postgresql' },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      // Up migration
      const upMigration = output.files[0];
      expect(upMigration.content).toContain('RENAME TO');
      expect(upMigration.content).toContain('"users"');
      expect(upMigration.content).toContain('"accounts"');

      // Down migration (rollback) - should rename back
      const downMigration = output.files[1];
      expect(downMigration.content).toContain('RENAME TO');
      expect(downMigration.content).toContain('"accounts"');
      expect(downMigration.content).toContain('"users"');
    });
  });

  describe('generate - DROP TABLE migrations', () => {
    it('should generate DROP TABLE SQL for drop_* pattern', async () => {
      const config: GeneratorConfig = {
        entityName: 'drop_legacy_users',
        options: { database: 'sqlite' },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      // Up migration
      const upMigration = output.files[0];
      expect(upMigration.content).toContain('DROP TABLE');
      expect(upMigration.content).toContain('"legacy_users"');

      // Down migration (rollback) - should warn about data loss
      const downMigration = output.files[1];
      expect(downMigration.content).toContain('WARNING');
      expect(downMigration.content).toContain('Cannot automatically rollback');
    });
  });

  describe('generate - Custom migrations', () => {
    it('should generate placeholder for unknown patterns', async () => {
      const config: GeneratorConfig = {
        entityName: 'update_indexes',
        options: { database: 'sqlite' },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      // Up migration
      const upMigration = output.files[0];
      expect(upMigration.content).toContain('custom SQL');
      expect(upMigration.content).toContain('update_indexes');

      // Down migration
      const downMigration = output.files[1];
      expect(downMigration.content).toContain('Rollback');
    });
  });

  describe('generate - File paths', () => {
    it('should generate timestamped folder names', async () => {
      const config: GeneratorConfig = {
        entityName: 'create_users',
        options: { database: 'sqlite' },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      // Should have timestamped folder
      expect(output.files[0].path).toMatch(
        /prisma\/migrations\/\d{14}_create_users\/migration\.sql/
      );
      expect(output.files[1].path).toMatch(/prisma\/migrations\/\d{14}_create_users\/down\.sql/);
    });
  });
});
