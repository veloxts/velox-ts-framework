/**
 * migrate:rollback Command
 *
 * Rollback migrations using down.sql files.
 */

import path from 'node:path';

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

import { error, info, success, warning } from '../../utils/output.js';
import { fileExists } from '../../utils/paths.js';
import { MigrationError } from '../errors.js';
import { loadMigrations, migrationsDirExists } from '../loader.js';
import { parseMigrateStatusOutput, prismaMigrateStatus } from '../prisma-wrapper.js';
import { rollbackMultiple } from '../rollback-runner.js';
import {
  createPrismaClient,
  type MigrateRollbackOptions,
  type MigrationFile,
  type PrismaClientLike,
} from '../types.js';

/**
 * Create the migrate:rollback command
 */
export function createMigrateRollbackCommand(): Command {
  return new Command('rollback')
    .description('Rollback migrations')
    .option('--step <n>', 'Rollback N migrations (default: 1)', parseInt, 1)
    .option('--all', 'Rollback all migrations')
    .option('--force', 'Skip confirmation prompt')
    .option('--dry-run', 'Show what would be rolled back')
    .option('--json', 'Output as JSON')
    .action(async (options: MigrateRollbackOptions) => {
      await runMigrateRollback(options);
    });
}

/**
 * Run migrate:rollback
 */
async function runMigrateRollback(options: MigrateRollbackOptions): Promise<void> {
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
        info('No migrations to rollback.');
      }
      return;
    }

    // Load migration files
    const files = await loadMigrations(cwd);

    // Get applied migrations from Prisma status
    const statusResult = await prismaMigrateStatus(cwd);
    const parsed = parseMigrateStatusOutput(statusResult.output);

    if (parsed.applied.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'No migrations have been applied' }));
      } else {
        info('No migrations have been applied yet.');
      }
      return;
    }

    // Find migrations to rollback (in reverse order - most recent first)
    const appliedFiles: MigrationFile[] = [];
    for (const appliedName of [...parsed.applied].reverse()) {
      const file = files.find((f) => f.name === appliedName);
      if (file) {
        appliedFiles.push(file);
      }
    }

    // Determine how many to rollback
    const count = options.all ? appliedFiles.length : (options.step ?? 1);
    const toRollback = appliedFiles.slice(0, count);

    if (toRollback.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'No migrations to rollback' }));
      } else {
        info('No migrations to rollback.');
      }
      return;
    }

    // Check if all migrations have rollback support
    const withoutRollback = toRollback.filter((m) => !m.hasRollback);
    if (withoutRollback.length > 0) {
      if (options.json) {
        console.log(
          JSON.stringify({
            error: 'Missing rollback files',
            migrations: withoutRollback.map((m) => m.name),
          })
        );
      } else {
        error('Cannot rollback - missing down.sql files:');
        for (const m of withoutRollback) {
          console.log(`  ${pc.dim('→')} ${m.name}`);
        }
        console.log('');
        console.log(`  ${pc.dim('Fix: Create down.sql in the migration folder')}`);
        console.log(`  ${pc.dim('Or use: velox migrate:fresh to reset completely')}`);
      }
      process.exit(1);
    }

    // Show what will be rolled back
    if (!options.json && !options.dryRun) {
      console.log('');
      warning(`Rolling back ${toRollback.length} migration${toRollback.length > 1 ? 's' : ''}`);
      console.log('');

      for (const m of toRollback) {
        console.log(`  ${pc.dim('→')} ${m.name}`);
      }
      console.log('');
    }

    // Dry run
    if (options.dryRun) {
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              dryRun: true,
              wouldRollback: toRollback.map((m) => m.name),
              count: toRollback.length,
            },
            null,
            2
          )
        );
      } else {
        warning('Dry run mode - no changes made.');
        console.log(`  ${pc.dim('Remove --dry-run to execute rollback.')}`);
      }
      return;
    }

    // Confirm unless --force
    if (!options.force && !options.json) {
      const confirm = await p.confirm({
        message: `Are you sure you want to rollback ${toRollback.length} migration${toRollback.length > 1 ? 's' : ''}?`,
      });

      if (p.isCancel(confirm) || !confirm) {
        console.log('');
        info('Rollback cancelled.');
        return;
      }
    }

    // Execute rollback
    if (!options.json) {
      console.log('');
      s.start('Rolling back migrations...');
    }

    // Initialize Prisma client dynamically (avoids compile-time dependency on generated types)
    prisma = await createPrismaClient();

    const result = await rollbackMultiple(prisma, toRollback, {
      dryRun: options.dryRun,
    });

    if (!options.json) {
      s.stop(result.failed > 0 ? 'Rollback completed with errors' : 'Rollback complete');
    }

    // Output results
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            success: result.failed === 0,
            rolledBack: result.results.filter((r) => r.success).map((r) => r.migration),
            failed: result.results
              .filter((r) => !r.success)
              .map((r) => ({
                migration: r.migration,
                error: r.error,
              })),
            total: result.total,
            successful: result.successful,
            duration: result.duration,
          },
          null,
          2
        )
      );
    } else {
      console.log('');

      // Show individual results
      for (const r of result.results) {
        if (r.success) {
          console.log(`  ${pc.green('✓')} ${r.migration} ${pc.dim(`(${r.duration}ms)`)}`);
        } else {
          console.log(`  ${pc.red('✗')} ${r.migration}`);
          if (r.error) {
            console.log(`    ${pc.red(r.error)}`);
          }
        }
      }

      console.log('');

      if (result.failed > 0) {
        error(`Rollback completed with ${result.failed} error${result.failed > 1 ? 's' : ''}`);
      } else {
        success(`Rolled back ${result.successful} migration${result.successful > 1 ? 's' : ''}`);
      }

      console.log('');
    }

    if (result.failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    s.stop('Rollback failed');

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
    // Disconnect Prisma client
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}
