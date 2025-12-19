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
