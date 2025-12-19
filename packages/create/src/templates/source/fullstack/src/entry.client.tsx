/**
 * Client Entry Point
 *
 * Hydrates the React application on the client side.
 */

import { hydrate } from '@veloxts/web/rendering';

// Hydrate with the root element's existing content
// The server-rendered HTML is already in the DOM
// We just need to attach event handlers and make it interactive
const rootElement = document.getElementById('root');

if (rootElement) {
  // Hydrate using the existing server-rendered content
  hydrate(rootElement.firstElementChild, {
    rootElement,
  });
} else {
  console.error('[VeloxTS] Root element not found. Ensure #root exists in the document.');
}
