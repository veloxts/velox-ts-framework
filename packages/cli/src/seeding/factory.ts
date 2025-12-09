/**
 * Factory System
 *
 * Base factory class and registry for generating fake data.
 */

import { factoryCreateFailed, stateNotFound } from './errors.js';
import type {
  Factory,
  FactoryConstructor,
  FactoryRegistry,
  PrismaClientLike,
  StateModifier,
} from './types.js';

// ============================================================================
// Prisma Model Types (for dynamic model access)
// ============================================================================

/**
 * Minimal Prisma model delegate interface for create operations.
 * Used for type-safe dynamic model access without depending on generated types.
 */
interface PrismaModelDelegate<TData, TResult> {
  create(args: { data: TData }): Promise<TResult>;
}

/**
 * Type for Prisma client with dynamic model access.
 * Maps model names to their delegates.
 */
type PrismaClientWithModels<TInput, TOutput> = Record<
  string,
  PrismaModelDelegate<TInput, TOutput> | undefined
>;

// ============================================================================
// Base Factory
// ============================================================================

/**
 * Abstract base class for model factories.
 *
 * Provides a fluent API for creating model instances with fake data
 * and named state variations.
 *
 * @template TInput - The input type for creating records
 * @template TOutput - The output type returned from database (defaults to TInput)
 *
 * @example
 * ```typescript
 * import { BaseFactory } from '@veloxts/cli';
 * import { faker } from '@faker-js/faker';
 *
 * interface UserInput {
 *   email: string;
 *   name: string;
 *   role: 'admin' | 'user';
 * }
 *
 * export class UserFactory extends BaseFactory<UserInput> {
 *   modelName = 'user';
 *
 *   definition(): UserInput {
 *     return {
 *       email: faker.internet.email(),
 *       name: faker.person.fullName(),
 *       role: 'user',
 *     };
 *   }
 *
 *   admin(): this {
 *     return this.state('admin');
 *   }
 *
 *   constructor(prisma: PrismaClientLike) {
 *     super(prisma);
 *     this.registerState('admin', (attrs) => ({ ...attrs, role: 'admin' }));
 *   }
 * }
 * ```
 */
export abstract class BaseFactory<TInput extends Record<string, unknown>, TOutput = TInput>
  implements Factory<TInput, TOutput>
{
  /** Map of registered state modifiers */
  protected states: Map<string, StateModifier<TInput>> = new Map();

  /** Currently active state names */
  protected activeStates: string[] = [];

  /** Prisma client for database operations */
  protected readonly prisma: PrismaClientLike;

  /**
   * Model name for Prisma operations (e.g., 'user', 'post').
   * Must match the lowercase model name in your Prisma schema.
   */
  abstract readonly modelName: string;

  /**
   * Define default attributes for new instances.
   * Override this method to provide fake data generation.
   */
  abstract definition(): TInput;

  constructor(prisma: PrismaClientLike) {
    this.prisma = prisma;
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Register a named state modifier.
   *
   * @param name - State name (e.g., 'admin', 'verified')
   * @param modifier - Function that modifies attributes
   * @returns this for chaining during construction
   *
   * @example
   * ```typescript
   * constructor(prisma: PrismaClientLike) {
   *   super(prisma);
   *   this.registerState('admin', (attrs) => ({ ...attrs, role: 'admin' }));
   *   this.registerState('unverified', (attrs) => ({ ...attrs, emailVerified: null }));
   * }
   * ```
   */
  protected registerState(name: string, modifier: StateModifier<TInput>): this {
    this.states.set(name, modifier);
    return this;
  }

  /**
   * Apply a named state modifier.
   * Returns a new factory instance with the state applied.
   *
   * @param name - State name to apply
   * @returns New factory instance with state active
   *
   * @example
   * ```typescript
   * // Create an admin user
   * await factory.get(UserFactory).state('admin').create();
   *
   * // Chain multiple states
   * await factory.get(UserFactory).state('admin').state('verified').create();
   * ```
   */
  state(name: string): Factory<TInput, TOutput> {
    if (!this.states.has(name)) {
      throw stateNotFound(this.constructor.name, name, Array.from(this.states.keys()));
    }

    // Create a shallow clone with the state added
    const clone = Object.create(Object.getPrototypeOf(this)) as this;
    Object.assign(clone, this);
    clone.states = new Map(this.states);
    clone.activeStates = [...this.activeStates, name];
    return clone;
  }

  /**
   * Get list of available state names.
   */
  getAvailableStates(): ReadonlyArray<string> {
    return Array.from(this.states.keys());
  }

  // ==========================================================================
  // Make (without persisting)
  // ==========================================================================

  /**
   * Make a single instance without persisting to database.
   *
   * @param overrides - Attributes to override defaults
   * @returns Generated attributes
   */
  make(overrides?: Partial<TInput>): TInput {
    return this.buildAttributes(overrides);
  }

  /**
   * Make multiple instances without persisting to database.
   *
   * @param count - Number of instances to make
   * @param overrides - Attributes to override defaults for all instances
   * @returns Array of generated attributes
   */
  makeMany(count: number, overrides?: Partial<TInput>): TInput[] {
    return Array.from({ length: count }, () => this.buildAttributes(overrides));
  }

  // ==========================================================================
  // Create (persist to database)
  // ==========================================================================

  /**
   * Create a single instance in the database.
   *
   * @param overrides - Attributes to override defaults
   * @returns Created database record
   */
  async create(overrides?: Partial<TInput>): Promise<TOutput> {
    const data = this.buildAttributes(overrides);

    try {
      // Access Prisma model dynamically with type-safe casting
      // We use unknown as intermediate to avoid any, then cast to our defined type
      const prismaWithModels = this.prisma as unknown as PrismaClientWithModels<TInput, TOutput>;
      const model = prismaWithModels[this.modelName];

      if (!model || typeof model.create !== 'function') {
        throw new Error(`Model '${this.modelName}' not found on Prisma client`);
      }

      return await model.create({ data });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw factoryCreateFailed(this.modelName, err);
    }
  }

  /**
   * Create multiple instances in the database.
   *
   * @param count - Number of instances to create
   * @param overrides - Attributes to override defaults for all instances
   * @returns Array of created database records
   */
  async createMany(count: number, overrides?: Partial<TInput>): Promise<TOutput[]> {
    const results: TOutput[] = [];

    // Create individually to get all returned records
    // (createMany doesn't return created records in some databases)
    for (let i = 0; i < count; i++) {
      const record = await this.create(overrides);
      results.push(record);
    }

    return results;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Build attributes by applying definition, states, and overrides.
   */
  private buildAttributes(overrides?: Partial<TInput>): TInput {
    // Start with definition
    let attrs = this.definition();

    // Apply active states in order
    for (const stateName of this.activeStates) {
      const modifier = this.states.get(stateName);
      if (modifier) {
        attrs = { ...attrs, ...modifier(attrs) };
      }
    }

    // Apply overrides last
    if (overrides) {
      attrs = { ...attrs, ...overrides };
    }

    return attrs;
  }
}

// ============================================================================
// Factory Registry
// ============================================================================

/**
 * Create a factory registry for managing factory instances.
 *
 * The registry caches factory instances and provides type-safe access.
 *
 * @param prisma - Prisma client to inject into factories
 * @returns Factory registry instance
 *
 * @example
 * ```typescript
 * const registry = createFactoryRegistry(prisma);
 *
 * // Get or create factory instance
 * const userFactory = registry.get(UserFactory);
 * await userFactory.create();
 * ```
 */
export function createFactoryRegistry(prisma: PrismaClientLike): FactoryRegistry {
  // Use unknown for type-erased storage, similar to AnyGenerator pattern
  const instances = new Map<FactoryConstructor, unknown>();

  return {
    get<TInput extends Record<string, unknown>, TOutput = TInput>(
      FactoryClass: FactoryConstructor<TInput, TOutput>
    ): Factory<TInput, TOutput> {
      // Check cache first
      let instance = instances.get(FactoryClass as FactoryConstructor);

      if (!instance) {
        // Create new instance
        instance = new FactoryClass(prisma);
        instances.set(FactoryClass as FactoryConstructor, instance);
      }

      // Type safety is maintained by the generic constraints on FactoryClass
      return instance as Factory<TInput, TOutput>;
    },

    clear(): void {
      instances.clear();
    },
  };
}
