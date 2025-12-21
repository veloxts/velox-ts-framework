/**
 * REST adapter exports
 *
 * @module rest
 */

export type { RestAdapterOptions, RestPlugin, RestRoute } from './adapter.js';
export {
  generateRestRoutes,
  getRouteSummary,
  registerRestRoutes,
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
// Route extraction - for frontend client configuration
export type { ExtractRoutesType, RouteMap } from './routes.js';
export { extractRoutes } from './routes.js';
