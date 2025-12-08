/**
 * Rollback Runner
 *
 * Custom rollback execution using down.sql files.
 */

import fs from 'node:fs/promises';

import { databaseError, noRollbackFile, rollbackFailed } from './errors.js';
import type {
  BatchRollbackResult,
  DatabaseType,
  MigrationFile,
  PrismaClientLike,
  RollbackResult,
} from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for rollback execution
 */
export interface RollbackOptions {
  /** Dry run mode - don't execute, just report */
  dryRun?: boolean;
  /** Database type for SQL dialect */
  database?: DatabaseType;
}

// ============================================================================
// Single Migration Rollback
// ============================================================================

/**
 * Rollback a single migration
 */
export async function rollbackMigration(
  prisma: PrismaClientLike,
  migration: MigrationFile,
  options: RollbackOptions = {}
): Promise<RollbackResult> {
  const startTime = Date.now();

  // Check if rollback is available
  if (!migration.hasRollback || !migration.downPath) {
    throw noRollbackFile(migration.name);
  }

  // In dry run mode, just return success
  if (options.dryRun) {
    return {
      migration: migration.name,
      success: true,
      duration: 0,
    };
  }

  try {
    // Read down.sql content
    const downSql = await fs.readFile(migration.downPath, 'utf-8');

    // Split SQL into statements and execute each one
    // This handles multi-statement down.sql files
    const statements = splitSqlStatements(downSql);

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed) {
        await prisma.$executeRawUnsafe(trimmed);
      }
    }

    // Remove migration record from _prisma_migrations
    await prisma.$executeRawUnsafe(
      `DELETE FROM "_prisma_migrations" WHERE "migration_name" = '${escapeString(migration.name)}'`
    );

    return {
      migration: migration.name,
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw rollbackFailed(migration.name, err);
  }
}

// ============================================================================
// Batch Rollback
// ============================================================================

/**
 * Rollback multiple migrations in order (most recent first)
 */
export async function rollbackMultiple(
  prisma: PrismaClientLike,
  migrations: MigrationFile[],
  options: RollbackOptions = {}
): Promise<BatchRollbackResult> {
  const startTime = Date.now();
  const results: RollbackResult[] = [];
  let successful = 0;
  let failed = 0;

  // Ensure migrations are in reverse chronological order
  const orderedMigrations = [...migrations].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  for (const migration of orderedMigrations) {
    try {
      const result = await rollbackMigration(prisma, migration, options);
      results.push(result);
      successful++;
    } catch (error) {
      // If rollback fails, record error and stop
      const err = error instanceof Error ? error : new Error(String(error));
      results.push({
        migration: migration.name,
        success: false,
        duration: 0,
        error: err.message,
      });
      failed++;
      // Stop on first failure
      break;
    }
  }

  return {
    results,
    total: orderedMigrations.length,
    successful,
    failed,
    duration: Date.now() - startTime,
  };
}

/**
 * Rollback all migrations
 */
export async function rollbackAll(
  prisma: PrismaClientLike,
  migrations: MigrationFile[],
  options: RollbackOptions = {}
): Promise<BatchRollbackResult> {
  return rollbackMultiple(prisma, migrations, options);
}

// ============================================================================
// Database Utilities
// ============================================================================

/**
 * Get applied migrations from the database
 */
export async function getAppliedMigrations(
  prisma: PrismaClientLike
): Promise<{ migration_name: string; started_at: Date; finished_at: Date | null }[]> {
  try {
    return await prisma.$queryRaw<
      { migration_name: string; started_at: Date; finished_at: Date | null }[]
    >`
      SELECT "migration_name", "started_at", "finished_at"
      FROM "_prisma_migrations"
      WHERE "finished_at" IS NOT NULL
      ORDER BY "started_at" DESC
    `;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw databaseError('getAppliedMigrations', err);
  }
}

/**
 * Check if _prisma_migrations table exists
 */
export async function checkMigrationsTableExists(
  prisma: PrismaClientLike,
  database: DatabaseType = 'postgresql'
): Promise<boolean> {
  try {
    let query: string;

    switch (database) {
      case 'sqlite':
        query = `SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'`;
        break;
      case 'mysql':
        query = `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_NAME = '_prisma_migrations'`;
        break;
      // case 'postgresql':
      default:
        query = `SELECT tablename FROM pg_tables WHERE tablename = '_prisma_migrations'`;
        break;
    }

    const result = await prisma.$queryRawUnsafe(query);
    return Array.isArray(result) && result.length > 0;
  } catch {
    return false;
  }
}

// ============================================================================
// SQL Helpers
// ============================================================================

/**
 * Split SQL into individual statements
 * Handles basic cases - not a full SQL parser
 */
function splitSqlStatements(sql: string): string[] {
  // Simple split on semicolons, but be aware this doesn't handle
  // semicolons inside strings/comments perfectly
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const prevChar = sql[i - 1];

    // Handle string literals
    if ((char === "'" || char === '"') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    // Handle statement separator
    if (char === ';' && !inString) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Add final statement if any
  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }

  return statements;
}

/**
 * Escape single quotes in SQL string
 */
function escapeString(value: string): string {
  return value.replace(/'/g, "''");
}
