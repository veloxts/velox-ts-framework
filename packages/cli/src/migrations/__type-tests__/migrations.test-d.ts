/**
 * Type tests for Migration Runner
 *
 * These tests verify that TypeScript type inference works correctly
 * for migration types, errors, and function signatures.
 */

import { expectAssignable, expectType } from 'tsd';

// Import from the compiled dist folder
import {
  type BatchRollbackResult,
  type DatabaseType,
  type MigrateFreshOptions,
  type MigrateResetOptions,
  type MigrateRollbackOptions,
  type MigrateRunOptions,
  type MigrateStatusOptions,
  type MigrationConfig,
  MigrationError,
  type MigrationErrorCode,
  type MigrationFile,
  type MigrationStatus,
  type MigrationStatusType,
  type PrismaMigrationRecord,
  type PrismaResult,
  type RollbackResult,
} from '../../../dist/index.js';

// ============================================================================
// MigrationFile Type Tests
// ============================================================================

// MigrationFile has all required fields
const migrationFile: MigrationFile = {
  name: '20241208120000_create_users',
  timestamp: '20241208120000',
  description: 'create_users',
  upPath: '/test/migration.sql',
  downPath: '/test/down.sql',
  hasRollback: true,
};

expectType<string>(migrationFile.name);
expectType<string>(migrationFile.timestamp);
expectType<string>(migrationFile.description);
expectType<string>(migrationFile.upPath);
expectType<string | null>(migrationFile.downPath);
expectType<boolean>(migrationFile.hasRollback);

// MigrationFile with null downPath
const migrationWithoutRollback: MigrationFile = {
  name: '20241208120000_create_users',
  timestamp: '20241208120000',
  description: 'create_users',
  upPath: '/test/migration.sql',
  downPath: null,
  hasRollback: false,
};

expectType<null>(migrationWithoutRollback.downPath);

// ============================================================================
// PrismaMigrationRecord Type Tests
// ============================================================================

const prismaRecord: PrismaMigrationRecord = {
  id: 'uuid-123',
  checksum: 'abc123def456',
  finished_at: new Date(),
  migration_name: '20241208120000_create_users',
  logs: null,
  rolled_back_at: null,
  started_at: new Date(),
  applied_steps_count: 1,
};

expectType<string>(prismaRecord.id);
expectType<string>(prismaRecord.checksum);
expectType<Date | null>(prismaRecord.finished_at);
expectType<string>(prismaRecord.migration_name);
expectType<string | null>(prismaRecord.logs);
expectType<Date | null>(prismaRecord.rolled_back_at);
expectType<Date>(prismaRecord.started_at);
expectType<number>(prismaRecord.applied_steps_count);

// ============================================================================
// MigrationStatus Type Tests
// ============================================================================

// MigrationStatusType is a union of literals
const appliedStatus: MigrationStatusType = 'applied';
const pendingStatus: MigrationStatusType = 'pending';
const failedStatus: MigrationStatusType = 'failed';

expectType<'applied'>(appliedStatus);
expectType<'pending'>(pendingStatus);
expectType<'failed'>(failedStatus);

// Full MigrationStatus object
const migrationStatus: MigrationStatus = {
  name: '20241208120000_create_users',
  status: 'applied',
  appliedAt: new Date(),
  hasRollback: true,
  duration: 100,
};

expectType<string>(migrationStatus.name);
expectType<MigrationStatusType>(migrationStatus.status);
expectType<Date | null>(migrationStatus.appliedAt);
expectType<boolean>(migrationStatus.hasRollback);
expectType<number | null>(migrationStatus.duration);

// Pending migration has null appliedAt
const pendingMigration: MigrationStatus = {
  name: '20241209120000_add_email',
  status: 'pending',
  appliedAt: null,
  hasRollback: false,
  duration: null,
};

expectType<null>(pendingMigration.appliedAt);
expectType<null>(pendingMigration.duration);

// ============================================================================
// Command Options Type Tests
// ============================================================================

// MigrateStatusOptions
const statusOptions: MigrateStatusOptions = {
  pending: true,
  json: false,
};

expectType<boolean | undefined>(statusOptions.pending);
expectType<boolean | undefined>(statusOptions.json);

// MigrateRunOptions
const runOptions: MigrateRunOptions = {
  dev: true,
  step: 2,
  dryRun: false,
  json: false,
};

expectType<boolean | undefined>(runOptions.dev);
expectType<number | undefined>(runOptions.step);
expectType<boolean | undefined>(runOptions.dryRun);
expectType<boolean | undefined>(runOptions.json);

// MigrateRollbackOptions
const rollbackOptions: MigrateRollbackOptions = {
  step: 1,
  all: false,
  force: true,
  dryRun: false,
  json: false,
};

expectType<number | undefined>(rollbackOptions.step);
expectType<boolean | undefined>(rollbackOptions.all);
expectType<boolean | undefined>(rollbackOptions.force);
expectType<boolean | undefined>(rollbackOptions.dryRun);
expectType<boolean | undefined>(rollbackOptions.json);

// MigrateFreshOptions
const freshOptions: MigrateFreshOptions = {
  seed: true,
  force: true,
  json: false,
};

expectType<boolean | undefined>(freshOptions.seed);
expectType<boolean | undefined>(freshOptions.force);
expectType<boolean | undefined>(freshOptions.json);

// MigrateResetOptions
const resetOptions: MigrateResetOptions = {
  seed: false,
  force: true,
  json: false,
};

expectType<boolean | undefined>(resetOptions.seed);
expectType<boolean | undefined>(resetOptions.force);
expectType<boolean | undefined>(resetOptions.json);

// ============================================================================
// Result Types Tests
// ============================================================================

// PrismaResult
const prismaResult: PrismaResult = {
  success: true,
  output: 'Migration applied',
  exitCode: 0,
};

expectType<boolean>(prismaResult.success);
expectType<string>(prismaResult.output);
expectType<string | undefined>(prismaResult.error);
expectType<number>(prismaResult.exitCode);

// Failed PrismaResult
const failedPrismaResult: PrismaResult = {
  success: false,
  output: '',
  error: 'Connection failed',
  exitCode: 1,
};

expectType<string | undefined>(failedPrismaResult.error);

// RollbackResult
const rollbackResult: RollbackResult = {
  migration: '20241208120000_create_users',
  success: true,
  duration: 50,
};

expectType<string>(rollbackResult.migration);
expectType<boolean>(rollbackResult.success);
expectType<number>(rollbackResult.duration);
expectType<string | undefined>(rollbackResult.error);

// Failed RollbackResult
const failedRollbackResult: RollbackResult = {
  migration: '20241208120000_create_users',
  success: false,
  duration: 0,
  error: 'SQL syntax error',
};

expectType<string | undefined>(failedRollbackResult.error);

// BatchRollbackResult
const batchResult: BatchRollbackResult = {
  results: [rollbackResult, failedRollbackResult],
  total: 2,
  successful: 1,
  failed: 1,
  duration: 100,
};

expectType<ReadonlyArray<RollbackResult>>(batchResult.results);
expectType<number>(batchResult.total);
expectType<number>(batchResult.successful);
expectType<number>(batchResult.failed);
expectType<number>(batchResult.duration);

// ============================================================================
// Configuration Types Tests
// ============================================================================

// DatabaseType is a union
const sqliteDb: DatabaseType = 'sqlite';
const postgresDb: DatabaseType = 'postgresql';
const mysqlDb: DatabaseType = 'mysql';

expectType<'sqlite'>(sqliteDb);
expectType<'postgresql'>(postgresDb);
expectType<'mysql'>(mysqlDb);

// MigrationConfig
const config: MigrationConfig = {
  cwd: '/project',
  database: 'postgresql',
  migrationsPath: 'prisma/migrations',
};

expectType<string>(config.cwd);
expectType<DatabaseType>(config.database);
expectType<string>(config.migrationsPath);

// ============================================================================
// MigrationError Type Tests
// ============================================================================

// MigrationErrorCode is a union of literals
const errorCode1: MigrationErrorCode = 'PRISMA_NOT_FOUND';
const errorCode2: MigrationErrorCode = 'MIGRATION_NOT_FOUND';
const errorCode3: MigrationErrorCode = 'NO_ROLLBACK_FILE';
const errorCode4: MigrationErrorCode = 'ROLLBACK_FAILED';
const errorCode5: MigrationErrorCode = 'PRISMA_ERROR';

expectAssignable<MigrationErrorCode>(errorCode1);
expectAssignable<MigrationErrorCode>(errorCode2);
expectAssignable<MigrationErrorCode>(errorCode3);
expectAssignable<MigrationErrorCode>(errorCode4);
expectAssignable<MigrationErrorCode>(errorCode5);

// MigrationError construction
const migrationError = new MigrationError('MIGRATION_NOT_FOUND', 'Test error');
expectAssignable<Error>(migrationError);
expectType<MigrationErrorCode>(migrationError.code);
expectType<string>(migrationError.message);
expectType<Record<string, unknown> | undefined>(migrationError.details);
expectType<string | undefined>(migrationError.fix);

// MigrationError with options
const errorWithOptions = new MigrationError('ROLLBACK_FAILED', 'Rollback failed', {
  details: { migration: 'test' },
  fix: 'Check your down.sql file',
  cause: new Error('Original error'),
});

expectType<Record<string, unknown> | undefined>(errorWithOptions.details);
expectType<string | undefined>(errorWithOptions.fix);
expectType<unknown>(errorWithOptions.cause);

// format() returns string
const formattedError = migrationError.format();
expectType<string>(formattedError);

// toJSON() returns Record
const jsonError = migrationError.toJSON();
expectType<Record<string, unknown>>(jsonError);

// ============================================================================
// Readonly Constraints Tests
// ============================================================================

// MigrationFile fields are readonly
declare const readonlyMigrationFile: MigrationFile;
expectType<string>(readonlyMigrationFile.name);
// @ts-expect-error - Should not be able to assign to readonly property
// readonlyMigrationFile.name = 'test';

// MigrationStatus fields are readonly
declare const readonlyStatus: MigrationStatus;
expectType<string>(readonlyStatus.name);
// @ts-expect-error - Should not be able to assign to readonly property
// readonlyStatus.name = 'test';

// BatchRollbackResult.results is readonly array
declare const readonlyBatch: BatchRollbackResult;
expectType<ReadonlyArray<RollbackResult>>(readonlyBatch.results);
// @ts-expect-error - Should not be able to push to readonly array
// readonlyBatch.results.push(rollbackResult);
