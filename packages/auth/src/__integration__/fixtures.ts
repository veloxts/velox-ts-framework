/**
 * Integration test fixtures and helpers
 * @module __integration__/fixtures
 */

import { TEST_SECRETS } from '@veloxts/testing';

import type { User } from '../types.js';

// Re-export shared test secrets
export { TEST_SECRETS };

// ============================================================================
// Test Users
// ============================================================================

export const TEST_USERS: Record<string, User> = {
  admin: {
    id: 'user-admin-123',
    email: 'admin@example.com',
    roles: ['admin'],
  },
  user: {
    id: 'user-regular-456',
    email: 'user@example.com',
    roles: ['user'],
  },
  guest: {
    id: 'user-guest-789',
    email: 'guest@example.com',
    roles: [], // Empty roles - tests guard failure
  },
  multiRole: {
    id: 'user-multi-101',
    email: 'multi@example.com',
    roles: ['user', 'editor', 'moderator'],
  },
};

// ============================================================================
// User Loader
// ============================================================================

/**
 * Mock user loader for tests
 */
export async function testUserLoader(userId: string): Promise<User | null> {
  const user = Object.values(TEST_USERS).find((u) => u.id === userId);
  return user ?? null;
}

// ============================================================================
// Auth Config Factory
// ============================================================================

/**
 * Auth config with user loader (for tests that use TEST_USERS)
 */
export function createTestAuthConfig() {
  return {
    jwt: {
      secret: TEST_SECRETS.access,
      refreshSecret: TEST_SECRETS.refresh,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'velox-test',
      audience: 'velox-test-app',
    },
    userLoader: testUserLoader,
  };
}

/**
 * Auth config without user loader (for tests with ad-hoc users)
 * User info comes directly from token claims
 */
export function createTestAuthConfigNoLoader() {
  return {
    jwt: {
      secret: TEST_SECRETS.access,
      refreshSecret: TEST_SECRETS.refresh,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'velox-test',
      audience: 'velox-test-app',
    },
    // No userLoader - user info comes from token
  };
}
