/**
 * Migration Loader - Unit Tests
 *
 * Tests for loading migration files from the filesystem.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import path from 'node:path';

import {
  loadMigrations,
  getMigrationByName,
  computeMigrationStatus,
  getPendingMigrations,
  getAppliedMigrationsWithRollback,
  DEFAULT_MIGRATIONS_PATH,
} from '../loader.js';
import type { MigrationFile, PrismaMigrationRecord } from '../types.js';

// Mock fs module
vi.mock('node:fs/promises');

describe('Migration Loader', () => {
  const mockCwd = '/test/project';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('loadMigrations', () => {
    it('should load migrations from directory', async () => {
      // Mock directory structure
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: '20241208120000_create_users', isDirectory: () => true } as unknown as fs.Dirent,
        { name: '20241208130000_add_email', isDirectory: () => true } as unknown as fs.Dirent,
        { name: 'migration_lock.toml', isDirectory: () => false } as unknown as fs.Dirent,
      ] as unknown as fs.Dirent[]);

      // Mock migration.sql exists for both, down.sql only for first
      vi.mocked(fs.access).mockImplementation(async (p: fs.PathLike) => {
        const pathStr = p.toString();
        if (pathStr.includes('migration.sql')) {
          return undefined;
        }
        if (pathStr.includes('20241208120000_create_users') && pathStr.includes('down.sql')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      const migrations = await loadMigrations(mockCwd);

      expect(migrations).toHaveLength(2);
      expect(migrations[0].name).toBe('20241208120000_create_users');
      expect(migrations[0].hasRollback).toBe(true);
      expect(migrations[1].name).toBe('20241208130000_add_email');
      expect(migrations[1].hasRollback).toBe(false);
    });

    it('should sort migrations by timestamp', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: '20241209000000_third', isDirectory: () => true } as unknown as fs.Dirent,
        { name: '20241207000000_first', isDirectory: () => true } as unknown as fs.Dirent,
        { name: '20241208000000_second', isDirectory: () => true } as unknown as fs.Dirent,
      ] as unknown as fs.Dirent[]);

      const migrations = await loadMigrations(mockCwd);

      expect(migrations[0].name).toBe('20241207000000_first');
      expect(migrations[1].name).toBe('20241208000000_second');
      expect(migrations[2].name).toBe('20241209000000_third');
    });

    it('should throw error if migrations directory not found', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      await expect(loadMigrations(mockCwd)).rejects.toThrow('Migrations directory not found');
    });

    it('should skip non-migration folders', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: '20241208120000_valid', isDirectory: () => true } as unknown as fs.Dirent,
        { name: 'not_a_migration', isDirectory: () => true } as unknown as fs.Dirent,
        { name: '.git', isDirectory: () => true } as unknown as fs.Dirent,
      ] as unknown as fs.Dirent[]);

      const migrations = await loadMigrations(mockCwd);

      expect(migrations).toHaveLength(1);
      expect(migrations[0].name).toBe('20241208120000_valid');
    });
  });

  describe('getMigrationByName', () => {
    it('should return migration by name', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: '20241208120000_create_users', isDirectory: () => true } as unknown as fs.Dirent,
      ] as unknown as fs.Dirent[]);

      const migration = await getMigrationByName(mockCwd, '20241208120000_create_users');

      expect(migration.name).toBe('20241208120000_create_users');
    });

    it('should throw if migration not found', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      await expect(
        getMigrationByName(mockCwd, 'nonexistent')
      ).rejects.toThrow('Migration not found');
    });
  });

  describe('computeMigrationStatus', () => {
    const mockFiles: MigrationFile[] = [
      {
        name: '20241207000000_first',
        timestamp: '20241207000000',
        description: 'first',
        upPath: '/test/first/migration.sql',
        downPath: '/test/first/down.sql',
        hasRollback: true,
      },
      {
        name: '20241208000000_second',
        timestamp: '20241208000000',
        description: 'second',
        upPath: '/test/second/migration.sql',
        downPath: null,
        hasRollback: false,
      },
      {
        name: '20241209000000_third',
        timestamp: '20241209000000',
        description: 'third',
        upPath: '/test/third/migration.sql',
        downPath: '/test/third/down.sql',
        hasRollback: true,
      },
    ];

    it('should mark applied migrations correctly', () => {
      const records: PrismaMigrationRecord[] = [
        {
          id: '1',
          checksum: 'abc',
          finished_at: new Date('2024-12-07T12:00:00Z'),
          migration_name: '20241207000000_first',
          logs: null,
          rolled_back_at: null,
          started_at: new Date('2024-12-07T11:59:00Z'),
          applied_steps_count: 1,
        },
      ];

      const statuses = computeMigrationStatus(mockFiles, records);

      expect(statuses).toHaveLength(3);
      expect(statuses[0].status).toBe('applied');
      expect(statuses[1].status).toBe('pending');
      expect(statuses[2].status).toBe('pending');
    });

    it('should preserve rollback capability', () => {
      const records: PrismaMigrationRecord[] = [];

      const statuses = computeMigrationStatus(mockFiles, records);

      expect(statuses[0].hasRollback).toBe(true);
      expect(statuses[1].hasRollback).toBe(false);
      expect(statuses[2].hasRollback).toBe(true);
    });
  });

  describe('getPendingMigrations', () => {
    const mockFiles: MigrationFile[] = [
      {
        name: '20241207000000_first',
        timestamp: '20241207000000',
        description: 'first',
        upPath: '/test/first/migration.sql',
        downPath: null,
        hasRollback: false,
      },
      {
        name: '20241208000000_second',
        timestamp: '20241208000000',
        description: 'second',
        upPath: '/test/second/migration.sql',
        downPath: null,
        hasRollback: false,
      },
    ];

    it('should return only pending migrations', () => {
      const records: PrismaMigrationRecord[] = [
        {
          id: '1',
          checksum: 'abc',
          finished_at: new Date(),
          migration_name: '20241207000000_first',
          logs: null,
          rolled_back_at: null,
          started_at: new Date(),
          applied_steps_count: 1,
        },
      ];

      const pending = getPendingMigrations(mockFiles, records);

      expect(pending).toHaveLength(1);
      expect(pending[0].name).toBe('20241208000000_second');
    });

    it('should return all migrations if none applied', () => {
      const pending = getPendingMigrations(mockFiles, []);

      expect(pending).toHaveLength(2);
    });
  });

  describe('getAppliedMigrationsWithRollback', () => {
    const mockFiles: MigrationFile[] = [
      {
        name: '20241207000000_first',
        timestamp: '20241207000000',
        description: 'first',
        upPath: '/test/first/migration.sql',
        downPath: '/test/first/down.sql',
        hasRollback: true,
      },
      {
        name: '20241208000000_second',
        timestamp: '20241208000000',
        description: 'second',
        upPath: '/test/second/migration.sql',
        downPath: null,
        hasRollback: false,
      },
    ];

    it('should return applied migrations in reverse order', () => {
      const records: PrismaMigrationRecord[] = [
        {
          id: '1',
          checksum: 'abc',
          finished_at: new Date(),
          migration_name: '20241207000000_first',
          logs: null,
          rolled_back_at: null,
          started_at: new Date(),
          applied_steps_count: 1,
        },
        {
          id: '2',
          checksum: 'def',
          finished_at: new Date(),
          migration_name: '20241208000000_second',
          logs: null,
          rolled_back_at: null,
          started_at: new Date(),
          applied_steps_count: 1,
        },
      ];

      const applied = getAppliedMigrationsWithRollback(mockFiles, records);

      expect(applied).toHaveLength(2);
      // Should be in reverse order for rollback
      expect(applied[0].name).toBe('20241208000000_second');
      expect(applied[1].name).toBe('20241207000000_first');
    });
  });

  describe('DEFAULT_MIGRATIONS_PATH', () => {
    it('should be prisma/migrations', () => {
      expect(DEFAULT_MIGRATIONS_PATH).toBe('prisma/migrations');
    });
  });
});
