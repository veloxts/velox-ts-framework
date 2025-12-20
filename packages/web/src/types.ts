/**
 * @veloxts/web - Core Type Definitions
 *
 * Type definitions for React Server Components integration with VeloxTS.
 */

import type { FastifyInstance } from 'fastify';

/**
 * Simplified Hookable interface (from hookable package)
 * We define this locally to avoid adding hookable as a dependency
 */
interface Hookable {
  hook<NameT extends string>(name: NameT, fn: (...args: unknown[]) => unknown): () => void;
  callHook<NameT extends string>(name: NameT, ...args: unknown[]): Promise<void>;
  afterEach(fn: (result: { name: string; args: unknown[] }) => void): void;
}

/**
 * Simplified NitroConfig interface (from nitropack)
 * We only include the properties relevant to Vinxi server configuration
 */
interface NitroServerConfig {
  preset?: string;
  prerender?: {
    routes?: string[];
    crawlLinks?: boolean;
  };
  routeRules?: Record<string, unknown>;
  baseURL?: string;
  runtimeConfig?: Record<string, unknown>;
  storage?: Record<string, unknown>;
  devStorage?: Record<string, unknown>;
  timing?: boolean;
  renderer?: string;
  serveStatic?: boolean | 'node' | 'deno';
  noPublicDir?: boolean;
  publicAssets?: Array<{ dir?: string; baseURL?: string; maxAge?: number }>;
  compressPublicAssets?: boolean | { gzip?: boolean; brotli?: boolean };
  node?: boolean;
  sourceMap?: boolean | 'inline' | 'hidden';
  minify?: boolean;
  externals?: {
    external?: string[];
    inline?: string[];
    trace?: boolean;
    traceOptions?: Record<string, unknown>;
  };
  moduleSideEffects?: string[];
  typescript?: {
    strict?: boolean;
    generateTsConfig?: boolean;
    internalPaths?: boolean;
  };
  hooks?: Record<string, (...args: unknown[]) => void | Promise<void>>;
  plugins?: string[];
  esbuild?: {
    options?: Record<string, unknown>;
  };
  rollupConfig?: Record<string, unknown>;
  analyze?: boolean | { filename?: string };
  experimental?: Record<string, unknown>;
  future?: Record<string, unknown>;
  logLevel?: number;
}

/**
 * Configuration for the VeloxTS web application
 */
export interface VeloxWebConfig {
  /**
   * Port to run the server on
   * @default 3030
   */
  port?: number;

  /**
   * Host to bind the server to
   * @default 'localhost'
   */
  host?: string;

  /**
   * Base path for API routes
   * @default '/api'
   */
  apiBase?: string;

  /**
   * Base path for tRPC routes
   * @default '/trpc'
   */
  trpcBase?: string;

  /**
   * Base path for static assets (client bundle)
   * @default '/_build'
   */
  buildBase?: string;

  /**
   * Directory containing page components
   * @default 'app/pages'
   */
  pagesDir?: string;

  /**
   * Directory containing layout components
   * @default 'app/layouts'
   */
  layoutsDir?: string;

  /**
   * Directory containing server actions
   * @default 'app/actions'
   */
  actionsDir?: string;

  /**
   * Enable development mode features (HMR, source maps)
   * @default process.env.NODE_ENV !== 'production'
   */
  dev?: boolean;
}

/**
 * Resolved configuration with all defaults applied
 */
export interface ResolvedVeloxWebConfig {
  port: number;
  host: string;
  apiBase: string;
  trpcBase: string;
  buildBase: string;
  pagesDir: string;
  layoutsDir: string;
  actionsDir: string;
  dev: boolean;
}

/**
 * Vinxi router definition for the VeloxTS application
 *
 * Matches Vinxi's expected router schema input types:
 * - 'http': Server-side HTTP handlers
 * - 'client': Browser-side JavaScript bundles
 * - 'static': Static file serving
 * - 'spa': Single-page application mode
 */
export interface VinxiRouter {
  /** Unique name for this router */
  name: string;

  /** Router type determines how Vinxi processes and serves this router */
  type: 'http' | 'client' | 'static' | 'spa';

  /** Path to the handler module (required for http, client, spa) */
  handler?: string;

  /** Build target: 'server' for Node.js, 'browser' for client bundles */
  target?: 'server' | 'browser';

  /** Base URL path for this router (defaults to '/') */
  base?: string;

  /** Root directory for this router (optional, defaults to project root) */
  root?: string;

  /** Directory for static assets (required for 'static' type) */
  dir?: string;

  /** Output directory for builds (optional) */
  outDir?: string;

  /** Custom routes configuration */
  routes?: VinxiRouteConfig[] | VinxiRoutesFn;

  /** Whether to build this router (for http type) */
  build?: boolean;

  /** Whether to run in a worker (for http type) */
  worker?: boolean;

  /** Middleware module path (for http type) */
  middleware?: string;

  /** Vite plugins function */
  plugins?: () => unknown[];

  /** File extensions to process */
  extensions?: string[];
}

/**
 * Routes function signature for dynamic route generation
 */
export type VinxiRoutesFn = (router: VinxiRouter, app: VinxiAppOptions) => VinxiCompiledRouter;

/**
 * Compiled router interface (simplified)
 */
export interface VinxiCompiledRouter {
  getRoutes(): VinxiRouteConfig[];
}

/**
 * Vinxi route configuration
 */
export interface VinxiRouteConfig {
  path: string;
  component?: string;
  layout?: string;
  children?: VinxiRouteConfig[];
}

/**
 * Vinxi app options passed to createApp()
 */
export interface VinxiAppOptions {
  /** Application name */
  name?: string;

  /** Server configuration (Nitro-compatible) */
  server?: NitroServerConfig & {
    port?: number;
    host?: string;
  };

  /** Router configurations */
  routers?: VinxiRouter[];

  /** Root directory */
  root?: string;

  /** Build mode */
  mode?: string;

  /** Enable devtools */
  devtools?: boolean;
}

/**
 * Vinxi App instance returned by createApp()
 *
 * This is the runtime application object with hooks, methods for
 * running dev server, building, and managing routers.
 */
export interface VinxiApp {
  /** Resolved application configuration */
  config: {
    name: string;
    devtools?: boolean;
    server: NitroServerConfig & { port?: number; host?: string };
    routers: VinxiResolvedRouter[];
    root: string;
    mode?: string;
  };

  /** Add a router dynamically */
  addRouter: (router: VinxiRouter) => VinxiApp;

  /** Add plugins to routers matching a filter */
  addRouterPlugins: (
    apply: (router: VinxiResolvedRouter) => boolean,
    plugins: () => unknown[]
  ) => void;

  /** Get a router by name */
  getRouter: (name: string) => VinxiResolvedRouter;

  /** Resolve a module path */
  resolveSync: (mod: string) => string;

  /** Dynamically import a module */
  import: (mod: string) => Promise<unknown>;

  /** Apply a stack function to the app */
  stack: (stack: (app: VinxiApp) => void | Promise<void>) => Promise<VinxiApp>;

  /** Start the development server */
  dev: () => Promise<void>;

  /** Build the application */
  build: () => Promise<void>;

  /** Hookable instance for lifecycle events */
  hooks: Hookable;
}

/**
 * Resolved router with additional computed properties
 */
export interface VinxiResolvedRouter extends VinxiRouter {
  /** Resolved base path */
  base: string;

  /** Router order in the stack */
  order: number;

  /** Resolved output directory */
  outDir: string;

  /** Resolved root directory */
  root: string;

  /** Internal router state */
  internals: {
    routes?: VinxiCompiledRouter;
    devServer?: unknown;
    appWorker?: unknown;
    type: unknown;
  };
}

/**
 * Handler type for Vinxi HTTP routers
 * Converts between Web API Request/Response and Fastify
 */
export type VinxiHandler = (request: Request) => Promise<Response> | Response;

/**
 * Options for creating the API handler
 */
export interface CreateApiHandlerOptions {
  /**
   * The Fastify instance to embed, or a factory function that returns one.
   * Factory function enables lazy initialization to avoid module evaluation issues.
   */
  app: FastifyInstance | (() => Promise<FastifyInstance>);

  /**
   * Base path for API routes (used for path stripping)
   * @default '/api'
   */
  basePath?: string;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;
}

/**
 * Route pattern parsed from file path
 */
export interface ParsedRoute {
  /**
   * Original file path relative to pages directory
   */
  filePath: string;

  /**
   * URL pattern (e.g., '/users/:id')
   */
  pattern: string;

  /**
   * Dynamic segments extracted from pattern
   */
  params: string[];

  /**
   * Whether this is a catch-all route
   */
  catchAll: boolean;

  /**
   * Route groups this route belongs to (in order from outermost to innermost)
   * e.g., `(auth)/(admin)/users.tsx` → ['auth', 'admin']
   */
  groups?: string[];

  /**
   * Associated layout file (if any)
   */
  layout?: string;
}

/**
 * Route match result
 */
export interface RouteMatch {
  /**
   * The matched route
   */
  route: ParsedRoute;

  /**
   * Extracted parameter values
   */
  params: Record<string, string>;
}

/**
 * Special page types for error handling
 */
export type SpecialPageType = 'not-found' | 'error' | 'loading';

/**
 * Props passed to not-found (404) page
 */
export interface NotFoundProps {
  /**
   * The path that was not found
   */
  pathname: string;
}

/**
 * Props passed to loading page/component
 */
export interface LoadingProps {
  /**
   * Optional message to display
   */
  message?: string;
}

/**
 * Props passed to page components
 */
export interface PageProps<TParams = Record<string, string>> {
  /**
   * Route parameters extracted from URL
   */
  params: TParams;

  /**
   * Search parameters from query string
   */
  searchParams: Record<string, string | string[]>;
}

/**
 * Props passed to layout components
 */
export interface LayoutProps {
  /**
   * Child content to render
   */
  children: React.ReactNode;

  /**
   * Route parameters (available in nested layouts)
   */
  params?: Record<string, string>;
}

/**
 * Props passed to error boundary components
 */
export interface ErrorProps {
  /**
   * The error that was thrown
   */
  error: Error;

  /**
   * Function to retry rendering
   */
  reset: () => void;
}

/**
 * Server action function type
 */
export type ServerAction<TInput = unknown, TOutput = unknown> = (input: TInput) => Promise<TOutput>;

/**
 * Server action with form data support
 */
export type FormAction<TOutput = unknown> = (formData: FormData) => Promise<TOutput>;

/**
 * Document component props for HTML wrapper
 */
export interface DocumentProps {
  /**
   * Content to render in <head>
   */
  head?: React.ReactNode;

  /**
   * Main page content
   */
  children: React.ReactNode;

  /**
   * Bootstrap scripts to include
   */
  scripts?: string[];

  /**
   * Initial data for hydration
   */
  initialData?: unknown;

  /**
   * Document language
   * @default 'en'
   */
  lang?: string;
}
