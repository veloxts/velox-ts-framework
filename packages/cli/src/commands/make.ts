/**
 * Make command - Code scaffolding for VeloxTS projects
 *
 * Usage:
 *   velox make <type> <name> [options]
 *   velox m <type> <name> [options]
 *
 * Examples:
 *   velox make procedure users --crud
 *   velox m p User
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

import type { GeneratorConfig, GeneratorOutput } from '../generators/index.js';
import {
  applyCliFlags,
  detectProjectContext,
  ensureVeloxProject,
  findSimilarGenerators,
  formatGeneratorList,
  formatWriteResults,
  formatWriteResultsJson,
  GeneratorError,
  GeneratorErrorCode,
  getAllGenerators,
  getGenerator,
  registerBuiltinGenerators,
  writeFiles,
} from '../generators/index.js';
import { error, formatCommand, info, success } from '../utils/output.js';

// ============================================================================
// Types
// ============================================================================

interface MakeOptions {
  dryRun: boolean;
  force: boolean;
  json: boolean;
  // Additional options are passed through to generators
  [key: string]: unknown;
}

// ============================================================================
// Command Creation
// ============================================================================

/**
 * Create the make command
 */
export function createMakeCommand(): Command {
  // Register built-in generators
  registerBuiltinGenerators();

  const cmd = new Command('make')
    .alias('m')
    .description('Scaffold code for your VeloxTS project')
    .argument('[type]', 'Generator type (procedure, schema, model, etc.)')
    .argument('[name]', 'Name for the generated entity')
    .option('-d, --dry-run', 'Preview changes without writing files', false)
    .option('-f, --force', 'Overwrite existing files without prompting', false)
    .option('--json', 'Output results as JSON', false)
    // Generator-specific options (passed through to generators)
    .option('-c, --crud', 'Generate full CRUD operations', false)
    .option('-P, --paginated', 'Include pagination for list operation', false)
    .option('-s, --soft-delete', 'Add soft delete support (model generator)', false)
    .option('-t, --timestamps', 'Include timestamps (model generator)', true)
    .option('-D, --database <type>', 'Database type: sqlite, postgresql, mysql', 'sqlite')
    // Test generator options
    .option('-T, --type <type>', 'Test type: unit, integration, e2e', 'unit')
    .option(
      '-G, --target <target>',
      'Test target: procedure, schema, model, service, generic',
      'generic'
    )
    // Resource generator options
    .option('-W, --with-tests', 'Include test files (resource generator)', true)
    .option('--skip-model', 'Skip Prisma model generation', false)
    .option('--skip-schema', 'Skip Zod schema generation', false)
    .option('--skip-procedure', 'Skip procedure generation', false)
    .action(async (type: string | undefined, name: string | undefined, options: MakeOptions) => {
      await runMake(type, name, options);
    });

  // Add help showing available generators
  cmd.addHelpText(
    'after',
    `
Available generators:${formatGeneratorList()}

Examples:
  ${formatCommand('velox make resource Post')}         Scaffold complete Post resource
  ${formatCommand('velox m r User --soft-delete')}     Resource with soft delete support
  ${formatCommand('velox m p User --crud')}            Scaffold CRUD procedures only
  ${formatCommand('velox m s User --crud')}            Scaffold Zod schemas only
  ${formatCommand('velox m t User -G procedure')}      Scaffold procedure unit tests
  ${formatCommand('velox make --dry-run r Post')}      Preview resource scaffolding
`
  );

  return cmd;
}

// ============================================================================
// Command Execution
// ============================================================================

/**
 * Run the make command
 */
async function runMake(
  type: string | undefined,
  name: string | undefined,
  options: MakeOptions
): Promise<void> {
  const { json, dryRun, force } = options;

  // JSON mode: suppress interactive output
  const isInteractive = !json;

  try {
    // List generators if no type specified
    if (!type) {
      if (json) {
        const generators = getAllGenerators().map((g) => ({
          name: g.name,
          aliases: g.generator.metadata.aliases ?? [],
          description: g.generator.metadata.description,
          category: g.generator.metadata.category,
        }));
        console.log(JSON.stringify({ generators }, null, 2));
        return;
      }

      p.intro(pc.bgCyan(pc.black(' VeloxTS Make ')));
      console.log(formatGeneratorList());
      console.log('');
      info(`Run ${formatCommand('velox make <type> <name>')} to scaffold code.`);
      return;
    }

    // Find the generator
    const generator = getGenerator(type);

    if (!generator) {
      const similar = findSimilarGenerators(type);
      const suggestion =
        similar.length > 0
          ? `Did you mean: ${similar.map((s) => pc.cyan(s)).join(', ')}?`
          : `Run ${formatCommand('velox make')} to see available generators.`;

      throw new GeneratorError(
        GeneratorErrorCode.INVALID_OPTION,
        `Unknown generator: ${type}`,
        suggestion
      );
    }

    // Check for entity name
    if (!name) {
      throw new GeneratorError(
        GeneratorErrorCode.INVALID_ENTITY_NAME,
        'Entity name is required',
        `Usage: ${formatCommand(`velox make ${type} <name>`)}`
      );
    }

    // Validate entity name
    const nameError = generator.validateEntityName(name);
    if (nameError) {
      throw new GeneratorError(
        GeneratorErrorCode.INVALID_ENTITY_NAME,
        nameError,
        'Entity names must start with a letter and contain only letters, numbers, hyphens, or underscores.'
      );
    }

    // Ensure we're in a VeloxTS project
    const cwd = process.cwd();
    await ensureVeloxProject(cwd);

    // Detect project context
    const project = await detectProjectContext(cwd);

    // Extract generator-specific options (remove global flags)
    const { dryRun: _d, force: _f, json: _j, ...generatorOptions } = options;

    // Validate generator options
    const validatedOptions = generator.validateOptions(generatorOptions);

    // Build generator config
    const config: GeneratorConfig = applyCliFlags(
      {
        entityName: name,
        options: validatedOptions,
        conflictStrategy: 'prompt',
        dryRun: false,
        force: false,
        cwd,
        project,
      },
      { dryRun, force, json }
    );

    // Show spinner for generation
    let output: GeneratorOutput;
    if (isInteractive) {
      const s = p.spinner();
      s.start(`Scaffolding ${generator.metadata.name}...`);

      try {
        output = await generator.generate(config);
        s.stop(`Scaffolded ${output.files.length} file(s)`);
      } catch (err) {
        s.stop('Scaffolding failed');
        throw err;
      }
    } else {
      output = await generator.generate(config);
    }

    // Write files
    const writeResults = await writeFiles(output.files, {
      conflictStrategy: config.conflictStrategy,
      dryRun: config.dryRun,
      force: config.force,
      cwd,
      silent: json,
    });

    // Output results
    if (json) {
      console.log(formatWriteResultsJson(writeResults));
    } else {
      console.log('');
      console.log(formatWriteResults(writeResults, dryRun));

      // Show post-generation instructions
      if (output.postInstructions && !dryRun) {
        console.log('');
        info('Next steps:');
        console.log(output.postInstructions);
      }

      console.log('');
      success(dryRun ? 'Dry run complete.' : 'Scaffolding complete!');
    }
  } catch (err) {
    handleError(err, json);
    process.exit(1);
  }
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Handle errors with appropriate formatting
 */
function handleError(err: unknown, json: boolean): void {
  if (err instanceof GeneratorError) {
    if (json) {
      console.log(JSON.stringify(err.toJSON(), null, 2));
    } else {
      error(err.message);
      if (err.fix) {
        info(`Fix: ${err.fix}`);
      }
    }
    return;
  }

  if (err instanceof Error) {
    if (json) {
      console.log(
        JSON.stringify(
          {
            code: 'E2005',
            message: err.message,
          },
          null,
          2
        )
      );
    } else {
      error(err.message);
    }
    return;
  }

  if (json) {
    console.log(
      JSON.stringify(
        {
          code: 'E2005',
          message: 'An unknown error occurred',
        },
        null,
        2
      )
    );
  } else {
    error('An unknown error occurred');
  }
}
