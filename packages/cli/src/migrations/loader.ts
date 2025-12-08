/**
 * Migration Loader
 *
 * Loads migration files from the filesystem.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { migrationNotFound, migrationsDirNotFound } from './errors.js';
import type { MigrationFile, MigrationStatus, PrismaMigrationRecord } from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** Default migrations directory (relative to project root) */
export const DEFAULT_MIGRATIONS_PATH = 'prisma/migrations';

/** Migration SQL file name */
const MIGRATION_FILE = 'migration.sql';

/** Rollback SQL file name */
const DOWN_FILE = 'down.sql';

/** Migration folder pattern: timestamp_description */
const MIGRATION_PATTERN = /^(\d{14})_(.+)$/;

// ============================================================================
// File Loading
// ============================================================================

/**
 * Load all migrations from the migrations directory
 */
export async function loadMigrations(
  cwd: string,
  migrationsPath = DEFAULT_MIGRATIONS_PATH
): Promise<MigrationFile[]> {
  const fullPath = path.join(cwd, migrationsPath);

  // Check if directory exists
  try {
    await fs.access(fullPath);
  } catch {
    throw migrationsDirNotFound(fullPath);
  }

  // Read directory contents
  const entries = await fs.readdir(fullPath, { withFileTypes: true });

  const migrations: MigrationFile[] = [];

  for (const entry of entries) {
    // Skip non-directories and migration_lock.toml
    if (!entry.isDirectory()) {
      continue;
    }

    // Parse migration name
    const match = MIGRATION_PATTERN.exec(entry.name);
    if (!match) {
      continue; // Skip folders that don't match pattern
    }

    const [, timestamp, description] = match;
    const migrationDir = path.join(fullPath, entry.name);

    // Check for migration.sql
    const upPath = path.join(migrationDir, MIGRATION_FILE);
    const downPath = path.join(migrationDir, DOWN_FILE);

    let hasUp = false;
    let hasDown = false;

    try {
      await fs.access(upPath);
      hasUp = true;
    } catch {
      // No migration.sql
    }

    try {
      await fs.access(downPath);
      hasDown = true;
    } catch {
      // No down.sql
    }

    // Only include if has migration.sql
    if (hasUp) {
      migrations.push({
        name: entry.name,
        timestamp,
        description,
        upPath,
        downPath: hasDown ? downPath : null,
        hasRollback: hasDown,
      });
    }
  }

  // Sort by timestamp (ascending)
  return migrations.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Get a migration by name
 */
export async function getMigrationByName(
  cwd: string,
  name: string,
  migrationsPath = DEFAULT_MIGRATIONS_PATH
): Promise<MigrationFile> {
  const migrations = await loadMigrations(cwd, migrationsPath);
  const migration = migrations.find((m) => m.name === name);

  if (!migration) {
    throw migrationNotFound(name);
  }

  return migration;
}

/**
 * Read migration SQL content
 */
export async function readMigrationSql(
  migration: MigrationFile
): Promise<{ up: string; down: string | null }> {
  const up = await fs.readFile(migration.upPath, 'utf-8');
  const down = migration.downPath ? await fs.readFile(migration.downPath, 'utf-8') : null;

  return { up, down };
}

// ============================================================================
// Database Query Helpers
// ============================================================================

/**
 * Query to get applied migrations from _prisma_migrations table
 */
export const GET_APPLIED_MIGRATIONS_SQL = `
  SELECT * FROM "_prisma_migrations"
  WHERE "finished_at" IS NOT NULL
  ORDER BY "started_at" ASC
`;

// ============================================================================
// Status Computation
// ============================================================================

/**
 * Compute migration status by comparing files with database records
 */
export function computeMigrationStatus(
  files: MigrationFile[],
  records: PrismaMigrationRecord[]
): MigrationStatus[] {
  // Create a map of applied migrations
  const appliedMap = new Map<string, PrismaMigrationRecord>();
  for (const record of records) {
    appliedMap.set(record.migration_name, record);
  }

  const statuses: MigrationStatus[] = [];

  for (const file of files) {
    const record = appliedMap.get(file.name);

    if (record) {
      // Migration is applied
      const status: MigrationStatus = {
        name: file.name,
        status: record.finished_at ? 'applied' : 'failed',
        appliedAt: record.finished_at,
        hasRollback: file.hasRollback,
        duration:
          record.finished_at && record.started_at
            ? new Date(record.finished_at).getTime() - new Date(record.started_at).getTime()
            : null,
      };
      statuses.push(status);
    } else {
      // Migration is pending
      statuses.push({
        name: file.name,
        status: 'pending',
        appliedAt: null,
        hasRollback: file.hasRollback,
        duration: null,
      });
    }
  }

  return statuses;
}

/**
 * Get pending migrations
 */
export function getPendingMigrations(
  files: MigrationFile[],
  records: PrismaMigrationRecord[]
): MigrationFile[] {
  const appliedNames = new Set(records.map((r) => r.migration_name));
  return files.filter((f) => !appliedNames.has(f.name));
}

/**
 * Get applied migrations with rollback capability
 */
export function getAppliedMigrationsWithRollback(
  files: MigrationFile[],
  records: PrismaMigrationRecord[]
): MigrationFile[] {
  const appliedNames = new Set(records.map((r) => r.migration_name));
  return files.filter((f) => appliedNames.has(f.name)).reverse(); // Most recent first for rollback order
}

/**
 * Check if migrations directory exists
 */
export async function migrationsDirExists(
  cwd: string,
  migrationsPath = DEFAULT_MIGRATIONS_PATH
): Promise<boolean> {
  try {
    await fs.access(path.join(cwd, migrationsPath));
    return true;
  } catch {
    return false;
  }
}
