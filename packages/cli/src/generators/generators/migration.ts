/**
 * Migration Generator
 *
 * Generates Prisma migration files with SQL scaffolding.
 *
 * Usage:
 *   velox generate migration <name> [options]
 *   velox g mig <name> [options]
 *
 * Examples:
 *   velox generate migration create_posts
 *   velox generate migration add_email_to_users
 *   velox generate migration remove_name_from_users
 *   velox g mig rename_posts_to_articles
 */

import { BaseGenerator, detectProjectContext } from '../base.js';
import {
  generateMigrationFiles,
  getMigrationInstructions,
  type MigrationOptions,
} from '../templates/migration.js';
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
 * Migration generator - creates Prisma migration files
 */
export class MigrationGenerator extends BaseGenerator<MigrationOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'migration',
    description: 'Generate a database migration file',
    longDescription: `
Generate a Prisma-compatible migration file with SQL scaffolding.

The migration name determines the SQL template:
  create_<table>           → CREATE TABLE scaffold
  add_<column>_to_<table>  → ALTER TABLE ADD COLUMN
  remove_<column>_from_<table> → ALTER TABLE DROP COLUMN
  rename_<old>_to_<new>    → RENAME TABLE
  drop_<table>             → DROP TABLE
  <anything_else>          → Custom migration template

Examples:
  velox generate migration create_posts
  velox generate migration add_slug_to_posts
  velox generate migration remove_legacy_field_from_users
  velox g mig rename_posts_to_articles
`,
    aliases: ['mig'],
    category: 'database',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'database',
      short: 'D',
      description: 'Database type (sqlite, postgresql, mysql)',
      type: 'string',
      choices: ['sqlite', 'postgresql', 'mysql'],
      default: 'sqlite',
    },
  ];

  /**
   * Custom validation for migration names
   * Migration names should be snake_case and descriptive
   */
  validateEntityName(name: string): string | undefined {
    if (!name || name.trim().length === 0) {
      return 'Migration name cannot be empty';
    }

    // Must be snake_case or kebab-case
    if (!/^[a-z][a-z0-9_-]*$/.test(name)) {
      return 'Migration name must be lowercase with underscores or hyphens (e.g., create_users)';
    }

    if (name.length > 100) {
      return 'Migration name must be 100 characters or less';
    }

    return undefined;
  }

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): MigrationOptions {
    const database = raw.database as string | undefined;

    // Validate database type
    if (database && !['sqlite', 'postgresql', 'mysql'].includes(database)) {
      throw new Error(`Invalid database type: ${database}. Use sqlite, postgresql, or mysql.`);
    }

    return {
      database: (database as MigrationOptions['database']) ?? 'sqlite',
    };
  }

  /**
   * Generate migration files
   */
  async generate(config: GeneratorConfig<MigrationOptions>): Promise<GeneratorOutput> {
    // Auto-detect database type from project if not specified
    let options = config.options;
    if (!config.options.database || config.options.database === 'sqlite') {
      const project = await detectProjectContext(config.cwd);
      options = { ...config.options, database: project.database };
    }

    const context = this.createContext({
      ...config,
      options,
    });

    // Generate migration files
    const files = generateMigrationFiles(context);

    // Generate post-creation instructions
    const postInstructions = getMigrationInstructions(context.entity.snake);

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
 * Create a new migration generator instance
 */
export function createMigrationGenerator(): MigrationGenerator {
  return new MigrationGenerator();
}
