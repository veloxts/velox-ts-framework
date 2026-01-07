/**
 * Database Client (Prisma 7.x)
 *
 * Prisma 7 requires:
 * - Driver adapter for database connections
 * - Uses standard @prisma/client import path
 *
 * Uses Laravel-style `db` export for consistency.
 */

// Runtime imports using createRequire for Node.js v24+ CJS interop
import { createRequire } from 'node:module';

/* @if sqlite */
// Type imports (erased at runtime, safe for ESM)
import type { PrismaBetterSqlite3 as PrismaBetterSqlite3Type } from '@prisma/adapter-better-sqlite3';
/* @endif sqlite */
/* @if postgresql */
// Type imports (erased at runtime, safe for ESM)
import type { PrismaPg as PrismaPgType } from '@prisma/adapter-pg';
/* @endif postgresql */
import type { PrismaClient as PrismaClientType } from '@prisma/client';

const require = createRequire(import.meta.url);
/* @if sqlite */
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3') as {
  PrismaBetterSqlite3: typeof PrismaBetterSqlite3Type;
};
/* @endif sqlite */
/* @if postgresql */
const { PrismaPg } = require('@prisma/adapter-pg') as {
  PrismaPg: typeof PrismaPgType;
};
/* @endif postgresql */
const { PrismaClient } = require('@prisma/client') as {
  PrismaClient: typeof PrismaClientType;
};

declare global {
  // Allow global `var` declarations for hot reload in development
  // eslint-disable-next-line no-var
  var __db: PrismaClientType | undefined;
}

/* @if sqlite */
/**
 * Create a Prisma client instance using the SQLite adapter.
 * Validates that DATABASE_URL is set before creating the client.
 */
function createPrismaClient(): PrismaClientType {
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
/* @endif sqlite */
/* @if postgresql */
/**
 * Create a Prisma client instance using the PostgreSQL adapter.
 *
 * Prisma 7 Breaking Change:
 * - PrismaPg now takes connectionString directly (not a Pool instance)
 * - Pool management is handled internally by the adapter
 */
function createPrismaClient(): PrismaClientType {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      '[VeloxTS] DATABASE_URL environment variable is not set. ' +
        'Ensure .env file exists with DATABASE_URL defined.'
    );
  }

  // Prisma 7: Pass connectionString directly to PrismaPg (not a Pool)
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
/* @endif postgresql */

/* @if sqlite */
// Use global singleton for hot reload in development
export const db = globalThis.__db ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__db = db;
}
/* @endif sqlite */
/* @if postgresql */
// Use global singleton for hot reload in development
export const db = globalThis.__db ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__db = db;
}

// Graceful shutdown - disconnect Prisma on process exit
const shutdown = async () => {
  await db.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
/* @endif postgresql */
