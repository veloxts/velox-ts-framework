/**
 * Seeding Types
 *
 * Core type definitions for the VeloxTS database seeding system.
 */

import type { PrismaClientLike } from '../migrations/types.js';

// Re-export for convenience
export type { PrismaClientLike };

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Valid environment names for seeder filtering
 */
export type Environment = 'development' | 'production' | 'test';

// ============================================================================
// Seeder Logger
// ============================================================================

/**
 * Logger interface for seeder output
 */
export interface SeederLogger {
  /** Log informational message */
  info(message: string): void;

  /** Log success message */
  success(message: string): void;

  /** Log warning message */
  warning(message: string): void;

  /** Log error message */
  error(message: string): void;

  /** Log debug message (only in verbose mode) */
  debug(message: string): void;
}

// ============================================================================
// Factory Types
// ============================================================================

/**
 * Factory interface for creating model instances with fake data.
 *
 * @template TInput - The input type for creating records
 * @template TOutput - The output type returned from database (defaults to TInput)
 *
 * @example
 * ```typescript
 * const users = await factory.get(UserFactory).create(10);
 * const admin = await factory.get(UserFactory).state('admin').create();
 * ```
 */
export interface Factory<TInput extends Record<string, unknown>, TOutput = TInput> {
  /** Model name for Prisma operations (e.g., 'user', 'post') */
  readonly modelName: string;

  /** Define default attributes for new instances */
  definition(): TInput;

  /**
   * Create a single instance in the database
   * @param overrides - Attributes to override defaults
   */
  create(overrides?: Partial<TInput>): Promise<TOutput>;

  /**
   * Create multiple instances in the database
   * @param count - Number of instances to create
   * @param overrides - Attributes to override defaults for all instances
   */
  createMany(count: number, overrides?: Partial<TInput>): Promise<TOutput[]>;

  /**
   * Make a single instance without persisting to database
   * @param overrides - Attributes to override defaults
   */
  make(overrides?: Partial<TInput>): TInput;

  /**
   * Make multiple instances without persisting to database
   * @param count - Number of instances to make
   * @param overrides - Attributes to override defaults for all instances
   */
  makeMany(count: number, overrides?: Partial<TInput>): TInput[];

  /**
   * Apply a named state modifier
   * @param name - State name to apply
   * @returns New factory instance with state applied
   */
  state(name: string): Factory<TInput, TOutput>;

  /**
   * Get list of available state names
   */
  getAvailableStates(): ReadonlyArray<string>;
}

/**
 * State modifier function type
 */
export type StateModifier<TInput> = (attrs: TInput) => Partial<TInput>;

/**
 * Factory constructor type for registry
 */
export interface FactoryConstructor<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = TInput,
> {
  new (prisma: PrismaClientLike): Factory<TInput, TOutput>;
}

// ============================================================================
// Factory Registry Types
// ============================================================================

/**
 * Registry for managing factory instances
 */
export interface FactoryRegistry {
  /**
   * Get or create a factory instance
   * @param FactoryClass - The factory constructor class
   */
  get<TInput extends Record<string, unknown>, TOutput = TInput>(
    FactoryClass: FactoryConstructor<TInput, TOutput>
  ): Factory<TInput, TOutput>;

  /**
   * Clear all cached factory instances
   */
  clear(): void;
}

// ============================================================================
// Seeder Types
// ============================================================================

/**
 * Context passed to seeders during execution.
 *
 * Provides access to database, factories, and logging utilities.
 */
export interface SeederContext {
  /** Prisma client for database operations */
  readonly db: PrismaClientLike;

  /** Factory registry for creating fake data */
  readonly factory: FactoryRegistry;

  /** Current environment (development, production, test) */
  readonly environment: Environment;

  /** Logger for seeder output */
  readonly log: SeederLogger;

  /**
   * Run another seeder (for composition)
   * @param seeder - Seeder to run
   */
  runSeeder(seeder: Seeder): Promise<void>;
}

/**
 * Base seeder interface - all seeders implement this.
 *
 * @example
 * ```typescript
 * export const UserSeeder: Seeder = {
 *   name: 'UserSeeder',
 *   dependencies: ['RoleSeeder'],
 *
 *   async run({ db, factory, log }) {
 *     await factory.get(UserFactory).createMany(10);
 *     log.success('Created 10 users');
 *   },
 * };
 * ```
 */
export interface Seeder {
  /** Unique seeder name (e.g., 'UserSeeder') */
  readonly name: string;

  /**
   * Seeders that must run before this one.
   * Used for dependency resolution and execution ordering.
   */
  readonly dependencies?: ReadonlyArray<string>;

  /**
   * Environments this seeder runs in.
   * If not specified, runs in all environments.
   */
  readonly environments?: ReadonlyArray<Environment>;

  /**
   * Run the seeder - populate data.
   * @param context - Seeder execution context
   */
  run(context: SeederContext): Promise<void>;

  /**
   * Optional: Truncate related tables before seeding.
   * Called when running with --fresh flag.
   * @param context - Seeder execution context
   */
  truncate?(context: SeederContext): Promise<void>;
}

// ============================================================================
// Seeder Registry Types
// ============================================================================

/**
 * Result of seeder execution
 */
export interface SeederResult {
  /** Seeder name */
  readonly name: string;

  /** Whether execution succeeded */
  readonly success: boolean;

  /** Duration in milliseconds */
  readonly duration: number;

  /** Error message if failed */
  readonly error?: string;

  /** Number of records created (if tracked) */
  readonly recordsCreated?: number;
}

/**
 * Result of batch seeder execution
 */
export interface BatchSeederResult {
  /** Individual seeder results */
  readonly results: ReadonlyArray<SeederResult>;

  /** Total seeders executed */
  readonly total: number;

  /** Number of successful seeders */
  readonly successful: number;

  /** Number of failed seeders */
  readonly failed: number;

  /** Number of skipped seeders */
  readonly skipped: number;

  /** Total duration in milliseconds */
  readonly duration: number;
}

// ============================================================================
// Command Options
// ============================================================================

/**
 * Options for db:seed command
 */
export interface SeedCommandOptions {
  /** Run truncate before seeding (fresh seed) */
  readonly fresh?: boolean;

  /** Run specific seeder class by name */
  readonly class?: string;

  /** Skip confirmation in production */
  readonly force?: boolean;

  /** Show what would run without executing */
  readonly dryRun?: boolean;

  /** Output as JSON */
  readonly json?: boolean;

  /** Verbose output */
  readonly verbose?: boolean;
}

/**
 * Options for seeder runner
 */
export interface SeederRunOptions {
  /** Run truncate before seeding */
  readonly fresh?: boolean;

  /** Specific seeders to run (by name) */
  readonly only?: ReadonlyArray<string>;

  /** Show what would run without executing */
  readonly dryRun?: boolean;

  /** Verbose output */
  readonly verbose?: boolean;

  /** Current environment */
  readonly environment?: Environment;
}

// ============================================================================
// Loader Types
// ============================================================================

/**
 * Loaded seeder from filesystem
 */
export interface LoadedSeeder {
  /** Seeder instance */
  readonly seeder: Seeder;

  /** File path where seeder was loaded from */
  readonly filePath: string;
}

/**
 * Result of loading seeders from filesystem
 */
export interface SeederLoadResult {
  /** Successfully loaded seeders */
  readonly seeders: ReadonlyArray<LoadedSeeder>;

  /** Files that failed to load */
  readonly errors: ReadonlyArray<{
    readonly filePath: string;
    readonly error: string;
  }>;
}
