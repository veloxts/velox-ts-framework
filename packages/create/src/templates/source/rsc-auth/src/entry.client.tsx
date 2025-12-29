/**
 * Client Entry Point
 *
 * Hydrates React client components on the client side.
 * Only pages marked with 'use client' need hydration.
 * Server-only components remain static HTML.
 */

import { hydrateRoot } from 'react-dom/client';
import { StrictMode } from 'react';

// Import client pages (only pages with 'use client' directive)
import LoginPage from '../app/pages/auth/login.tsx';
import RegisterPage from '../app/pages/auth/register.tsx';

// Route mapping for client pages
const clientRoutes: Record<string, React.ComponentType> = {
  '/auth/login': LoginPage,
  '/auth/register': RegisterPage,
};

const rootElement = document.getElementById('root');
const pathname = window.location.pathname;

// Only hydrate if this is a client page
const PageComponent = clientRoutes[pathname];

if (rootElement && PageComponent) {
  // Hydrate the client component
  hydrateRoot(
    rootElement,
    <StrictMode>
      <PageComponent />
    </StrictMode>,
    {
      onRecoverableError: (error: unknown) => {
        // Log hydration mismatches in development
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[VeloxTS] Hydration warning:', error);
        }
      },
    }
  );
} else if (!PageComponent) {
  // Server-only page, no hydration needed
  console.debug('[VeloxTS] Server-rendered page, no client hydration needed');
}
