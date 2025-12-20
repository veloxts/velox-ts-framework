/**
 * @veloxts/web
 *
 * React Server Components integration for VeloxTS framework.
 * Provides a unified full-stack experience with type-safe APIs
 * and modern React patterns.
 *
 * @packageDocumentation
 */

// Action types
export type {
  Action,
  ActionBuilder,
  ActionConfig,
  ActionContext,
  ActionError,
  ActionErrorCode,
  ActionHandler,
  ActionHandlerFn,
  ActionMetadata,
  ActionRegistry,
  ActionResult,
  ActionSuccess,
  AuthenticatedActionContext,
  CallableAction,
  CallableFormAction,
  CreateActionOptions,
  ErrorHandler,
  FluentActionBuilder,
  FormActionHandler,
  RegisteredAction,
  TrpcActionOptions,
  TrpcBridge,
  TrpcBridgeOptions,
  TrpcCaller,
  ValidatedAction,
} from './actions/index.js';
// New action() helper - recommended API
// Server Actions (legacy API - still supported)
export {
  action,
  // Action creation
  createAction,
  // Context utilities
  createActionContext,
  // Registry
  createActionRegistry,
  // tRPC Bridge
  createActions,
  createAuthenticatedContext,
  createFormAction,
  createTrpcBridge,
  // Result helpers
  error,
  getActionRegistry,
  isAuthenticatedContext,
  isError,
  isSuccess,
  parseCookies,
  registerAction,
  resetActionRegistry,
  success,
  TrpcBridgeError,
  wrapProcedure,
} from './actions/index.js';
// Fastify adapter
export {
  createApiHandler,
  createH3ApiHandler,
  isFastifyInstance,
} from './adapters/fastify-adapter.js';
export type {
  AuthenticatedH3ActionContext,
  H3ActionContext,
  H3AdapterConfig,
  H3AuthAdapter,
  H3CookieOptions,
} from './adapters/h3-adapter.js';
// H3/Vinxi auth adapter for RSC server actions
export {
  createH3Action,
  createH3AuthAdapter,
  createH3Context,
  createMockAuthenticatedH3Context,
  createMockH3Context,
  H3AuthError,
  isAuthenticatedH3Context,
  isH3Context,
  resetH3Utilities,
} from './adapters/h3-adapter.js';
export {
  getEnvConfig,
  resolveConfig,
  validateConfig,
} from './app/config.js';
// App configuration
export {
  type ApiConfig,
  type BuildConfig,
  type DefineVeloxAppOptions,
  defineVeloxApp,
  type RoutingConfig,
  type ServerConfig,
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
// SSR Handler
export { createSsrHandler, type SsrHandlerOptions } from './rendering/ssr-handler.js';
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
  type H3Event,
  type H3EventHandler,
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
// Utilities
export { escapeHtml } from './utils/html.js';
