/**
 * Generator Types
 *
 * Core type definitions for the VeloxTS code generator system.
 */

// ============================================================================
// Entity Naming
// ============================================================================

/**
 * All naming variations for an entity.
 * Derived from a single input name (e.g., "User", "BlogPost").
 */
export interface EntityNames {
  /** Original input: "User" or "user" */
  readonly raw: string;

  /** PascalCase: "User", "BlogPost" */
  readonly pascal: string;

  /** camelCase: "user", "blogPost" */
  readonly camel: string;

  /** kebab-case: "user", "blog-post" */
  readonly kebab: string;

  /** snake_case: "user", "blog_post" */
  readonly snake: string;

  /** SCREAMING_SNAKE_CASE: "USER", "BLOG_POST" */
  readonly screamingSnake: string;

  /** Singular camelCase: "user", "blogPost" */
  readonly singular: string;

  /** Plural camelCase: "users", "blogPosts" */
  readonly plural: string;

  /** PascalCase plural: "Users", "BlogPosts" */
  readonly pascalPlural: string;

  /** Human readable: "User", "Blog Post" */
  readonly humanReadable: string;

  /** Human readable plural: "Users", "Blog Posts" */
  readonly humanReadablePlural: string;
}

// ============================================================================
// Template Context
// ============================================================================

/**
 * Project-level context for template generation
 */
export interface ProjectContext {
  /** Project name from package.json */
  readonly name: string;

  /** Whether @veloxts/auth is installed */
  readonly hasAuth: boolean;

  /** Database type from configuration */
  readonly database: 'sqlite' | 'postgresql' | 'mysql';
}

/**
 * Context available to all templates
 */
export interface TemplateContext<TOptions = Record<string, unknown>> {
  /** Entity naming variations */
  readonly entity: EntityNames;

  /** Project-level context */
  readonly project: ProjectContext;

  /** Generator-specific options */
  readonly options: TOptions;
}

/**
 * A template function that generates file content
 */
export type TemplateFunction<TOptions = Record<string, unknown>> = (
  context: TemplateContext<TOptions>
) => string;

// ============================================================================
// Generator Output
// ============================================================================

/**
 * A single file to be generated
 */
export interface GeneratedFile {
  /** Relative path from project root (e.g., "src/procedures/users.ts") */
  readonly path: string;

  /** File content */
  readonly content: string;

  /** Whether to skip if file exists (default: false, will prompt) */
  readonly skipIfExists?: boolean;
}

/**
 * Output from a generator - one or more files to create
 */
export interface GeneratorOutput {
  /** Files to generate */
  readonly files: ReadonlyArray<GeneratedFile>;

  /** Instructions to show after generation */
  readonly postInstructions?: string;
}

// ============================================================================
// Generator Metadata & Options
// ============================================================================

/**
 * Generator category for grouping in help
 */
export type GeneratorCategory = 'resource' | 'database' | 'test' | 'composite';

/**
 * Generator metadata for CLI registration
 */
export interface GeneratorMetadata {
  /** Generator name (used in CLI: velox generate <name>) */
  readonly name: string;

  /** Short description for help text */
  readonly description: string;

  /** Longer description with examples */
  readonly longDescription?: string;

  /** Aliases (e.g., 'p' for 'procedure') */
  readonly aliases?: ReadonlyArray<string>;

  /** Category for grouping in help */
  readonly category: GeneratorCategory;
}

/**
 * Option type for generator options
 */
export type GeneratorOptionType = 'boolean' | 'string' | 'number' | 'array';

/**
 * Generator option definition
 */
export interface GeneratorOption<T = unknown> {
  /** Option name (used as --name in CLI) */
  readonly name: string;

  /** Short flag (e.g., 'c' for --crud) */
  readonly short?: string;

  /** Commander.js style flag (e.g., '-c, --crud' or '--skip-model') */
  readonly flag?: string;

  /** Description for help text */
  readonly description: string;

  /** Default value */
  readonly default?: T;

  /** Whether this option is required */
  readonly required?: boolean;

  /** Type of the option */
  readonly type: GeneratorOptionType;

  /** Choices for string options */
  readonly choices?: ReadonlyArray<string>;
}

// ============================================================================
// Conflict Handling
// ============================================================================

/**
 * Strategy for handling file conflicts
 */
export type ConflictStrategy = 'prompt' | 'skip' | 'overwrite' | 'error';

// ============================================================================
// Generator Configuration
// ============================================================================

/**
 * Configuration passed from CLI to generator
 */
export interface GeneratorConfig<TOptions = Record<string, unknown>> {
  /** Entity name from positional argument */
  readonly entityName: string;

  /** Parsed and validated CLI options */
  readonly options: TOptions;

  /** Conflict handling strategy */
  readonly conflictStrategy: ConflictStrategy;

  /** Dry run mode - don't write files */
  readonly dryRun: boolean;

  /** Force overwrite without prompting */
  readonly force: boolean;

  /** Working directory (project root) */
  readonly cwd: string;

  /** Project context (detected from package.json) */
  readonly project: ProjectContext;
}

// ============================================================================
// Generator Interface
// ============================================================================

/**
 * Generator interface - all generators implement this
 */
export interface Generator<TOptions = Record<string, unknown>> {
  /** Generator metadata */
  readonly metadata: GeneratorMetadata;

  /** Option definitions */
  readonly options: ReadonlyArray<GeneratorOption>;

  /**
   * Validate the entity name
   * @returns Error message if invalid, undefined if valid
   */
  validateEntityName(name: string): string | undefined;

  /**
   * Validate and transform raw options to typed options
   * @throws Error if options are invalid
   */
  validateOptions(raw: Record<string, unknown>): TOptions;

  /**
   * Generate files based on configuration
   */
  generate(config: GeneratorConfig<TOptions>): Promise<GeneratorOutput>;
}

/**
 * Type-erased generator alias for registry storage.
 * Used when storing heterogeneous generators with different option types.
 *
 * The `any` type is intentionally used here because:
 * 1. Generator<T> is invariant in T due to both covariant (validateOptions return)
 *    and contravariant (generate config parameter) positions
 * 2. We need to store generators with different TOptions in a single collection
 * 3. Type safety is maintained at the call site through validateOptions()
 *
 * This is a legitimate use of type erasure where the type information is
 * recovered through runtime validation before use.
 */
// biome-ignore lint/suspicious/noExplicitAny: Type erasure for heterogeneous generator storage - see comment above
export type AnyGenerator = Generator<any>;

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Error codes for generator errors (for AI/tooling integration)
 */
export enum GeneratorErrorCode {
  NOT_IN_PROJECT = 'E2001',
  INVALID_ENTITY_NAME = 'E2002',
  FILE_ALREADY_EXISTS = 'E2003',
  INVALID_OPTION = 'E2004',
  GENERATION_FAILED = 'E2005',
  CANCELED = 'E2006',
}

/**
 * Structured generator error with code and optional fix suggestion
 */
export class GeneratorError extends Error {
  constructor(
    public readonly code: GeneratorErrorCode,
    message: string,
    public readonly fix?: string
  ) {
    super(message);
    this.name = 'GeneratorError';
  }

  /**
   * Format error for display
   */
  format(): string {
    let output = `GeneratorError[${this.code}]: ${this.message}`;
    if (this.fix) {
      output += `\n\n  Fix: ${this.fix}`;
    }
    return output;
  }

  /**
   * Convert to JSON for --json output
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      fix: this.fix,
    };
  }
}
