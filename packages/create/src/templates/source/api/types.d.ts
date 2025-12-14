/**
 * Type declarations for VeloxTS application
 *
 * Extends the base context with the specific Prisma client types.
 * This enables full autocomplete for ctx.db in procedure handlers.
 */

import type { PrismaClient } from './generated/prisma/client.js';

declare module '@veloxts/core' {
  interface BaseContext {
    db: PrismaClient;
  }
}
