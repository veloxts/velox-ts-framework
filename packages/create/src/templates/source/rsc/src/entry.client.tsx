/**
 * Client Entry Point
 *
 * Handles client-side hydration for pages marked with 'use client'.
 * Server Components remain as static HTML without hydration.
 *
 * This template has no client components by default.
 * To add interactive pages, create them with 'use client' directive
 * and register them in the clientRoutes map below.
 */

import { hydrateRoot } from 'react-dom/client';
import { StrictMode } from 'react';

// Import client pages here when you add them
// Example: import MyClientPage from '../app/pages/my-page.tsx';

// Route mapping for client pages
// Add entries like: '/my-page': MyClientPage
const clientRoutes: Record<string, React.ComponentType> = {
  // No client pages by default in the RSC template
};

const rootElement = document.getElementById('root');
const pathname = window.location.pathname;

// Only hydrate if this is a client page
const PageComponent = clientRoutes[pathname];

if (rootElement && PageComponent) {
  hydrateRoot(
    rootElement,
    <StrictMode>
      <PageComponent />
    </StrictMode>,
    {
      onRecoverableError: (error: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[VeloxTS] Hydration warning:', error);
        }
      },
    }
  );
} else {
  // Server-only page, no hydration needed
  console.debug('[VeloxTS] Server-rendered page, no client hydration needed');
}
