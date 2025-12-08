/**
 * Migrate command - Database migration commands
 *
 * Provides subcommands for managing database migrations:
 * - migrate:status - Show migration status
 * - migrate:run - Run pending migrations
 * - migrate:rollback - Rollback migrations
 * - migrate:fresh - Drop all tables and re-run
 * - migrate:reset - Rollback all then re-run
 */

import { Command } from 'commander';

import {
  createMigrateFreshCommand,
  createMigrateResetCommand,
  createMigrateRollbackCommand,
  createMigrateRunCommand,
  createMigrateStatusCommand,
} from '../migrations/commands/index.js';

/**
 * Create the migrate command with subcommands
 */
export function createMigrateCommand(): Command {
  const migrate = new Command('migrate')
    .description('Database migration commands')
    .addCommand(createMigrateStatusCommand())
    .addCommand(createMigrateRunCommand())
    .addCommand(createMigrateRollbackCommand())
    .addCommand(createMigrateFreshCommand())
    .addCommand(createMigrateResetCommand());

  return migrate;
}
