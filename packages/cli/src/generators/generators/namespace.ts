/**
 * Namespace Generator
 *
 * Scaffolds a complete procedure namespace with schema file.
 *
 * Usage:
 *   velox make namespace <name> [options]
 *   velox m ns <name> [options]
 *
 * Examples:
 *   velox make namespace products           # Empty namespace with schema
 *   velox make namespace orders --example   # With example CRUD procedures
 */

import { BaseGenerator } from '../base.js';
import {
  getNamespaceInstructions,
  getNamespaceProcedurePath,
  getNamespaceSchemaPath,
  type NamespaceOptions,
  namespaceSchemaTemplate,
  namespaceTemplate,
} from '../templates/namespace.js';
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
 * Namespace generator - creates procedure namespace with schema
 */
export class NamespaceGenerator extends BaseGenerator<NamespaceOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'namespace',
    description: 'Generate procedure namespace + schema (for existing models or external APIs)',
    longDescription: `
Scaffold a procedure namespace with a separate Zod schema file.

Use this when you already have a Prisma model or are working with external data.
For new database entities, use "velox make resource" instead (recommended).

Creates:
  • Procedure file (src/procedures/{plural}.ts)
  • Schema file (src/schemas/{kebab}.ts)
  • Auto-registers in router.ts

When to use:
  ✓ You have an EXISTING Prisma model and need procedures for it
  ✓ Calling an external API (no database model needed)
  ✓ You want separate schema files (cleaner than inline)
  ✓ Need procedure collection without Prisma injection

When NOT to use:
  • Creating a new database entity → use "resource" instead (recommended)
  • Adding a single procedure → use "procedure" instead

Comparison:
  • "resource" = Prisma model + schema + procedures + tests (RECOMMENDED)
  • "namespace" = schema + procedures (no Prisma injection)
  • "procedure" = procedures only (inline schemas)

Examples:
  velox make namespace products           # Empty namespace for existing model
  velox make namespace orders --example   # With example CRUD procedures
  velox m ns external-api -e              # For external API integration
`,
    aliases: ['ns'],
    category: 'resource',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'example',
      short: 'e',
      description: 'Include example CRUD procedures',
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
  validateOptions(raw: Record<string, unknown>): NamespaceOptions {
    return {
      withExample: Boolean(raw.example ?? raw.withExample ?? false),
      skipRegistration: Boolean(raw['skip-registration'] ?? raw.skipRegistration ?? false),
    };
  }

  /**
   * Generate namespace files
   */
  async generate(config: GeneratorConfig<NamespaceOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const { entity } = context;
    const { options } = config;

    // Generate procedure file
    const procedureContent = namespaceTemplate(context);
    const procedureFile: GeneratedFile = {
      path: getNamespaceProcedurePath(entity.plural),
      content: procedureContent,
    };

    // Generate schema file
    const schemaContent = namespaceSchemaTemplate(context);
    const schemaFile: GeneratedFile = {
      path: getNamespaceSchemaPath(entity.kebab),
      content: schemaContent,
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
            false // not a dry run
          );
        }
      }
    }

    // Generate post-creation instructions
    const postInstructions = this.buildPostInstructions(entity, options, registrationResult);

    return {
      files: [schemaFile, procedureFile],
      postInstructions,
    };
  }

  /**
   * Build post-instructions based on registration result
   */
  private buildPostInstructions(
    entity: { plural: string; pascal: string; camel: string; kebab: string },
    options: NamespaceOptions,
    registrationResult: { success: boolean; modifiedFiles: string[]; error?: string } | null
  ): string {
    const procedureVar = `${entity.camel}Procedures`;

    // If registration was successful
    if (registrationResult?.success) {
      const modifiedFiles = registrationResult.modifiedFiles.map((f) => `    - ${f}`).join('\n');
      let instructions = `
  ✓ Namespace ${procedureVar} auto-registered!

  Created files:
    - src/schemas/${entity.kebab}.ts
    - src/procedures/${entity.plural}.ts

  Modified files:
${modifiedFiles}`;

      instructions += `

  Next steps:
  1. Add fields to your schema in src/schemas/${entity.kebab}.ts
  2. Add the ${entity.pascal} model to your Prisma schema
  3. ${options.withExample ? 'Customize the example procedures' : 'Add procedures to src/procedures/' + entity.plural + '.ts'}`;

      return instructions;
    }

    // If registration was skipped
    if (options.skipRegistration) {
      return getNamespaceInstructions(entity.plural, entity.pascal, entity.kebab);
    }

    // If registration failed
    if (registrationResult?.error) {
      return `
  ⚠ Auto-registration failed: ${registrationResult.error}

${getNamespaceInstructions(entity.plural, entity.pascal, entity.kebab)}`;
    }

    // Default: show manual instructions
    return getNamespaceInstructions(entity.plural, entity.pascal, entity.kebab);
  }
}

// ============================================================================
// Export
// ============================================================================

/**
 * Create a new namespace generator instance
 */
export function createNamespaceGenerator(): NamespaceGenerator {
  return new NamespaceGenerator();
}
