/**
 * Database Configuration
 *
 * Prisma client instance for database access.
 */

import { PrismaClient } from '@prisma/client';

declare global {
  // Allow global `var` declarations for hot reload in development
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = globalThis.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Re-export as db for convenience
export const db = prisma;
