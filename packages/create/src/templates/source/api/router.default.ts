/**
 * Router Definition
 *
 * This file exports the router type for frontend type safety.
 * It MUST NOT have any side effects (like importing dotenv) so that
 * the frontend can safely import types from here.
 *
 * IMPORTANT: Do not add 'import dotenv/config' or any side-effect imports here.
 * The server entry point (index.ts) handles environment setup.
 */

import { extractRoutes } from '@veloxts/velox';

import { healthProcedures } from './procedures/health.js';
import { userProcedures } from './procedures/users.js';

// Procedure collections for routing
export const collections = [healthProcedures, userProcedures];

// Router definition for frontend type safety
export const router = {
  health: healthProcedures,
  users: userProcedures,
};

export type AppRouter = typeof router;

// Route mappings for frontend client
export const routes = extractRoutes(collections);
