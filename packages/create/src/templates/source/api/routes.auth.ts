/**
 * Routes - Browser-Safe Route Definitions
 *
 * BROWSER-SAFE: This file contains only static route metadata.
 * Never import from procedures/ or @veloxts/* packages here.
 *
 * These route mappings tell the frontend client how to call each procedure.
 */

// ============================================================================
// Route Helper (Browser-Safe)
// ============================================================================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RouteEntry = {
  method: HttpMethod;
  path: string;
};

const defineRoutes = <T extends Record<string, RouteEntry>>(routes: T): T => routes;

// ============================================================================
// Health Routes
// ============================================================================

export const healthRoutes = defineRoutes({
  getHealth: { method: 'GET', path: '/health' },
});

// ============================================================================
// Auth Routes
// ============================================================================

export const authRoutes = defineRoutes({
  createAccount: { method: 'POST', path: '/auth/register' },
  createSession: { method: 'POST', path: '/auth/login' },
  createRefresh: { method: 'POST', path: '/auth/refresh' },
  deleteSession: { method: 'POST', path: '/auth/logout' },
  getMe: { method: 'GET', path: '/auth/me' },
});

// ============================================================================
// User Routes
// ============================================================================

export const userRoutes = defineRoutes({
  getUser: { method: 'GET', path: '/users/:id' },
  listUsers: { method: 'GET', path: '/users' },
  createUser: { method: 'POST', path: '/users' },
  updateUser: { method: 'PUT', path: '/users/:id' },
  patchUser: { method: 'PATCH', path: '/users/:id' },
  deleteUser: { method: 'DELETE', path: '/users/:id' },
});

// ============================================================================
// Combined Routes Export
// ============================================================================

export const routes = {
  health: healthRoutes,
  auth: authRoutes,
  users: userRoutes,
} as const;

export type Routes = typeof routes;
