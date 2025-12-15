/**
 * Seeder Generator
 *
 * Scaffolds seeder files for VeloxTS applications.
 *
 * Usage:
 *   velox make seeder <name> [options]
 *   velox m s <name> [options]
 *
 * Examples:
 *   velox make seeder user           # Creates UserSeeder
 *   velox make seeder post --factory # Also creates PostFactory
 */

import { BaseGenerator } from '../base.js';
import { factoryTemplate, getFactoryPath } from '../templates/factory.js';
import {
  getSeederInstructions,
  getSeederPath,
  type SeederOptions,
  seederTemplate,
} from '../templates/seeder.js';
import type {
  GeneratedFile,
  GeneratorConfig,
  GeneratorMetadata,
  GeneratorOption,
  GeneratorOutput,
} from '../types.js';

// ============================================================================
// Generator Implementation
// ============================================================================

/**
 * Seeder generator - creates seeder files for database seeding
 */
export class SeederGenerator extends BaseGenerator<SeederOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'seeder',
    description: 'Generate a database seeder file',
    longDescription: `
Scaffold a VeloxTS seeder file for populating the database with initial or test data.

Seeders are stored in src/database/seeders/ and implement the Seeder interface.
They can have dependencies on other seeders and are executed in the correct order.

Examples:
  velox make seeder user              # Creates UserSeeder.ts
  velox make seeder post --factory    # Creates PostSeeder.ts and PostFactory.ts
`,
    aliases: ['s', 'seed'],
    category: 'database',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'factory',
      short: 'f',
      description: 'Also generate a factory for this model',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): SeederOptions {
    return {
      factory: Boolean(raw.factory ?? false),
    };
  }

  /**
   * Generate seeder files
   */
  async generate(config: GeneratorConfig<SeederOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const { entity, options } = context;
    const files: GeneratedFile[] = [];

    // Generate seeder file
    const seederContent = seederTemplate(context);
    files.push({
      path: getSeederPath(entity.pascal),
      content: seederContent,
    });

    // Generate factory if requested
    if (options.factory) {
      const factoryContent = factoryTemplate({
        entity: context.entity,
        project: context.project,
        options: {},
      });
      files.push({
        path: getFactoryPath(entity.pascal),
        content: factoryContent,
      });
    }

    // Generate post-creation instructions
    const postInstructions = getSeederInstructions(entity.pascal, Boolean(options.factory));

    return {
      files,
      postInstructions,
    };
  }
}

// ============================================================================
// Export
// ============================================================================

/**
 * Create a new seeder generator instance
 */
export function createSeederGenerator(): SeederGenerator {
  return new SeederGenerator();
}
