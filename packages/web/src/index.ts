/**
 * @veloxts/web
 *
 * React Server Components integration for VeloxTS framework.
 *
 * ## Entry Points
 *
 * - `@veloxts/web` - Server-side code and build-time configuration (NO server-only guard)
 * - `@veloxts/web/server` - RSC server runtime (uses server-only guard)
 * - `@veloxts/web/client` - Browser-safe hooks and utilities
 * - `@veloxts/web/types` - Type definitions (isomorphic)
 *
 * ## Usage
 *
 * ```typescript
 * // Build-time configuration (app.config.ts) - runs in Node.js
 * import { defineVeloxApp } from '@veloxts/web';
 *
 * // Server action files ('use server') - runs in RSC context
 * import { authAction, validated } from '@veloxts/web/server';
 *
 * // Client components ('use client')
 * import { useAction, useFormAction } from '@veloxts/web/client';
 *
 * // Type imports (works anywhere)
 * import type { ActionResult, PageProps } from '@veloxts/web/types';
 * ```
 *
 * ## Why No server-only Guard Here?
 *
 * This module includes build-time configuration (`defineVeloxApp`) which runs
 * in Node.js context during Vinxi's config loading, NOT in React Server Component
 * context. The `server-only` package is designed to prevent client bundle inclusion,
 * but it incorrectly throws during legitimate Node.js build-time usage.
 *
 * RSC-specific runtime code is protected via:
 * - `@veloxts/web/server` - Has server-only guard for RSC server runtime
 * - `@veloxts/web/actions` - Has server-only guard for server actions
 *
 * @packageDocumentation
 */

export {
  getEnvConfig,
  resolveConfig,
  validateConfig,
} from './app/config.js';
// ============================================================================
// App Configuration (always server-side)
// ============================================================================
export {
  type ApiConfig,
  type BuildConfig,
  type DefineVeloxAppOptions,
  defineVeloxApp,
  type RoutingConfig,
  type ServerConfig,
} from './app/create-app.js';
// ============================================================================
// Rendering (Server-Side)
// ============================================================================
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
export {
  clearComponentCache,
  type RenderToStreamOptions,
  renderToStream,
} from './rendering/server-renderer.js';
export { createSsrHandler, type SsrHandlerOptions } from './rendering/ssr-handler.js';
// ============================================================================
// Routers (Vinxi configuration)
// ============================================================================
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
// ============================================================================
// File-Based Routing
// ============================================================================
export {
  createFileRouter,
  type FileRouter,
  type FileRouterOptions,
  parseFilePath,
  type SpecialPages,
} from './routing/file-router.js';
export {
  createLayoutResolver,
  type LayoutChain,
  type LayoutComponent as LayoutComponentType,
  type LayoutResolver,
  type LayoutResolverOptions,
  wrapWithLayouts,
} from './routing/layouts.js';
// NOTE: We intentionally do NOT re-export from ./server/index.js here
// because it has a 'server-only' guard that would block Vinxi config loading.
// Users should import server-only functionality from '@veloxts/web/server'.
// ============================================================================
// Types (isomorphic, also available via @veloxts/web/types)
// ============================================================================
export type {
  ActionError,
  ActionErrorCode,
  ActionResult,
  ActionSuccess,
  DocumentProps,
  ErrorProps,
  FormAction,
  LayoutComponent,
  LayoutConfig,
  LayoutMode,
  LayoutProps,
  LoadingProps,
  NotFoundProps,
  PageConfig,
  PageProps,
  ServerAction,
  SpecialPageType,
} from './types/index.js';
// ============================================================================
// Core Types (Vinxi/internal)
// ============================================================================
export type {
  CreateApiHandlerOptions,
  ParsedRoute,
  ResolvedVeloxWebConfig,
  RouteMatch,
  VeloxWebConfig,
  VinxiApp,
  VinxiAppOptions,
  VinxiHandler,
  VinxiResolvedRouter,
  VinxiRouteConfig,
  VinxiRouter,
} from './types.js';
// ============================================================================
// Utilities
// ============================================================================
export { escapeHtml } from './utils/html.js';
