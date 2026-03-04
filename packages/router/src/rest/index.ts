/**
 * REST adapter exports
 *
 * @module rest
 */

export type {
  GenerateRestRoutesOptions,
  RestAdapterOptions,
  RestPlugin,
  RestRoute,
} from './adapter.js';
export {
  generateRestRoutes,
  getRouteSummary,
  registerRestRoutes,
  rest,
} from './adapter.js';
// Naming convention utilities - internal, exported for advanced use cases
export type { RestMapping } from './naming.js';
export {
  buildMultiLevelNestedPath,
  buildNestedRestPath,
  buildRestPath,
  calculateNestingDepth,
  followsNamingConvention,
  inferResourceName,
  parseNamingConvention,
} from './naming.js';
// Collection registry - for swagger auto-discovery
export type { RegisteredCollection } from './registry.js';
export {
  clearCollectionRegistry,
  getRegisteredCollections,
  registerCollections,
} from './registry.js';
// Route extraction - for frontend client configuration
export type { ExtractRoutesType, RouteEntry, RouteMap } from './routes.js';
export { extractRoutes } from './routes.js';
