/**
 * @veloxts/cli - Developer tooling and command-line interface
 *
 * A beautiful, Laravel-inspired CLI for the VeloxTS Framework that provides
 * commands for development, database migrations, and other developer workflows.
 *
 * @example
 * ```bash
 * # Start development server
 * velox dev
 *
 * # Run database migrations
 * velox migrate
 *
 * # Show help
 * velox --help
 * ```
 */

/**
 * CLI version (synchronized with package.json)
 */
export const CLI_VERSION = '0.1.0';

/**
 * Export command functions for programmatic usage
 */
export { createDevCommand } from './commands/dev.js';
export { createMigrateCommand } from './commands/migrate.js';
/**
 * Export utilities for reuse in other packages
 */
export * from './utils/output.js';
export * from './utils/paths.js';
