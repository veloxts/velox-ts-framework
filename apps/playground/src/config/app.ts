/**
 * Application Configuration
 *
 * Centralized configuration with environment variable support.
 * Following 12-factor app principles.
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface AppConfig {
  /** Server port */
  port: number;
  /** Server host */
  host: string;
  /** Enable logging */
  logger: boolean;
  /** API prefix for REST routes */
  apiPrefix: string;
  /** Environment name */
  env: 'development' | 'production' | 'test';
}

// ============================================================================
// Configuration Factory
// ============================================================================

/**
 * Creates application configuration from environment variables
 *
 * Defaults are suitable for local development.
 */
export function createConfig(): AppConfig {
  return {
    port: Number(process.env.PORT) || 3210,
    host: process.env.HOST || '0.0.0.0',
    logger: process.env.LOG_LEVEL !== 'silent',
    apiPrefix: process.env.API_PREFIX || '/api',
    env: (process.env.NODE_ENV as AppConfig['env']) || 'development',
  };
}

/**
 * Default configuration instance
 */
export const config = createConfig();
