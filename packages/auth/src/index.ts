/**
 * @veloxts/auth - Authentication and authorization system
 *
 * Provides authentication middleware, session management, and authorization
 * guards for VeloxTS applications. Deferred to v1.1+ release.
 *
 * @note This package is a placeholder for MVP (v0.1.0)
 */

export const AUTH_VERSION = '0.1.0';

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
 * @param config - Authentication configuration
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
