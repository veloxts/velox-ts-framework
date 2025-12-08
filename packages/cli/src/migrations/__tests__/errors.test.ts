/**
 * Migration Errors - Unit Tests
 *
 * Tests for migration error classes and factory functions.
 */

import { describe, it, expect } from 'vitest';

import {
  MigrationError,
  prismaNotFound,
  migrationsDirNotFound,
  migrationNotFound,
  noRollbackFile,
  rollbackFailed,
  prismaError,
  databaseError,
  noPendingMigrations,
  noAppliedMigrations,
  checksumMismatch,
} from '../errors.js';

describe('MigrationError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const error = new MigrationError('MIGRATION_NOT_FOUND', 'Test message');

      expect(error.code).toBe('MIGRATION_NOT_FOUND');
      expect(error.message).toBe('Test message');
      expect(error.name).toBe('MigrationError');
    });

    it('should create error with details', () => {
      const error = new MigrationError('MIGRATION_NOT_FOUND', 'Test', {
        details: { migrationName: 'test_migration' },
      });

      expect(error.details).toEqual({ migrationName: 'test_migration' });
    });

    it('should create error with fix suggestion', () => {
      const error = new MigrationError('MIGRATION_NOT_FOUND', 'Test', {
        fix: 'Run velox migrate:status',
      });

      expect(error.fix).toBe('Run velox migrate:status');
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new MigrationError('ROLLBACK_FAILED', 'Test', { cause });

      expect(error.cause).toBe(cause);
    });
  });

  describe('format', () => {
    it('should format basic error', () => {
      const error = new MigrationError('MIGRATION_NOT_FOUND', 'Migration not found');

      expect(error.format()).toContain('MIGRATION_NOT_FOUND');
      expect(error.format()).toContain('Migration not found');
    });

    it('should include details in formatted output', () => {
      const error = new MigrationError('MIGRATION_NOT_FOUND', 'Not found', {
        details: { name: 'test' },
      });

      expect(error.format()).toContain('Details');
      expect(error.format()).toContain('name: test');
    });

    it('should include fix in formatted output', () => {
      const error = new MigrationError('MIGRATION_NOT_FOUND', 'Not found', {
        fix: 'Check the migration name',
      });

      expect(error.format()).toContain('Fix');
      expect(error.format()).toContain('Check the migration name');
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON', () => {
      const error = new MigrationError('MIGRATION_NOT_FOUND', 'Not found', {
        details: { name: 'test' },
        fix: 'Check name',
      });

      const json = error.toJSON();

      expect(json.code).toBe('MIGRATION_NOT_FOUND');
      expect(json.message).toBe('Not found');
      expect(json.details).toEqual({ name: 'test' });
      expect(json.fix).toBe('Check name');
    });
  });
});

describe('Error Factory Functions', () => {
  describe('prismaNotFound', () => {
    it('should create PRISMA_NOT_FOUND error', () => {
      const error = prismaNotFound();

      expect(error.code).toBe('PRISMA_NOT_FOUND');
      expect(error.fix).toContain('npm install');
    });
  });

  describe('migrationsDirNotFound', () => {
    it('should create MIGRATIONS_DIR_NOT_FOUND error with path', () => {
      const error = migrationsDirNotFound('/test/migrations');

      expect(error.code).toBe('MIGRATIONS_DIR_NOT_FOUND');
      expect(error.message).toContain('/test/migrations');
      expect(error.details?.path).toBe('/test/migrations');
    });
  });

  describe('migrationNotFound', () => {
    it('should create MIGRATION_NOT_FOUND error with name', () => {
      const error = migrationNotFound('20241208_test');

      expect(error.code).toBe('MIGRATION_NOT_FOUND');
      expect(error.message).toContain('20241208_test');
      expect(error.details?.name).toBe('20241208_test');
    });
  });

  describe('noRollbackFile', () => {
    it('should create NO_ROLLBACK_FILE error', () => {
      const error = noRollbackFile('20241208_test');

      expect(error.code).toBe('NO_ROLLBACK_FILE');
      expect(error.message).toContain('20241208_test');
      expect(error.fix).toContain('down.sql');
    });
  });

  describe('rollbackFailed', () => {
    it('should create ROLLBACK_FAILED error with cause', () => {
      const cause = new Error('SQL error');
      const error = rollbackFailed('20241208_test', cause);

      expect(error.code).toBe('ROLLBACK_FAILED');
      expect(error.message).toContain('20241208_test');
      expect(error.cause).toBe(cause);
    });
  });

  describe('prismaError', () => {
    it('should create PRISMA_ERROR with command and output', () => {
      const error = prismaError('migrate deploy', 'Error output');

      expect(error.code).toBe('PRISMA_ERROR');
      expect(error.details?.command).toBe('migrate deploy');
      expect(error.details?.output).toBe('Error output');
    });
  });

  describe('databaseError', () => {
    it('should create DATABASE_ERROR with operation and cause', () => {
      const cause = new Error('Connection failed');
      const error = databaseError('query', cause);

      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.details?.operation).toBe('query');
      expect(error.cause).toBe(cause);
    });
  });

  describe('noPendingMigrations', () => {
    it('should create NO_PENDING_MIGRATIONS error', () => {
      const error = noPendingMigrations();

      expect(error.code).toBe('NO_PENDING_MIGRATIONS');
    });
  });

  describe('noAppliedMigrations', () => {
    it('should create NO_APPLIED_MIGRATIONS error', () => {
      const error = noAppliedMigrations();

      expect(error.code).toBe('NO_APPLIED_MIGRATIONS');
    });
  });

  describe('checksumMismatch', () => {
    it('should create CHECKSUM_MISMATCH error', () => {
      const error = checksumMismatch('20241208_test', 'abc123', 'def456');

      expect(error.code).toBe('CHECKSUM_MISMATCH');
      expect(error.details?.migration).toBe('20241208_test');
      expect(error.details?.expected).toBe('abc123');
      expect(error.details?.actual).toBe('def456');
      expect(error.fix).toContain('migrate:fresh');
    });
  });
});
