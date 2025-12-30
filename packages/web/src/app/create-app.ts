/**
 * VeloxTS Web Application Factory
 *
 * Creates a Vinxi application with three routers:
 * 1. API router - Embeds Fastify for /api/* and /trpc/*
 * 2. Client router - Serves static assets from /_build/*
 * 3. SSR router - Renders React Server Components for all other routes
 */

import { createApp } from 'vinxi';
import { config as viteConfig } from 'vinxi/plugins/config';
import tsconfigPaths from 'vite-tsconfig-paths';

import type { ResolvedVeloxWebConfig, VeloxWebConfig, VinxiApp, VinxiRouter } from '../types.js';
import { getEnvConfig, resolveConfig, validateConfig } from './config.js';

/**
 * Node.js built-in modules that need browser stubs when bundling for the client.
 *
 * ## Why This Exists (TEMPORARY WORKAROUND)
 *
 * When Vite bundles client components that import server actions, it analyzes the
 * full import graph even though the server action code won't run on the client.
 * This causes errors when server-side packages (e.g., `@veloxts/auth`, Prisma)
 * have transitive dependencies on Node.js-only modules.
 *
 * Example error chain:
 * ```
 * login.tsx ('use client')
 *   -> imports login from 'app/actions/auth' ('use server')
 *     -> imports { authAction } from '@veloxts/web'
 *       -> imports { CompiledProcedure } from '@veloxts/router'
 *         -> imports from vinxi (has esbuild dep)
 *     -> imports { db } from '@/api/database'
 *       -> imports better-sqlite3 (native .node module)
 * ```
 *
 * ## Problems With This Approach
 *
 * 1. **Maintenance burden** - New Node.js deps require new stubs
 * 2. **Masks architectural violations** - Server code shouldn't reach client analysis
 * 3. **Bundle bloat** - Dead code paths included in client bundle
 * 4. **Type safety erosion** - Stubs are runtime no-ops with full types
 *
 * ## Proper Solution (TODO)
 *
 * 1. Split @veloxts/web exports: `@veloxts/web/client` vs `@veloxts/web/server`
 * 2. Use dynamic imports in server actions for heavy dependencies
 * 3. Use type-only imports for shared type definitions
 * 4. Leverage Vinxi's server function transform for proper isolation
 *
 * @see CLAUDE.md section "RSC Server/Client Separation" for architecture guidelines
 *
 * @internal
 */
const NODE_BUILTIN_STUBS: Record<string, string> = {
  // Core Node.js modules - provide empty stubs
  'node:fs': 'data:text/javascript,export default {};export const readFileSync=()=>"";export const existsSync=()=>false;export const mkdirSync=()=>{};export const writeFileSync=()=>{};export const readdirSync=()=>[];',
  'node:path': 'data:text/javascript,export default {};export const join=(...a)=>a.join("/");export const resolve=(...a)=>a.join("/");export const dirname=()=>"";export const basename=(p)=>p;export const extname=()=>"";export const sep="/";',
  'node:url': 'data:text/javascript,export default {};export const fileURLToPath=(u)=>u;export const pathToFileURL=(p)=>p;export const URL=globalThis.URL;',
  'node:crypto': 'data:text/javascript,export default {};export const randomBytes=()=>new Uint8Array(0);export const createHash=()=>({update:()=>({digest:()=>""}),digest:()=>""});export const randomUUID=()=>crypto.randomUUID();',
  'node:os': 'data:text/javascript,export default {};export const platform=()=>"browser";export const homedir=()=>"";export const tmpdir=()=>"/tmp";export const cpus=()=>[];export const hostname=()=>"localhost";',
  'node:process': 'data:text/javascript,export default {env:{},cwd:()=>"/",platform:"browser",version:"v0.0.0"};',
  'node:child_process': 'data:text/javascript,export default {};export const spawn=()=>({on:()=>{},stdout:{on:()=>{}},stderr:{on:()=>{}}});export const exec=()=>{};export const execSync=()=>"";',
  'node:util': 'data:text/javascript,export default {};export const promisify=(f)=>f;export const inspect=(o)=>String(o);export const format=(...a)=>a.join(" ");',
  'node:stream': 'data:text/javascript,export default {};export class Readable{};export class Writable{};export class Transform{};export class Duplex{};',
  'node:buffer': 'data:text/javascript,export const Buffer={from:()=>new Uint8Array(),alloc:()=>new Uint8Array(),isBuffer:()=>false};export default {Buffer};',
  'node:events': 'data:text/javascript,export default class EventEmitter{on(){}off(){}emit(){}once(){}};export {default as EventEmitter};',
  'node:assert': 'data:text/javascript,export default ()=>{};export const strict=()=>{};export const deepEqual=()=>{};export const equal=()=>{};',
  'node:http': 'data:text/javascript,export default {};export const createServer=()=>({listen:()=>{}});export const request=()=>({on:()=>{},end:()=>{}});',
  'node:https': 'data:text/javascript,export default {};export const createServer=()=>({listen:()=>{}});export const request=()=>({on:()=>{},end:()=>{}});',
  'node:net': 'data:text/javascript,export default {};export const createServer=()=>({listen:()=>{}});export const createConnection=()=>({on:()=>{},end:()=>{}});',
  'node:tls': 'data:text/javascript,export default {};export const createServer=()=>({listen:()=>{}});export const connect=()=>({on:()=>{},end:()=>{}});',
  'node:dns': 'data:text/javascript,export default {};export const lookup=()=>{};export const resolve=()=>{};',
  'node:zlib': 'data:text/javascript,export default {};export const gzip=()=>{};export const gunzip=()=>{};export const deflate=()=>{};export const inflate=()=>{};',
  'node:readline': 'data:text/javascript,export default {};export const createInterface=()=>({on:()=>{},close:()=>{}});',
  'node:querystring': 'data:text/javascript,export default {};export const parse=(s)=>Object.fromEntries(new URLSearchParams(s));export const stringify=(o)=>new URLSearchParams(o).toString();',
  'node:async_hooks': 'data:text/javascript,export default {};export const createHook=()=>({enable:()=>{},disable:()=>{}});export const AsyncResource=class{};',
  'node:perf_hooks': 'data:text/javascript,export default {};export const performance=globalThis.performance;',
  'node:worker_threads': 'data:text/javascript,export default {};export const isMainThread=true;export const parentPort=null;export const Worker=class{};',
  'node:module': 'data:text/javascript,export default {};export const createRequire=()=>()=>({});',
  // Native packages that cannot run in browser
  'esbuild': 'data:text/javascript,export default {};export const build=async()=>({});export const transform=async()=>({code:""});export const formatMessages=async()=>[];',
  'fsevents': 'data:text/javascript,export default {};',
  'lightningcss': 'data:text/javascript,export default {};export const transform=()=>({code:""});',
  'sharp': 'data:text/javascript,export default ()=>({resize:()=>({toBuffer:async()=>new Uint8Array()})});',
  'better-sqlite3': 'data:text/javascript,export default class Database{prepare(){return{run:()=>{},get:()=>null,all:()=>[]}}};',
  // Server framework packages
  'dotenv': 'data:text/javascript,export default {};export const config=()=>({});export const parse=()=>({});',
  'fastify': 'data:text/javascript,export default ()=>({register:()=>{},get:()=>{},post:()=>{},listen:async()=>{}});',
  'pino': 'data:text/javascript,export default ()=>({info:()=>{},error:()=>{},warn:()=>{},debug:()=>{}});',
};

/**
 * Server configuration options
 */
export interface ServerConfig {
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
}

/**
 * Routing configuration options
 */
export interface RoutingConfig {
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
}

/**
 * API configuration options
 */
export interface ApiConfig {
  /**
   * Base path prefix for API routes
   * @default '/api'
   */
  prefix?: string;

  /**
   * Path to the API handler module
   * @default './src/api/handler'
   */
  handlerPath?: string;
}

/**
 * Build configuration options
 */
export interface BuildConfig {
  /**
   * Output directory for builds
   * @default 'dist'
   */
  outDir?: string;

  /**
   * Base path for static assets (client bundle)
   * @default '/_build'
   */
  buildBase?: string;
}

/**
 * Options for defineVeloxApp (nested config format - legacy)
 */
export interface DefineVeloxAppNestedOptions {
  server?: ServerConfig;
  routing?: RoutingConfig;
  api?: ApiConfig;
  build?: BuildConfig;
  serverEntry?: string;
  clientEntry?: string;
  dev?: boolean;
}

/**
 * Flat options for defineVeloxApp (preferred, Laravel-style)
 *
 * All options have sensible defaults. You only need to specify what you want to change.
 */
export interface DefineVeloxAppOptions {
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
   * Base path prefix for API routes
   * @default '/api'
   */
  apiPrefix?: string;

  /**
   * Path to the API handler module
   * @default './src/api/handler'
   */
  apiHandler?: string;

  /**
   * Output directory for builds
   * @default 'dist'
   */
  outDir?: string;

  /**
   * Base path for static assets
   * @default '/_build'
   */
  buildBase?: string;

  /**
   * Path to the server entry point
   * @default './src/entry.server'
   */
  serverEntry?: string;

  /**
   * Path to the client entry point
   * @default './src/entry.client'
   */
  clientEntry?: string;

  /**
   * Enable development mode features (HMR, source maps)
   * @default process.env.NODE_ENV !== 'production'
   */
  dev?: boolean;

  // Nested options for backward compatibility
  server?: ServerConfig;
  routing?: RoutingConfig;
  api?: ApiConfig;
  build?: BuildConfig;
}

/**
 * Creates a Vinxi application configuration for VeloxTS.
 *
 * This is the main entry point for configuring a full-stack VeloxTS app
 * with React Server Components.
 *
 * @example Minimal (all defaults)
 * ```typescript
 * import { defineVeloxApp } from '@veloxts/web';
 * export default defineVeloxApp();
 * ```
 *
 * @example Flat config (preferred, Laravel-style)
 * ```typescript
 * import { defineVeloxApp } from '@veloxts/web';
 *
 * export default defineVeloxApp({
 *   port: 3030,
 *   apiPrefix: '/api',
 *   pagesDir: 'app/pages',
 * });
 * ```
 *
 * @example Nested config (backward compatible)
 * ```typescript
 * import { defineVeloxApp } from '@veloxts/web';
 *
 * export default defineVeloxApp({
 *   server: { port: 3030 },
 *   api: { prefix: '/api' },
 * });
 * ```
 */
export function defineVeloxApp(options: DefineVeloxAppOptions = {}): VinxiApp {
  // Merge environment config with provided options
  const envConfig = getEnvConfig();

  // Support both flat and nested config (flat takes precedence)
  const flatConfig: VeloxWebConfig = {
    // Flat options take precedence, then nested, then env defaults
    port: options.port ?? options.server?.port ?? envConfig.port,
    host: options.host ?? options.server?.host ?? envConfig.host,
    apiBase: options.apiPrefix ?? options.api?.prefix ?? envConfig.apiBase,
    buildBase: options.buildBase ?? options.build?.buildBase ?? envConfig.buildBase,
    pagesDir: options.pagesDir ?? options.routing?.pagesDir,
    layoutsDir: options.layoutsDir ?? options.routing?.layoutsDir,
    actionsDir: options.actionsDir ?? options.routing?.actionsDir,
    dev: options.dev ?? envConfig.dev,
  };

  // Resolve and validate configuration
  const config = resolveConfig(flatConfig);
  validateConfig(config);

  // Extract handler paths with defaults (flat takes precedence)
  const apiHandler = options.apiHandler ?? options.api?.handlerPath ?? './src/api/handler';
  const serverEntry = options.serverEntry ?? './src/entry.server';
  const clientEntry = options.clientEntry ?? './src/entry.client';

  // Build routers
  const routers = createRouters(config, {
    apiHandler,
    serverEntry,
    clientEntry,
  });

  // Create and return a proper Vinxi app with hooks, dev(), build() methods, etc.
  // Pass port/host through server config to make them available to the Vinxi dev server.
  // While Vinxi primarily uses CLI args and env vars for port, passing it in server config
  // ensures consistency and allows the config to be used in deployment scripts.
  return createApp({
    name: 'velox-app',
    server: {
      port: config.port,
      host: config.host,
    },
    routers,
  });
}

/**
 * Creates the three routers for the Vinxi application
 */
function createRouters(
  config: ResolvedVeloxWebConfig,
  handlers: {
    apiHandler: string;
    serverEntry: string;
    clientEntry: string;
  }
): VinxiRouter[] {
  return [
    // Router 1: API routes (Fastify embedded)
    createApiRouter(config, handlers.apiHandler),

    // Router 2: Client-side assets
    createClientRouter(config, handlers.clientEntry),

    // Router 3: SSR/RSC handler
    createSsrRouter(config, handlers.serverEntry),
  ];
}

/**
 * Creates the API router configuration
 *
 * This router handles both /api/* and /trpc/* routes by
 * embedding the Fastify application.
 */
function createApiRouter(config: ResolvedVeloxWebConfig, handlerPath: string): VinxiRouter {
  return {
    name: 'api',
    type: 'http',
    handler: handlerPath,
    target: 'server',
    base: config.apiBase,
    // Enable tsconfig path aliases (e.g., @/* → ./src/*)
    plugins: () => [tsconfigPaths()],
  };
}

/**
 * Creates the client router configuration
 *
 * This router serves the client-side JavaScript bundle
 * and other static assets.
 */
function createClientRouter(config: ResolvedVeloxWebConfig, entryPath: string): VinxiRouter {
  return {
    name: 'client',
    type: 'client',
    handler: entryPath,
    target: 'browser',
    base: config.buildBase,
    plugins: () => [
      // Enable tsconfig path aliases (e.g., @/* → ./src/*)
      tsconfigPaths(),
      // Provide browser stubs for Node.js built-in modules and native packages.
      // When server-side code gets pulled into the client bundle (e.g., through
      // server actions or shared imports), these stubs prevent bundling errors.
      viteConfig('velox-browser-stubs', {
        resolve: {
          alias: NODE_BUILTIN_STUBS,
        },
      }),
    ],
  };
}

/**
 * Creates the SSR router configuration
 *
 * This router handles all other routes by rendering
 * React Server Components.
 */
function createSsrRouter(_config: ResolvedVeloxWebConfig, entryPath: string): VinxiRouter {
  return {
    name: 'ssr',
    type: 'http',
    handler: entryPath,
    target: 'server',
    // No base = handles all routes not matched by other routers
    // Enable tsconfig path aliases (e.g., @/* → ./src/*, @/app/* → ./app/*)
    plugins: () => [tsconfigPaths()],
  };
}

/**
 * Re-export for convenience
 */
export { getEnvConfig, resolveConfig, validateConfig } from './config.js';
