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
export {
  extractInitialData,
  getInitialData,
  type HydrateOptions,
  type HydrateResult,
  hydrate,
  hydrateRoot,
  showErrorOverlay,
} from './rendering/client-hydrator.js';
export { Document } from './rendering/document.js';
export {
  type ClientManifest,
  createEmptyModuleMap,
  createModuleMap,
  type FlightModuleMap,
  getClientComponentChunks,
  isClientComponent,
  loadClientManifest,
  resolveClientManifest,
} from './rendering/flight.js';
// Rendering utilities
export {
  type RenderToStreamOptions,
  renderToStream,
} from './rendering/server-renderer.js';
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
  type FileRouter,
  type FileRouterOptions,
  parseFilePath,
  type SpecialPages,
} from './routing/file-router.js';

// Layout resolution
export {
  createLayoutResolver,
  type LayoutChain,
  type LayoutComponent,
  type LayoutResolver,
  type LayoutResolverOptions,
  wrapWithLayouts,
} from './routing/layouts.js';

// Server Actions
export {
  // Action creation
  createAction,
  createFormAction,
  // Result helpers
  error,
  isError,
  isSuccess,
  success,
  // Context utilities
  createActionContext,
  createAuthenticatedContext,
  isAuthenticatedContext,
  parseCookies,
  // Registry
  createActionRegistry,
  getActionRegistry,
  registerAction,
  resetActionRegistry,
  // tRPC Bridge
  createActions,
  createTrpcBridge,
  TrpcBridgeError,
  wrapProcedure,
} from './actions/index.js';

// Action types
export type {
  ActionBuilder,
  ActionContext,
  ActionError,
  ActionErrorCode,
  ActionHandler,
  ActionMetadata,
  ActionRegistry,
  ActionResult,
  ActionSuccess,
  AuthenticatedActionContext,
  CallableAction,
  CallableFormAction,
  CreateActionOptions,
  FormActionHandler,
  RegisteredAction,
  TrpcActionOptions,
  TrpcBridge,
  TrpcBridgeOptions,
  TrpcCaller,
} from './actions/index.js';

// Core types
export type {
  CreateApiHandlerOptions,
  DocumentProps,
  ErrorProps,
  FormAction,
  LayoutProps,
  LoadingProps,
  NotFoundProps,
  PageProps,
  ParsedRoute,
  ResolvedVeloxWebConfig,
  RouteMatch,
  ServerAction,
  SpecialPageType,
  VeloxWebConfig,
  VinxiHandler,
  VinxiRouteConfig,
  VinxiRouter,
} from './types.js';
