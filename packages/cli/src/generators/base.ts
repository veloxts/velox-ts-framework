/**
 * Base Generator Infrastructure
 *
 * Core utilities and base class for all VeloxTS code generators.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type {
  ConflictStrategy,
  Generator,
  GeneratorConfig,
  GeneratorMetadata,
  GeneratorOption,
  GeneratorOutput,
  ProjectContext,
  ProjectType,
  TemplateContext,
} from './types.js';
import { GeneratorError, GeneratorErrorCode } from './types.js';
import { deriveEntityNames } from './utils/naming.js';

// ============================================================================
// Project Detection
// ============================================================================

/**
 * Markers that indicate a VeloxTS project
 */
const VELOX_PROJECT_MARKERS = ['@veloxts/velox', '@veloxts/core', '@veloxts/router'] as const;

/**
 * Ensure the current directory is a VeloxTS project
 *
 * @throws GeneratorError if not in a VeloxTS project
 */
export async function ensureVeloxProject(cwd: string): Promise<void> {
  const packageJsonPath = join(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    throw new GeneratorError(
      GeneratorErrorCode.NOT_IN_PROJECT,
      'No package.json found. Are you in a VeloxTS project?',
      'Run this command from the root of your VeloxTS project, or create a new project with: npx create-velox-app my-app'
    );
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const hasVeloxMarker = VELOX_PROJECT_MARKERS.some((marker) => marker in dependencies);

  if (!hasVeloxMarker) {
    throw new GeneratorError(
      GeneratorErrorCode.NOT_IN_PROJECT,
      'This does not appear to be a VeloxTS project.',
      'VeloxTS packages not found in dependencies. Create a new project with: npx create-velox-app my-app'
    );
  }
}

/**
 * Markers that indicate a Vinxi/RSC project
 */
const VINXI_PROJECT_MARKERS = ['vinxi', '@vinxi/server-functions', '@veloxts/web'] as const;

/**
 * Detect project configuration from package.json and velox config
 */
export async function detectProjectContext(cwd: string): Promise<ProjectContext> {
  const packageJsonPath = join(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return {
      name: 'unknown',
      hasAuth: false,
      database: 'sqlite',
      projectType: 'api',
      isVinxiProject: false,
      hasWeb: false,
    };
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  // Detect auth package
  const hasAuth = '@veloxts/auth' in dependencies;

  // Detect web package
  const hasWeb = '@veloxts/web' in dependencies;

  // Detect database from Prisma schema or default to SQLite
  const database = detectDatabase(cwd);

  // Detect Vinxi project by checking markers or app.config.ts
  const hasVinxiMarker = VINXI_PROJECT_MARKERS.some((marker) => marker in dependencies);
  const hasAppConfig =
    existsSync(join(cwd, 'app.config.ts')) || existsSync(join(cwd, 'app.config.js'));
  const isVinxiProject = hasVinxiMarker || hasAppConfig;

  // Detect project type
  const hasAppPagesDir = existsSync(join(cwd, 'app', 'pages'));
  const projectType: ProjectType = isVinxiProject || hasAppPagesDir ? 'fullstack' : 'api';

  // Detect directory structure
  const pagesDir = projectType === 'fullstack' ? 'app/pages' : undefined;
  const layoutsDir = projectType === 'fullstack' ? 'app/layouts' : undefined;
  const actionsDir = projectType === 'fullstack' ? 'app/actions' : 'src/actions';

  return {
    name: packageJson.name ?? 'velox-app',
    hasAuth,
    database,
    projectType,
    isVinxiProject,
    hasWeb,
    pagesDir,
    layoutsDir,
    actionsDir,
  };
}

/**
 * Detect database type from Prisma schema
 */
function detectDatabase(cwd: string): 'sqlite' | 'postgresql' | 'mysql' {
  const prismaSchemaPath = join(cwd, 'prisma', 'schema.prisma');

  if (!existsSync(prismaSchemaPath)) {
    return 'sqlite';
  }

  const schema = readFileSync(prismaSchemaPath, 'utf-8');

  if (schema.includes('provider = "postgresql"') || schema.includes('provider = "postgres"')) {
    return 'postgresql';
  }

  if (schema.includes('provider = "mysql"')) {
    return 'mysql';
  }

  return 'sqlite';
}

// ============================================================================
// Entity Name Validation
// ============================================================================

/**
 * Reserved words that cannot be used as entity names
 */
const RESERVED_WORDS = new Set([
  // JavaScript/TypeScript keywords
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'null',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'async',
  'await',
  'implements',
  'interface',
  'package',
  'private',
  'protected',
  'public',
  'type',
  'any',
  'unknown',
  'never',
  'object',
  'string',
  'number',
  'boolean',
  'symbol',
  'bigint',

  // VeloxTS reserved
  'procedure',
  'procedures',
  'context',
  'router',
  'velox',
  'api',
  'query',
  'mutation',
  'input',
  'output',
  'guard',
  'middleware',
]);

/**
 * Validate entity name format
 *
 * @returns Error message if invalid, undefined if valid
 */
export function validateEntityNameDefault(name: string): string | undefined {
  // Must not be empty
  if (!name || name.trim().length === 0) {
    return 'Entity name cannot be empty';
  }

  // Must start with a letter
  if (!/^[a-zA-Z]/.test(name)) {
    return 'Entity name must start with a letter';
  }

  // Can only contain letters, numbers, hyphens, underscores
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    return 'Entity name can only contain letters, numbers, hyphens, and underscores';
  }

  // Must not be too long
  if (name.length > 64) {
    return 'Entity name must be 64 characters or less';
  }

  // Must not be a reserved word
  const lower = name.toLowerCase();
  if (RESERVED_WORDS.has(lower)) {
    return `"${name}" is a reserved word and cannot be used as an entity name`;
  }

  return undefined;
}

// ============================================================================
// Base Generator Class
// ============================================================================

/**
 * Abstract base class for all generators.
 * Provides common functionality and enforces the generator contract.
 */
export abstract class BaseGenerator<TOptions = Record<string, unknown>>
  implements Generator<TOptions>
{
  abstract readonly metadata: GeneratorMetadata;
  abstract readonly options: ReadonlyArray<GeneratorOption>;

  /**
   * Default entity name validation.
   * Override in subclasses for custom validation.
   */
  validateEntityName(name: string): string | undefined {
    return validateEntityNameDefault(name);
  }

  /**
   * Validate and transform raw CLI options to typed options.
   * Override in subclasses to implement option validation.
   */
  abstract validateOptions(raw: Record<string, unknown>): TOptions;

  /**
   * Generate files based on configuration.
   * Must be implemented by subclasses.
   */
  abstract generate(config: GeneratorConfig<TOptions>): Promise<GeneratorOutput>;

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Create a template context for generation
   */
  protected createContext(config: GeneratorConfig<TOptions>): TemplateContext<TOptions> {
    return {
      entity: deriveEntityNames(config.entityName),
      project: config.project,
      options: config.options,
    };
  }

  /**
   * Resolve output path relative to project root
   */
  protected resolvePath(cwd: string, relativePath: string): string {
    return resolve(cwd, relativePath);
  }

  /**
   * Check if a file would conflict (exists and shouldn't be overwritten)
   */
  protected wouldConflict(filePath: string, strategy: ConflictStrategy, force: boolean): boolean {
    if (force) {
      return false;
    }

    if (!existsSync(filePath)) {
      return false;
    }

    return strategy !== 'overwrite';
  }

  /**
   * Format a success message for generated files
   */
  protected formatSuccessMessage(files: ReadonlyArray<{ path: string }>, dryRun: boolean): string {
    const prefix = dryRun ? '[dry-run] Would create' : 'Created';
    const fileList = files.map((f) => `  • ${f.path}`).join('\n');
    return `${prefix}:\n${fileList}`;
  }
}

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Default generator configuration
 */
export function createDefaultConfig<TOptions>(
  entityName: string,
  options: TOptions,
  project: ProjectContext
): Omit<GeneratorConfig<TOptions>, 'cwd'> {
  return {
    entityName,
    options,
    conflictStrategy: 'prompt',
    dryRun: false,
    force: false,
    project,
  };
}

/**
 * Apply CLI flags to generator config
 */
export function applyCliFlags<TOptions>(
  config: GeneratorConfig<TOptions>,
  flags: {
    dryRun?: boolean;
    force?: boolean;
    json?: boolean;
  }
): GeneratorConfig<TOptions> {
  return {
    ...config,
    dryRun: flags.dryRun ?? config.dryRun,
    force: flags.force ?? config.force,
    conflictStrategy: flags.force ? 'overwrite' : config.conflictStrategy,
  };
}
