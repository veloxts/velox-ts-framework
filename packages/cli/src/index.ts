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

import { createRequire } from 'node:module';

// Read version from package.json dynamically
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

/** CLI package version */
export const CLI_VERSION: string = packageJson.version ?? '0.0.0-unknown';

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
