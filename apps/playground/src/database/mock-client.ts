/**
 * Mock Database Client
 *
 * In-memory database implementation for playground testing.
 * In a real application, replace with actual Prisma client.
 *
 * @example Real application usage:
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * export const prisma = new PrismaClient();
 * ```
 */

import type { DatabaseClient } from '@veloxts/orm';

import type { CreateUserData, User } from '../schemas/user.js';

// ============================================================================
// Mock Client Interface
// ============================================================================

/**
 * Where clause for filtering (simplified Prisma-like syntax)
 */
interface WhereClause {
  OR?: Array<{
    name?: { contains: string };
    email?: { contains: string };
  }>;
}

/**
 * Mock Prisma client interface
 *
 * Mirrors the structure of a real Prisma client with user model.
 */
export interface MockPrismaClient extends DatabaseClient {
  user: {
    findUnique: (args: { where: { id: string } }) => Promise<User | null>;
    findMany: (args?: { skip?: number; take?: number; where?: WhereClause }) => Promise<User[]>;
    create: (args: { data: CreateUserData }) => Promise<User>;
    update: (args: {
      where: { id: string };
      data: Partial<CreateUserData>;
    }) => Promise<User | null>;
    delete: (args: { where: { id: string } }) => Promise<User | null>;
    count: (args?: { where?: WhereClause }) => Promise<number>;
  };
}

// ============================================================================
// In-Memory Store
// ============================================================================

/**
 * Seed data for testing
 */
const seedUsers: User[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Bob Smith',
    email: 'bob@example.com',
    createdAt: '2024-02-20T14:45:00Z',
    updatedAt: '2024-02-20T14:45:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    createdAt: '2024-03-10T09:15:00Z',
    updatedAt: '2024-03-10T09:15:00Z',
  },
];

/**
 * In-memory user store
 */
let usersStore: User[] = [...seedUsers];

// ============================================================================
// Mock Client Factory
// ============================================================================

/**
 * Creates a mock Prisma client for playground testing
 *
 * This simulates Prisma client behavior using an in-memory array.
 * Useful for:
 * - Testing without a real database
 * - Demonstrating framework features
 * - Quick prototyping
 */
export function createMockPrismaClient(): MockPrismaClient {
  return {
    $connect: async () => {
      console.log('[Mock DB] Connected to in-memory database');
      // Reset to seed data on connect
      usersStore = [...seedUsers];
    },

    $disconnect: async () => {
      console.log('[Mock DB] Disconnected from in-memory database');
    },

    user: {
      findUnique: async ({ where }) => {
        return usersStore.find((u) => u.id === where.id) ?? null;
      },

      findMany: async (args) => {
        let results = [...usersStore];

        // Apply where clause filtering
        if (args?.where?.OR) {
          results = results.filter((user) => {
            return args.where?.OR?.some((condition) => {
              if (condition.name?.contains) {
                return user.name.toLowerCase().includes(condition.name.contains.toLowerCase());
              }
              if (condition.email?.contains) {
                return user.email.toLowerCase().includes(condition.email.contains.toLowerCase());
              }
              return false;
            });
          });
        }

        // Apply pagination
        const skip = args?.skip ?? 0;
        const take = args?.take ?? 10;
        return results.slice(skip, skip + take);
      },

      create: async ({ data }) => {
        const now = new Date().toISOString();
        const newUser: User = {
          id: crypto.randomUUID(),
          name: data.name,
          email: data.email,
          createdAt: now,
          updatedAt: now,
        };
        usersStore.push(newUser);
        return newUser;
      },

      update: async ({ where, data }) => {
        const index = usersStore.findIndex((u) => u.id === where.id);
        if (index === -1) return null;

        const updated: User = {
          ...usersStore[index],
          ...data,
          updatedAt: new Date().toISOString(),
        };
        usersStore[index] = updated;
        return updated;
      },

      delete: async ({ where }) => {
        const index = usersStore.findIndex((u) => u.id === where.id);
        if (index === -1) return null;

        const [deleted] = usersStore.splice(index, 1);
        return deleted;
      },

      count: async () => {
        return usersStore.length;
      },
    },
  };
}

/**
 * Gets all users (for search functionality)
 *
 * Exposed for procedures that need direct store access.
 */
export function getAllUsers(): User[] {
  return [...usersStore];
}
