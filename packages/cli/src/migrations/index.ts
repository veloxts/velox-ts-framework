/**
 * Migration Runner
 *
 * Public API for the VeloxTS migration runner system.
 */

// Types
export type {
  MigrationFile,
  PrismaMigrationRecord,
  MigrationStatus,
  MigrationStatusType,
  MigrateStatusOptions,
  MigrateRunOptions,
  MigrateRollbackOptions,
  MigrateFreshOptions,
  MigrateResetOptions,
  PrismaResult,
  RollbackResult,
  BatchRollbackResult,
  DatabaseType,
  MigrationConfig,
} from './types.js';

// Errors
export {
  MigrationError,
  type MigrationErrorCode,
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
} from './errors.js';

// Loader
export {
  DEFAULT_MIGRATIONS_PATH,
  loadMigrations,
  getMigrationByName,
  readMigrationSql,
  computeMigrationStatus,
  getPendingMigrations,
  getAppliedMigrationsWithRollback,
  migrationsDirExists,
} from './loader.js';

// Prisma Wrapper
export {
  runPrismaCommand,
  runPrismaCommandInteractive,
  prismaMigrateStatus,
  prismaMigrateDeploy,
  prismaMigrateDev,
  prismaMigrateReset,
  prismaDbPush,
  prismaDbSeed,
  parseMigrateStatusOutput,
  isPrismaAvailable,
  type ParsedMigrationStatus,
} from './prisma-wrapper.js';

// Rollback Runner
export {
  rollbackMigration,
  rollbackMultiple,
  rollbackAll,
  getAppliedMigrations,
  checkMigrationsTableExists,
  type RollbackOptions,
} from './rollback-runner.js';

// Commands
export {
  createMigrateStatusCommand,
  createMigrateRunCommand,
  createMigrateRollbackCommand,
  createMigrateFreshCommand,
  createMigrateResetCommand,
} from './commands/index.js';
