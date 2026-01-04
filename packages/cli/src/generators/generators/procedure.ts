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
import {
  detectRouterPattern,
  isProcedureRegistered,
  registerProcedures,
} from '../utils/router-integration.js';

// ============================================================================
// Generator Implementation
// ============================================================================

/**
 * Procedure generator - creates procedure files
 */
export class ProcedureGenerator extends BaseGenerator<ProcedureOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'procedure',
    description: 'Generate a procedure file (for single or additional procedures)',
    longDescription: `
Scaffold a standalone procedure file with inline schemas.

Use this for adding individual procedures or extending existing namespaces.
For new database entities, use "velox make resource" instead (recommended).

Creates:
  • Procedure file (src/procedures/{plural}.ts) with inline Zod schemas
  • Auto-registers in router.ts

When to use:
  ✓ Adding a single procedure to your API
  ✓ Quick prototyping (inline schemas, no separate files)
  ✓ Extending an existing namespace with additional procedures

When NOT to use:
  • Creating a new database entity → use "resource" instead (recommended)
  • Want separate schema files → use "namespace" instead

Comparison:
  • "resource" = Prisma model + schema + procedures + tests (RECOMMENDED)
  • "namespace" = schema + procedures (separate files)
  • "procedure" = procedures only (inline schemas, self-contained)

Examples:
  velox make procedure health            # Single health check procedure
  velox make procedure users --crud      # CRUD with inline schemas
  velox m p analytics                    # Quick procedure for analytics
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
    {
      name: 'skip-registration',
      short: 'S',
      description: 'Skip auto-registering the procedure in router.ts',
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
    const skipRegistration = Boolean(raw['skip-registration'] ?? raw.skipRegistration ?? false);

    // Warn if --paginated without --crud (paginated only applies to list)
    if (paginated && !crud) {
      // Silently enable pagination anyway - it will work when user adds list manually
    }

    return { crud, paginated, skipRegistration };
  }

  /**
   * Generate procedure files
   */
  async generate(config: GeneratorConfig<ProcedureOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const { entity } = context;
    const { options } = config;

    // Generate procedure content using template
    const content = procedureTemplate(context);

    // Create the generated file
    const file: GeneratedFile = {
      path: getProcedurePath(entity.plural),
      content,
    };

    // Try auto-registration if not skipped
    let registrationResult: {
      success: boolean;
      modifiedFiles: string[];
      error?: string;
    } | null = null;

    if (!options.skipRegistration && !config.dryRun) {
      const procedureVar = `${entity.camel}Procedures`;

      // Check if already registered
      if (!isProcedureRegistered(config.cwd, procedureVar)) {
        // Detect router pattern
        const pattern = detectRouterPattern(config.cwd);

        if (pattern.type !== 'unknown') {
          // Perform registration
          registrationResult = registerProcedures(
            config.cwd,
            entity.kebab,
            procedureVar,
            false // not a dry run since we're writing
          );
        }
      }
    }

    // Generate post-creation instructions based on registration result
    const postInstructions = this.buildPostInstructions(entity, options, registrationResult);

    return {
      files: [file],
      postInstructions,
    };
  }

  /**
   * Build post-instructions based on whether auto-registration succeeded
   */
  private buildPostInstructions(
    entity: { plural: string; pascal: string; camel: string; kebab: string },
    options: ProcedureOptions,
    registrationResult: { success: boolean; modifiedFiles: string[]; error?: string } | null
  ): string {
    const procedureVar = `${entity.camel}Procedures`;

    // If registration was successful, show simpler instructions
    if (registrationResult?.success) {
      const modifiedFiles = registrationResult.modifiedFiles.map((f) => `    - ${f}`).join('\n');
      let instructions = `
  ✓ Procedure ${procedureVar} auto-registered!

  Modified files:
${modifiedFiles}`;

      if (options.crud) {
        instructions += `

  Next: Add the ${entity.pascal} model to your Prisma schema:

     // prisma/schema.prisma
     model ${entity.pascal} {
       id        String   @id @default(uuid())
       createdAt DateTime @default(now())
       updatedAt DateTime @updatedAt
     }

     Then run: pnpm db:push`;
      }

      return instructions;
    }

    // If registration was skipped or failed, show manual instructions
    if (options.skipRegistration) {
      return getProcedureInstructions(entity.plural, entity.pascal);
    }

    // If registration failed, show error and manual instructions
    if (registrationResult?.error) {
      return `
  ⚠ Auto-registration failed: ${registrationResult.error}

${getProcedureInstructions(entity.plural, entity.pascal)}`;
    }

    // Default: show manual instructions
    return getProcedureInstructions(entity.plural, entity.pascal);
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
