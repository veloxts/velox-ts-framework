/**
 * Environment detection utilities.
 */

import type { Environment } from './types.js';

/**
 * Detect current environment from NODE_ENV.
 * Defaults to 'development' if not set or unrecognized.
 */
export function detectEnvironment(): Environment {
  const env = process.env.NODE_ENV?.toLowerCase().trim();

  switch (env) {
    case 'production':
    case 'prod':
      return 'production';
    case 'test':
    case 'testing':
      return 'test';
    default:
      // 'development', 'dev', undefined, or any unrecognized value
      return 'development';
  }
}

/**
 * Check if current environment is development.
 */
export function isDevelopment(): boolean {
  return detectEnvironment() === 'development';
}

/**
 * Check if current environment is production.
 */
export function isProduction(): boolean {
  return detectEnvironment() === 'production';
}

/**
 * Check if current environment is test.
 */
export function isTest(): boolean {
  return detectEnvironment() === 'test';
}

/**
 * Validate and normalize environment string.
 * @throws Error if environment is not recognized.
 */
export function validateEnvironment(env: string): Environment {
  const normalized = env.toLowerCase().trim();

  if (normalized === 'production' || normalized === 'prod') {
    return 'production';
  }
  if (normalized === 'test' || normalized === 'testing') {
    return 'test';
  }
  if (normalized === 'development' || normalized === 'dev') {
    return 'development';
  }

  throw new Error(`Invalid environment: "${env}". Must be one of: development, test, production`);
}
