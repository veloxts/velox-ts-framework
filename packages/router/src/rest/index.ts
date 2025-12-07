/**
 * REST adapter exports
 *
 * @module rest
 */

export type { RestAdapterOptions, RestPlugin, RestRoute } from './adapter.js';
// REST adapter - public API
export {
  // Legacy API (deprecated)
  createRoutesRegistrar,
  // Internal utilities
  generateRestRoutes,
  getRouteSummary,
  registerRestRoutes,
  // Succinct API (preferred)
  rest,
} from './adapter.js';
// Naming convention utilities - internal, exported for advanced use cases
export type { RestMapping } from './naming.js';
export {
  buildNestedRestPath,
  buildRestPath,
  followsNamingConvention,
  inferResourceName,
  parseNamingConvention,
} from './naming.js';
