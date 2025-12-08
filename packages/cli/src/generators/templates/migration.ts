/**
 * Migration Template
 *
 * Generates Prisma migration files with common SQL patterns.
 */

import type { TemplateContext, TemplateFunction, GeneratedFile } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface MigrationOptions {
  /** Database type (affects SQL syntax) */
  database: 'sqlite' | 'postgresql' | 'mysql';
}

// ============================================================================
// Migration Name Parser
// ============================================================================

interface ParsedMigration {
  type: 'create' | 'add' | 'remove' | 'rename' | 'drop' | 'custom';
  table?: string;
  column?: string;
  oldName?: string;
  newName?: string;
}

/**
 * Parse migration name to determine type and extract details
 *
 * Supported patterns:
 * - create_users → CREATE TABLE users
 * - add_email_to_users → ALTER TABLE ADD COLUMN
 * - remove_name_from_users → ALTER TABLE DROP COLUMN
 * - rename_users_to_accounts → RENAME TABLE
 * - drop_users → DROP TABLE
 */
function parseMigrationName(name: string): ParsedMigration {
  const lower = name.toLowerCase();

  // create_<table>
  if (lower.startsWith('create_')) {
    return {
      type: 'create',
      table: name.slice(7), // remove 'create_'
    };
  }

  // add_<column>_to_<table>
  const addMatch = lower.match(/^add_(.+)_to_(.+)$/);
  if (addMatch) {
    return {
      type: 'add',
      column: addMatch[1],
      table: addMatch[2],
    };
  }

  // remove_<column>_from_<table>
  const removeMatch = lower.match(/^remove_(.+)_from_(.+)$/);
  if (removeMatch) {
    return {
      type: 'remove',
      column: removeMatch[1],
      table: removeMatch[2],
    };
  }

  // rename_<old>_to_<new>
  const renameMatch = lower.match(/^rename_(.+)_to_(.+)$/);
  if (renameMatch) {
    return {
      type: 'rename',
      oldName: renameMatch[1],
      newName: renameMatch[2],
    };
  }

  // drop_<table>
  if (lower.startsWith('drop_')) {
    return {
      type: 'drop',
      table: name.slice(5), // remove 'drop_'
    };
  }

  // Custom migration
  return { type: 'custom' };
}

// ============================================================================
// SQL Generators
// ============================================================================

/**
 * Generate CREATE TABLE SQL
 */
function generateCreateTableSql(table: string, database: string): string {
  const idType = database === 'postgresql' ? 'UUID' : 'TEXT';
  const idDefault = database === 'postgresql'
    ? 'DEFAULT gen_random_uuid()'
    : '';
  const timestampType = database === 'mysql' ? 'DATETIME' : 'TIMESTAMP';
  const timestampDefault = database === 'sqlite'
    ? "DEFAULT (datetime('now'))"
    : database === 'postgresql'
    ? 'DEFAULT CURRENT_TIMESTAMP'
    : 'DEFAULT CURRENT_TIMESTAMP';

  return `-- CreateTable
CREATE TABLE "${table}" (
    "id" ${idType} PRIMARY KEY ${idDefault},
    -- TODO: Add your columns here
    -- "name" TEXT NOT NULL,
    -- "email" TEXT NOT NULL UNIQUE,
    "created_at" ${timestampType} NOT NULL ${timestampDefault},
    "updated_at" ${timestampType} NOT NULL ${timestampDefault}
);

-- CreateIndex (optional)
-- CREATE UNIQUE INDEX "${table}_email_key" ON "${table}"("email");
`;
}

/**
 * Generate ADD COLUMN SQL
 */
function generateAddColumnSql(table: string, column: string, _database: string): string {
  return `-- AddColumn
ALTER TABLE "${table}" ADD COLUMN "${column}" TEXT;
-- TODO: Adjust the column type as needed
-- Common types: TEXT, INTEGER, BOOLEAN, TIMESTAMP, UUID
-- Add NOT NULL if required (may need DEFAULT value)
`;
}

/**
 * Generate DROP COLUMN SQL
 */
function generateRemoveColumnSql(table: string, column: string, database: string): string {
  if (database === 'sqlite') {
    return `-- RemoveColumn
-- SQLite doesn't support DROP COLUMN directly.
-- You need to recreate the table without the column.
-- See: https://www.sqlite.org/lang_altertable.html

-- Step 1: Create new table without the column
-- CREATE TABLE "${table}_new" (
--     "id" TEXT PRIMARY KEY,
--     -- all columns except "${column}"
--     "created_at" TIMESTAMP NOT NULL,
--     "updated_at" TIMESTAMP NOT NULL
-- );

-- Step 2: Copy data
-- INSERT INTO "${table}_new" SELECT id, ..., created_at, updated_at FROM "${table}";

-- Step 3: Drop old table
-- DROP TABLE "${table}";

-- Step 4: Rename new table
-- ALTER TABLE "${table}_new" RENAME TO "${table}";
`;
  }

  return `-- RemoveColumn
ALTER TABLE "${table}" DROP COLUMN "${column}";
`;
}

/**
 * Generate RENAME TABLE SQL
 */
function generateRenameTableSql(oldName: string, newName: string, database: string): string {
  if (database === 'mysql') {
    return `-- RenameTable
RENAME TABLE "${oldName}" TO "${newName}";
`;
  }

  return `-- RenameTable
ALTER TABLE "${oldName}" RENAME TO "${newName}";
`;
}

/**
 * Generate DROP TABLE SQL
 */
function generateDropTableSql(table: string): string {
  return `-- DropTable
DROP TABLE IF EXISTS "${table}";
`;
}

/**
 * Generate custom migration SQL
 */
function generateCustomSql(name: string): string {
  return `-- Migration: ${name}
--
-- Write your custom SQL here.
-- This migration was created because the name didn't match
-- any known patterns (create_*, add_*_to_*, remove_*_from_*, etc.)

-- Example operations:
-- CREATE TABLE "example" (...);
-- ALTER TABLE "example" ADD COLUMN "field" TEXT;
-- CREATE INDEX "example_field_idx" ON "example"("field");
-- UPDATE "example" SET "field" = 'value' WHERE condition;
`;
}

// ============================================================================
// Template Functions
// ============================================================================

/**
 * Generate migration SQL based on name and database type
 */
function generateMigrationSql(name: string, database: string): string {
  const parsed = parseMigrationName(name);

  switch (parsed.type) {
    case 'create':
      return generateCreateTableSql(parsed.table!, database);

    case 'add':
      return generateAddColumnSql(parsed.table!, parsed.column!, database);

    case 'remove':
      return generateRemoveColumnSql(parsed.table!, parsed.column!, database);

    case 'rename':
      return generateRenameTableSql(parsed.oldName!, parsed.newName!, database);

    case 'drop':
      return generateDropTableSql(parsed.table!);

    case 'custom':
    default:
      return generateCustomSql(name);
  }
}

/**
 * Generate timestamp for migration folder name
 */
function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

// ============================================================================
// Template Export
// ============================================================================

/**
 * Migration template
 */
export const migrationTemplate: TemplateFunction<MigrationOptions> = (ctx) => {
  return generateMigrationSql(ctx.entity.raw, ctx.options.database);
};

/**
 * Generate all files for a migration
 */
export function generateMigrationFiles(ctx: TemplateContext<MigrationOptions>): GeneratedFile[] {
  const timestamp = generateTimestamp();
  const migrationName = ctx.entity.snake;
  const folderName = `${timestamp}_${migrationName}`;

  const sql = generateMigrationSql(ctx.entity.raw, ctx.options.database);

  return [
    {
      path: `prisma/migrations/${folderName}/migration.sql`,
      content: sql,
    },
  ];
}

/**
 * Generate post-generation instructions
 */
export function getMigrationInstructions(migrationName: string): string {
  return `
  1. Review and customize the generated SQL:

     Edit prisma/migrations/*_${migrationName}/migration.sql

  2. Apply the migration:

     For development (with Prisma):
       pnpm db:push

     For production migrations:
       npx prisma migrate deploy

  Note: If using Prisma's migration system, you may prefer:
       npx prisma migrate dev --name ${migrationName}

  This will create a migration with proper Prisma metadata.
`;
}
