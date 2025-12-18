/**
 * Resource Generator
 *
 * Generates a complete resource with model, schema, procedures, and tests.
 * This is the "full stack" generator for quickly scaffolding new entities.
 */

import * as p from '@clack/prompts';

import { BaseGenerator } from '../base.js';
import { collectFields, displayFieldsSummary, type FieldDefinition } from '../fields/index.js';
import {
  generateResourceFiles,
  getResourceInstructions,
  type ResourceOptions,
} from '../templates/resource.js';
import type {
  GeneratedFile,
  GeneratorConfig,
  GeneratorMetadata,
  GeneratorOption,
  GeneratorOutput,
} from '../types.js';
import { deriveEntityNames } from '../utils/naming.js';

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
  {
    name: 'interactive',
    type: 'boolean',
    description: 'Interactively define fields',
    default: true,
    flag: '-i, --interactive',
  },
  {
    name: 'skipFields',
    type: 'boolean',
    description: 'Skip field prompts (generate skeleton only)',
    default: false,
    flag: '--skip-fields',
  },
];

// ============================================================================
// Generator Class
// ============================================================================

/**
 * CLI options including interactive flags (extends ResourceOptions for template)
 */
interface ResourceCliOptions extends ResourceOptions {
  interactive: boolean;
  skipFields: boolean;
}

/**
 * Resource generator implementation
 */
export class ResourceGenerator extends BaseGenerator<ResourceCliOptions> {
  readonly metadata: GeneratorMetadata = metadata;
  readonly options: ReadonlyArray<GeneratorOption> = options;

  /**
   * Validate resource-specific options
   */
  validateOptions(rawOptions: Record<string, unknown>): ResourceCliOptions {
    return {
      crud: Boolean(rawOptions.crud ?? true),
      paginated: Boolean(rawOptions.paginated ?? true),
      softDelete: Boolean(rawOptions.softDelete ?? false),
      timestamps: Boolean(rawOptions.timestamps ?? true),
      withTests: Boolean(rawOptions.withTests ?? true),
      skipModel: Boolean(rawOptions.skipModel ?? false),
      skipSchema: Boolean(rawOptions.skipSchema ?? false),
      skipProcedure: Boolean(rawOptions.skipProcedure ?? false),
      interactive: Boolean(rawOptions.interactive ?? true),
      skipFields: Boolean(rawOptions.skipFields ?? false),
    };
  }

  /**
   * Generate resource files with optional interactive field collection
   */
  async generate(config: GeneratorConfig<ResourceCliOptions>): Promise<GeneratorOutput> {
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

      // Show summary of collected fields
      if (fields.length > 0) {
        displayFieldsSummary(fields);

        // Confirm before proceeding
        const confirmed = await p.confirm({
          message: 'Generate resource with these fields?',
          initialValue: true,
        });

        if (p.isCancel(confirmed) || !confirmed) {
          return {
            files: [],
            postInstructions: 'Operation cancelled by user.',
          };
        }
      }
    }

    // Build template options (without CLI-only flags)
    const templateOptions: ResourceOptions = {
      crud: config.options.crud,
      paginated: config.options.paginated,
      softDelete: config.options.softDelete,
      timestamps: config.options.timestamps,
      withTests: config.options.withTests,
      skipModel: config.options.skipModel,
      skipSchema: config.options.skipSchema,
      skipProcedure: config.options.skipProcedure,
      fields,
    };

    // Create context with template options
    const ctx = {
      entity: deriveEntityNames(config.entityName),
      project: config.project,
      options: templateOptions,
    };

    // Show spinner during actual file generation
    // Only show if we're in interactive mode (we collected fields or user opted to skip)
    const showSpinner = interactive && !skipFields && !config.dryRun;
    let generatedFiles: readonly GeneratedFile[];

    if (showSpinner) {
      const s = p.spinner();
      s.start('Scaffolding resource...');

      try {
        generatedFiles = generateResourceFiles(ctx);
        s.stop(`Scaffolded ${generatedFiles.length} file(s)`);
      } catch (err) {
        s.stop('Scaffolding failed');
        throw err;
      }
    } else {
      generatedFiles = generateResourceFiles(ctx);
    }

    return {
      files: generatedFiles,
      postInstructions: getResourceInstructions(ctx.entity.pascal, templateOptions),
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
// Factory Function
// ============================================================================

/**
 * Create a new resource generator instance
 */
export function createResourceGenerator(): ResourceGenerator {
  return new ResourceGenerator();
}
