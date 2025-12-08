/**
 * Migration Template
 *
 * Generates Prisma migration files with common SQL patterns.
 */

import type { GeneratedFile, TemplateContext, TemplateFunction } from '../types.js';

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

type ParsedMigration =
  | { type: 'create'; table: string }
  | { type: 'add'; table: string; column: string }
  | { type: 'remove'; table: string; column: string }
  | { type: 'rename'; oldName: string; newName: string }
  | { type: 'drop'; table: string }
  | { type: 'custom' };

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
    const column = addMatch[1];
    const table = addMatch[2];
    if (column && table) {
      return {
        type: 'add',
        column,
        table,
      };
    }
  }

  // remove_<column>_from_<table>
  const removeMatch = lower.match(/^remove_(.+)_from_(.+)$/);
  if (removeMatch) {
    const column = removeMatch[1];
    const table = removeMatch[2];
    if (column && table) {
      return {
        type: 'remove',
        column,
        table,
      };
    }
  }

  // rename_<old>_to_<new>
  const renameMatch = lower.match(/^rename_(.+)_to_(.+)$/);
  if (renameMatch) {
    const oldName = renameMatch[1];
    const newName = renameMatch[2];
    if (oldName && newName) {
      return {
        type: 'rename',
        oldName,
        newName,
      };
    }
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
  const idDefault = database === 'postgresql' ? 'DEFAULT gen_random_uuid()' : '';
  const timestampType = database === 'mysql' ? 'DATETIME' : 'TIMESTAMP';
  const timestampDefault =
    database === 'sqlite'
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
// Rollback SQL Generators
// ============================================================================

/**
 * Generate DROP TABLE SQL for rollback of CREATE TABLE
 */
function generateRollbackCreateTableSql(table: string): string {
  return `-- RollbackCreateTable
DROP TABLE IF EXISTS "${table}";
`;
}

/**
 * Generate DROP COLUMN SQL for rollback of ADD COLUMN
 */
function generateRollbackAddColumnSql(table: string, column: string, database: string): string {
  if (database === 'sqlite') {
    return `-- RollbackAddColumn
-- SQLite doesn't support DROP COLUMN directly in older versions.
-- For SQLite 3.35.0+ you can use:
ALTER TABLE "${table}" DROP COLUMN "${column}";

-- For older SQLite versions, you need to recreate the table.
-- See: https://www.sqlite.org/lang_altertable.html
`;
  }

  return `-- RollbackAddColumn
ALTER TABLE "${table}" DROP COLUMN "${column}";
`;
}

/**
 * Generate ADD COLUMN SQL for rollback of REMOVE COLUMN
 * Note: Data loss warning - column data cannot be recovered
 */
function generateRollbackRemoveColumnSql(table: string, column: string): string {
  return `-- RollbackRemoveColumn
-- WARNING: Original column data cannot be recovered!
-- You must manually specify the correct column type.
ALTER TABLE "${table}" ADD COLUMN "${column}" TEXT;
-- TODO: Adjust the column type to match the original schema
`;
}

/**
 * Generate reverse RENAME TABLE SQL for rollback
 */
function generateRollbackRenameTableSql(
  oldName: string,
  newName: string,
  database: string
): string {
  // Reverse the rename: newName -> oldName
  if (database === 'mysql') {
    return `-- RollbackRenameTable
RENAME TABLE "${newName}" TO "${oldName}";
`;
  }

  return `-- RollbackRenameTable
ALTER TABLE "${newName}" RENAME TO "${oldName}";
`;
}

/**
 * Generate warning for rollback of DROP TABLE
 * Data loss - cannot recover dropped table
 */
function generateRollbackDropTableSql(table: string): string {
  return `-- RollbackDropTable
-- WARNING: Cannot automatically rollback DROP TABLE!
-- The original table data and schema are lost.
-- You must manually recreate the table with its original schema:
--
-- CREATE TABLE "${table}" (
--     "id" TEXT PRIMARY KEY,
--     -- TODO: Add original columns here
--     "created_at" TIMESTAMP NOT NULL,
--     "updated_at" TIMESTAMP NOT NULL
-- );
`;
}

/**
 * Generate rollback SQL for custom migrations
 */
function generateRollbackCustomSql(name: string): string {
  return `-- Rollback Migration: ${name}
--
-- Write your rollback SQL here.
-- This should reverse the operations in migration.sql
--
-- Example rollback operations:
-- DROP TABLE IF EXISTS "example";
-- ALTER TABLE "example" DROP COLUMN "field";
-- DROP INDEX "example_field_idx";
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
      return generateCreateTableSql(parsed.table, database);

    case 'add':
      return generateAddColumnSql(parsed.table, parsed.column, database);

    case 'remove':
      return generateRemoveColumnSql(parsed.table, parsed.column, database);

    case 'rename':
      return generateRenameTableSql(parsed.oldName, parsed.newName, database);

    case 'drop':
      return generateDropTableSql(parsed.table);

    case 'custom':
      return generateCustomSql(name);
  }
}

/**
 * Generate rollback SQL based on name and database type
 */
function generateRollbackSql(name: string, database: string): string {
  const parsed = parseMigrationName(name);

  switch (parsed.type) {
    case 'create':
      return generateRollbackCreateTableSql(parsed.table);

    case 'add':
      return generateRollbackAddColumnSql(parsed.table, parsed.column, database);

    case 'remove':
      return generateRollbackRemoveColumnSql(parsed.table, parsed.column);

    case 'rename':
      return generateRollbackRenameTableSql(parsed.oldName, parsed.newName, database);

    case 'drop':
      return generateRollbackDropTableSql(parsed.table);

    case 'custom':
      return generateRollbackCustomSql(name);
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
  // Use raw entity name to preserve original migration name (e.g., create_users)
  const migrationName = ctx.entity.raw;
  const folderName = `${timestamp}_${migrationName}`;

  const upSql = migrationTemplate(ctx);
  const downSql = generateRollbackSql(ctx.entity.raw, ctx.options.database);

  return [
    {
      path: `prisma/migrations/${folderName}/migration.sql`,
      content: upSql,
    },
    {
      path: `prisma/migrations/${folderName}/down.sql`,
      content: downSql,
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
     Edit prisma/migrations/*_${migrationName}/down.sql (rollback)

  2. Apply the migration:

     For development (with Prisma):
       pnpm db:push

     For production migrations:
       npx prisma migrate deploy

  3. To rollback (if needed):

     Run the SQL in down.sql manually:
       sqlite3 prisma/dev.db < prisma/migrations/*_${migrationName}/down.sql

     Or use a database client to execute the rollback SQL.

  Note: If using Prisma's migration system, you may prefer:
       npx prisma migrate dev --name ${migrationName}

  This will create a migration with proper Prisma metadata.
`;
}
