/**
 * Environment-aware server configuration presets.
 *
 * Provides sensible defaults for server settings based on NODE_ENV,
 * respecting Fastify's constraint that server config must be set at construction time.
 */

import type { VeloxAppConfig, VeloxFastifyOptions } from '@veloxts/core';

import { detectEnvironment } from './env.js';
import { mergeDeep } from './merge.js';
import type { Environment } from './types.js';

/**
 * Valid log levels for Fastify/Pino logger.
 */
const VALID_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const;

/**
 * Type for valid log levels.
 */
type LogLevel = (typeof VALID_LOG_LEVELS)[number];

/**
 * Type guard to check if a value is a valid log level.
 */
function isValidLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && VALID_LOG_LEVELS.includes(value as LogLevel);
}

/**
 * Parse and validate a log level from environment variable.
 * Returns the validated log level or the default if invalid.
 *
 * @param value - The raw environment variable value
 * @param defaultLevel - Fallback level if value is invalid
 */
function parseLogLevel(value: string | undefined, defaultLevel: LogLevel): LogLevel {
  if (value === undefined) {
    return defaultLevel;
  }
  if (isValidLogLevel(value)) {
    return value;
  }
  // Invalid log level - return default
  return defaultLevel;
}

/**
 * Parse and validate a port number from environment variable.
 * Returns the validated port or the default if invalid.
 *
 * @param value - The raw environment variable value
 * @param defaultPort - Fallback port if value is invalid
 */
function parsePort(value: string | undefined, defaultPort: number): number {
  if (value === undefined) {
    return defaultPort;
  }
  const parsed = parseInt(value, 10);
  // Check for NaN and ensure port is in valid range (1-65535)
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    return defaultPort;
  }
  return parsed;
}

/**
 * Logger configuration options.
 */
interface LoggerOptions {
  level?: LogLevel;
  transport?: {
    target: string;
    options?: Record<string, unknown>;
  };
}

/**
 * Override options for server configuration.
 */
export interface ServerConfigOverrides {
  /**
   * Server port. Defaults vary by environment:
   * - development: 3030
   * - test: 0 (random port for parallel tests)
   * - production: PORT env var or 3030
   */
  port?: number;

  /**
   * Server host. Defaults:
   * - development/test: 'localhost'
   * - production: '0.0.0.0' (all interfaces)
   */
  host?: string;

  /**
   * Logger configuration. Defaults:
   * - development: debug level with pino-pretty
   * - test: false (silent)
   * - production: warn level
   */
  logger?: boolean | LoggerOptions;

  /**
   * Fastify-specific options.
   */
  fastify?: VeloxFastifyOptions;
}

/**
 * Complete server preset configuration.
 */
interface ServerPreset {
  port: number;
  host: string;
  logger: boolean | LoggerOptions;
  fastify: VeloxFastifyOptions;
}

/**
 * Server presets for each environment.
 */
const serverPresets: Record<Environment, ServerPreset> = {
  /**
   * Development preset - optimized for local development.
   *
   * - Pretty-printed debug logs
   * - Localhost binding
   * - No proxy trust (direct access)
   */
  development: {
    port: 3030,
    host: 'localhost',
    logger: {
      level: 'debug',
      transport: { target: 'pino-pretty' },
    },
    fastify: {
      trustProxy: false,
    },
  },

  /**
   * Test preset - optimized for automated testing.
   *
   * - Random port for parallel test execution
   * - Silent logging
   * - Localhost binding
   */
  test: {
    port: 0, // Random port for parallel tests
    host: 'localhost',
    logger: false, // Silent in tests
    fastify: {
      trustProxy: false,
    },
  },

  /**
   * Production preset - optimized for deployment.
   *
   * - Reads PORT from environment
   * - Binds to all interfaces (for containerized deployments)
   * - Minimal logging (warn level)
   * - Trust proxy headers (assumes reverse proxy)
   * - Conservative limits for security
   */
  production: {
    port: parsePort(process.env.PORT, 3030),
    host: '0.0.0.0', // Bind to all interfaces
    logger: {
      level: parseLogLevel(process.env.LOG_LEVEL, 'warn'),
    },
    fastify: {
      trustProxy: true, // Behind reverse proxy
      bodyLimit: 1048576, // 1MB
      requestTimeout: 30000, // 30 seconds
      connectionTimeout: 60000, // 60 seconds
    },
  },
};

/**
 * Get environment-aware server configuration for VeloxApp.
 *
 * Returns sensible defaults based on NODE_ENV with optional overrides.
 * Pass the result directly to `veloxApp()`.
 *
 * @param overrides - Override specific settings (env auto-detected from NODE_ENV)
 * @returns VeloxAppConfig ready for veloxApp()
 *
 * @example
 * ```typescript
 * // Auto-detect environment
 * const app = await veloxApp(getServerConfig());
 *
 * // With overrides
 * const app = await veloxApp(getServerConfig({ port: 4000 }));
 * ```
 */
export function getServerConfig(overrides?: ServerConfigOverrides): VeloxAppConfig;

/**
 * Get server configuration for a specific environment.
 *
 * @param env - Target environment
 * @param overrides - Override specific settings
 * @returns VeloxAppConfig ready for veloxApp()
 *
 * @example
 * ```typescript
 * // Explicit environment
 * const app = await veloxApp(getServerConfig('production'));
 *
 * // Explicit environment + overrides
 * const app = await veloxApp(getServerConfig('production', {
 *   port: 4000,
 *   fastify: { bodyLimit: 10 * 1048576 }  // 10MB
 * }));
 * ```
 */
export function getServerConfig(
  env: Environment,
  overrides?: ServerConfigOverrides
): VeloxAppConfig;

// Implementation with overloads
export function getServerConfig(
  envOrOverrides?: Environment | ServerConfigOverrides,
  overrides?: ServerConfigOverrides
): VeloxAppConfig {
  // Detect if first arg is Environment or overrides
  let env: Environment;
  let finalOverrides: ServerConfigOverrides | undefined;

  if (typeof envOrOverrides === 'string') {
    env = envOrOverrides;
    finalOverrides = overrides;
  } else {
    env = detectEnvironment();
    finalOverrides = envOrOverrides;
  }

  const preset = serverPresets[env];

  if (!finalOverrides) {
    return preset;
  }

  // Deep merge preset with overrides
  return mergeDeep(preset, finalOverrides);
}

/**
 * Direct access to server presets (for advanced users or testing).
 */
export { serverPresets };

/**
 * Get the raw server preset for an environment without any overrides.
 *
 * @param env - Target environment (defaults to NODE_ENV detection)
 * @returns The preset configuration
 */
export function getServerPreset(env?: Environment): ServerPreset {
  return serverPresets[env ?? detectEnvironment()];
}
