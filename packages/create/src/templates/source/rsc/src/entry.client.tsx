/**
 * Client Entry Point
 *
 * Hydrates the React application on the client side.
 * For SSR apps, the server streams the component tree as HTML.
 * We hydrate the existing DOM to attach event handlers.
 */

import { hydrateRoot } from '@veloxts/web';

const rootElement = document.getElementById('root');

if (rootElement?.firstElementChild) {
  // Hydrate the server-rendered React tree
  // This attaches event handlers and makes the app interactive
  hydrateRoot(rootElement, rootElement.firstElementChild as unknown as React.ReactNode, {
    onRecoverableError: (error: unknown) => {
      // Log hydration mismatches in development
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[VeloxTS] Hydration warning:', error);
      }
    },
  });
} else {
  console.error(
    '[VeloxTS] Root element or content not found. Ensure #root exists with server-rendered content.'
  );
}
