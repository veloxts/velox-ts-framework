/**
 * tRPC Configuration
 *
 * Sets up tRPC router from VeloxTS procedure collections.
 * Provides both the router and type exports for client consumption.
 */

import { type AnyRouter, createAppRouter, createTRPC } from '@veloxts/router';

import { healthProcedures, userProcedures } from '../procedures/index.js';

// ============================================================================
// tRPC Instance
// ============================================================================

/**
 * Create tRPC instance with VeloxTS context
 */
export const t = createTRPC();

// ============================================================================
// App Router
// ============================================================================

/**
 * Combined tRPC router from all procedure collections
 */
export const appRouter: AnyRouter = createAppRouter(t, [userProcedures, healthProcedures]);

/**
 * App router type for client inference
 */
export type AppRouter = AnyRouter;
