/**
 * Application Configuration
 */

export const config = {
  port: Number(process.env.PORT) || __API_PORT__,
  host: process.env.HOST || '0.0.0.0',
  logger: process.env.LOG_LEVEL !== 'silent',
  apiPrefix: process.env.API_PREFIX || '/api',
  env: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
} as const;

export type AppConfig = typeof config;
