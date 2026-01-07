import { createRouter, RouterProvider } from '@tanstack/react-router';
import { VeloxProvider } from '@veloxts/client/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { routeTree } from './routeTree.gen';
import './styles/global.css';

// Import router type (type-only import is erased at compile time)
import type { AppRouter } from '../../api/src/router.js';
/* @if auth */
// Import routes from browser-safe routes file (no server-side code)
import { routes } from '../../api/src/routes.js';

/* @endif auth */

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
const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Automatic token refresh on 401 responses
const handleUnauthorized = async (): Promise<boolean> => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      // Refresh failed - clear tokens
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      return false;
    }

    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return true; // Retry the original request
  } catch {
    // Network error during refresh
    return false;
  }
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
    <VeloxProvider<AppRouter>
      config={{
        baseUrl: '/api',
        headers: getAuthHeaders,
        routes,
        onUnauthorized: handleUnauthorized,
      }}
    >
      <RouterProvider router={router} />
    </VeloxProvider>
    {/* @endif auth */}
  </StrictMode>
);
