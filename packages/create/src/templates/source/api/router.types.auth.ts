/**
 * Router Types - Type-Only File for Frontend
 *
 * This file exports the AppRouter type for frontend type safety.
 * It uses TypeScript's inline `typeof import()` syntax which is
 * purely compile-time and should not trigger Vite's module resolution.
 */

/**
 * AppRouter type for frontend type safety.
 *
 * Using inline typeof import() avoids top-level import statements
 * that Vite might try to resolve during bundle analysis.
 */
export type AppRouter = {
  auth: typeof import('./procedures/auth.js')['authProcedures'];
  health: typeof import('./procedures/health.js')['healthProcedures'];
  users: typeof import('./procedures/users.js')['userProcedures'];
};
