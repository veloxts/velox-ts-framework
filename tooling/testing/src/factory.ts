/**
 * Model Factories - Laravel-style test data generation
 *
 * Elegant API for creating type-safe test data with zero ceremony.
 *
 * @module testing/factory
 *
 * @example
 * ```typescript
 * // Define a factory
 * const User = defineFactory<User>(() => ({
 *   id: ({ sequence }) => `user-${sequence}`,
 *   name: ({ sequence }) => `User ${sequence}`,
 *   email: ({ sequence }) => `user${sequence}@test.com`,
 *   createdAt: () => new Date().toISOString(),
 * }));
 *
 * // Add states for variations
 * User.state('admin', { role: 'admin' });
 * User.state('unverified', { emailVerifiedAt: null });
 *
 * // Use in tests
 * const user = User.make();
 * const users = User.count(5).make();
 * const admin = User.state('admin').make();
 * const specific = User.make({ email: 'exact@email.com' });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Context provided to factory definition functions
 */
export interface FactoryContext {
  /** Auto-incrementing sequence number (starts at 1) */
  sequence: number;
}

/**
 * Factory definition - each field can be a value or a function
 */
export type FactoryDefinition<T> = {
  [K in keyof T]: T[K] | ((context: FactoryContext) => T[K]);
};

/**
 * Factory builder for chaining .count() and .state()
 */
export interface FactoryBuilder<T> {
  /** Create multiple records */
  make(overrides?: Partial<T>): T[];
  /** Set how many records to create */
  count(n: number): FactoryBuilder<T>;
  /** Apply named states */
  state(...names: string[]): FactoryBuilder<T>;
}

/**
 * Factory interface with make(), count(), state() methods
 */
export interface Factory<T> {
  /** Create a single record */
  make(overrides?: Partial<T>): T;
  /** Create multiple records */
  count(n: number): FactoryBuilder<T>;
  /** Apply named state transformations */
  state(...names: string[]): FactoryBuilder<T>;
  /** Define a named state (call on factory, not builder) */
  defineState(name: string, overrides: Partial<T>): void;
}

// ============================================================================
// Factory Implementation
// ============================================================================

/**
 * Define a model factory for type-safe test data generation
 *
 * Factories provide a Laravel-style API for creating test records:
 * - `make()` creates a single record
 * - `count(n).make()` creates multiple records
 * - `state('name').make()` applies predefined transformations
 * - `make({ field: 'value' })` applies inline overrides
 *
 * @param definition - Object where each field is a value or resolver function
 * @returns Factory instance with make(), count(), state() methods
 *
 * @example
 * ```typescript
 * const User = defineFactory<User>(() => ({
 *   id: ({ sequence }) => crypto.randomUUID(),
 *   name: ({ sequence }) => `Test User ${sequence}`,
 *   email: ({ sequence }) => `user${sequence}@test.com`,
 *   role: 'user',
 *   createdAt: () => new Date().toISOString(),
 *   updatedAt: () => new Date().toISOString(),
 * }));
 *
 * // Define states for common variations
 * User.defineState('admin', { role: 'admin' });
 * User.defineState('banned', { status: 'banned', bannedAt: new Date().toISOString() });
 *
 * // Usage in tests
 * const user = User.make();                          // Single user
 * const users = User.count(10).make();               // 10 users
 * const admin = User.state('admin').make();          // Admin user
 * const admins = User.state('admin').count(3).make(); // 3 admins
 * const custom = User.make({ email: 'specific@test.com' }); // Custom email
 * ```
 */
export function defineFactory<T>(
  definitionFn: () => FactoryDefinition<T>
): Factory<T> {
  const states = new Map<string, Partial<T>>();
  let globalSequence = 0;

  /**
   * Resolve a factory definition to a concrete value
   */
  const resolve = (overrides: Partial<T> = {}): T => {
    const context: FactoryContext = {
      sequence: ++globalSequence,
    };

    const definition = definitionFn();
    const result = {} as T;

    for (const key in definition) {
      const fieldDef = definition[key];
      if (typeof fieldDef === 'function') {
        result[key] = (fieldDef as (ctx: FactoryContext) => T[typeof key])(context);
      } else {
        result[key] = fieldDef as T[typeof key];
      }
    }

    return { ...result, ...overrides };
  };

  /**
   * Create a builder for chaining count() and state()
   */
  const createBuilder = (
    activeStates: string[] = [],
    recordCount = 1
  ): FactoryBuilder<T> => ({
    make(overrides = {}) {
      // Merge all active states
      const stateOverrides = activeStates.reduce<Partial<T>>(
        (acc, name) => {
          const stateData = states.get(name);
          if (!stateData) {
            throw new Error(
              `Unknown factory state: "${name}". ` +
                `Available states: ${[...states.keys()].join(', ') || 'none'}`
            );
          }
          return { ...acc, ...stateData };
        },
        {} as Partial<T>
      );

      // Create records
      return Array.from({ length: recordCount }, () =>
        resolve({ ...stateOverrides, ...overrides })
      );
    },

    count(n) {
      return createBuilder(activeStates, n);
    },

    state(...names) {
      return createBuilder([...activeStates, ...names], recordCount);
    },
  });

  // Return the factory
  return {
    make(overrides = {}) {
      return resolve(overrides);
    },

    count(n) {
      return createBuilder([], n);
    },

    state(...names) {
      // For single record, return a builder that makes one item
      const builder = createBuilder(names, 1);
      return {
        ...builder,
        make(overrides = {}) {
          return builder.make(overrides)[0];
        },
      } as unknown as FactoryBuilder<T>;
    },

    defineState(name, overrides) {
      states.set(name, overrides);
    },
  };
}

// ============================================================================
// Helper Factories
// ============================================================================

/**
 * Create a UUID generator for factory fields
 *
 * @example
 * ```typescript
 * const User = defineFactory<User>(() => ({
 *   id: uuid(),
 *   // ...
 * }));
 * ```
 */
export function uuid(): (ctx: FactoryContext) => string {
  return () => crypto.randomUUID();
}

/**
 * Create a sequential ID generator
 *
 * @param prefix - Optional prefix for the ID
 *
 * @example
 * ```typescript
 * const User = defineFactory<User>(() => ({
 *   id: sequence('user'),  // user-1, user-2, ...
 * }));
 * ```
 */
export function sequence(prefix = ''): (ctx: FactoryContext) => string {
  return ({ sequence: seq }) => prefix ? `${prefix}-${seq}` : String(seq);
}

/**
 * Create a timestamp generator (ISO string)
 *
 * @example
 * ```typescript
 * const User = defineFactory<User>(() => ({
 *   createdAt: timestamp(),
 * }));
 * ```
 */
export function timestamp(): () => string {
  return () => new Date().toISOString();
}

/**
 * Create a sequenced email generator
 *
 * @param domain - Email domain (default: 'test.com')
 *
 * @example
 * ```typescript
 * const User = defineFactory<User>(() => ({
 *   email: email(),  // user1@test.com, user2@test.com, ...
 * }));
 * ```
 */
export function email(domain = 'test.com'): (ctx: FactoryContext) => string {
  return ({ sequence: seq }) => `user${seq}@${domain}`;
}
