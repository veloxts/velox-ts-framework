/**
 * Database Configuration
 *
 * Prisma client instance for database access.
 * Uses Laravel-style `db` export for consistency.
 *
 * Note: Prisma 7 requires using driver adapters for direct database connections.
 * We explicitly load dotenv here because Vite's SSR module evaluation
 * doesn't always have access to .env variables.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Get the project root directory (2 levels up from src/api/)
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..');

// Load .env file explicitly for Vite SSR compatibility
// Use project root for reliable path resolution
dotenv.config({ path: resolve(projectRoot, '.env') });

declare global {
  // Allow global `var` declarations for hot reload in development
  // eslint-disable-next-line no-var
  var __db: PrismaClient | undefined;
}

/**
 * Create a Prisma client instance using the SQLite adapter.
 *
 * Prisma 7 Breaking Change:
 * - `datasourceUrl` and `datasources` options removed from PrismaClient
 * - Must use driver adapters for direct database connections
 * - Validates that DATABASE_URL is set before creating the client
 */
function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      '[VeloxTS] DATABASE_URL environment variable is not set. ' +
        'Ensure .env file exists in project root with DATABASE_URL defined.'
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
