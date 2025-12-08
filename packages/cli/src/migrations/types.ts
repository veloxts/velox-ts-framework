/**
 * Migration Types
 *
 * Core type definitions for the VeloxTS migration runner system.
 */

// ============================================================================
// Prisma Client Interface
// ============================================================================

/**
 * Minimal Prisma client interface for migration operations.
 *
 * This avoids depending on generated Prisma client types which may not exist
 * in CI environments where `prisma generate` hasn't been run.
 */
export interface PrismaClientLike {
  /**
   * Execute a raw SQL query and return results.
   * Uses a tagged template literal for parameterized queries.
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;

  /**
   * Execute a raw SQL query string and return results.
   * Use with caution - values are not automatically escaped.
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;

  /**
   * Execute a raw SQL statement (INSERT, UPDATE, DELETE, etc.).
   * Returns the number of affected rows.
   */
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;

  /**
   * Disconnect from the database.
   */
  $disconnect(): Promise<void>;
}

// ============================================================================
// Migration File Types
// ============================================================================

/**
 * A migration file loaded from the filesystem
 */
export interface MigrationFile {
  /** Full migration name (e.g., "20241208120000_create_users") */
  readonly name: string;

  /** Timestamp prefix (e.g., "20241208120000") */
  readonly timestamp: string;

  /** Description suffix (e.g., "create_users") */
  readonly description: string;

  /** Absolute path to migration.sql */
  readonly upPath: string;

  /** Absolute path to down.sql (null if not exists) */
  readonly downPath: string | null;

  /** Whether rollback is available (down.sql exists) */
  readonly hasRollback: boolean;
}

// ============================================================================
// Prisma Migration Record
// ============================================================================

/**
 * Record from Prisma's _prisma_migrations table
 */
export interface PrismaMigrationRecord {
  /** UUID identifier */
  id: string;

  /** SHA-256 checksum of migration.sql */
  checksum: string;

  /** When migration finished (null if failed) */
  finished_at: Date | null;

  /** Migration name (matches folder name) */
  migration_name: string;

  /** Log output from migration */
  logs: string | null;

  /** When migration was rolled back (null if not rolled back) */
  rolled_back_at: Date | null;

  /** When migration started */
  started_at: Date;

  /** Number of steps applied */
  applied_steps_count: number;
}

// ============================================================================
// Migration Status
// ============================================================================

/**
 * Status of a migration
 */
export type MigrationStatusType = 'applied' | 'pending' | 'failed';

/**
 * Combined status of a migration (file + database record)
 */
export interface MigrationStatus {
  /** Migration name */
  readonly name: string;

  /** Current status */
  readonly status: MigrationStatusType;

  /** When applied (null if pending) */
  readonly appliedAt: Date | null;

  /** Whether rollback is available (down.sql exists) */
  readonly hasRollback: boolean;

  /** Duration in milliseconds (null if pending or unknown) */
  readonly duration: number | null;
}

// ============================================================================
// Command Options
// ============================================================================

/**
 * Options for migrate:status command
 */
export interface MigrateStatusOptions {
  /** Show only pending migrations */
  readonly pending?: boolean;

  /** Output as JSON */
  readonly json?: boolean;
}

/**
 * Options for migrate:run command
 */
export interface MigrateRunOptions {
  /** Use development mode (prisma migrate dev) */
  readonly dev?: boolean;

  /** Run only N migrations */
  readonly step?: number;

  /** Show what would be run without executing */
  readonly dryRun?: boolean;

  /** Output as JSON */
  readonly json?: boolean;
}

/**
 * Options for migrate:rollback command
 */
export interface MigrateRollbackOptions {
  /** Number of migrations to rollback (default: 1) */
  readonly step?: number;

  /** Rollback all migrations */
  readonly all?: boolean;

  /** Skip confirmation prompt */
  readonly force?: boolean;

  /** Show what would be rolled back */
  readonly dryRun?: boolean;

  /** Output as JSON */
  readonly json?: boolean;
}

/**
 * Options for migrate:fresh command
 */
export interface MigrateFreshOptions {
  /** Run seeders after migrations */
  readonly seed?: boolean;

  /** Skip confirmation prompt */
  readonly force?: boolean;

  /** Output as JSON */
  readonly json?: boolean;
}

/**
 * Options for migrate:reset command
 */
export interface MigrateResetOptions {
  /** Run seeders after migrations */
  readonly seed?: boolean;

  /** Skip confirmation prompt */
  readonly force?: boolean;

  /** Output as JSON */
  readonly json?: boolean;
}

// ============================================================================
// Operation Results
// ============================================================================

/**
 * Result of running Prisma CLI command
 */
export interface PrismaResult {
  /** Whether command succeeded */
  readonly success: boolean;

  /** Standard output */
  readonly output: string;

  /** Standard error (if failed) */
  readonly error?: string;

  /** Exit code */
  readonly exitCode: number;
}

/**
 * Result of rolling back a single migration
 */
export interface RollbackResult {
  /** Migration name */
  readonly migration: string;

  /** Whether rollback succeeded */
  readonly success: boolean;

  /** Duration in milliseconds */
  readonly duration: number;

  /** Error message if failed */
  readonly error?: string;
}

/**
 * Result of a batch rollback operation
 */
export interface BatchRollbackResult {
  /** Individual rollback results */
  readonly results: ReadonlyArray<RollbackResult>;

  /** Total migrations rolled back */
  readonly total: number;

  /** Number of successful rollbacks */
  readonly successful: number;

  /** Number of failed rollbacks */
  readonly failed: number;

  /** Total duration in milliseconds */
  readonly duration: number;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Database type for SQL dialect
 */
export type DatabaseType = 'sqlite' | 'postgresql' | 'mysql';

/**
 * Configuration for the migration runner
 */
export interface MigrationConfig {
  /** Working directory (project root) */
  readonly cwd: string;

  /** Database type */
  readonly database: DatabaseType;

  /** Path to migrations directory (relative to cwd) */
  readonly migrationsPath: string;
}
