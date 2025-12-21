/**
 * Router Types Declaration File
 *
 * This is a TypeScript declaration file (.d.ts) that Vite ignores completely.
 * It provides AppRouter type for the frontend without triggering Vite's
 * module graph analysis.
 *
 * The types here mirror the router.ts structure.
 */

import type { healthProcedures } from './procedures/health.js';
import type { userProcedures } from './procedures/users.js';

export type AppRouter = {
  health: typeof healthProcedures;
  users: typeof userProcedures;
};
