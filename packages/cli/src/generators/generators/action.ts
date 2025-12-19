/**
 * Action Generator
 *
 * Scaffolds server action files for VeloxTS applications.
 *
 * Usage:
 *   velox make action <name> [options]
 *
 * Examples:
 *   velox make action users           # Simple actions
 *   velox make action posts --crud    # Full CRUD actions
 *   velox make action contact --form  # Form action handler
 *   velox make action orders --trpc   # tRPC bridge actions
 */

import { BaseGenerator } from '../base.js';
import {
  type ActionOptions,
  actionTemplate,
  getActionInstructions,
  getActionPath,
} from '../templates/action.js';
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
 * Action generator - creates server action files
 */
export class ActionGenerator extends BaseGenerator<ActionOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'action',
    description: 'Generate server action files',
    longDescription: `
Scaffold server actions for VeloxTS applications.

Server actions run on the server and can be called from client components.
Use --form for form handling, --crud for CRUD operations, or --trpc to
wrap existing tRPC procedures.

Examples:
  velox make action users           # Simple actions
  velox make action posts --crud    # Full CRUD actions
  velox make action contact --form  # Form action handler
  velox make action orders --trpc   # tRPC bridge actions
  velox make action admin --auth    # Actions requiring authentication
`,
    aliases: ['a', 'act'],
    category: 'resource',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'form',
      short: 'f',
      description: 'Generate form action handler',
      type: 'boolean',
      default: false,
    },
    {
      name: 'auth',
      short: 'a',
      description: 'Include authentication requirement',
      type: 'boolean',
      default: false,
    },
    {
      name: 'crud',
      short: 'c',
      description: 'Generate CRUD-style actions',
      type: 'boolean',
      default: false,
    },
    {
      name: 'trpc',
      short: 't',
      description: 'Use tRPC bridge for type safety',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): ActionOptions {
    return {
      form: Boolean(raw.form ?? false),
      auth: Boolean(raw.auth ?? false),
      crud: Boolean(raw.crud ?? false),
      trpc: Boolean(raw.trpc ?? false),
    };
  }

  /**
   * Generate action files
   */
  async generate(config: GeneratorConfig<ActionOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const files: GeneratedFile[] = [];

    // Generate action file
    const actionContent = actionTemplate(context);
    files.push({
      path: getActionPath(config.entityName, config.project),
      content: actionContent,
    });

    return {
      files,
      postInstructions: getActionInstructions(config.entityName, config.options),
    };
  }
}

/**
 * Factory function for creating an ActionGenerator instance
 */
export function createActionGenerator(): ActionGenerator {
  return new ActionGenerator();
}
