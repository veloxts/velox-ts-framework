/**
 * Prisma Client Configuration (Prisma 7.x)
 *
 * Creates and exports the Prisma client instance for database access.
 * Uses Prisma 7+ driver adapter pattern for SQLite.
 *
 * Prisma 7 requires:
 * - Generated client from custom output path
 * - Driver adapter for database connections
 *
 * @see https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
 */

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

import { PrismaClient } from '../generated/prisma/client.js';

// ============================================================================
// Prisma Client Instance
// ============================================================================

/**
 * Create the SQLite adapter for Prisma 7+
 * Database URL comes from environment (configured in prisma.config.ts)
 */
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL,
});

/**
 * Prisma client instance with driver adapter
 *
 * In Prisma 7+, you must pass an adapter to the PrismaClient constructor.
 * The adapter handles the actual database connection.
 */
export const prisma = new PrismaClient({
  adapter,
});

/**
 * Export the Prisma client type for use in type declarations
 */
export type { PrismaClient } from '../generated/prisma/client.js';
