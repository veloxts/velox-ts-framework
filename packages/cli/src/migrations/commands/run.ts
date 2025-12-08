/**
 * migrate:run Command
 *
 * Run pending migrations.
 */

import path from 'node:path';

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

import { error, info, success, warning } from '../../utils/output.js';
import { fileExists } from '../../utils/paths.js';
import type { MigrateRunOptions } from '../types.js';
import { loadMigrations, migrationsDirExists } from '../loader.js';
import {
  prismaMigrateDeploy,
  prismaMigrateDev,
  prismaMigrateStatus,
  parseMigrateStatusOutput,
} from '../prisma-wrapper.js';
import { MigrationError, noPendingMigrations } from '../errors.js';

/**
 * Create the migrate:run command
 */
export function createMigrateRunCommand(): Command {
  return new Command('run')
    .description('Run pending migrations')
    .option('--dev', 'Use development mode (creates migration from schema changes)')
    .option('--step <n>', 'Run only N migrations', parseInt)
    .option('--dry-run', 'Show what would be run without executing')
    .option('--json', 'Output as JSON')
    .action(async (options: MigrateRunOptions) => {
      await runMigrateRun(options);
    });
}

/**
 * Run migrate:run
 */
async function runMigrateRun(options: MigrateRunOptions): Promise<void> {
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

    // Get current status to see what's pending
    const hasDir = await migrationsDirExists(cwd);

    if (!options.dev && !hasDir) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'No migrations found' }));
      } else {
        info('No migrations found.');
        console.log(`  ${pc.dim('Create one with: velox generate migration create_users')}`);
        console.log(`  ${pc.dim('Or use --dev to create from schema changes')}`);
      }
      return;
    }

    // Check for pending migrations
    if (!options.dev && hasDir) {
      const statusResult = await prismaMigrateStatus(cwd);
      const parsed = parseMigrateStatusOutput(statusResult.output);

      if (parsed.pending.length === 0) {
        if (options.json) {
          console.log(JSON.stringify({ message: 'No pending migrations', ran: 0 }));
        } else {
          success('Database is already up to date!');
          console.log(`  ${pc.dim('All migrations have been applied.')}`);
        }
        return;
      }

      // Show pending migrations
      if (!options.json) {
        console.log('');
        info(`${parsed.pending.length} pending migration${parsed.pending.length > 1 ? 's' : ''}`);
        console.log('');

        const toRun = options.step
          ? parsed.pending.slice(0, options.step)
          : parsed.pending;

        for (const name of toRun) {
          console.log(`  ${pc.dim('→')} ${name}`);
        }
        console.log('');

        if (options.step && options.step < parsed.pending.length) {
          console.log(`  ${pc.dim(`(Limiting to ${options.step} migration${options.step > 1 ? 's' : ''}. ${parsed.pending.length - options.step} remaining.)`)}`);
          console.log('');
        }
      }
    }

    // Dry run - just show what would happen
    if (options.dryRun) {
      if (options.json) {
        const statusResult = await prismaMigrateStatus(cwd);
        const parsed = parseMigrateStatusOutput(statusResult.output);
        const toRun = options.step
          ? parsed.pending.slice(0, options.step)
          : parsed.pending;

        console.log(JSON.stringify({
          dryRun: true,
          wouldRun: toRun,
          count: toRun.length,
        }, null, 2));
      } else {
        warning('Dry run mode - no changes made.');
        console.log(`  ${pc.dim('Remove --dry-run to apply migrations.')}`);
      }
      return;
    }

    // Execute migrations
    if (!options.json) {
      console.log('');
      s.start('Running migrations...');
    }

    let result;

    if (options.dev) {
      // Development mode: prisma migrate dev
      if (!options.json) {
        s.stop('Starting Prisma Migrate Dev');
        console.log('');
      }
      result = await prismaMigrateDev(cwd);
    } else {
      // Production mode: prisma migrate deploy
      if (!options.json) {
        s.stop('Starting Prisma Migrate Deploy');
        console.log('');
      }
      result = await prismaMigrateDeploy(cwd);
    }

    // Handle result
    if (result.success) {
      if (options.json) {
        console.log(JSON.stringify({ success: true, message: 'Migrations applied' }));
      } else {
        console.log('');
        success('Migrations applied successfully!');
        console.log('');
      }
    } else {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: result.error }));
      } else {
        console.log('');
        error('Migration failed.');
        if (result.error) {
          console.log(`  ${pc.dim(result.error)}`);
        }
        console.log('');
      }
      process.exit(1);
    }
  } catch (err) {
    s.stop('Migration failed');

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
