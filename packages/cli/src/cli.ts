#!/usr/bin/env tsx

/**
 * VeloxTS CLI - Main entry point
 *
 * A beautiful, Laravel-inspired command-line interface for the VeloxTS Framework
 *
 * Uses tsx as the shebang to enable:
 * - TypeScript execution without compilation
 * - ESM .js → .ts import resolution (required for `velox procedures list`)
 */

import { Command } from 'commander';

import { createDbCommand } from './commands/db.js';
import { createDevCommand } from './commands/dev.js';
import { createIntrospectCommand } from './commands/introspect.js';
import { createMakeCommand } from './commands/make.js';
import { createMcpCommand } from './commands/mcp.js';
import { createMigrateCommand } from './commands/migrate.js';
import { createOpenApiCommand } from './commands/openapi.js';
import { createProceduresCommand } from './commands/procedures.js';
import { createScheduleCommand } from './commands/schedule.js';
import { createTenantCommand } from './commands/tenant.js';
import { CLI_VERSION } from './index.js';

/**
 * Create the main CLI program
 */
function createCLI(): Command {
  const program = new Command();

  program
    .name('velox')
    .description('VeloxTS Framework - Laravel-inspired TypeScript full-stack framework')
    .version(CLI_VERSION, '-v, --version', 'Output the current version')
    .helpOption('-h, --help', 'Display help for command');

  // Register commands
  program.addCommand(createDbCommand());
  program.addCommand(createDevCommand(CLI_VERSION));
  program.addCommand(createIntrospectCommand());
  program.addCommand(createMakeCommand());
  program.addCommand(createMcpCommand());
  program.addCommand(createMigrateCommand());
  program.addCommand(createOpenApiCommand());
  program.addCommand(createProceduresCommand());
  program.addCommand(createScheduleCommand());
  program.addCommand(createTenantCommand());

  return program;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const program = createCLI();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unknown error occurred');
    }
    process.exit(1);
  }
}

// Run the CLI
main();
