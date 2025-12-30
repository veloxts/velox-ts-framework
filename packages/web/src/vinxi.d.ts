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
