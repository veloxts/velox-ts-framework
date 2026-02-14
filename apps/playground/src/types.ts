/**
 * Playground Type Declarations
 *
 * Extends BaseContext via declaration merging so that `ctx.db`
 * is typed as the generated PrismaClient in all procedure handlers.
 */

import type { PrismaClient } from './database/index.js';

declare module '@veloxts/core' {
  interface BaseContext {
    db: PrismaClient;
  }
}
