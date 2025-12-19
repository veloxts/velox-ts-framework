/**
 * @veloxts/web
 *
 * React Server Components integration for VeloxTS framework.
 * Provides a unified full-stack experience with type-safe APIs
 * and modern React patterns.
 *
 * @packageDocumentation
 */

// Fastify adapter
export {
  createApiHandler,
  isFastifyInstance,
} from './adapters/fastify-adapter.js';
export {
  getEnvConfig,
  resolveConfig,
  validateConfig,
} from './app/config.js';
// App configuration
export {
  type DefineVeloxAppOptions,
  defineVeloxApp,
} from './app/create-app.js';
// Routers
export {
  type ApiRouterOptions,
  createApiRouter,
  isApiError,
} from './routers/api-router.js';
export {
  type ClientRouterOptions,
  defaultClientConfig,
  getCacheHeaders,
  getContentType,
} from './routers/client-router.js';
export {
  createSsrRouter,
  type SsrRouterOptions,
} from './routers/ssr-router.js';
// File-based routing
export {
  createFileRouter,
  parseFilePath,
  type FileRouter,
  type FileRouterOptions,
} from './routing/file-router.js';
// Core types
export type {
  CreateApiHandlerOptions,
  DocumentProps,
  ErrorProps,
  FormAction,
  LayoutProps,
  PageProps,
  ParsedRoute,
  ResolvedVeloxWebConfig,
  RouteMatch,
  ServerAction,
  VeloxWebConfig,
  VinxiHandler,
  VinxiRouteConfig,
  VinxiRouter,
} from './types.js';
