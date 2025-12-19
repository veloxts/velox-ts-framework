/**
 * Rendering utilities for @veloxts/web
 *
 * Import from '@veloxts/web/rendering' for server and client rendering.
 *
 * @module @veloxts/web/rendering
 *
 * @example
 * ```typescript
 * // Server-side rendering
 * import { renderToStream, Document } from '@veloxts/web/rendering';
 *
 * // Client-side hydration
 * import { hydrate, getInitialData } from '@veloxts/web/rendering';
 *
 * // Flight utilities
 * import { createModuleMap, loadClientManifest } from '@veloxts/web/rendering';
 * ```
 */

// Client hydrator
export {
  extractInitialData,
  getInitialData,
  type HydrateOptions,
  type HydrateResult,
  hydrate,
  hydrateRoot,
  showErrorOverlay,
} from './client-hydrator.js';
// Document component
export { Document, default as DefaultDocument } from './document.js';
// Flight utilities
export {
  type ClientManifest,
  createEmptyModuleMap,
  createModuleMap,
  type FlightModuleMap,
  getClientComponentChunks,
  isClientComponent,
  loadClientManifest,
  resolveClientManifest,
} from './flight.js';
// Server renderer
export {
  type RenderToStreamOptions,
  renderToStream,
} from './server-renderer.js';
// SSR Handler
export { createSsrHandler, type SsrHandlerOptions } from './ssr-handler.js';
