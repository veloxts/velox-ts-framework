/**
 * Type declarations for the 'vinxi' module
 *
 * Vinxi is a meta-framework build tool that doesn't ship TypeScript declarations.
 * This module provides the minimal type declarations needed for VeloxTS integration.
 */

declare module 'vinxi' {
  import type { VinxiApp, VinxiAppOptions } from './types.js';

  /**
   * Creates a Vinxi application instance
   *
   * @param options - Application configuration options
   * @returns A Vinxi app instance with dev(), build(), hooks, and router management
   */
  export function createApp(options?: VinxiAppOptions): VinxiApp;

  /**
   * Resolves a module path relative to the app root
   */
  export function resolve(path: string): string;
}

/**
 * Vinxi plugins/config module for custom Vite configuration
 *
 * The config helper allows adding custom Vite options to Vinxi routers.
 */
declare module 'vinxi/plugins/config' {
  import type { Plugin } from 'vite';

  /**
   * Vite configuration options that can be passed to the config plugin.
   * This is a subset of UserConfig focused on commonly needed options.
   */
  interface ViteConfigOptions {
    /**
     * Module resolution options
     */
    resolve?: {
      /**
       * Aliases for module resolution.
       * Can map module names to replacement modules or inline data URIs.
       */
      alias?: Record<string, string>;
    };
    /**
     * Dependency optimization options
     */
    optimizeDeps?: {
      /**
       * Dependencies to exclude from pre-bundling
       */
      exclude?: string[];
      /**
       * Dependencies to force include in pre-bundling
       */
      include?: string[];
    };
    /**
     * Build options
     */
    build?: {
      /**
       * External dependencies to exclude from bundle
       */
      external?: string[];
      /**
       * Rollup options
       */
      rollupOptions?: {
        external?: string[];
      };
    };
    /**
     * SSR-specific options
     */
    ssr?: {
      /**
       * External dependencies for SSR
       */
      external?: string[];
      /**
       * Dependencies to bundle for SSR
       */
      noExternal?: string[];
    };
  }

  /**
   * Creates a Vite plugin that merges custom configuration options.
   *
   * @param name - Unique name for this config plugin
   * @param options - Vite configuration options to merge
   * @returns A Vite plugin
   *
   * @example
   * ```typescript
   * import { config } from 'vinxi/plugins/config';
   *
   * plugins: () => [
   *   config('my-config', {
   *     optimizeDeps: {
   *       exclude: ['native-module'],
   *     },
   *   }),
   * ]
   * ```
   */
  export function config(name: string, options: ViteConfigOptions): Plugin;
}

/**
 * Type declarations for '@vinxi/server-functions/plugin'
 *
 * Provides type-safe server function support for Vinxi applications.
 * Enables 'use server' directive transformation and RPC handling.
 */
declare module '@vinxi/server-functions/plugin' {
  import type { Plugin } from 'vite';
  import type { VinxiRouter } from './types.js';

  /**
   * Server functions plugin configuration options
   */
  interface ServerFunctionsRouterOptions {
    /**
     * Additional Vite plugins to include in the server functions router
     */
    plugins?: () => Plugin[];
  }

  /**
   * Server functions plugin API
   */
  export const serverFunctions: {
    /**
     * Client-side Vite plugin that transforms 'use server' directives
     *
     * This plugin:
     * - Detects files with 'use server' at the top
     * - Replaces server function implementations with RPC stubs
     * - Prevents server-only code from being bundled into the client
     *
     * MUST be added to both client and SSR routers.
     */
    client: () => Plugin;

    /**
     * Creates a dedicated router for handling server function RPC calls
     *
     * This router:
     * - Handles POST requests to server function endpoints
     * - Executes the actual server-side function implementation
     * - Serializes and returns the result
     *
     * @param options - Configuration options for the router
     * @returns A Vinxi router configuration
     */
    router: (options?: ServerFunctionsRouterOptions) => VinxiRouter;
  };
}
