/**
 * VeloxTS Error Catalog
 *
 * Central registry of all error codes with messages, fixes, and documentation links.
 * Error codes follow the pattern E[category][number]:
 *
 * E1xxx - Core/Runtime errors
 * E2xxx - Generator errors
 * E3xxx - Seeding errors
 * E4xxx - Migration errors
 * E5xxx - Dev server errors
 * E6xxx - Validation errors
 * E7xxx - Authentication errors
 * E8xxx - Database errors
 * E9xxx - Configuration errors
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Definition for a single error in the catalog
 */
export interface ErrorDefinition {
  /** Unique error code (e.g., 'E1001') */
  readonly code: string;
  /** Short name for the error (e.g., 'NOT_FOUND') */
  readonly name: string;
  /** Human-readable error message */
  readonly message: string;
  /** Suggested fix for the error */
  readonly fix?: string;
  /** URL to documentation about this error */
  readonly docsUrl?: string;
}

// ============================================================================
// Error Catalog
// ============================================================================

const DOCS_BASE = 'https://veloxts.dev/errors';

/**
 * Central error catalog containing all VeloxTS error definitions
 */
export const ERROR_CATALOG: Record<string, ErrorDefinition> = {
  // ==========================================================================
  // E1xxx - Core/Runtime Errors
  // ==========================================================================

  E1001: {
    code: 'E1001',
    name: 'NOT_FOUND',
    message: 'Resource not found',
    fix: 'Check that the resource exists and the ID is correct.',
    docsUrl: `${DOCS_BASE}/E1001`,
  },
  E1002: {
    code: 'E1002',
    name: 'VALIDATION_FAILED',
    message: 'Input validation failed',
    fix: 'Check the input data matches the expected schema.',
    docsUrl: `${DOCS_BASE}/E1002`,
  },
  E1003: {
    code: 'E1003',
    name: 'UNAUTHORIZED',
    message: 'Authentication required',
    fix: 'Provide valid authentication credentials.',
    docsUrl: `${DOCS_BASE}/E1003`,
  },
  E1004: {
    code: 'E1004',
    name: 'FORBIDDEN',
    message: 'Access denied',
    fix: 'Check that you have the required permissions for this action.',
    docsUrl: `${DOCS_BASE}/E1004`,
  },
  E1005: {
    code: 'E1005',
    name: 'CONFLICT',
    message: 'Resource conflict',
    fix: 'The resource already exists or conflicts with existing data.',
    docsUrl: `${DOCS_BASE}/E1005`,
  },
  E1006: {
    code: 'E1006',
    name: 'INTERNAL_ERROR',
    message: 'Internal server error',
    fix: 'Check server logs for more details.',
    docsUrl: `${DOCS_BASE}/E1006`,
  },

  // ==========================================================================
  // E2xxx - Generator Errors
  // ==========================================================================

  E2001: {
    code: 'E2001',
    name: 'NOT_IN_PROJECT',
    message: 'Not in a VeloxTS project',
    fix: 'Run this command from the root of your VeloxTS project (where package.json exists).',
    docsUrl: `${DOCS_BASE}/E2001`,
  },
  E2002: {
    code: 'E2002',
    name: 'INVALID_ENTITY_NAME',
    message: 'Invalid entity name',
    fix: 'Entity names must be alphanumeric and start with a letter (e.g., User, BlogPost).',
    docsUrl: `${DOCS_BASE}/E2002`,
  },
  E2003: {
    code: 'E2003',
    name: 'FILE_ALREADY_EXISTS',
    message: 'File already exists',
    fix: 'Use --force to overwrite existing files, or choose a different name.',
    docsUrl: `${DOCS_BASE}/E2003`,
  },
  E2004: {
    code: 'E2004',
    name: 'INVALID_OPTION',
    message: 'Invalid generator option',
    fix: 'Run the command with --help to see available options.',
    docsUrl: `${DOCS_BASE}/E2004`,
  },
  E2005: {
    code: 'E2005',
    name: 'GENERATION_FAILED',
    message: 'Code generation failed',
    fix: 'Check the error details above for more information.',
    docsUrl: `${DOCS_BASE}/E2005`,
  },
  E2006: {
    code: 'E2006',
    name: 'CANCELED',
    message: 'Operation canceled by user',
    docsUrl: `${DOCS_BASE}/E2006`,
  },
  E2007: {
    code: 'E2007',
    name: 'PROJECT_STRUCTURE',
    message: 'Invalid project structure',
    fix: 'Ensure your project follows the VeloxTS directory conventions.',
    docsUrl: `${DOCS_BASE}/E2007`,
  },
  E2008: {
    code: 'E2008',
    name: 'MIGRATION_FAILED',
    message: 'Database migration failed',
    fix: 'Run "npx prisma db push" manually to see detailed errors.',
    docsUrl: `${DOCS_BASE}/E2008`,
  },

  // ==========================================================================
  // E3xxx - Seeding Errors
  // ==========================================================================

  E3001: {
    code: 'E3001',
    name: 'SEEDER_NOT_FOUND',
    message: 'Seeder not found',
    fix: 'Check that the seeder exists in src/database/seeders/ and is properly exported.',
    docsUrl: `${DOCS_BASE}/E3001`,
  },
  E3002: {
    code: 'E3002',
    name: 'CIRCULAR_DEPENDENCY',
    message: 'Circular dependency detected between seeders',
    fix: 'Review seeder dependencies and remove the circular reference.',
    docsUrl: `${DOCS_BASE}/E3002`,
  },
  E3003: {
    code: 'E3003',
    name: 'EXECUTION_FAILED',
    message: 'Seeder execution failed',
    fix: 'Check the seeder implementation and database state.',
    docsUrl: `${DOCS_BASE}/E3003`,
  },
  E3004: {
    code: 'E3004',
    name: 'TRUNCATION_FAILED',
    message: 'Table truncation failed',
    fix: 'Check for foreign key constraints that may prevent truncation.',
    docsUrl: `${DOCS_BASE}/E3004`,
  },
  E3005: {
    code: 'E3005',
    name: 'INVALID_CONFIG',
    message: 'Invalid seeder configuration',
    fix: 'Ensure the seeder has required properties: name and run function.',
    docsUrl: `${DOCS_BASE}/E3005`,
  },
  E3006: {
    code: 'E3006',
    name: 'DEPENDENCY_NOT_FOUND',
    message: 'Seeder dependency not found',
    fix: 'Ensure all dependencies exist in src/database/seeders/ and are registered.',
    docsUrl: `${DOCS_BASE}/E3006`,
  },
  E3007: {
    code: 'E3007',
    name: 'NO_SEEDERS_FOUND',
    message: 'No seeders found in project',
    fix: 'Create a seeder with: velox make seeder <name>',
    docsUrl: `${DOCS_BASE}/E3007`,
  },
  E3008: {
    code: 'E3008',
    name: 'DATABASE_ERROR',
    message: 'Database error during seeding',
    fix: 'Check your database connection and ensure it is running.',
    docsUrl: `${DOCS_BASE}/E3008`,
  },
  E3010: {
    code: 'E3010',
    name: 'FACTORY_NOT_FOUND',
    message: 'Factory not found in registry',
    fix: 'Ensure the factory is properly instantiated before use.',
    docsUrl: `${DOCS_BASE}/E3010`,
  },
  E3011: {
    code: 'E3011',
    name: 'STATE_NOT_FOUND',
    message: 'Factory state not found',
    fix: 'Register states using registerState() before calling state().',
    docsUrl: `${DOCS_BASE}/E3011`,
  },
  E3012: {
    code: 'E3012',
    name: 'FACTORY_CREATE_FAILED',
    message: 'Factory creation failed',
    fix: 'Check the factory definition and ensure all required fields are provided.',
    docsUrl: `${DOCS_BASE}/E3012`,
  },
  E3013: {
    code: 'E3013',
    name: 'INVALID_FACTORY',
    message: 'Invalid factory configuration',
    fix: 'Ensure the factory has a valid definition function.',
    docsUrl: `${DOCS_BASE}/E3013`,
  },
  E3020: {
    code: 'E3020',
    name: 'FILESYSTEM_ERROR',
    message: 'Filesystem error during seeder loading',
    fix: 'Check file permissions and path validity.',
    docsUrl: `${DOCS_BASE}/E3020`,
  },
  E3021: {
    code: 'E3021',
    name: 'INVALID_EXPORT',
    message: 'Invalid seeder export',
    fix: "Ensure the file exports a valid Seeder object with 'name' and 'run' properties.",
    docsUrl: `${DOCS_BASE}/E3021`,
  },

  // ==========================================================================
  // E4xxx - Migration Errors
  // ==========================================================================

  E4001: {
    code: 'E4001',
    name: 'PRISMA_NOT_FOUND',
    message: 'Prisma CLI not found',
    fix: 'Install Prisma: pnpm add @prisma/client prisma',
    docsUrl: `${DOCS_BASE}/E4001`,
  },
  E4002: {
    code: 'E4002',
    name: 'MIGRATIONS_DIR_NOT_FOUND',
    message: 'Migrations directory not found',
    fix: 'Create a migration with: velox make migration create_users',
    docsUrl: `${DOCS_BASE}/E4002`,
  },
  E4003: {
    code: 'E4003',
    name: 'MIGRATION_NOT_FOUND',
    message: 'Migration not found',
    fix: 'Run "velox migrate status" to see available migrations.',
    docsUrl: `${DOCS_BASE}/E4003`,
  },
  E4004: {
    code: 'E4004',
    name: 'NO_ROLLBACK_FILE',
    message: 'No down.sql file found for migration',
    fix: 'Create a down.sql file in the migration folder, or use "velox migrate fresh" to reset.',
    docsUrl: `${DOCS_BASE}/E4004`,
  },
  E4005: {
    code: 'E4005',
    name: 'ROLLBACK_FAILED',
    message: 'Migration rollback failed',
    fix: 'Check the down.sql file for syntax errors.',
    docsUrl: `${DOCS_BASE}/E4005`,
  },
  E4006: {
    code: 'E4006',
    name: 'PRISMA_ERROR',
    message: 'Prisma command failed',
    fix: 'Run the Prisma command directly to see detailed error output.',
    docsUrl: `${DOCS_BASE}/E4006`,
  },
  E4007: {
    code: 'E4007',
    name: 'MIGRATION_DATABASE_ERROR',
    message: 'Database operation failed during migration',
    fix: 'Check your database connection and ensure it is running.',
    docsUrl: `${DOCS_BASE}/E4007`,
  },
  E4008: {
    code: 'E4008',
    name: 'NO_PENDING_MIGRATIONS',
    message: 'No pending migrations to run',
    fix: 'All migrations are up to date.',
    docsUrl: `${DOCS_BASE}/E4008`,
  },
  E4009: {
    code: 'E4009',
    name: 'NO_APPLIED_MIGRATIONS',
    message: 'No migrations have been applied',
    fix: 'Run "velox migrate run" to apply migrations.',
    docsUrl: `${DOCS_BASE}/E4009`,
  },
  E4010: {
    code: 'E4010',
    name: 'CHECKSUM_MISMATCH',
    message: 'Migration checksum mismatch',
    fix: 'The migration file was modified after being applied. Use "velox migrate fresh" to reset.',
    docsUrl: `${DOCS_BASE}/E4010`,
  },

  // ==========================================================================
  // E5xxx - Dev Server Errors
  // ==========================================================================

  E5001: {
    code: 'E5001',
    name: 'ENTRY_NOT_FOUND',
    message: 'Application entry point not found',
    fix: 'Specify entry with --entry flag or ensure src/index.ts exists.',
    docsUrl: `${DOCS_BASE}/E5001`,
  },
  E5002: {
    code: 'E5002',
    name: 'PORT_IN_USE',
    message: 'Port already in use',
    fix: 'Stop other servers using this port, or use --port to specify a different port.',
    docsUrl: `${DOCS_BASE}/E5002`,
  },
  E5003: {
    code: 'E5003',
    name: 'BUILD_ERROR',
    message: 'Build error',
    fix: 'Check the TypeScript compilation errors above.',
    docsUrl: `${DOCS_BASE}/E5003`,
  },
  E5004: {
    code: 'E5004',
    name: 'RUNTIME_ERROR',
    message: 'Runtime error',
    fix: 'Check the stack trace for the error location.',
    docsUrl: `${DOCS_BASE}/E5004`,
  },
  E5005: {
    code: 'E5005',
    name: 'MODULE_NOT_FOUND',
    message: 'Module not found',
    fix: 'Install the missing package with your package manager.',
    docsUrl: `${DOCS_BASE}/E5005`,
  },
  E5006: {
    code: 'E5006',
    name: 'SYNTAX_ERROR',
    message: 'Syntax error in source file',
    fix: 'Check the indicated line for syntax issues.',
    docsUrl: `${DOCS_BASE}/E5006`,
  },
  E5007: {
    code: 'E5007',
    name: 'TYPE_ERROR',
    message: 'TypeScript type error',
    fix: 'Fix the type error indicated in the message.',
    docsUrl: `${DOCS_BASE}/E5007`,
  },
  E5008: {
    code: 'E5008',
    name: 'DATABASE_CONNECTION_FAILED',
    message: 'Database connection failed',
    fix: 'Check DATABASE_URL environment variable and ensure the database is running.',
    docsUrl: `${DOCS_BASE}/E5008`,
  },
  E5009: {
    code: 'E5009',
    name: 'MISSING_ENV_VAR',
    message: 'Required environment variable not set',
    fix: 'Add the missing variable to your .env file.',
    docsUrl: `${DOCS_BASE}/E5009`,
  },
  E5010: {
    code: 'E5010',
    name: 'STARTUP_TIMEOUT',
    message: 'Server startup timed out',
    fix: 'Check for blocking operations during server initialization.',
    docsUrl: `${DOCS_BASE}/E5010`,
  },

  // ==========================================================================
  // E9xxx - Configuration Errors
  // ==========================================================================

  E9001: {
    code: 'E9001',
    name: 'CONFIG_NOT_FOUND',
    message: 'Configuration file not found',
    fix: 'Create a velox.config.ts file in your project root.',
    docsUrl: `${DOCS_BASE}/E9001`,
  },
  E9002: {
    code: 'E9002',
    name: 'INVALID_CONFIG',
    message: 'Invalid configuration',
    fix: 'Check your configuration file for syntax errors or invalid values.',
    docsUrl: `${DOCS_BASE}/E9002`,
  },
  E9003: {
    code: 'E9003',
    name: 'PACKAGE_JSON_NOT_FOUND',
    message: 'package.json not found',
    fix: 'Run this command from your project root directory.',
    docsUrl: `${DOCS_BASE}/E9003`,
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get an error definition from the catalog
 */
export function getErrorDefinition(code: string): ErrorDefinition | undefined {
  return ERROR_CATALOG[code];
}

/**
 * Check if an error code exists in the catalog
 */
export function isValidErrorCode(code: string): boolean {
  return code in ERROR_CATALOG;
}

/**
 * Get all error codes for a category
 */
export function getErrorsByCategory(categoryPrefix: string): ErrorDefinition[] {
  return Object.values(ERROR_CATALOG).filter((def) => def.code.startsWith(categoryPrefix));
}
