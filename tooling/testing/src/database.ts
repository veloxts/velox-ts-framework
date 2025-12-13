/**
 * Mock Database - Prisma-compatible in-memory database for testing
 *
 * Provides a zero-config mock database that implements the Prisma client
 * interface. Use in tests without a real database connection.
 *
 * @module testing/database
 *
 * @example
 * ```typescript
 * import { createMockDatabase } from '@veloxts/testing';
 *
 * // Create empty database
 * const db = createMockDatabase();
 *
 * // Or with seed data
 * const db = createMockDatabase({
 *   user: [
 *     { id: '1', name: 'Alice', email: 'alice@test.com' },
 *     { id: '2', name: 'Bob', email: 'bob@test.com' },
 *   ],
 * });
 *
 * // Use like Prisma
 * await db.user.create({ data: { name: 'Charlie', email: 'charlie@test.com' } });
 * const users = await db.user.findMany();
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Seed data for initializing the mock database
 */
export type SeedData = Record<string, unknown[]>;

/**
 * Where clause for filtering records
 */
export type WhereClause<T> = Partial<T> | { OR?: Partial<T>[] } | { AND?: Partial<T>[] };

/**
 * Mock model interface - mirrors Prisma model methods
 */
export interface MockModel<T extends Record<string, unknown>> {
  create(args: { data: T }): Promise<T>;
  createMany(args: { data: T[] }): Promise<{ count: number }>;
  findUnique(args: { where: Partial<T> }): Promise<T | null>;
  findFirst(args?: { where?: WhereClause<T> }): Promise<T | null>;
  findMany(args?: { where?: WhereClause<T>; skip?: number; take?: number }): Promise<T[]>;
  update(args: { where: Partial<T>; data: Partial<T> }): Promise<T>;
  upsert(args: { where: Partial<T>; create: T; update: Partial<T> }): Promise<T>;
  delete(args: { where: Partial<T> }): Promise<T>;
  deleteMany(args?: { where?: WhereClause<T> }): Promise<{ count: number }>;
  count(args?: { where?: WhereClause<T> }): Promise<number>;
}

/**
 * Mock database interface with dynamic model access
 */
export interface MockDatabase {
  /** Seed the database with data */
  seed(data: SeedData): Promise<void>;
  /** Reset database to empty state */
  reset(): Promise<void>;
  /** Reset database to initial seed data */
  restore(): Promise<void>;
  /** Prisma-compatible connect */
  $connect(): Promise<void>;
  /** Prisma-compatible disconnect */
  $disconnect(): Promise<void>;
  /** Access a model by name */
  [model: string]: MockModel<Record<string, unknown>> | unknown;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Check if a record matches a where clause
 */
function matchesWhere<T extends Record<string, unknown>>(
  record: T,
  where: WhereClause<T>
): boolean {
  // Handle OR clauses
  if ('OR' in where && Array.isArray(where.OR)) {
    return where.OR.some((condition) => matchesWhere(record, condition));
  }

  // Handle AND clauses
  if ('AND' in where && Array.isArray(where.AND)) {
    return where.AND.every((condition) => matchesWhere(record, condition));
  }

  // Simple field matching
  return Object.entries(where).every(([key, value]) => {
    const recordValue = record[key];

    // Handle nested contains queries
    if (value && typeof value === 'object' && 'contains' in value) {
      const searchValue = String((value as { contains: string }).contains).toLowerCase();
      return String(recordValue).toLowerCase().includes(searchValue);
    }

    // Handle nested equals queries
    if (value && typeof value === 'object' && 'equals' in value) {
      return recordValue === (value as { equals: unknown }).equals;
    }

    // Direct equality
    return recordValue === value;
  });
}

/**
 * Create a mock model for a specific entity type
 */
function createMockModel<T extends Record<string, unknown>>(
  store: Map<string, T[]>,
  modelName: string
): MockModel<T> {
  const getRecords = (): T[] => {
    if (!store.has(modelName)) {
      store.set(modelName, []);
    }
    return store.get(modelName) as T[];
  };

  return {
    async create({ data }) {
      const records = getRecords();
      // Auto-generate ID if not provided
      const record = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      } as T;
      records.push(record);
      return record;
    },

    async createMany({ data }) {
      const records = getRecords();
      const newRecords = data.map((item) => ({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...item,
      })) as T[];
      records.push(...newRecords);
      return { count: newRecords.length };
    },

    async findUnique({ where }) {
      const records = getRecords();
      return records.find((r) => matchesWhere(r, where)) ?? null;
    },

    async findFirst({ where } = {}) {
      const records = getRecords();
      if (!where) return records[0] ?? null;
      return records.find((r) => matchesWhere(r, where)) ?? null;
    },

    async findMany({ where, skip = 0, take } = {}) {
      let records = getRecords();

      if (where) {
        records = records.filter((r) => matchesWhere(r, where));
      }

      // Apply pagination
      if (skip > 0) {
        records = records.slice(skip);
      }
      if (take !== undefined) {
        records = records.slice(0, take);
      }

      return [...records];
    },

    async update({ where, data }) {
      const records = getRecords();
      const index = records.findIndex((r) => matchesWhere(r, where));

      if (index === -1) {
        throw new Error(`Record not found in ${modelName}`);
      }

      const updated = {
        ...records[index],
        ...data,
        updatedAt: new Date().toISOString(),
      } as T;
      records[index] = updated;
      return updated;
    },

    async upsert({ where, create, update }) {
      const records = getRecords();
      const existing = records.find((r) => matchesWhere(r, where));

      if (existing) {
        const index = records.indexOf(existing);
        const updated = {
          ...existing,
          ...update,
          updatedAt: new Date().toISOString(),
        } as T;
        records[index] = updated;
        return updated;
      }

      const record = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...create,
      } as T;
      records.push(record);
      return record;
    },

    async delete({ where }) {
      const records = getRecords();
      const index = records.findIndex((r) => matchesWhere(r, where));

      if (index === -1) {
        throw new Error(`Record not found in ${modelName}`);
      }

      const [deleted] = records.splice(index, 1);
      return deleted;
    },

    async deleteMany({ where } = {}) {
      const records = getRecords();

      if (!where) {
        const count = records.length;
        records.length = 0;
        return { count };
      }

      const toDelete = records.filter((r) => matchesWhere(r, where));
      for (const record of toDelete) {
        const index = records.indexOf(record);
        if (index !== -1) {
          records.splice(index, 1);
        }
      }

      return { count: toDelete.length };
    },

    async count({ where } = {}) {
      const records = getRecords();
      if (!where) return records.length;
      return records.filter((r) => matchesWhere(r, where)).length;
    },
  };
}

/**
 * Create a mock database for testing
 *
 * Returns a Prisma-compatible database client that stores data in memory.
 * Perfect for unit and integration tests without a real database.
 *
 * @param initialSeed - Optional initial data to populate the database
 * @returns Mock database with Prisma-compatible model access
 *
 * @example
 * ```typescript
 * // Empty database
 * const db = createMockDatabase();
 *
 * // With seed data
 * const db = createMockDatabase({
 *   user: [
 *     { id: '1', name: 'Alice', email: 'alice@test.com' },
 *     { id: '2', name: 'Bob', email: 'bob@test.com' },
 *   ],
 *   post: [
 *     { id: '1', title: 'Hello', authorId: '1' },
 *   ],
 * });
 *
 * // Use like Prisma
 * const user = await db.user.create({
 *   data: { name: 'Charlie', email: 'charlie@test.com' },
 * });
 *
 * const users = await db.user.findMany({
 *   where: { name: { contains: 'ali' } },
 * });
 *
 * // Reset between tests
 * await db.reset();
 *
 * // Restore to initial seed
 * await db.restore();
 * ```
 */
export function createMockDatabase(initialSeed?: SeedData): MockDatabase {
  const store = new Map<string, unknown[]>();
  const originalSeed = initialSeed ? { ...initialSeed } : undefined;

  // Initialize with seed data
  if (initialSeed) {
    for (const [model, records] of Object.entries(initialSeed)) {
      store.set(model, [...records]);
    }
  }

  // Model cache for consistent references
  const modelCache = new Map<string, MockModel<Record<string, unknown>>>();

  const db = new Proxy({} as MockDatabase, {
    get(_, prop: string) {
      // Handle special methods
      switch (prop) {
        case 'seed':
          return async (data: SeedData) => {
            for (const [model, records] of Object.entries(data)) {
              const existing = store.get(model) ?? [];
              store.set(model, [...existing, ...records]);
            }
          };

        case 'reset':
          return async () => {
            store.clear();
            modelCache.clear();
          };

        case 'restore':
          return async () => {
            store.clear();
            modelCache.clear();
            if (originalSeed) {
              for (const [model, records] of Object.entries(originalSeed)) {
                store.set(model, [...records]);
              }
            }
          };

        case '$connect':
          return async () => {
            // No-op for mock
          };

        case '$disconnect':
          return async () => {
            // No-op for mock
          };

        default:
          // Return cached model or create new one
          if (!modelCache.has(prop)) {
            modelCache.set(
              prop,
              createMockModel(store as Map<string, Record<string, unknown>[]>, prop)
            );
          }
          return modelCache.get(prop);
      }
    },
  });

  return db;
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a database plugin configuration for testing
 *
 * Returns a configuration object that can be spread into databasePlugin().
 *
 * @param seed - Optional seed data
 * @returns Database plugin configuration with mock client
 *
 * @example
 * ```typescript
 * import { createTestServer, mockDatabaseConfig } from '@veloxts/testing';
 * import { databasePlugin } from '@veloxts/orm';
 *
 * const server = await createTestServer();
 * await server.register(databasePlugin(mockDatabaseConfig({
 *   user: User.count(3).make(),
 * })));
 * ```
 */
export function mockDatabaseConfig(seed?: SeedData): { client: MockDatabase } {
  return {
    client: createMockDatabase(seed),
  };
}
