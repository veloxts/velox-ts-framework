/**
 * Type declarations for VeloxTS application
 *
 * Extends the base context with the specific Prisma client types.
 * This enables full autocomplete for ctx.db in procedure handlers.
 */

import type { PrismaClient } from '@prisma/client';

declare module '@veloxts/core' {
  interface BaseContext {
    db: PrismaClient;
  }
}

// Extend User interface to include name field from Prisma model
declare module '@veloxts/auth' {
  interface User {
    name?: string;
  }
}
