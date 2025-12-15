/**
 * Procedure Generator
 *
 * Scaffolds procedure files for VeloxTS applications.
 *
 * Usage:
 *   velox make procedure <name> [options]
 *   velox m p <name> [options]
 *
 * Examples:
 *   velox make procedure users           # Simple get procedure
 *   velox make procedure posts --crud    # Full CRUD procedures
 *   velox m p comments --crud --paginated    # CRUD with pagination
 */

import { BaseGenerator } from '../base.js';
import {
  getProcedureInstructions,
  getProcedurePath,
  type ProcedureOptions,
  procedureTemplate,
} from '../templates/procedure.js';
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
 * Procedure generator - creates procedure files
 */
export class ProcedureGenerator extends BaseGenerator<ProcedureOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'procedure',
    description: 'Generate a procedure file for API endpoints',
    longDescription: `
Scaffold a VeloxTS procedure file that defines API endpoints.

By default, scaffolds a simple procedure with just a get operation.
Use --crud to scaffold full CRUD operations (get, list, create, update, patch, delete).

Examples:
  velox make procedure users           # Simple get procedure
  velox make procedure posts --crud    # Full CRUD procedures
  velox m p comments --crud --paginated    # CRUD with pagination
`,
    aliases: ['p', 'proc'],
    category: 'resource',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'crud',
      short: 'c',
      description: 'Generate full CRUD operations (get, list, create, update, patch, delete)',
      type: 'boolean',
      default: false,
    },
    {
      name: 'paginated',
      short: 'P',
      description: 'Include pagination for list operation (requires --crud)',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): ProcedureOptions {
    const crud = Boolean(raw.crud ?? false);
    const paginated = Boolean(raw.paginated ?? false);

    // Warn if --paginated without --crud (paginated only applies to list)
    if (paginated && !crud) {
      // Silently enable pagination anyway - it will work when user adds list manually
    }

    return { crud, paginated };
  }

  /**
   * Generate procedure files
   */
  async generate(config: GeneratorConfig<ProcedureOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const { entity } = context;

    // Generate procedure content using template
    const content = procedureTemplate(context);

    // Create the generated file
    const file: GeneratedFile = {
      path: getProcedurePath(entity.plural),
      content,
    };

    // Generate post-creation instructions
    const postInstructions = getProcedureInstructions(entity.plural, entity.pascal);

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
 * Create a new procedure generator instance
 */
export function createProcedureGenerator(): ProcedureGenerator {
  return new ProcedureGenerator();
}
