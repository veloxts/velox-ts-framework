/**
 * migrate:reset Command
 *
 * Rollback all migrations then re-run them using our down.sql files.
 */

import path from 'node:path';

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

import { error, info, success, warning } from '../../utils/output.js';
import { fileExists } from '../../utils/paths.js';
import { MigrationError } from '../errors.js';
import { loadMigrations, migrationsDirExists } from '../loader.js';
import {
  parseMigrateStatusOutput,
  prismaDbSeed,
  prismaMigrateDeploy,
  prismaMigrateStatus,
} from '../prisma-wrapper.js';
import { rollbackAll } from '../rollback-runner.js';
import type { MigrateResetOptions, MigrationFile, PrismaClientLike } from '../types.js';

/**
 * Create the migrate:reset command
 */
export function createMigrateResetCommand(): Command {
  return new Command('reset')
    .description('Rollback all migrations then re-run')
    .option('--seed', 'Run seeders after migrations')
    .option('--force', 'Skip confirmation prompt')
    .option('--json', 'Output as JSON')
    .action(async (options: MigrateResetOptions) => {
      await runMigrateReset(options);
    });
}

/**
 * Run migrate:reset
 */
async function runMigrateReset(options: MigrateResetOptions): Promise<void> {
  const cwd = process.cwd();
  const s = p.spinner();

  let prisma: PrismaClientLike | null = null;

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

    // Check migrations directory
    const hasDir = await migrationsDirExists(cwd);
    if (!hasDir) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'No migrations found' }));
      } else {
        info('No migrations to reset.');
      }
      return;
    }

    // Load migration files
    const files = await loadMigrations(cwd);

    // Get applied migrations from Prisma status
    const statusResult = await prismaMigrateStatus(cwd);
    const parsed = parseMigrateStatusOutput(statusResult.output);

    // Find applied migrations with rollback capability
    const appliedFiles: MigrationFile[] = [];
    for (const appliedName of [...parsed.applied].reverse()) {
      const file = files.find((f) => f.name === appliedName);
      if (file) {
        appliedFiles.push(file);
      }
    }

    // Check if all applied migrations have rollback support
    const withoutRollback = appliedFiles.filter((m) => !m.hasRollback);
    if (withoutRollback.length > 0) {
      if (options.json) {
        console.log(
          JSON.stringify({
            error: 'Cannot reset - missing rollback files',
            migrations: withoutRollback.map((m) => m.name),
            suggestion: 'Use "velox migrate:fresh" to drop all tables instead',
          })
        );
      } else {
        error('Cannot reset - missing down.sql files:');
        for (const m of withoutRollback) {
          console.log(`  ${pc.dim('→')} ${m.name}`);
        }
        console.log('');
        console.log(`  ${pc.dim('Use: velox migrate:fresh to drop all tables instead')}`);
      }
      process.exit(1);
    }

    // Show warning
    if (!options.json) {
      console.log('');
      warning(
        `This will rollback ${appliedFiles.length} migration${appliedFiles.length > 1 ? 's' : ''} then re-run them.`
      );
      console.log('');
    }

    // Confirm unless --force
    if (!options.force && !options.json) {
      const confirm = await p.confirm({
        message: 'Are you sure you want to reset all migrations?',
      });

      if (p.isCancel(confirm) || !confirm) {
        console.log('');
        info('Operation cancelled.');
        return;
      }
    }

    // Initialize Prisma client dynamically (avoids compile-time dependency on generated types)
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient() as PrismaClientLike;

    // Step 1: Rollback all migrations
    if (!options.json) {
      console.log('');
      s.start(
        `Rolling back ${appliedFiles.length} migration${appliedFiles.length > 1 ? 's' : ''}...`
      );
    }

    const rollbackResult = await rollbackAll(prisma, appliedFiles);

    if (rollbackResult.failed > 0) {
      if (!options.json) {
        s.stop('Rollback failed');
      }

      if (options.json) {
        console.log(
          JSON.stringify({
            success: false,
            phase: 'rollback',
            error: 'Rollback failed',
            results: rollbackResult.results,
          })
        );
      } else {
        console.log('');
        error('Rollback failed. Database may be in an inconsistent state.');
        for (const r of rollbackResult.results.filter((r) => !r.success)) {
          console.log(`  ${pc.red('✗')} ${r.migration}: ${r.error}`);
        }
        console.log('');
      }
      process.exit(1);
    }

    if (!options.json) {
      s.stop(
        `Rolled back ${rollbackResult.successful} migration${rollbackResult.successful > 1 ? 's' : ''}`
      );
    }

    // Step 2: Re-run migrations
    if (!options.json) {
      console.log('');
      s.start('Re-running all migrations...');
    }

    // Disconnect prisma before running migrate deploy (it opens its own connection)
    await prisma.$disconnect();
    prisma = null;

    const deployResult = await prismaMigrateDeploy(cwd);

    if (!deployResult.success) {
      if (!options.json) {
        s.stop('Migration failed');
      }

      if (options.json) {
        console.log(
          JSON.stringify({
            success: false,
            phase: 'deploy',
            error: deployResult.error,
            rollbackSuccessful: rollbackResult.successful,
          })
        );
      } else {
        console.log('');
        error('Migration failed after rollback. Database may be in an inconsistent state.');
        if (deployResult.error) {
          console.log(`  ${pc.dim(deployResult.error)}`);
        }
        console.log('');
      }
      process.exit(1);
    }

    if (!options.json) {
      s.stop('Migrations applied');
    }

    // Step 3: Run seeders if requested
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
              message: 'Reset complete but seeding failed',
              seedError: seedResult.error,
            })
          );
        } else {
          console.log('');
          warning('Reset complete but seeding failed.');
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
          rollbackCount: rollbackResult.successful,
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
  } finally {
    // Disconnect Prisma client if still connected
    // noinspection PointlessBooleanExpressionJS
    if (prisma) {
      // noinspection JSObjectNullOrUndefined
      await prisma.$disconnect();
    }
  }
}
