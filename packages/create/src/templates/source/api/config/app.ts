/**
 * Application Configuration
 */

/**
 * Application configuration type
 */
export interface AppConfig {
  port: number;
  host: string;
  logger: boolean | { level: string };
  apiPrefix: string;
  env: 'development' | 'production' | 'test';
}

/**
 * Build logger configuration based on environment.
 *
 * - LOG_LEVEL=silent: Disable logging
 * - LOG_LEVEL=debug: Enable debug-level logging
 * - Default: Standard info-level logging
 */
function buildLoggerConfig(): boolean | { level: string } {
  const logLevel = process.env.LOG_LEVEL;

  // Silent mode - no logging
  if (logLevel === 'silent') {
    return false;
  }

  // Debug mode - verbose logging
  if (logLevel === 'debug') {
    return { level: 'debug' };
  }

  // Default - standard logging
  return true;
}

export const config: AppConfig = {
  port: Number(process.env.PORT) || __API_PORT__,
  host: process.env.HOST || '0.0.0.0',
  logger: buildLoggerConfig(),
  apiPrefix: process.env.API_PREFIX || '/api',
  env: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
};
