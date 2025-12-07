/**
 * Test helper utilities
 * @module testing/helpers
 */

// ============================================================================
// HTTP Helpers
// ============================================================================

/**
 * Creates an authorization header with a Bearer token
 *
 * @example
 * ```typescript
 * const response = await server.inject({
 *   method: 'GET',
 *   url: '/protected',
 *   headers: authHeader(token),
 * });
 * ```
 */
export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

/**
 * Creates common JSON headers for POST/PUT requests
 *
 * @example
 * ```typescript
 * const response = await server.inject({
 *   method: 'POST',
 *   url: '/users',
 *   headers: { ...authHeader(token), ...jsonHeaders() },
 *   payload: { name: 'John' },
 * });
 * ```
 */
export function jsonHeaders(): { 'content-type': string } {
  return { 'content-type': 'application/json' };
}

// ============================================================================
// Test Secrets
// ============================================================================

/**
 * Pre-generated test secrets for JWT signing
 * These are 64+ characters as required for HMAC-SHA512
 */
export const TEST_SECRETS = {
  /** Access token secret */
  access:
    'test-access-secret-key-for-integration-tests-must-be-64-characters-long-at-minimum-for-hmac',
  /** Refresh token secret */
  refresh:
    'test-refresh-secret-key-for-integration-tests-must-be-64-characters-long-at-minimum-for-hmac',
  /** Session secret (32+ chars) */
  session: 'test-session-secret-for-integration-tests-32chars',
  /** CSRF secret */
  csrf: 'test-csrf-secret-for-integration-tests-must-be-32-characters-minimum',
} as const;

// ============================================================================
// Timing Helpers
// ============================================================================

/**
 * Wait for a specified duration
 * Useful for testing time-dependent features like token expiration
 *
 * @example
 * ```typescript
 * // Wait for token to expire
 * await wait(1100); // 1.1 seconds
 * ```
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// User Factory
// ============================================================================

/**
 * Base user interface for test fixtures
 */
export interface TestUser {
  id: string;
  email: string;
  roles?: string[];
  permissions?: string[];
  [key: string]: unknown;
}

/**
 * Creates a test user with sensible defaults
 *
 * @example
 * ```typescript
 * const admin = createTestUser({ roles: ['admin'] });
 * const user = createTestUser({ id: 'custom-id', email: 'custom@example.com' });
 * ```
 */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const id = overrides.id ?? `test-user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    email: overrides.email ?? `${id}@example.com`,
    roles: overrides.roles ?? ['user'],
    permissions: overrides.permissions ?? [],
    ...overrides,
  };
}

/**
 * Creates a user loader function for a specific set of test users
 *
 * @example
 * ```typescript
 * const users = [
 *   createTestUser({ id: 'admin-1', roles: ['admin'] }),
 *   createTestUser({ id: 'user-1', roles: ['user'] }),
 * ];
 *
 * const userLoader = createUserLoader(users);
 * const user = await userLoader('admin-1'); // Returns the admin user
 * ```
 */
export function createUserLoader(users: TestUser[]): (userId: string) => Promise<TestUser | null> {
  const userMap = new Map(users.map((u) => [u.id, u]));
  return async (userId: string) => userMap.get(userId) ?? null;
}
