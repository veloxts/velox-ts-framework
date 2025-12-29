/**
 * Client Entry Point
 *
 * Handles client-side hydration for pages marked with 'use client'.
 * Server Components remain as static HTML without hydration.
 *
 * IMPORTANT: The hydration tree must match exactly what the server rendered.
 * Server renders: <div id="root"><MinimalContent><Page /></MinimalContent></div>
 * Client hydrates: <MinimalContent><Page /></MinimalContent>
 *
 * This template has no client components by default.
 * To add interactive pages:
 * 1. Create a page with 'use client' directive
 * 2. Import it here
 * 3. Add it to clientRoutes with its layout
 *
 * @example
 * import MyPage from '../app/pages/my-page.tsx';
 * import MinimalContent from '../app/layouts/minimal-content.tsx';
 *
 * const clientRoutes: Record<string, ClientRoute> = {
 *   '/my-page': { Page: MyPage, Layout: MinimalContent },
 * };
 */

import { hydrateRoot } from 'react-dom/client';
import { StrictMode } from 'react';

// Import content layouts (shared between server and client)
import MinimalContent from '../app/layouts/minimal-content.tsx';

// Route mapping for client pages with their layouts
// The layout must match what the server rendered inside <div id="root">
interface ClientRoute {
  Page: React.ComponentType;
  Layout: React.ComponentType<{ children: React.ReactNode }>;
}

const clientRoutes: Record<string, ClientRoute> = {
  // No client pages by default in the RSC template
  // Example: '/my-page': { Page: MyPage, Layout: MinimalContent },
};

// Suppress unused variable warning - MinimalContent is imported for documentation
void MinimalContent;

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
