/**
 * Client Entry Point
 *
 * Hydrates the React application on the client side.
 * For RSC apps, Vinxi handles the component streaming and hydration.
 * We just need to initialize the hydration process with the root container.
 */

import { hydrateRoot } from 'react-dom/client';

const rootElement = document.getElementById('root');

if (rootElement) {
  // For RSC, the server streams the component tree via React Flight.
  // The firstElementChild contains the server-rendered React tree.
  // We hydrate it to attach event handlers and make it interactive.
  hydrateRoot(rootElement, rootElement.firstElementChild as unknown as React.ReactNode);
} else {
  console.error('[VeloxTS] Root element not found. Ensure #root exists in the document.');
}
