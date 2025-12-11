import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { VeloxProvider } from '@veloxts/client/react';
import { routeTree } from './routeTree.gen';
import './styles/global.css';

// Import router type from API for full type safety
import type { AppRouter } from '../../api/src/index.js';

// Create router with route tree
const router = createRouter({ routeTree });

// Type-safe router registration
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

/* @if auth */
// Dynamic headers for auth - fetches token on each request
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Route mappings for auth procedures with custom .rest() endpoints
const routes = {
  auth: {
    createAccount: '/auth/register',
    createSession: '/auth/login',
    createRefresh: '/auth/refresh',
    deleteSession: '/auth/logout',
    getMe: '/auth/me',
  },
};
/* @endif auth */

// Render application
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    {/* @if default */}
    <VeloxProvider<AppRouter> config={{ baseUrl: '/api' }}>
      <RouterProvider router={router} />
    </VeloxProvider>
    {/* @endif default */}
    {/* @if auth */}
    <VeloxProvider<AppRouter> config={{ baseUrl: '/api', headers: getAuthHeaders, routes }}>
      <RouterProvider router={router} />
    </VeloxProvider>
    {/* @endif auth */}
  </StrictMode>
);
