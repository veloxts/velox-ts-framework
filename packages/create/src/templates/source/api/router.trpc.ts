/**
 * Router Definition - tRPC Hybrid Template
 *
 * This file exports the router type for frontend type safety.
 * It MUST NOT have any side effects (like importing dotenv) so that
 * the frontend can safely import types from here.
 *
 * IMPORTANT: Do not add 'import dotenv/config' or any side-effect imports here.
 * The server entry point (index.ts) handles environment setup.
 */

import { healthProcedures } from './procedures/health.js';
import { userProcedures } from './procedures/users.js';

// Procedure collections for routing
export const collections = [healthProcedures, userProcedures];

/**
 * AppRouter type for frontend type safety
 *
 * Constructed from procedure collections to preserve full type information.
 * This enables type-safe API calls with full autocomplete.
 *
 * @example
 * ```typescript
 * import type { AppRouter } from '../../api/src/router.js';
 * import { createVeloxHooks } from '@veloxts/client/react';
 *
 * export const api = createVeloxHooks<AppRouter>();
 * ```
 */
export const router = {
  health: healthProcedures,
  users: userProcedures,
};

export type AppRouter = typeof router;
