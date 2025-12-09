/**
 * Seeder Runner
 *
 * Executes seeders with dependency resolution, logging, and error handling.
 */

import { executionFailed, seederDatabaseError, truncationFailed } from './errors.js';
import { createFactoryRegistry } from './factory.js';
import type { SeederRegistry } from './registry.js';
import type {
  BatchSeederResult,
  Environment,
  FactoryRegistry,
  PrismaClientLike,
  Seeder,
  SeederContext,
  SeederLogger,
  SeederResult,
  SeederRunOptions,
} from './types.js';

// ============================================================================
// Seeder Runner
// ============================================================================

/**
 * Seeder execution runner.
 *
 * Handles running seeders in correct dependency order with proper
 * context, logging, and error handling.
 *
 * @example
 * ```typescript
 * const runner = new SeederRunner(prisma, registry);
 *
 * // Run all seeders
 * const result = await runner.runAll();
 *
 * // Run specific seeders
 * const result = await runner.run(['UserSeeder', 'PostSeeder']);
 *
 * // Fresh seed (truncate first)
 * const result = await runner.fresh();
 * ```
 */
export class SeederRunner {
  private readonly prisma: PrismaClientLike;
  private readonly registry: SeederRegistry;
  private readonly factoryRegistry: FactoryRegistry;

  constructor(prisma: PrismaClientLike, registry: SeederRegistry) {
    this.prisma = prisma;
    this.registry = registry;
    this.factoryRegistry = createFactoryRegistry(prisma);
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Run all registered seeders in dependency order.
   *
   * @param options - Run options
   * @returns Batch result with individual seeder results
   */
  async runAll(options: SeederRunOptions = {}): Promise<BatchSeederResult> {
    const environment = options.environment ?? this.detectEnvironment();
    const seeders = this.registry.getInOrder(environment);

    return this.executeSeeders(seeders, options);
  }

  /**
   * Run specific seeders by name (includes their dependencies).
   *
   * @param names - Seeder names to run
   * @param options - Run options
   * @returns Batch result with individual seeder results
   */
  async run(names: string[], options: SeederRunOptions = {}): Promise<BatchSeederResult> {
    const environment = options.environment ?? this.detectEnvironment();
    const seeders = this.registry.getByNames(names, environment);

    return this.executeSeeders(seeders, options);
  }

  /**
   * Run seeders with fresh (truncate tables first).
   *
   * Calls truncate() on each seeder in reverse order, then runs them.
   *
   * @param options - Run options
   * @returns Batch result with individual seeder results
   */
  async fresh(options: SeederRunOptions = {}): Promise<BatchSeederResult> {
    const environment = options.environment ?? this.detectEnvironment();
    const seeders = this.registry.getInOrder(environment);

    // Truncate in reverse order (dependents first)
    if (!options.dryRun) {
      await this.truncateSeeders([...seeders].reverse(), options);
    }

    return this.executeSeeders(seeders, options);
  }

  // ==========================================================================
  // Execution
  // ==========================================================================

  /**
   * Execute a list of seeders in order.
   */
  private async executeSeeders(
    seeders: Seeder[],
    options: SeederRunOptions
  ): Promise<BatchSeederResult> {
    const startTime = Date.now();
    const results: SeederResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const seeder of seeders) {
      const result = await this.executeSeeder(seeder, options);
      results.push(result);

      if (result.success) {
        successful++;
      } else {
        failed++;
        // Stop on first failure to prevent cascading errors
        break;
      }
    }

    // Calculate skipped as seeders that weren't executed due to early failure
    const skipped = seeders.length - results.length;

    return {
      results,
      total: seeders.length,
      successful,
      failed,
      skipped,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Execute a single seeder.
   */
  private async executeSeeder(seeder: Seeder, options: SeederRunOptions): Promise<SeederResult> {
    const startTime = Date.now();

    // Dry run - just report what would run
    if (options.dryRun) {
      return {
        name: seeder.name,
        success: true,
        duration: 0,
      };
    }

    // Create context for this seeder
    const context = this.createContext(seeder, options);

    try {
      await seeder.run(context);

      return {
        name: seeder.name,
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      return {
        name: seeder.name,
        success: false,
        duration: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  /**
   * Truncate tables for seeders that implement truncate().
   */
  private async truncateSeeders(seeders: Seeder[], options: SeederRunOptions): Promise<void> {
    for (const seeder of seeders) {
      if (seeder.truncate) {
        const context = this.createContext(seeder, options);

        try {
          await seeder.truncate(context);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          throw truncationFailed(seeder.name, err);
        }
      }
    }
  }

  // ==========================================================================
  // Context Creation
  // ==========================================================================

  /**
   * Create execution context for a seeder.
   */
  private createContext(seeder: Seeder, options: SeederRunOptions): SeederContext {
    const environment = options.environment ?? this.detectEnvironment();
    const log = this.createLogger(seeder.name, options);

    // Capture `this` for runSeeder closure
    const runner = this;

    return {
      db: this.prisma,
      factory: this.factoryRegistry,
      environment,
      log,

      async runSeeder(innerSeeder: Seeder): Promise<void> {
        const innerContext = runner.createContext(innerSeeder, options);
        try {
          await innerSeeder.run(innerContext);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          throw executionFailed(innerSeeder.name, err);
        }
      },
    };
  }

  /**
   * Create logger for a seeder.
   */
  private createLogger(seederName: string, options: SeederRunOptions): SeederLogger {
    const prefix = `[${seederName}]`;
    const verbose = options.verbose ?? false;

    return {
      info(message: string): void {
        console.log(`${prefix} ${message}`);
      },

      success(message: string): void {
        console.log(`${prefix} \u2714 ${message}`);
      },

      warning(message: string): void {
        console.log(`${prefix} \u26A0 ${message}`);
      },

      error(message: string): void {
        console.error(`${prefix} \u2718 ${message}`);
      },

      debug(message: string): void {
        if (verbose) {
          console.log(`${prefix} [debug] ${message}`);
        }
      },
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Detect current environment from NODE_ENV.
   */
  private detectEnvironment(): Environment {
    const env = process.env.NODE_ENV;

    switch (env) {
      case 'production':
        return 'production';
      case 'test':
        return 'test';
      default:
        return 'development';
    }
  }

  /**
   * Test database connection.
   *
   * @throws SeederError if connection fails
   */
  async testConnection(): Promise<void> {
    try {
      // Execute a simple query to test connection
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw seederDatabaseError('connection test', err);
    }
  }
}
