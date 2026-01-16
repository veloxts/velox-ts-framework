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

// Triple-slash reference ensures TypeScript processes our type augmentations
// for BaseContext (e.g., ctx.db) before type-checking procedures.
// This is NOT a runtime import - it only affects type checking.
/// <reference path="./types.ts" />

import { createRouter, extractRoutes } from '@veloxts/velox';

import { healthProcedures } from './procedures/health.js';
import { userProcedures } from './procedures/users.js';

// Create router and collections from procedure definitions
export const { collections, router } = createRouter(healthProcedures, userProcedures);

export type AppRouter = typeof router;

// Route mappings for frontend client
export const routes = extractRoutes(collections);
