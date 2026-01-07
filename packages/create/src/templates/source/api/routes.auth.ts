/**
 * Browser-Safe Route Definitions
 *
 * This file exports route metadata that can be safely imported by frontend code.
 * It does NOT import any server-side modules like procedures or database clients.
 *
 * IMPORTANT: Keep this file browser-safe - no Node.js imports or side effects.
 */

import type { RouteMap } from '@veloxts/velox';

/**
 * Route mappings for the VeloxTS client
 *
 * Maps namespace -> procedure -> { method, path, kind }
 * These must match the actual procedure definitions in ./procedures/
 */
export const routes: RouteMap = {
  health: {
    getHealth: { method: 'GET', path: '/health', kind: 'query' },
  },
  auth: {
    createAccount: { method: 'POST', path: '/auth/register', kind: 'mutation' },
    createSession: { method: 'POST', path: '/auth/login', kind: 'mutation' },
    createRefresh: { method: 'POST', path: '/auth/refresh', kind: 'mutation' },
    deleteSession: { method: 'DELETE', path: '/auth/session', kind: 'mutation' },
    getMe: { method: 'GET', path: '/auth/me', kind: 'query' },
  },
  users: {
    listUsers: { method: 'GET', path: '/users', kind: 'query' },
    getUser: { method: 'GET', path: '/users/:id', kind: 'query' },
    createUser: { method: 'POST', path: '/users', kind: 'mutation' },
    updateUser: { method: 'PUT', path: '/users/:id', kind: 'mutation' },
    patchUser: { method: 'PATCH', path: '/users/:id', kind: 'mutation' },
    deleteUser: { method: 'DELETE', path: '/users/:id', kind: 'mutation' },
  },
};
