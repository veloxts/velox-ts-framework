/**
 * API Handler with Authentication
 *
 * This creates the Fastify API handler that gets embedded in Vinxi.
 * All routes under /api/* are handled by this Fastify instance.
 * Includes JWT authentication via @veloxts/auth.
 */

import { veloxApp } from '@veloxts/core';
import { databasePlugin } from '@veloxts/orm';
import { rest } from '@veloxts/router';
import { authPlugin } from '@veloxts/auth';
import { createH3ApiHandler } from '@veloxts/web';

import { db } from './database.js';
import { authProcedures } from './procedures/auth.js';
import { healthProcedures } from './procedures/health.js';
import { userProcedures } from './procedures/users.js';
import { getJwtSecrets, parseUserRoles, tokenStore } from './utils/auth.js';

// Export router type for frontend type safety
const router = { health: healthProcedures, users: userProcedures, auth: authProcedures };
export type AppRouter = typeof router;

/**
 * Create auth configuration for the embedded API.
 */
function createAuthConfig() {
  const { jwtSecret, refreshSecret } = getJwtSecrets();

  return {
    jwt: {
      secret: jwtSecret,
      refreshSecret: refreshSecret,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'velox-app',
      audience: 'velox-app-client',
    },
    userLoader: async (userId: string) => {
      const user = await db.user.findUnique({
        where: { id: userId },
      });

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: parseUserRoles(user.roles),
      };
    },
    isTokenRevoked: async (jti: string) => tokenStore.isRevoked(jti),
    rateLimit: {
      max: 100,
      windowMs: 60000,
    },
  };
}

/**
 * Export the h3 event handler for Vinxi embedding.
 */
export default createH3ApiHandler({
  app: async () => {
    const app = await veloxApp();

    // Register database plugin
    await app.register(databasePlugin({ client: db }));

    // Register auth plugin for JWT verification
    await app.register(authPlugin(createAuthConfig()));

    // Register REST routes from procedures
    app.routes(
      rest([healthProcedures, userProcedures, authProcedures], {
        prefix: '', // No prefix - Vinxi handles /api/*
      })
    );

    return app.server;
  },
  basePath: '/api',
});
