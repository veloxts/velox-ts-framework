/**
 * Type declarations for VeloxTS application
 *
 * This file uses declaration merging to extend the framework's base types
 * with application-specific properties:
 *
 * - `ctx.db`: Typed PrismaClient for database access in procedure handlers
 * - `ctx.user.name`: Additional user field from your Prisma schema
 *
 * IMPORTANT: This file must be imported (side-effect import) in your entry
 * point to ensure the declaration merging is processed by TypeScript.
 *
 * @example
 * ```typescript
 * // In your index.ts entry point:
 * import './types.js'; // Side-effect import for declaration merging
 * ```
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
