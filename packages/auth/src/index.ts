/**
 * @veloxts/auth - Authentication and authorization system
 *
 * Provides authentication middleware, session management, and authorization
 * guards for VeloxTS applications. Deferred to v1.1+ release.
 *
 * @note This package is a placeholder for MVP (v0.1.0)
 */

import { createRequire } from 'node:module';

// Read version from package.json dynamically
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

/** Auth package version */
export const AUTH_VERSION: string = packageJson.version ?? '0.0.0-unknown';

/**
 * User interface for authenticated requests
 */
export interface User {
  id: string;
  email: string;
  [key: string]: unknown;
}

/**
 * Creates an authentication plugin for VeloxTS
 *
 * @param _config
 * @returns Auth plugin
 *
 * @note Full implementation coming in v1.1+
 */
export function createAuth(_config: { secret?: string; sessionStore?: unknown } = {}) {
  return {
    version: AUTH_VERSION,
    middleware: () => {
      console.log('Auth middleware placeholder (v1.1+)');
    },
  };
}

/**
 * Authorization guard decorator (placeholder)
 *
 * @note Full implementation coming in v1.1+
 */
export function guard(permissions: string[]) {
  return (target: unknown) => {
    console.log(`Guard decorator placeholder: ${permissions.join(', ')}`);
    return target;
  };
}
