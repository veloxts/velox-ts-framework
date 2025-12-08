/**
 * Resource Generator
 *
 * Generates a complete resource with model, schema, procedures, and tests.
 * This is the "full stack" generator for quickly scaffolding new entities.
 */

import { BaseGenerator } from '../base.js';
import {
  generateResourceFiles,
  getResourceInstructions,
  type ResourceOptions,
} from '../templates/resource.js';
import type {
  GeneratorConfig,
  GeneratorMetadata,
  GeneratorOption,
  GeneratorOutput,
} from '../types.js';

// ============================================================================
// Generator Metadata
// ============================================================================

const metadata: GeneratorMetadata = {
  name: 'resource',
  description: 'Generate complete resource (model, schema, procedures, tests)',
  category: 'resource',
  aliases: ['r', 'res'],
};

// ============================================================================
// Generator Options
// ============================================================================

const options: GeneratorOption[] = [
  {
    name: 'crud',
    type: 'boolean',
    description: 'Generate full CRUD operations',
    default: true,
    flag: '-c, --crud',
  },
  {
    name: 'paginated',
    type: 'boolean',
    description: 'Include pagination for list operations',
    default: true,
    flag: '-P, --paginated',
  },
  {
    name: 'softDelete',
    type: 'boolean',
    description: 'Include soft delete support',
    default: false,
    flag: '-s, --soft-delete',
  },
  {
    name: 'timestamps',
    type: 'boolean',
    description: 'Include timestamp fields (createdAt, updatedAt)',
    default: true,
    flag: '-t, --timestamps',
  },
  {
    name: 'withTests',
    type: 'boolean',
    description: 'Generate test files',
    default: true,
    flag: '-W, --with-tests',
  },
  {
    name: 'skipModel',
    type: 'boolean',
    description: 'Skip Prisma model generation',
    default: false,
    flag: '--skip-model',
  },
  {
    name: 'skipSchema',
    type: 'boolean',
    description: 'Skip Zod schema generation',
    default: false,
    flag: '--skip-schema',
  },
  {
    name: 'skipProcedure',
    type: 'boolean',
    description: 'Skip procedure generation',
    default: false,
    flag: '--skip-procedure',
  },
];

// ============================================================================
// Generator Class
// ============================================================================

/**
 * Resource generator implementation
 */
export class ResourceGenerator extends BaseGenerator<ResourceOptions> {
  constructor() {
    super(metadata, options);
  }

  /**
   * Validate resource-specific options
   */
  validateOptions(rawOptions: Record<string, unknown>): ResourceOptions {
    return {
      crud: Boolean(rawOptions.crud ?? true),
      paginated: Boolean(rawOptions.paginated ?? true),
      softDelete: Boolean(rawOptions.softDelete ?? false),
      timestamps: Boolean(rawOptions.timestamps ?? true),
      withTests: Boolean(rawOptions.withTests ?? true),
      skipModel: Boolean(rawOptions.skipModel ?? false),
      skipSchema: Boolean(rawOptions.skipSchema ?? false),
      skipProcedure: Boolean(rawOptions.skipProcedure ?? false),
    };
  }

  /**
   * Generate resource files
   */
  async generate(config: GeneratorConfig<ResourceOptions>): Promise<GeneratorOutput> {
    const ctx = this.createContext(config);
    const files = generateResourceFiles(ctx);

    return {
      files,
      postInstructions: getResourceInstructions(ctx.entity.pascal, config.options),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new resource generator instance
 */
export function createResourceGenerator(): ResourceGenerator {
  return new ResourceGenerator();
}
