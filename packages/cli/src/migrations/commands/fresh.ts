/**
 * migrate:fresh Command
 *
 * Drop all tables and re-run all migrations.
 */

import path from 'node:path';

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

import { error, info, success, warning } from '../../utils/output.js';
import { fileExists } from '../../utils/paths.js';
import { MigrationError } from '../errors.js';
import { prismaDbSeed, prismaMigrateReset } from '../prisma-wrapper.js';
import type { MigrateFreshOptions } from '../types.js';

/**
 * Create the migrate:fresh command
 */
export function createMigrateFreshCommand(): Command {
  return new Command('fresh')
    .description('Drop all tables and re-run all migrations')
    .option('--seed', 'Run seeders after migrations')
    .option('--force', 'Skip confirmation prompt')
    .option('--json', 'Output as JSON')
    .action(async (options: MigrateFreshOptions) => {
      await runMigrateFresh(options);
    });
}

/**
 * Run migrate:fresh
 */
async function runMigrateFresh(options: MigrateFreshOptions): Promise<void> {
  const cwd = process.cwd();
  const s = p.spinner();

  try {
    // Check if Prisma schema exists
    const schemaPath = path.join(cwd, 'prisma', 'schema.prisma');
    if (!fileExists(schemaPath)) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'Prisma schema not found' }));
      } else {
        error('Prisma schema not found.');
        console.log(`  ${pc.dim('Expected: prisma/schema.prisma')}`);
      }
      process.exit(1);
    }

    // Show warning
    if (!options.json) {
      console.log('');
      warning('This will DROP ALL TABLES and re-run all migrations.');
      warning('All data in the database will be lost!');
      console.log('');
    }

    // Confirm unless --force
    if (!options.force && !options.json) {
      const confirm = await p.confirm({
        message: 'Are you sure you want to drop all tables and re-run migrations?',
      });

      if (p.isCancel(confirm) || !confirm) {
        console.log('');
        info('Operation cancelled.');
        return;
      }
    }

    // Execute fresh
    if (!options.json) {
      console.log('');
      s.start('Dropping all tables and re-running migrations...');
    }

    // Run prisma migrate reset --force (force to skip Prisma's own confirmation)
    const result = await prismaMigrateReset(cwd, true);

    if (!result.success) {
      if (!options.json) {
        s.stop('Migration reset failed');
      }

      if (options.json) {
        console.log(JSON.stringify({ success: false, error: result.error }));
      } else {
        console.log('');
        error('Migration reset failed.');
        if (result.error) {
          console.log(`  ${pc.dim(result.error)}`);
        }
        console.log('');
      }
      process.exit(1);
    }

    if (!options.json) {
      s.stop('Database reset complete');
    }

    // Run seeders if requested
    if (options.seed) {
      if (!options.json) {
        console.log('');
        s.start('Running seeders...');
      }

      const seedResult = await prismaDbSeed(cwd);

      if (!seedResult.success) {
        if (!options.json) {
          s.stop('Seeding failed');
        }

        if (options.json) {
          console.log(
            JSON.stringify({
              success: true,
              message: 'Database reset complete but seeding failed',
              seedError: seedResult.error,
            })
          );
        } else {
          console.log('');
          warning('Database reset complete but seeding failed.');
          if (seedResult.error) {
            console.log(`  ${pc.dim(seedResult.error)}`);
          }
          console.log('');
        }
        return;
      }

      if (!options.json) {
        s.stop('Seeding complete');
      }
    }

    // Success output
    if (options.json) {
      console.log(
        JSON.stringify({
          success: true,
          message: options.seed
            ? 'Database reset and seeded successfully'
            : 'Database reset successfully',
        })
      );
    } else {
      console.log('');
      success(
        options.seed ? 'Database reset and seeded successfully!' : 'Database reset successfully!'
      );
      console.log('');
    }
  } catch (err) {
    s.stop('Operation failed');

    if (options.json) {
      if (err instanceof MigrationError) {
        console.log(JSON.stringify({ error: err.toJSON() }));
      } else {
        console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    } else {
      console.log('');
      if (err instanceof MigrationError) {
        error(err.message);
        if (err.fix) {
          console.log(`  ${pc.dim('Fix:')} ${err.fix}`);
        }
      } else {
        error(err instanceof Error ? err.message : String(err));
      }
      console.log('');
    }
    process.exit(1);
  }
}
