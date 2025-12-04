/**
 * Prisma Client Configuration
 *
 * Creates and exports the Prisma client instance for database access.
 * Uses Prisma 7+ driver adapter pattern for SQLite.
 *
 * @see https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
 */

import path from 'node:path';

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

// ============================================================================
// Database Configuration
// ============================================================================

/**
 * Get database URL from environment or use default
 */
function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;

  if (envUrl) {
    return envUrl;
  }

  // Default: SQLite file in prisma directory
  return `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`;
}

// ============================================================================
// Prisma Client Instance
// ============================================================================

/**
 * Create the SQLite adapter for Prisma 7+
 */
const adapter = new PrismaBetterSqlite3({
  url: getDatabaseUrl(),
});

/**
 * Prisma client instance with driver adapter
 *
 * In Prisma 7+, you must pass an adapter to the PrismaClient constructor.
 * The adapter handles the actual database connection.
 */
export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * Export the Prisma client type for use in type declarations
 */
export type { PrismaClient } from '@prisma/client';
