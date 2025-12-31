/**
 * Resource Generator
 *
 * Generates a complete resource with model, schema, procedures, and tests.
 * This is the "full stack" generator for quickly scaffolding new entities.
 *
 * Features:
 * - Auto-injects Prisma models into schema.prisma
 * - Auto-registers procedures in detected router pattern
 * - Optional automatic Prisma migration
 * - Snapshot/rollback for safe file operations
 */

import { writeFileSync } from 'node:fs';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import { BaseGenerator } from '../base.js';
import { collectFields, type FieldDefinition } from '../fields/index.js';
import {
  generateInjectablePrismaContent,
  generateResourceFiles,
  type ResourceOptions,
} from '../templates/resource.js';
import type {
  GeneratedFile,
  GeneratorConfig,
  GeneratorMetadata,
  GeneratorOption,
  GeneratorOutput,
} from '../types.js';
import {
  findAllSimilarFiles,
  formatSimilarFilesWarning,
} from '../utils/filesystem.js';
import { deriveEntityNames } from '../utils/naming.js';
import { promptAndRunMigration } from '../utils/prisma-migration.js';
import {
  analyzePrismaSchema,
  findPrismaSchema,
  hasModel,
  injectIntoSchema,
  type PrismaEnumDefinition,
  type PrismaModelDefinition,
} from '../utils/prisma-schema.js';
import {
  detectRouterPattern,
  isProcedureRegistered,
  registerProcedures,
} from '../utils/router-integration.js';
import {
  createSnapshot,
  type FileSnapshot,
  rollback,
  saveOriginal,
  trackCreated,
} from '../utils/snapshot.js';

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
    default: false,
    flag: '-i, --interactive',
  },
  {
    name: 'skipFields',
    type: 'boolean',
    description: 'Skip field prompts (generate skeleton only)',
    default: false,
    flag: '--skip-fields',
  },
  // Auto-registration options
  {
    name: 'skipRegistration',
    type: 'boolean',
    description: 'Skip auto-registering procedures in router',
    default: false,
    flag: '--skip-registration',
  },
  {
    name: 'skipMigration',
    type: 'boolean',
    description: 'Skip Prisma migration prompt',
    default: false,
    flag: '--skip-migration',
  },
  {
    name: 'autoMigrate',
    type: 'boolean',
    description: 'Auto-run Prisma migration without prompting',
    default: false,
    flag: '--auto-migrate',
  },
];

// ============================================================================
// Generator Class
// ============================================================================

/**
 * CLI options including interactive flags and auto-registration (extends ResourceOptions for template)
 */
interface ResourceCliOptions extends ResourceOptions {
  interactive: boolean;
  skipFields: boolean;
  // Auto-registration options
  skipRegistration: boolean;
  skipMigration: boolean;
  autoMigrate: boolean;
}

/**
 * Result of auto-registration operations
 */
interface AutoRegistrationResult {
  /** Whether Prisma model was injected into schema.prisma */
  prismaInjected: boolean;
  /** Whether procedures were registered in router */
  procedureRegistered: boolean;
  /** Whether migration was run */
  migrationRun: boolean;
  /** Files modified during auto-registration */
  modifiedFiles: string[];
  /** Errors encountered (for partial success scenarios) */
  errors: string[];
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
      interactive: Boolean(rawOptions.interactive ?? false),
      skipFields: Boolean(rawOptions.skipFields ?? false),
      // Auto-registration options
      skipRegistration: Boolean(rawOptions.skipRegistration ?? false),
      skipMigration: Boolean(rawOptions.skipMigration ?? false),
      autoMigrate: Boolean(rawOptions.autoMigrate ?? false),
    };
  }

  /**
   * Generate resource files with optional interactive field collection
   * and automatic Prisma/router integration
   */
  async generate(config: GeneratorConfig<ResourceCliOptions>): Promise<GeneratorOutput> {
    const { interactive, skipFields, skipRegistration, skipMigration, autoMigrate } =
      config.options;

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

    // Check for similar files (singular/plural variants) before generating
    // This helps prevent accidental duplicate entities like user.ts vs users.ts
    if (!config.force && !config.dryRun) {
      const targetPaths = [
        `src/procedures/${ctx.entity.kebab}.ts`,
        `src/schemas/${ctx.entity.kebab}.schema.ts`,
      ];

      const similarResult = findAllSimilarFiles(config.cwd, targetPaths, ctx.entity.kebab);

      if (similarResult.hasSimilar) {
        const warningMessage = formatSimilarFilesWarning(similarResult, config.entityName);
        p.log.warn(warningMessage);

        // In interactive mode, ask user to confirm
        if (interactive) {
          const shouldContinue = await p.confirm({
            message: 'Do you want to continue anyway?',
            initialValue: false,
          });

          if (p.isCancel(shouldContinue) || !shouldContinue) {
            return {
              files: [],
              postInstructions: 'Generation cancelled due to similar existing files.',
            };
          }
        } else {
          // In non-interactive mode, abort and suggest --force
          p.log.error('Use --force to generate anyway, or choose a different entity name.');
          return {
            files: [],
            postInstructions:
              'Generation aborted: similar files already exist. Use --force to override.',
          };
        }
      }
    }

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

    // Auto-registration (skip in dry-run mode)
    let autoResult: AutoRegistrationResult = {
      prismaInjected: false,
      procedureRegistered: false,
      migrationRun: false,
      modifiedFiles: [],
      errors: [],
    };

    if (!config.dryRun) {
      autoResult = await this.performAutoRegistration(config.cwd, ctx.entity, templateOptions, {
        skipRegistration,
        skipMigration,
        autoMigrate,
        showSpinner: interactive,
      });
    }

    // Build post-instructions based on what was auto-done
    const postInstructions = this.buildPostInstructions(
      ctx.entity.pascal,
      templateOptions,
      autoResult
    );

    return {
      files: generatedFiles,
      postInstructions,
    };
  }

  /**
   * Perform auto-registration of Prisma model and procedures
   */
  private async performAutoRegistration(
    projectRoot: string,
    entity: { pascal: string; camel: string; kebab: string },
    options: ResourceOptions,
    flags: {
      skipRegistration: boolean;
      skipMigration: boolean;
      autoMigrate: boolean;
      showSpinner: boolean;
    }
  ): Promise<AutoRegistrationResult> {
    const result: AutoRegistrationResult = {
      prismaInjected: false,
      procedureRegistered: false,
      migrationRun: false,
      modifiedFiles: [],
      errors: [],
    };

    // Create snapshot for rollback capability
    const snapshot = createSnapshot();

    try {
      // Step 1: Inject Prisma model into schema.prisma
      if (!options.skipModel) {
        const prismaResult = await this.injectPrismaModel(
          projectRoot,
          entity,
          options,
          snapshot,
          flags.showSpinner
        );
        if (prismaResult.success) {
          result.prismaInjected = true;
          if (prismaResult.schemaPath) {
            result.modifiedFiles.push(prismaResult.schemaPath);
          }
        } else if (prismaResult.error) {
          result.errors.push(prismaResult.error);
        }
      }

      // Step 2: Auto-register procedures in router
      if (!options.skipProcedure && !flags.skipRegistration) {
        const regResult = await this.registerInRouter(
          projectRoot,
          entity,
          snapshot,
          flags.showSpinner
        );
        if (regResult.success) {
          result.procedureRegistered = true;
          result.modifiedFiles.push(...regResult.modifiedFiles);
        } else if (regResult.error) {
          result.errors.push(regResult.error);
        }
      }

      // Step 3: Run Prisma migration (if model was injected and migration not skipped)
      if (result.prismaInjected && !flags.skipMigration) {
        const migResult = await promptAndRunMigration({
          cwd: projectRoot,
          autoRun: flags.autoMigrate,
          skip: false,
        });
        result.migrationRun = migResult;
      }

      return result;
    } catch (err) {
      // Rollback on critical error
      if (flags.showSpinner) {
        console.log(pc.yellow('\n  Rolling back auto-registration changes...'));
      }
      rollback(snapshot, { verbose: flags.showSpinner });

      result.errors.push(err instanceof Error ? err.message : String(err));
      return result;
    }
  }

  /**
   * Inject Prisma model into schema.prisma
   */
  private async injectPrismaModel(
    projectRoot: string,
    entity: { pascal: string; camel: string },
    options: ResourceOptions,
    snapshot: FileSnapshot,
    showSpinner: boolean
  ): Promise<{ success: boolean; schemaPath?: string; error?: string }> {
    const schemaPath = findPrismaSchema(projectRoot);

    if (!schemaPath) {
      return {
        success: false,
        error: 'Prisma schema not found. Cannot auto-inject model.',
      };
    }

    let s: ReturnType<typeof p.spinner> | null = null;
    if (showSpinner) {
      s = p.spinner();
      s.start('Injecting Prisma model...');
    }

    try {
      // Analyze existing schema
      const analysis = analyzePrismaSchema(schemaPath);

      // Check if model already exists
      if (hasModel(analysis, entity.pascal)) {
        if (s) s.stop(pc.dim(`Model ${entity.pascal} already exists`));
        return { success: false, error: `Model ${entity.pascal} already exists in schema` };
      }

      // Generate injectable content
      const injectable = generateInjectablePrismaContent(entity, options);

      // Prepare model and enum definitions
      const models: PrismaModelDefinition[] = [
        { name: injectable.modelName, content: injectable.modelContent },
      ];

      // Use structured enum data directly (no fragile string splitting)
      const enums: PrismaEnumDefinition[] = injectable.enums.map((e) => ({
        name: e.name,
        content: e.content,
      }));

      // Save original for rollback
      saveOriginal(snapshot, schemaPath);

      // Inject into schema
      const injectionResult = injectIntoSchema(analysis, models, enums);

      // Write modified schema
      writeFileSync(schemaPath, injectionResult.content, 'utf-8');

      if (s) {
        const addedItems = [
          ...injectionResult.addedModels.map((m) => `model ${m}`),
          ...injectionResult.addedEnums.map((e) => `enum ${e}`),
        ];
        s.stop(pc.green(`Injected ${addedItems.join(', ')} into schema.prisma`));
      }

      return { success: true, schemaPath };
    } catch (err) {
      if (s) s.stop(pc.red('Failed to inject Prisma model'));
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Register procedures in router
   */
  private async registerInRouter(
    projectRoot: string,
    entity: { pascal: string; camel: string; kebab: string },
    snapshot: FileSnapshot,
    showSpinner: boolean
  ): Promise<{ success: boolean; modifiedFiles: string[]; error?: string }> {
    const procedureVar = `${entity.camel}Procedures`;

    // Check if already registered
    if (isProcedureRegistered(projectRoot, procedureVar)) {
      if (showSpinner) {
        console.log(pc.dim(`  ${procedureVar} already registered`));
      }
      return { success: false, modifiedFiles: [], error: `${procedureVar} already registered` };
    }

    let s: ReturnType<typeof p.spinner> | null = null;
    if (showSpinner) {
      s = p.spinner();
      s.start('Registering procedures in router...');
    }

    try {
      // Detect router pattern
      const pattern = detectRouterPattern(projectRoot);

      if (pattern.type === 'unknown') {
        if (s) s.stop(pc.dim('Could not detect router pattern'));
        return {
          success: false,
          modifiedFiles: [],
          error: 'Could not detect router pattern. Manual registration required.',
        };
      }

      // Save originals for rollback
      if (pattern.indexPath) {
        saveOriginal(snapshot, pattern.indexPath);
      }
      if (pattern.type === 'centralized') {
        saveOriginal(snapshot, pattern.proceduresIndexPath);
      }

      // Register procedures
      const result = registerProcedures(projectRoot, entity.kebab, procedureVar);

      if (result.success) {
        // Track modified files
        for (const file of result.modifiedFiles) {
          if (!snapshot.modifiedFiles.has(file)) {
            trackCreated(snapshot, file);
          }
        }

        if (s) {
          const actions: string[] = [];
          if (result.registrations.importAdded) actions.push('import added');
          if (result.registrations.addedToArray) actions.push('added to collections');
          if (result.registrations.addedToObject) actions.push('added to router');
          if (result.registrations.exportAdded) actions.push('export added');
          s.stop(pc.green(`Registered ${procedureVar} (${actions.join(', ')})`));
        }

        return { success: true, modifiedFiles: result.modifiedFiles };
      }

      if (s) s.stop(pc.dim(result.error || 'Registration failed'));
      return {
        success: false,
        modifiedFiles: [],
        error: result.error || 'Registration failed',
      };
    } catch (err) {
      if (s) s.stop(pc.red('Failed to register procedures'));
      return {
        success: false,
        modifiedFiles: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Build post-instructions based on what was auto-done
   */
  private buildPostInstructions(
    entityName: string,
    options: ResourceOptions,
    autoResult: AutoRegistrationResult
  ): string {
    const steps: string[] = [];
    let stepNum = 1;
    const lowerName = entityName.toLowerCase();
    const camelName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
    const hasFields = options.fields && options.fields.length > 0;
    const fieldCount = options.fields?.length ?? 0;

    // Show what was auto-done
    const autoDoneItems: string[] = [];
    if (autoResult.prismaInjected) {
      autoDoneItems.push('✓ Prisma model injected into schema.prisma');
    }
    if (autoResult.procedureRegistered) {
      autoDoneItems.push('✓ Procedures registered in router');
    }
    if (autoResult.migrationRun) {
      autoDoneItems.push('✓ Database schema updated');
    }

    if (autoDoneItems.length > 0) {
      steps.push(`Auto-completed:\n     ${autoDoneItems.join('\n     ')}`);
    }

    // Show any errors
    if (autoResult.errors.length > 0) {
      const errorItems = autoResult.errors.map((e) => `⚠ ${e}`);
      steps.push(`Notes:\n     ${errorItems.join('\n     ')}`);
    }

    // Manual steps still needed
    const manualSteps: string[] = [];

    // Prisma model (if not auto-injected)
    if (!options.skipModel && !autoResult.prismaInjected) {
      const fieldInfo = hasFields
        ? ` (${fieldCount} field${fieldCount === 1 ? '' : 's'} defined)`
        : '';
      manualSteps.push(`${stepNum}. Add the Prisma model to your schema${fieldInfo}:

     Copy the contents of src/models/${lowerName}.prisma
     into your prisma/schema.prisma file.`);
      stepNum++;
    }

    // Migration (if model was injected but migration wasn't run)
    if (autoResult.prismaInjected && !autoResult.migrationRun) {
      manualSteps.push(`${stepNum}. Push schema changes to database:

     npx prisma db push
     # or
     npx prisma migrate dev --name add_${lowerName}`);
      stepNum++;
    }

    // Zod schema review
    if (!options.skipSchema) {
      if (hasFields) {
        manualSteps.push(`${stepNum}. Review the Zod validation (optional):

     The schema at src/schemas/${lowerName}.schema.ts
     already includes your ${fieldCount} field${fieldCount === 1 ? '' : 's'}.
     Customize validation rules if needed.`);
      } else {
        manualSteps.push(`${stepNum}. Add fields to the Zod schema:

     Edit src/schemas/${lowerName}.schema.ts
     to define your validation schema.`);
      }
      stepNum++;
    }

    // Register procedures (if not auto-registered)
    if (!options.skipProcedure && !autoResult.procedureRegistered) {
      manualSteps.push(`${stepNum}. Register the procedures in your router:

     import { ${camelName}Procedures } from './procedures/${lowerName}.js';

     // Add to your router
     const router = createRouter({
       ${camelName}: ${camelName}Procedures,
     });`);
      stepNum++;
    }

    // Run tests
    if (options.withTests) {
      manualSteps.push(`${stepNum}. Run the tests:

     pnpm test src/procedures/__tests__/${lowerName}.test.ts`);
      stepNum++;
    }

    // API endpoints summary
    manualSteps.push(`${stepNum}. Your ${entityName} API is ready:

     GET    /api/${lowerName}s      - List all
     GET    /api/${lowerName}s/:id  - Get by ID
     POST   /api/${lowerName}s      - Create new
     PUT    /api/${lowerName}s/:id  - Full update
     PATCH  /api/${lowerName}s/:id  - Partial update
     DELETE /api/${lowerName}s/:id  - Delete`);

    if (manualSteps.length > 0) {
      steps.push(...manualSteps);
    }

    return `\n  ${steps.join('\n\n  ')}`;
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
