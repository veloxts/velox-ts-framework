/**
 * tRPC Configuration
 *
 * Sets up tRPC router from VeloxTS procedure collections.
 * Provides both the router and type exports for client consumption.
 */

import { type AnyRouter, appRouter as createAppRouter, trpc } from '@veloxts/router';

import { authProcedures, healthProcedures, userProcedures } from '../procedures/index.js';

// ============================================================================
// tRPC Instance
// ============================================================================

/**
 * Create tRPC instance with VeloxTS context
 */
export const t = trpc();

// ============================================================================
// App Router
// ============================================================================

/**
 * Combined tRPC router from all procedure collections
 * Includes auth, user, and health procedures for full API coverage
 */
export const appRouter: AnyRouter = createAppRouter(t, [
  authProcedures,
  userProcedures,
  healthProcedures,
]);

/**
 * App router type for client inference
 * Using typeof ensures full type safety for tRPC clients
 */
export type AppRouter = typeof appRouter;
