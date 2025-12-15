/**
 * db:seed Command
 *
 * Run database seeders.
 */

import path from 'node:path';

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

import { createPrismaClient } from '../../migrations/types.js';
import { error, info, success, warning } from '../../utils/output.js';
import { fileExists } from '../../utils/paths.js';
import { SeederError } from '../errors.js';
import { loadSeeders, seedersDirectoryExists } from '../loader.js';
import { SeederRegistry } from '../registry.js';
import { SeederRunner } from '../runner.js';
import type { BatchSeederResult, SeedCommandOptions } from '../types.js';

// ============================================================================
// Command Factory
// ============================================================================

/**
 * Create the db:seed command
 */
export function createSeedCommand(): Command {
  return new Command('seed')
    .description('Run database seeders')
    .argument('[seeder]', 'Specific seeder to run (e.g., UserSeeder)')
    .option('--fresh', 'Truncate tables before seeding')
    .option('--class <name>', 'Run specific seeder class')
    .option('--force', 'Run in production without confirmation')
    .option('--dry-run', 'Show what would run without executing')
    .option('--verbose', 'Show detailed output')
    .option('--json', 'Output as JSON')
    .action(async (seederArg: string | undefined, options: SeedCommandOptions) => {
      await runSeedCommand(seederArg, options);
    });
}

// ============================================================================
// Command Implementation
// ============================================================================

/**
 * Run the db:seed command
 */
async function runSeedCommand(
  seederArg: string | undefined,
  options: SeedCommandOptions
): Promise<void> {
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

    // Check if seeders directory exists
    if (!(await seedersDirectoryExists(cwd))) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'No seeders found' }));
      } else {
        info('No seeders found.');
        console.log(`  ${pc.dim('Create one with: velox make seeder <name>')}`);
      }
      return;
    }

    // Production safety check
    if (process.env.NODE_ENV === 'production' && !options.force) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'Cannot seed in production without --force' }));
        process.exit(1);
      }

      const confirmed = await p.confirm({
        message: pc.yellow('Running seeders in production. Are you sure?'),
      });

      if (p.isCancel(confirmed) || !confirmed) {
        info('Seeding cancelled.');
        return;
      }
    }

    // Load seeders
    if (!options.json) {
      s.start('Loading seeders...');
    }

    const loadResult = await loadSeeders(cwd);

    if (loadResult.errors.length > 0 && !options.json) {
      s.stop('Seeders loaded with errors');
      for (const err of loadResult.errors) {
        warning(`Failed to load ${path.basename(err.filePath)}: ${err.error}`);
      }
    }

    if (loadResult.seeders.length === 0) {
      if (!options.json) {
        s.stop('No seeders found');
        info('No seeders found.');
        console.log(`  ${pc.dim('Create one with: velox make seeder <name>')}`);
      } else {
        console.log(JSON.stringify({ error: 'No seeders found' }));
      }
      return;
    }

    if (!options.json) {
      s.stop(
        `Loaded ${loadResult.seeders.length} seeder${loadResult.seeders.length > 1 ? 's' : ''}`
      );
    }

    // Build registry
    const registry = new SeederRegistry();
    for (const loaded of loadResult.seeders) {
      registry.register(loaded.seeder);
    }

    // Determine which seeders to run
    const seederName = seederArg ?? options.class;
    let seedersToRun: string[] | undefined;

    if (seederName) {
      if (!registry.has(seederName)) {
        if (options.json) {
          console.log(JSON.stringify({ error: `Seeder '${seederName}' not found` }));
        } else {
          error(`Seeder '${seederName}' not found.`);
          console.log(`  ${pc.dim('Available seeders:')}`);
          for (const name of registry.getNames()) {
            console.log(`    ${pc.dim('•')} ${name}`);
          }
        }
        process.exit(1);
      }
      seedersToRun = [seederName];
    }

    // Show what will run
    if (!options.json && !options.dryRun) {
      console.log('');
      const ordered = seedersToRun ? registry.getByNames(seedersToRun) : registry.getInOrder();

      if (options.fresh) {
        info(
          `Will ${pc.bold('truncate')} and seed ${ordered.length} seeder${ordered.length > 1 ? 's' : ''}:`
        );
      } else {
        info(`Running ${ordered.length} seeder${ordered.length > 1 ? 's' : ''}:`);
      }
      console.log('');
      for (const seeder of ordered) {
        const deps = seeder.dependencies?.length
          ? pc.dim(` (depends on: ${seeder.dependencies.join(', ')})`)
          : '';
        console.log(`  ${pc.dim('→')} ${seeder.name}${deps}`);
      }
      console.log('');
    }

    // Dry run
    if (options.dryRun) {
      const ordered = seedersToRun ? registry.getByNames(seedersToRun) : registry.getInOrder();

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              dryRun: true,
              fresh: options.fresh ?? false,
              seeders: ordered.map((s) => ({
                name: s.name,
                dependencies: s.dependencies ?? [],
              })),
              count: ordered.length,
            },
            null,
            2
          )
        );
      } else {
        warning('Dry run mode - no changes made.');
        console.log(`  ${pc.dim('Remove --dry-run to execute seeders.')}`);
      }
      return;
    }

    // Create Prisma client
    if (!options.json) {
      s.start('Connecting to database...');
    }

    const prisma = await createPrismaClient();

    if (!options.json) {
      s.stop('Connected to database');
    }

    // Create runner
    const runner = new SeederRunner(prisma, registry);

    // Execute seeders
    if (!options.json) {
      console.log('');
      s.start(options.fresh ? 'Truncating and seeding...' : 'Seeding...');
    }

    let result: BatchSeederResult;

    if (options.fresh) {
      result = await runner.fresh({
        only: seedersToRun,
        verbose: options.verbose,
        dryRun: false,
      });
    } else if (seedersToRun) {
      result = await runner.run(seedersToRun, {
        verbose: options.verbose,
        dryRun: false,
      });
    } else {
      result = await runner.runAll({
        verbose: options.verbose,
        dryRun: false,
      });
    }

    // Disconnect
    await prisma.$disconnect();

    // Output results
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            success: result.failed === 0,
            total: result.total,
            successful: result.successful,
            failed: result.failed,
            skipped: result.skipped,
            duration: result.duration,
            results: result.results,
          },
          null,
          2
        )
      );
    } else {
      s.stop(result.failed === 0 ? 'Seeding complete' : 'Seeding finished with errors');
      console.log('');

      if (result.failed === 0) {
        success(
          `Ran ${result.successful} seeder${result.successful !== 1 ? 's' : ''} successfully!`
        );
      } else {
        error(`${result.failed} seeder${result.failed !== 1 ? 's' : ''} failed.`);
        for (const r of result.results) {
          if (!r.success) {
            console.log(`  ${pc.red('✗')} ${r.name}: ${pc.dim(r.error ?? 'Unknown error')}`);
          }
        }
      }

      console.log(`  ${pc.dim(`Duration: ${result.duration}ms`)}`);
      console.log('');
    }

    if (result.failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    s.stop('Seeding failed');

    if (options.json) {
      if (err instanceof SeederError) {
        console.log(JSON.stringify({ error: err.toJSON() }));
      } else {
        console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    } else {
      console.log('');
      if (err instanceof SeederError) {
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
