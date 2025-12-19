/**
 * Routing Module
 *
 * File-based routing and layout resolution for VeloxTS applications.
 *
 * @module @veloxts/web/routing
 */

// File router
export {
  createFileRouter,
  type FileRouter,
  type FileRouterOptions,
  parseFilePath,
} from './file-router.js';
// Layout resolver
export {
  createLayoutResolver,
  type LayoutChain,
  type LayoutComponent,
  type LayoutResolver,
  type LayoutResolverOptions,
  wrapWithLayouts,
} from './layouts.js';
