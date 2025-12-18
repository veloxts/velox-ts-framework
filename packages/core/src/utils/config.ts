/**
 * Configuration types and utilities for VeloxTS application
 * @module utils/config
 */

import type { FastifyLoggerOptions, FastifyServerOptions } from 'fastify';

// ============================================================================
// Branded Types for Validated Values
// ============================================================================

/**
 * Brand symbol for validated port numbers
 */
declare const ValidPortBrand: unique symbol;

/**
 * Branded type for validated port numbers (0-65535)
 *
 * Values of this type have been validated and are guaranteed to be
 * valid port numbers. Use `isValidPort()` to narrow a number to this type.
 *
 * @example
 * ```typescript
 * function listen(port: ValidPort) {
 *   // port is guaranteed to be 0-65535
 * }
 *
 * const port = 3030;
 * if (isValidPort(port)) {
 *   listen(port); // TypeScript knows port is ValidPort here
 * }
 * ```
 */
export type ValidPort = number & { readonly [ValidPortBrand]: typeof ValidPortBrand };

/**
 * Brand symbol for validated host strings
 */
declare const ValidHostBrand: unique symbol;

/**
 * Branded type for validated host strings
 *
 * Values of this type have been validated and are guaranteed to be
 * non-empty strings. Use `isValidHost()` to narrow a string to this type.
 */
export type ValidHost = string & { readonly [ValidHostBrand]: typeof ValidHostBrand };

// ============================================================================
// Fastify Options Types
// ============================================================================

/**
 * VeloxTS-specific Fastify options (excluding options VeloxTS controls)
 *
 * The `logger` option is excluded because VeloxTS controls logging
 * through the top-level `logger` configuration option.
 *
 * @example
 * ```typescript
 * const config: VeloxAppConfig = {
 *   logger: true, // Use this for logging
 *   fastify: {
 *     // logger is NOT allowed here - TypeScript will error
 *     trustProxy: true,
 *     maxParamLength: 200,
 *   }
 * };
 * ```
 */
export type VeloxFastifyOptions = Omit<FastifyServerOptions, 'logger'>;

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for creating a VeloxTS application
 *
 * @example
 * ```typescript
 * const config: VeloxAppConfig = {
 *   port: 3030,
 *   host: '0.0.0.0',
 *   logger: true
 * };
 * ```
 */
export interface VeloxAppConfig {
  /**
   * Port to listen on
   * @default 3030
   */
  port?: number;

  /**
   * Host to bind to
   * @default '0.0.0.0'
   */
  host?: string;

  /**
   * Enable Fastify logger
   * - `true` enables default logger
   * - `false` disables logging
   * - Object provides custom logger configuration
   *
   * @default true in development, false in production
   */
  logger?: boolean | FastifyLoggerOptions;

  /**
   * Custom Fastify options (escape hatch for advanced usage)
   * Allows full control over Fastify server configuration.
   *
   * Note: The `logger` option should be set via the top-level `logger`
   * config, not here. TypeScript will prevent setting it in `fastify`.
   *
   * @default {}
   */
  fastify?: VeloxFastifyOptions;
}

/**
 * Deeply readonly version of VeloxAppConfig after merging with defaults
 *
 * Configuration is frozen after initialization to prevent accidental mutation.
 */
export type FrozenVeloxAppConfig = Readonly<{
  port: ValidPort;
  host: ValidHost;
  logger: boolean | FastifyLoggerOptions;
  fastify: VeloxFastifyOptions;
}>;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  port: 3030,
  host: '0.0.0.0',
  logger: process.env.NODE_ENV !== 'production',
} as const;

// ============================================================================
// Type Guards (Branded Type Validators)
// ============================================================================

/**
 * Type guard that validates and narrows port to ValidPort
 *
 * @param port - Port number to validate
 * @returns true if port is valid (0-65535), narrowing to ValidPort
 *
 * @example
 * ```typescript
 * const port = 3030;
 * if (isValidPort(port)) {
 *   // port is narrowed to ValidPort
 *   startServer(port);
 * }
 * ```
 */
export function isValidPort(port: number): port is ValidPort {
  return Number.isInteger(port) && port >= 0 && port <= 65535;
}

/**
 * Type guard that validates and narrows host to ValidHost
 *
 * @param host - Host string to validate
 * @returns true if host is valid (non-empty string), narrowing to ValidHost
 */
export function isValidHost(host: string): host is ValidHost {
  return typeof host === 'string' && host.length > 0;
}

// ============================================================================
// Configuration Functions
// ============================================================================

/**
 * Merges user configuration with defaults
 *
 * @param userConfig - User-provided configuration
 * @returns Complete configuration with defaults applied (not yet validated)
 *
 * @example
 * ```typescript
 * const config = mergeConfig({ port: 4000 });
 * // Result: { port: 4000, host: '0.0.0.0', logger: true, fastify: {} }
 * ```
 */
export function mergeConfig(userConfig: VeloxAppConfig = {}): Required<VeloxAppConfig> {
  return {
    port: userConfig.port ?? DEFAULT_CONFIG.port,
    host: userConfig.host ?? DEFAULT_CONFIG.host,
    logger: userConfig.logger ?? DEFAULT_CONFIG.logger,
    fastify: userConfig.fastify ?? {},
  };
}

/**
 * Validates configuration and returns a frozen, type-safe config object
 *
 * The returned config has branded types that guarantee validation has occurred.
 * The object is frozen at runtime to prevent accidental mutation.
 *
 * @param config - Configuration to validate
 * @returns Frozen configuration with branded types
 * @throws {Error} If configuration is invalid
 *
 * @example
 * ```typescript
 * const merged = mergeConfig({ port: 3030 });
 * const validated = validateConfig(merged);
 * // validated.port is ValidPort (branded type)
 * // validated is frozen (immutable at runtime)
 * ```
 */
export function validateConfig(config: Required<VeloxAppConfig>): FrozenVeloxAppConfig {
  if (!isValidPort(config.port)) {
    throw new Error(`Invalid port number: ${config.port}. Must be between 0 and 65535.`);
  }

  if (!isValidHost(config.host)) {
    throw new Error('Host must be a non-empty string.');
  }

  // Return frozen config with branded types
  return Object.freeze({
    port: config.port, // Already narrowed to ValidPort by isValidPort
    host: config.host, // Already narrowed to ValidHost by isValidHost
    logger: config.logger,
    fastify: config.fastify,
  });
}
