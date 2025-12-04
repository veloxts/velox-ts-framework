/**
 * REST adapter exports
 *
 * @module rest
 */

export type { RestAdapterOptions, RestRoute } from './adapter.js';
// REST adapter - public API
export {
  createRoutesRegistrar,
  generateRestRoutes,
  getRouteSummary,
  registerRestRoutes,
} from './adapter.js';
// Naming convention utilities - internal, exported for advanced use cases
export type { RestMapping } from './naming.js';
export {
  buildRestPath,
  followsNamingConvention,
  inferResourceName,
  parseNamingConvention,
} from './naming.js';
