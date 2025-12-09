#!/usr/bin/env node

/**
 * VeloxTS CLI - Main entry point
 *
 * A beautiful, Laravel-inspired command-line interface for the VeloxTS Framework
 */

import { Command } from 'commander';

import { createDbCommand } from './commands/db.js';
import { createDevCommand } from './commands/dev.js';
import { createGenerateCommand } from './commands/generate.js';
import { createMigrateCommand } from './commands/migrate.js';
import { createProceduresCommand } from './commands/procedures.js';
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
  program.addCommand(createGenerateCommand());
  program.addCommand(createMigrateCommand());
  program.addCommand(createProceduresCommand());

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
