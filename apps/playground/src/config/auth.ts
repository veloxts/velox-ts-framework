/**
 * Authentication Configuration
 *
 * JWT-based authentication configuration for the playground app.
 */

import type { AuthPluginOptions } from '@veloxts/auth';

import { prisma } from '../database/index.js';

// ============================================================================
// JWT Secrets
// ============================================================================

/**
 * Default development secrets (64+ characters for HMAC-SHA512)
 * In production, always use environment variables!
 */
const DEFAULT_JWT_SECRET =
  'playground-dev-jwt-secret-must-be-at-least-64-characters-for-security-requirements';
const DEFAULT_REFRESH_SECRET =
  'playground-dev-refresh-secret-must-be-at-least-64-characters-for-security-too';

// ============================================================================
// User Loader
// ============================================================================

/**
 * Loads user from database by ID
 * Called on every authenticated request to populate ctx.user
 */
async function userLoader(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles ? JSON.parse(user.roles) : ['user'],
  };
}

// ============================================================================
// Auth Configuration
// ============================================================================

export function createAuthConfig(): AuthPluginOptions {
  return {
    jwt: {
      secret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET || DEFAULT_REFRESH_SECRET,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'velox-playground',
      audience: 'velox-playground-app',
    },
    userLoader,
    rateLimit: {
      max: 100,
      windowMs: 60000, // 1 minute
    },
  };
}

export const authConfig = createAuthConfig();
