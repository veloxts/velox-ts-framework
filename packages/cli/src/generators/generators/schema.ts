/**
 * Schema Generator
 *
 * Generates Zod validation schemas for VeloxTS applications.
 */

import { BaseGenerator } from '../base.js';
import {
  generateSchemaFiles,
  getSchemaInstructions,
  type SchemaOptions,
} from '../templates/schema.js';
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
  name: 'schema',
  description: 'Generate Zod validation schemas',
  category: 'resource',
  aliases: ['s', 'zod'],
};

// ============================================================================
// Generator Options
// ============================================================================

const options: GeneratorOption[] = [
  {
    name: 'crud',
    type: 'boolean',
    description: 'Generate CRUD-related schemas (create, update, patch, list)',
    default: false,
    flag: '-c, --crud',
  },
  {
    name: 'timestamps',
    type: 'boolean',
    description: 'Include timestamp fields (createdAt, updatedAt)',
    default: true,
    flag: '-t, --timestamps',
  },
  {
    name: 'softDelete',
    type: 'boolean',
    description: 'Include soft delete field (deletedAt)',
    default: false,
    flag: '-s, --soft-delete',
  },
];

// ============================================================================
// Generator Class
// ============================================================================

/**
 * Schema generator implementation
 */
export class SchemaGenerator extends BaseGenerator<SchemaOptions> {
  readonly metadata: GeneratorMetadata = metadata;
  readonly options: ReadonlyArray<GeneratorOption> = options;

  /**
   * Validate schema-specific options
   */
  validateOptions(rawOptions: Record<string, unknown>): SchemaOptions {
    return {
      crud: Boolean(rawOptions.crud ?? false),
      timestamps: Boolean(rawOptions.timestamps ?? true),
      softDelete: Boolean(rawOptions.softDelete ?? false),
    };
  }

  /**
   * Generate schema files
   */
  async generate(config: GeneratorConfig<SchemaOptions>): Promise<GeneratorOutput> {
    const ctx = this.createContext(config);
    const files = generateSchemaFiles(ctx);

    return {
      files,
      postInstructions: getSchemaInstructions(ctx.entity.pascal, config.options),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new schema generator instance
 */
export function createSchemaGenerator(): SchemaGenerator {
  return new SchemaGenerator();
}
