/**
 * Database Configuration
 *
 * Prisma client instance for database access.
 * Uses Laravel-style `db` export for consistency.
 */

import { PrismaClient } from '@prisma/client';

declare global {
  // Allow global `var` declarations for hot reload in development
  // eslint-disable-next-line no-var
  var __db: PrismaClient | undefined;
}

export const db = globalThis.__db ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__db = db;
}
