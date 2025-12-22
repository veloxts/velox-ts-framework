/**
 * Routes - Browser-Safe Route Definitions
 *
 * BROWSER-SAFE: This file contains only static route metadata.
 * Never import from procedures/ or @veloxts/* packages here.
 *
 * These route mappings tell the frontend client how to call each procedure.
 */

export const routes = {
  health: {
    getHealth: { method: 'GET', path: '/health' },
  },
  users: {
    getUser: { method: 'GET', path: '/users/:id' },
    listUsers: { method: 'GET', path: '/users' },
    createUser: { method: 'POST', path: '/users' },
    updateUser: { method: 'PUT', path: '/users/:id' },
    patchUser: { method: 'PATCH', path: '/users/:id' },
    deleteUser: { method: 'DELETE', path: '/users/:id' },
  },
} as const;

export type Routes = typeof routes;
