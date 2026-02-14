/**
 * Environment detection utilities.
 */

import type { Environment } from './types.js';

/**
 * Normalize a raw environment string to a recognized Environment value.
 * Returns undefined if the value is not recognized.
 */
function normalizeEnvironment(value: string | undefined): Environment | undefined {
  const normalized = value?.toLowerCase().trim();

  switch (normalized) {
    case 'production':
    case 'prod':
      return 'production';
    case 'test':
    case 'testing':
      return 'test';
    case 'development':
    case 'dev':
      return 'development';
    default:
      return undefined;
  }
}

/**
 * Detect current environment from NODE_ENV.
 * Defaults to 'development' if not set or unrecognized.
 */
export function detectEnvironment(): Environment {
  return normalizeEnvironment(process.env.NODE_ENV) ?? 'development';
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
  const result = normalizeEnvironment(env);

  if (!result) {
    throw new Error(`Invalid environment: "${env}". Must be one of: development, test, production`);
  }

  return result;
}
