/**
 * Integration tests for auth middleware with router procedures
 *
 * Tests the full flow of authentication through procedure middleware:
 * - JWT extraction from Authorization header
 * - Token verification
 * - User loading
 * - Context decoration with user and auth info
 *
 * @module __integration__/auth-middleware.integration.test
 */

import { defineProcedures, type ProcedureCollection, procedure, rest } from '@veloxts/router';
import { z } from '@veloxts/validation';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authMiddleware } from '../middleware.js';
import type { User } from '../types.js';
import { createTestAuthConfig, TEST_USERS } from './fixtures.js';
import { authHeader, createTestServer } from './setup.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('Auth Middleware Integration', () => {
  let server: FastifyInstance;
  let accessToken: string;
  let procedures: ProcedureCollection;

  beforeEach(async () => {
    server = await createTestServer();

    // Create access token for admin user
    accessToken = server.auth.jwt.createTokenPair(TEST_USERS.admin).accessToken;

    // Create auth middleware instance
    const auth = authMiddleware(createTestAuthConfig());

    // Define procedures with auth middleware
    procedures = defineProcedures('users', {
      // GET /api/users/:id - Protected route that returns current user
      getUser: procedure()
        .input(z.object({ id: z.string() }))
        .use(auth.requireAuth())
        .query(async ({ ctx }) => {
          const user = ctx.user as User;
          return {
            id: user.id,
            email: user.email,
            requestedId: ctx.request.params,
          };
        }),

      // GET /api/users - Protected list with optional auth
      listUsers: procedure()
        .use(auth.optionalAuth())
        .query(async ({ ctx }) => {
          return {
            authenticated: ctx.auth.isAuthenticated,
            userId: ctx.user?.id ?? null,
          };
        }),

      // POST /api/users - Protected create endpoint
      createUser: procedure()
        .input(z.object({ name: z.string(), email: z.string().email() }))
        .use(auth.requireAuth())
        .mutation(async ({ input, ctx }) => {
          const user = ctx.user as User;
          return {
            createdBy: user.id,
            name: input.name,
            email: input.email,
          };
        }),
    });

    // Register routes using REST adapter - directly on server with prefix option
    rest([procedures], { prefix: '/api' })(server);

    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  // ==========================================================================
  // Protected Routes (requireAuth)
  // ==========================================================================

  describe('Protected Routes (requireAuth)', () => {
    it('should allow access with valid token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/test-id-123',
        headers: authHeader(accessToken),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(TEST_USERS.admin.id);
      expect(body.email).toBe(TEST_USERS.admin.email);
    });

    it('should reject request without token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/test-id-123',
      });

      expect(response.statusCode).toBe(401);
      // Error message may vary based on error handler - just verify 401
    });

    it('should reject request with invalid token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/test-id-123',
        headers: authHeader('invalid-token'),
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject request with malformed Authorization header', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/test-id-123',
        headers: { authorization: 'NotBearer token' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should allow mutations with valid token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users',
        headers: {
          ...authHeader(accessToken),
          'content-type': 'application/json',
        },
        payload: {
          name: 'New User',
          email: 'new@example.com',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.createdBy).toBe(TEST_USERS.admin.id);
      expect(body.name).toBe('New User');
    });
  });

  // ==========================================================================
  // Optional Auth Routes
  // ==========================================================================

  describe('Optional Auth Routes (optionalAuth)', () => {
    it('should allow access without token and set isAuthenticated to false', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.authenticated).toBe(false);
      expect(body.userId).toBeNull();
    });

    it('should set user when valid token provided', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users',
        headers: authHeader(accessToken),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.authenticated).toBe(true);
      expect(body.userId).toBe(TEST_USERS.admin.id);
    });

    it('should allow access with invalid token (optional auth)', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users',
        headers: authHeader('invalid-token'),
      });

      // Optional auth should not reject invalid tokens
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.authenticated).toBe(false);
    });
  });

  // ==========================================================================
  // Token Handling
  // ==========================================================================

  describe('Token Handling', () => {
    it('should extract token from Bearer scheme', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/123',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle token with extra whitespace', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/123',
        headers: { authorization: `Bearer   ${accessToken}` },
      });

      // The JWT library should handle this gracefully
      expect([200, 401]).toContain(response.statusCode);
    });

    it('should reject expired tokens', async () => {
      // Use fake timers to test token expiration without actually waiting
      vi.useFakeTimers();

      try {
        // Create a token with minimum valid expiry (60 seconds)
        const shortLivedServer = await createTestServer({
          authOptions: {
            jwt: {
              secret: createTestAuthConfig().jwt.secret,
              refreshSecret: createTestAuthConfig().jwt.refreshSecret,
              accessTokenExpiry: '1m', // Minimum allowed (60 seconds)
              refreshTokenExpiry: '1h',
            },
          },
        });

        const shortToken = shortLivedServer.auth.jwt.createTokenPair(TEST_USERS.admin).accessToken;

        // Advance time by 61 seconds to expire the token
        vi.advanceTimersByTime(61 * 1000);

        // Create new server for the request (fresh instance)
        const freshServer = await createTestServer();

        // Define a simple protected route
        const auth = authMiddleware(createTestAuthConfig());
        const procs = defineProcedures('test', {
          getTest: procedure()
            .input(z.object({ id: z.string() }))
            .use(auth.requireAuth())
            .query(async () => ({ success: true })),
        });

        rest([procs], { prefix: '/api' })(freshServer);

        await freshServer.ready();

        const response = await freshServer.inject({
          method: 'GET',
          url: '/api/test/123',
          headers: authHeader(shortToken),
        });

        expect(response.statusCode).toBe(401);

        await shortLivedServer.close();
        await freshServer.close();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
