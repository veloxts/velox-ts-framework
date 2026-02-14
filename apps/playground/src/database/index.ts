/**
 * Database Exports
 *
 * Central export point for database configuration.
 * When USE_MOCK_DB=true, the real Prisma client is NOT imported,
 * preventing crashes from missing DATABASE_URL or stale generated client.
 */

import type { DatabaseClient } from '@veloxts/orm';

export * from './mock-client.js';
export type { PrismaClient } from './prisma.js';

/**
 * When USE_MOCK_DB=true (benchmarks), export a stub that no-ops on
 * $connect/$disconnect and throws a clear error if any model is accessed.
 * When USE_MOCK_DB is not set, eagerly import and export the real client.
 */
let prisma: DatabaseClient;

if (process.env.USE_MOCK_DB === 'true') {
  prisma = new Proxy({} as DatabaseClient, {
    get(_target, prop) {
      if (prop === '$disconnect' || prop === '$connect') {
        return () => Promise.resolve();
      }
      if (prop === 'then' || prop === Symbol.toPrimitive || prop === Symbol.toStringTag) {
        return undefined;
      }
      throw new Error(`prisma.${String(prop)} called with USE_MOCK_DB=true. Use ctx.db instead.`);
    },
  });
} else {
  // Only import prisma.ts (which creates PrismaClient) when actually needed
  const mod = await import('./prisma.js');
  prisma = mod.prisma;
}

export { prisma };
