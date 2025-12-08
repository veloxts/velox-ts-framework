/**
 * Model Generator
 *
 * Generates Prisma model, Zod schema, and optionally procedures.
 *
 * Usage:
 *   velox generate model <name> [options]
 *   velox g m <name> [options]
 *
 * Examples:
 *   velox generate model Post              # Model + schema only
 *   velox generate model Comment --crud    # Model + schema + procedures
 *   velox g m Order --crud --paginated     # With pagination
 *   velox g m Article --soft-delete        # With soft delete support
 */

import { BaseGenerator } from '../base.js';
import { generateModelFiles, getModelInstructions, type ModelOptions } from '../templates/model.js';
import type {
  GeneratorConfig,
  GeneratorMetadata,
  GeneratorOption,
  GeneratorOutput,
} from '../types.js';

// ============================================================================
// Generator Implementation
// ============================================================================

/**
 * Model generator - creates Prisma model, Zod schema, and procedures
 */
export class ModelGenerator extends BaseGenerator<ModelOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'model',
    description: 'Generate a Prisma model with Zod schema and optional procedures',
    longDescription: `
Generate a complete model including:
- Prisma model definition (saved to prisma/models/ for easy copying)
- Zod validation schemas (input/output)
- CRUD procedures (with --crud flag)

Examples:
  velox generate model Post              # Model + schema only
  velox generate model Comment --crud    # With CRUD procedures
  velox g m Order --crud --paginated     # With pagination
  velox g m Article --soft-delete        # With soft delete
`,
    aliases: ['m'],
    category: 'resource',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'crud',
      short: 'c',
      description: 'Generate CRUD procedures alongside the model',
      type: 'boolean',
      default: false,
    },
    {
      name: 'paginated',
      short: 'P',
      description: 'Include pagination for list operation (with --crud)',
      type: 'boolean',
      default: false,
    },
    {
      name: 'soft-delete',
      short: 's',
      description: 'Add soft delete support (deletedAt field)',
      type: 'boolean',
      default: false,
    },
    {
      name: 'timestamps',
      short: 't',
      description: 'Include timestamps (createdAt, updatedAt)',
      type: 'boolean',
      default: true,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): ModelOptions {
    return {
      crud: Boolean(raw.crud ?? false),
      paginated: Boolean(raw.paginated ?? false),
      softDelete: Boolean(raw['soft-delete'] ?? raw.softDelete ?? false),
      timestamps: Boolean(raw.timestamps ?? true),
    };
  }

  /**
   * Generate model files
   */
  async generate(config: GeneratorConfig<ModelOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);

    // Generate all model files
    const files = generateModelFiles(context);

    // Generate post-creation instructions
    const postInstructions = getModelInstructions(context);

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
 * Create a new model generator instance
 */
export function createModelGenerator(): ModelGenerator {
  return new ModelGenerator();
}
