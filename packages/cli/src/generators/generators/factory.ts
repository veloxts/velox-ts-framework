/**
 * Factory Generator
 *
 * Generates factory files for VeloxTS applications.
 *
 * Usage:
 *   velox generate factory <name> [options]
 *   velox g f <name> [options]
 *
 * Examples:
 *   velox generate factory user     # Creates UserFactory
 *   velox g f post                  # Creates PostFactory
 */

import { BaseGenerator } from '../base.js';
import {
  type FactoryOptions,
  factoryTemplate,
  getFactoryInstructions,
  getFactoryPath,
} from '../templates/factory.js';
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
 * Factory generator - creates factory files for generating fake data
 */
export class FactoryGenerator extends BaseGenerator<FactoryOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'factory',
    description: 'Generate a model factory for fake data generation',
    longDescription: `
Generate a VeloxTS factory file for creating model instances with fake data.

Factories are stored in src/database/factories/ and extend BaseFactory.
They use @faker-js/faker to generate realistic test data and support
named states for common variations (e.g., admin, verified).

Examples:
  velox generate factory user     # Creates UserFactory.ts
  velox g f post                  # Creates PostFactory.ts
`,
    aliases: ['f', 'fac'],
    category: 'database',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'model',
      short: 'm',
      description: 'Path to model file for type inference (optional)',
      type: 'string',
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): FactoryOptions {
    return {
      model: raw.model as string | undefined,
    };
  }

  /**
   * Generate factory files
   */
  async generate(config: GeneratorConfig<FactoryOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const { entity } = context;

    // Generate factory file
    const content = factoryTemplate(context);

    const file: GeneratedFile = {
      path: getFactoryPath(entity.pascal),
      content,
    };

    // Generate post-creation instructions
    const postInstructions = getFactoryInstructions(entity.pascal);

    return {
      files: [file],
      postInstructions,
    };
  }
}

// ============================================================================
// Export
// ============================================================================

/**
 * Create a new factory generator instance
 */
export function createFactoryGenerator(): FactoryGenerator {
  return new FactoryGenerator();
}
