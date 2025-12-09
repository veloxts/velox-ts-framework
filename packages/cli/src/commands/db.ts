/**
 * DB command - Database seeding commands
 *
 * Provides subcommands for managing database seeding:
 * - db:seed - Run database seeders
 */

import { Command } from 'commander';

import { createSeedCommand } from '../seeding/commands/seed.js';

/**
 * Create the db command with subcommands
 */
export function createDbCommand(): Command {
  const db = new Command('db')
    .description('Database seeding commands')
    .addCommand(createSeedCommand());

  return db;
}
