/**
 * Application Configuration
 */

export interface AppConfig {
  port: number;
  host: string;
  logger: boolean;
  apiPrefix: string;
  env: 'development' | 'production' | 'test';
}

export function createConfig(): AppConfig {
  return {
    port: Number(process.env.PORT) || __API_PORT__,
    host: process.env.HOST || '0.0.0.0',
    logger: process.env.LOG_LEVEL !== 'silent',
    apiPrefix: process.env.API_PREFIX || '/api',
    env: (process.env.NODE_ENV as AppConfig['env']) || 'development',
  };
}

export const config = createConfig();
