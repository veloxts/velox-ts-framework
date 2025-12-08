/**
 * migrate:status Command
 *
 * Show migration status - which migrations are applied vs pending.
 */

import path from 'node:path';

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

import { error, info, success, warning } from '../../utils/output.js';
import { fileExists } from '../../utils/paths.js';
import { MigrationError } from '../errors.js';
import { computeMigrationStatus, loadMigrations, migrationsDirExists } from '../loader.js';
import { parseMigrateStatusOutput, prismaMigrateStatus } from '../prisma-wrapper.js';
import type { MigrateStatusOptions, MigrationStatus } from '../types.js';

/**
 * Create the migrate:status command
 */
export function createMigrateStatusCommand(): Command {
  return new Command('status')
    .description('Show migration status')
    .option('--pending', 'Show only pending migrations')
    .option('--json', 'Output as JSON')
    .action(async (options: MigrateStatusOptions) => {
      await runMigrateStatus(options);
    });
}

/**
 * Run migrate:status
 */
async function runMigrateStatus(options: MigrateStatusOptions): Promise<void> {
  const cwd = process.cwd();

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

    // Check if migrations directory exists
    const hasDir = await migrationsDirExists(cwd);
    if (!hasDir) {
      if (options.json) {
        console.log(JSON.stringify({ migrations: [], pending: 0, applied: 0 }));
      } else {
        info('No migrations found.');
        console.log(`  ${pc.dim('Create one with: velox generate migration create_users')}`);
      }
      return;
    }

    // Get Prisma migrate status
    const prismaResult = await prismaMigrateStatus(cwd);
    const parsed = parseMigrateStatusOutput(prismaResult.output);

    // Load migration files
    const files = await loadMigrations(cwd);

    // Build status list
    const statuses: MigrationStatus[] = files.map((file) => {
      const isApplied = parsed.applied.includes(file.name);
      return {
        name: file.name,
        status: isApplied ? 'applied' : 'pending',
        appliedAt: null, // We don't have exact date from prisma status output
        hasRollback: file.hasRollback,
        duration: null,
      };
    });

    // Filter if --pending
    const displayStatuses = options.pending
      ? statuses.filter((s) => s.status === 'pending')
      : statuses;

    // JSON output
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            migrations: displayStatuses,
            pending: statuses.filter((s) => s.status === 'pending').length,
            applied: statuses.filter((s) => s.status === 'applied').length,
            total: statuses.length,
          },
          null,
          2
        )
      );
      return;
    }

    // Pretty output
    console.log('');
    info('Migration Status');
    console.log('');

    if (displayStatuses.length === 0) {
      if (options.pending) {
        success('All migrations have been applied!');
      } else {
        console.log(`  ${pc.dim('No migrations found.')}`);
      }
      console.log('');
      return;
    }

    // Print table header
    console.log(
      `  ${pc.dim('Status')}     ${pc.dim('Migration')}                          ${pc.dim('Rollback')}`
    );
    console.log(`  ${pc.dim('─'.repeat(70))}`);

    // Print each migration
    for (const status of displayStatuses) {
      const statusIcon =
        status.status === 'applied' ? pc.green('✓ Applied') : pc.yellow('○ Pending');

      const rollbackIcon = status.hasRollback ? pc.green('Yes') : pc.dim('No');

      // Truncate name if too long
      const displayName =
        status.name.length > 40 ? status.name.slice(0, 37) + '...' : status.name.padEnd(40);

      console.log(`  ${statusIcon}  ${displayName}  ${rollbackIcon}`);
    }

    console.log('');

    // Summary
    const pendingCount = statuses.filter((s) => s.status === 'pending').length;
    const appliedCount = statuses.filter((s) => s.status === 'applied').length;

    if (pendingCount > 0) {
      warning(`${pendingCount} pending migration${pendingCount > 1 ? 's' : ''}`);
      console.log(`  ${pc.dim('Run:')} velox migrate:run`);
    } else {
      success(`All ${appliedCount} migration${appliedCount > 1 ? 's' : ''} applied`);
    }

    // Show Prisma warnings if any
    if (parsed.warnings.length > 0) {
      console.log('');
      for (const warn of parsed.warnings) {
        warning(warn);
      }
    }

    console.log('');
  } catch (err) {
    if (options.json) {
      if (err instanceof MigrationError) {
        console.log(JSON.stringify({ error: err.toJSON() }));
      } else {
        console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    } else {
      if (err instanceof MigrationError) {
        error(err.message);
        if (err.fix) {
          console.log(`  ${pc.dim('Fix:')} ${err.fix}`);
        }
      } else {
        error(err instanceof Error ? err.message : String(err));
      }
    }
    process.exit(1);
  }
}
