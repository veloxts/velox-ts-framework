/**
 * Sync command - Generate Zod schemas + CRUD procedures from Prisma schema
 *
 * Usage:
 *   velox sync [options]
 *
 * Options:
 *   --dry-run             Preview changes without writing files
 *   --force               Skip prompts, generate all models with defaults
 *   --skip-registration   Skip auto-registering procedures in router
 *
 * Examples:
 *   velox sync                       Interactive sync for all models
 *   velox sync --dry-run             Preview what would be generated
 *   velox sync --force               Generate all models with defaults
 *   velox sync --skip-registration   Skip router registration
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

import { ensureVeloxProject } from '../generators/index.js';
import { findPrismaSchema } from '../generators/utils/prisma-schema.js';
import { executeSync } from '../sync/index.js';
import type { SyncCommandOptions } from '../sync/types.js';

// ============================================================================
// Command Creation
// ============================================================================

/**
 * Create the `velox sync` command.
 */
export function createSyncCommand(): Command {
  const cmd = new Command('sync')
    .description('Generate Zod schemas and CRUD procedures from Prisma schema')
    .option('-d, --dry-run', 'Preview changes without writing files', false)
    .option('-f, --force', 'Skip prompts and generate all models with defaults', false)
    .option('--skip-registration', 'Skip auto-registering procedures in router', false)
    .action(async (options: SyncCommandOptions) => {
      await runSync(options);
    });

  return cmd;
}

// ============================================================================
// Command Execution
// ============================================================================

/**
 * Run the sync pipeline.
 */
async function runSync(options: SyncCommandOptions): Promise<void> {
  const projectRoot = process.cwd();

  try {
    // Verify we're in a VeloxTS project
    await ensureVeloxProject(projectRoot);

    // Verify Prisma schema exists
    const schemaPath = findPrismaSchema(projectRoot);
    if (!schemaPath) {
      p.log.error('Prisma schema not found. Ensure prisma/schema.prisma exists in your project.');
      process.exit(1);
    }

    p.intro(pc.bgCyan(pc.black(' VeloxTS Sync ')));

    const result = await executeSync(projectRoot, {
      dryRun: options.dryRun,
      force: options.force,
      skipRegistration: options.skipRegistration,
    });

    // Show final summary
    const totalCreated = result.created.length;
    const totalOverwritten = result.overwritten.length;
    const totalRegistered = result.registered.length;
    const totalErrors = result.errors.length;

    if (totalErrors > 0) {
      p.outro(
        pc.yellow(
          `Sync completed with ${totalErrors} error${totalErrors === 1 ? '' : 's'}. ` +
            `${totalCreated} created, ${totalOverwritten} overwritten.`
        )
      );
      process.exit(1);
    }

    if (totalCreated === 0 && totalOverwritten === 0) {
      p.outro(pc.dim('Nothing to generate.'));
    } else {
      const parts: string[] = [];
      if (totalCreated > 0) {
        parts.push(`${totalCreated} created`);
      }
      if (totalOverwritten > 0) {
        parts.push(`${totalOverwritten} overwritten`);
      }
      if (totalRegistered > 0) {
        parts.push(`${totalRegistered} registered`);
      }
      p.outro(pc.green(`Sync complete: ${parts.join(', ')}.`));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    p.log.error(message);
    process.exit(1);
  }
}
