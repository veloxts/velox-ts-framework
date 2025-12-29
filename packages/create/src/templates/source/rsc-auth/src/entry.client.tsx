/**
 * Client Entry Point
 *
 * Hydrates React client components on the client side.
 * Only pages marked with 'use client' need hydration.
 * Server-only components remain static HTML.
 *
 * IMPORTANT: The hydration tree must match exactly what the server rendered.
 * Server renders: <div id="root"><MinimalContent><Page /></MinimalContent></div>
 * Client hydrates: <MinimalContent><Page /></MinimalContent>
 */

import { hydrateRoot } from 'react-dom/client';
import { StrictMode } from 'react';

// Import client pages (only pages with 'use client' directive)
import LoginPage from '../app/pages/auth/login.tsx';
import RegisterPage from '../app/pages/auth/register.tsx';

// Import content layouts (shared between server and client)
import MinimalContent from '../app/layouts/minimal-content.tsx';

// Route mapping for client pages with their layouts
// The layout must match what the server rendered inside <div id="root">
interface ClientRoute {
  Page: React.ComponentType;
  Layout: React.ComponentType<{ children: React.ReactNode }>;
}

const clientRoutes: Record<string, ClientRoute> = {
  '/auth/login': { Page: LoginPage, Layout: MinimalContent },
  '/auth/register': { Page: RegisterPage, Layout: MinimalContent },
};

const rootElement = document.getElementById('root');
const pathname = window.location.pathname;

// Only hydrate if this is a client page
const match = clientRoutes[pathname];

if (rootElement && match) {
  const { Page, Layout } = match;

  // Hydrate with the exact same tree structure as server rendered
  hydrateRoot(
    rootElement,
    <StrictMode>
      <Layout>
        <Page />
      </Layout>
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
} else {
  // Server-only page, no hydration needed
  console.debug('[VeloxTS] Server-rendered page, no client hydration needed');
}
