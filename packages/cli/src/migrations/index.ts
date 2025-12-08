/**
 * Migration Runner
 *
 * Public API for the VeloxTS migration runner system.
 */

// Commands
export {
  createMigrateFreshCommand,
  createMigrateResetCommand,
  createMigrateRollbackCommand,
  createMigrateRunCommand,
  createMigrateStatusCommand,
} from './commands/index.js';
// Errors
export {
  checksumMismatch,
  databaseError,
  MigrationError,
  type MigrationErrorCode,
  migrationNotFound,
  migrationsDirNotFound,
  noAppliedMigrations,
  noPendingMigrations,
  noRollbackFile,
  prismaError,
  prismaNotFound,
  rollbackFailed,
} from './errors.js';
// Loader
export {
  computeMigrationStatus,
  DEFAULT_MIGRATIONS_PATH,
  getAppliedMigrationsWithRollback,
  getMigrationByName,
  getPendingMigrations,
  loadMigrations,
  migrationsDirExists,
  readMigrationSql,
} from './loader.js';
// Prisma Wrapper
export {
  isPrismaAvailable,
  type ParsedMigrationStatus,
  parseMigrateStatusOutput,
  prismaDbPush,
  prismaDbSeed,
  prismaMigrateDeploy,
  prismaMigrateDev,
  prismaMigrateReset,
  prismaMigrateStatus,
  runPrismaCommand,
  runPrismaCommandInteractive,
} from './prisma-wrapper.js';
// Rollback Runner
export {
  checkMigrationsTableExists,
  getAppliedMigrations,
  type RollbackOptions,
  rollbackAll,
  rollbackMigration,
  rollbackMultiple,
} from './rollback-runner.js';
// Types
export type {
  BatchRollbackResult,
  DatabaseType,
  MigrateFreshOptions,
  MigrateResetOptions,
  MigrateRollbackOptions,
  MigrateRunOptions,
  MigrateStatusOptions,
  MigrationConfig,
  MigrationFile,
  MigrationStatus,
  MigrationStatusType,
  PrismaClientLike,
  PrismaMigrationRecord,
  PrismaResult,
  RollbackResult,
} from './types.js';
export { createPrismaClient } from './types.js';
