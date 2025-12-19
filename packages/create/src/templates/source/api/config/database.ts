/**
 * Database Client (Prisma 7.x)
 *
 * Prisma 7 requires:
 * - Generated client from custom output path
 * - Driver adapter for database connections
 *
 * Uses Laravel-style `db` export for consistency.
 */

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

import { PrismaClient } from '../generated/prisma/client.js';

// Validate DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create SQLite adapter with database URL from environment
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });

// Export configured Prisma client
export const db = new PrismaClient({ adapter });
