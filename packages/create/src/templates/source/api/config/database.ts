/**
 * Database Client (Prisma 7.x)
 *
 * Prisma 7 requires:
 * - Driver adapter for database connections
 * - Uses standard @prisma/client import path
 *
 * Uses Laravel-style `db` export for consistency.
 */

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

declare global {
  // Allow global `var` declarations for hot reload in development
  // eslint-disable-next-line no-var
  var __db: PrismaClient | undefined;
}

/**
 * Create a Prisma client instance using the SQLite adapter.
 * Validates that DATABASE_URL is set before creating the client.
 */
function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      '[VeloxTS] DATABASE_URL environment variable is not set. ' +
        'Ensure .env file exists with DATABASE_URL defined.'
    );
  }

  // Prisma 7 requires driver adapters for direct connections
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

// Use global singleton for hot reload in development
export const db = globalThis.__db ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__db = db;
}
