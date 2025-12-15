/**
 * Migration Errors
 *
 * Error classes and codes for the migration runner system.
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Error codes for migration operations
 */
export type MigrationErrorCode =
  | 'PRISMA_NOT_FOUND'
  | 'MIGRATIONS_DIR_NOT_FOUND'
  | 'MIGRATION_NOT_FOUND'
  | 'NO_ROLLBACK_FILE'
  | 'ROLLBACK_FAILED'
  | 'PRISMA_ERROR'
  | 'DATABASE_ERROR'
  | 'NO_PENDING_MIGRATIONS'
  | 'NO_APPLIED_MIGRATIONS'
  | 'CHECKSUM_MISMATCH';

/**
 * Human-readable messages for error codes
 */
const ERROR_MESSAGES: Record<MigrationErrorCode, string> = {
  PRISMA_NOT_FOUND: 'Prisma CLI not found. Ensure @prisma/client is installed.',
  MIGRATIONS_DIR_NOT_FOUND: 'Migrations directory not found.',
  MIGRATION_NOT_FOUND: 'Migration not found.',
  NO_ROLLBACK_FILE: 'No down.sql file found for migration.',
  ROLLBACK_FAILED: 'Rollback failed.',
  PRISMA_ERROR: 'Prisma command failed.',
  DATABASE_ERROR: 'Database operation failed.',
  NO_PENDING_MIGRATIONS: 'No pending migrations to run.',
  NO_APPLIED_MIGRATIONS: 'No migrations have been applied.',
  CHECKSUM_MISMATCH: 'Migration checksum does not match.',
};

// ============================================================================
// Migration Error Class
// ============================================================================

/**
 * Structured error for migration operations
 */
export class MigrationError extends Error {
  /** Error code for programmatic handling */
  public readonly code: MigrationErrorCode;

  /** Additional context/details */
  public readonly details?: Record<string, unknown>;

  /** Suggested fix (optional) */
  public readonly fix?: string;

  constructor(
    code: MigrationErrorCode,
    message?: string,
    options?: {
      details?: Record<string, unknown>;
      fix?: string;
      cause?: Error;
    }
  ) {
    const errorMessage = message ?? ERROR_MESSAGES[code];
    super(errorMessage, { cause: options?.cause });

    this.name = 'MigrationError';
    this.code = code;
    this.details = options?.details;
    this.fix = options?.fix;
  }

  /**
   * Format error for display
   */
  format(): string {
    let output = `MigrationError[${this.code}]: ${this.message}`;

    if (this.details && Object.keys(this.details).length > 0) {
      output += '\n\n  Details:';
      for (const [key, value] of Object.entries(this.details)) {
        output += `\n    ${key}: ${String(value)}`;
      }
    }

    if (this.fix) {
      output += `\n\n  Fix: ${this.fix}`;
    }

    return output;
  }

  /**
   * Convert to JSON for --json output
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      fix: this.fix,
    };
  }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create error for missing Prisma CLI
 */
export function prismaNotFound(): MigrationError {
  return new MigrationError('PRISMA_NOT_FOUND', undefined, {
    fix: 'Install Prisma: npm install @prisma/client prisma',
  });
}

/**
 * Create error for missing migrations directory
 */
export function migrationsDirNotFound(path: string): MigrationError {
  return new MigrationError('MIGRATIONS_DIR_NOT_FOUND', `Migrations directory not found: ${path}`, {
    details: { path },
    fix: 'Create a migration with: velox make migration create_users',
  });
}

/**
 * Create error for migration not found
 */
export function migrationNotFound(name: string): MigrationError {
  return new MigrationError('MIGRATION_NOT_FOUND', `Migration not found: ${name}`, {
    details: { name },
    fix: 'Run "velox migrate:status" to see available migrations.',
  });
}

/**
 * Create error for missing rollback file
 */
export function noRollbackFile(migration: string): MigrationError {
  return new MigrationError('NO_ROLLBACK_FILE', `No down.sql found for migration: ${migration}`, {
    details: { migration },
    fix: 'Create a down.sql file in the migration folder, or use "velox migrate:fresh" to reset.',
  });
}

/**
 * Create error for rollback failure
 */
export function rollbackFailed(migration: string, cause: Error): MigrationError {
  return new MigrationError('ROLLBACK_FAILED', `Failed to rollback migration: ${migration}`, {
    details: { migration, originalError: cause.message },
    cause,
  });
}

/**
 * Create error for Prisma command failure
 */
export function prismaError(command: string, output: string): MigrationError {
  return new MigrationError('PRISMA_ERROR', `Prisma command failed: ${command}`, {
    details: { command, output },
  });
}

/**
 * Create error for database operation failure
 */
export function databaseError(operation: string, cause: Error): MigrationError {
  return new MigrationError('DATABASE_ERROR', `Database operation failed: ${operation}`, {
    details: { operation, originalError: cause.message },
    cause,
  });
}

/**
 * Create error for no pending migrations
 */
export function noPendingMigrations(): MigrationError {
  return new MigrationError('NO_PENDING_MIGRATIONS', 'No pending migrations to run.');
}

/**
 * Create error for no applied migrations
 */
export function noAppliedMigrations(): MigrationError {
  return new MigrationError('NO_APPLIED_MIGRATIONS', 'No migrations have been applied yet.');
}

/**
 * Create error for checksum mismatch
 */
export function checksumMismatch(
  migration: string,
  expected: string,
  actual: string
): MigrationError {
  return new MigrationError('CHECKSUM_MISMATCH', `Migration checksum mismatch: ${migration}`, {
    details: { migration, expected, actual },
    fix: 'The migration file has been modified after it was applied. Use "velox migrate:fresh" to reset.',
  });
}
