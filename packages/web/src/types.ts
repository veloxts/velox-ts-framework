/**
 * @veloxts/web - Core Type Definitions
 *
 * Type definitions for React Server Components integration with VeloxTS.
 */

import type { FastifyInstance } from 'fastify';

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
 */
export interface VinxiRouter {
  name: string;
  type: 'http' | 'client' | 'static';
  handler?: string;
  target?: 'server' | 'browser';
  base?: string;
  dir?: string;
  routes?: VinxiRouteConfig[];
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
 * Handler type for Vinxi HTTP routers
 * Converts between Web API Request/Response and Fastify
 */
export type VinxiHandler = (request: Request) => Promise<Response> | Response;

/**
 * Options for creating the API handler
 */
export interface CreateApiHandlerOptions {
  /**
   * The Fastify instance to embed
   */
  app: FastifyInstance;

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
   * Route group (if any)
   */
  group?: string;

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
