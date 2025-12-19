/**
 * Server Entry Point
 *
 * Handles server-side rendering of React Server Components.
 */

import { createSsrHandler } from '@veloxts/web';

// Export the SSR handler for Vinxi
export default createSsrHandler({
  // RSC rendering configuration
  streaming: true,
  shellTimeout: 5000,
});
