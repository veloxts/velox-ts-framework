/**
 * MCP Tools
 *
 * Tools provide actions that AI assistants can invoke.
 */

// Generate tool
export type { GenerateOptions, GenerateResult, GeneratorType } from './generate.js';
export {
  formatGenerateResult,
  generate,
  generateProcedure,
  generateResource,
  generateSchema,
} from './generate.js';
// Migrate tool
export type { MigrateAction, MigrateOptions, MigrateResult, MigrationInfo } from './migrate.js';
export {
  formatMigrateResult,
  migrate,
  migrateFresh,
  migrateReset,
  migrateRollback,
  migrateRun,
  migrateStatus,
} from './migrate.js';
