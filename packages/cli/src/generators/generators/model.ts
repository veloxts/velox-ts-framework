/**
 * Model Generator
 *
 * Scaffolds Prisma model, Zod schema, and optionally procedures.
 *
 * Usage:
 *   velox make model <name> [options]
 *   velox m model <name> [options]
 *
 * Examples:
 *   velox make model Post              # Model + schema only
 *   velox make model Comment --crud    # Model + schema + procedures
 *   velox m model Order --crud --paginated     # With pagination
 *   velox m model Article --soft-delete        # With soft delete support
 */

import * as p from '@clack/prompts';

import { BaseGenerator } from '../base.js';
import { collectFields, type FieldDefinition } from '../fields/index.js';
import { generateModelFiles, getModelInstructions, type ModelOptions } from '../templates/model.js';
import type {
  GeneratorConfig,
  GeneratorMetadata,
  GeneratorOption,
  GeneratorOutput,
} from '../types.js';
import { deriveEntityNames } from '../utils/naming.js';

// ============================================================================
// Generator Implementation
// ============================================================================

/**
 * CLI options including interactive flags (extends ModelOptions for template)
 */
interface ModelCliOptions extends ModelOptions {
  interactive: boolean;
  skipFields: boolean;
}

/**
 * Model generator - creates Prisma model, Zod schema, and procedures
 */
export class ModelGenerator extends BaseGenerator<ModelCliOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'model',
    description: 'Generate a Prisma model with Zod schema and optional procedures',
    longDescription: `
Scaffold a complete model including:
- Prisma model definition (saved to prisma/models/ for easy copying)
- Zod validation schemas (input/output)
- CRUD procedures (with --crud flag)

Examples:
  velox make model Post              # Model + schema only
  velox make model Comment --crud    # With CRUD procedures
  velox m model Order --crud --paginated     # With pagination
  velox m model Article --soft-delete        # With soft delete
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
    {
      name: 'interactive',
      short: 'i',
      description: 'Interactively define fields',
      type: 'boolean',
      default: true,
    },
    {
      name: 'skip-fields',
      description: 'Skip field prompts (generate skeleton only)',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): ModelCliOptions {
    return {
      crud: Boolean(raw.crud ?? false),
      paginated: Boolean(raw.paginated ?? false),
      softDelete: Boolean(raw['soft-delete'] ?? raw.softDelete ?? false),
      timestamps: Boolean(raw.timestamps ?? true),
      interactive: Boolean(raw.interactive ?? true),
      skipFields: Boolean(raw['skip-fields'] ?? raw.skipFields ?? false),
    };
  }

  /**
   * Generate model files with optional interactive field collection
   */
  async generate(config: GeneratorConfig<ModelCliOptions>): Promise<GeneratorOutput> {
    const { interactive, skipFields } = config.options;

    // Collect fields interactively if not skipped and in interactive mode
    let fields: FieldDefinition[] = [];

    if (interactive && !skipFields && !config.dryRun) {
      const fieldResult = await this.collectFieldsInteractively(config.entityName);

      if (fieldResult.cancelled) {
        // User cancelled - return empty output
        return {
          files: [],
          postInstructions: 'Operation cancelled by user.',
        };
      }

      fields = fieldResult.fields;
      // Field collection already shows summary and confirms with user
    }

    // Build template options (without CLI-only flags)
    const templateOptions: ModelOptions = {
      crud: config.options.crud,
      paginated: config.options.paginated,
      softDelete: config.options.softDelete,
      timestamps: config.options.timestamps,
      fields,
    };

    // Create context with template options
    const context = {
      entity: deriveEntityNames(config.entityName),
      project: config.project,
      options: templateOptions,
    };

    // Show spinner during actual file generation
    // Only show if we're in interactive mode (we collected fields or user opted to skip)
    const showSpinner = interactive && !skipFields && !config.dryRun;
    let files: readonly import('../types.js').GeneratedFile[];

    if (showSpinner) {
      const s = p.spinner();
      s.start('Scaffolding model...');

      try {
        files = generateModelFiles(context);
        s.stop(`Scaffolded ${files.length} file(s)`);
      } catch (err) {
        s.stop('Scaffolding failed');
        throw err;
      }
    } else {
      files = generateModelFiles(context);
    }

    // Generate post-creation instructions
    const postInstructions = getModelInstructions(context);

    return {
      files,
      postInstructions,
    };
  }

  /**
   * Collect fields interactively from user
   */
  private async collectFieldsInteractively(
    entityName: string
  ): Promise<{ fields: FieldDefinition[]; cancelled: boolean }> {
    // Ask if user wants to define fields
    const wantFields = await p.confirm({
      message: `Do you want to define fields for ${entityName}?`,
      initialValue: true,
    });

    if (p.isCancel(wantFields)) {
      return { fields: [], cancelled: true };
    }

    if (!wantFields) {
      return { fields: [], cancelled: false };
    }

    // Collect fields
    return collectFields({
      resourceName: entityName,
      minFields: 0,
    });
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
