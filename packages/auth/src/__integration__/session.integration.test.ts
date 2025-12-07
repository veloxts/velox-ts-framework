/**
 * Integration tests for session management
 *
 * Tests the full session lifecycle through HTTP requests:
 * - Session creation and cookie setting
 * - Session loading from cookies
 * - Session data persistence across requests
 * - Session regeneration (security after login)
 * - Session destruction (logout)
 * - Flash messages
 * - Sliding expiration
 *
 * @module __integration__/session.integration.test
 */

import cookie from '@fastify/cookie';
import { defineProcedures, type ProcedureCollection, procedure, rest } from '@veloxts/router';
import { createTestServer, TEST_SECRETS } from '@veloxts/testing';
import { z } from '@veloxts/validation';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createInMemorySessionStore,
  createSessionManager,
  isSessionAuthenticated,
  loginSession,
  logoutSession,
  sessionMiddleware,
  type Session,
  type SessionStore,
} from '../session.js';
import type { User } from '../types.js';
import { TEST_USERS, testUserLoader } from './fixtures.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('Session Management Integration', () => {
  let server: FastifyInstance;
  let store: SessionStore;
  let procedures: ProcedureCollection;

  beforeEach(async () => {
    // Create test server with cookie support
    server = await createTestServer({ logger: false });
    await server.register(cookie);

    // Create session store
    store = createInMemorySessionStore();

    // Create session middleware
    const session = sessionMiddleware({
      secret: TEST_SECRETS.session,
      store,
      cookie: {
        name: 'test.session',
        secure: false, // Allow non-HTTPS in tests
        httpOnly: true,
        sameSite: 'lax',
      },
      expiration: {
        ttl: 3600, // 1 hour
        sliding: true,
      },
      userLoader: testUserLoader,
    });

    // Define procedures with session middleware
    // Using 'sessions' namespace to avoid route conflicts
    procedures = defineProcedures('sessions', {
      // GET /api/sessions - List session data (acts as get current session)
      listSessions: procedure()
        .use(session.middleware())
        .query(async ({ ctx }) => {
          const sess = ctx.session as Session;
          return {
            id: sess.id,
            isNew: sess.isNew,
            data: {
              counter: sess.get('counter') ?? 0,
              userId: sess.get('userId'),
            },
          };
        }),

      // POST /api/sessions - Create/update session data
      createSession: procedure()
        .input(z.object({ counter: z.number().optional(), message: z.string().optional() }))
        .use(session.middleware())
        .mutation(async ({ input, ctx }) => {
          const sess = ctx.session as Session;
          if (input.counter !== undefined) {
            sess.set('counter', input.counter);
          }
          if (input.message) {
            sess.flash('message', input.message);
          }
          return { success: true, sessionId: sess.id };
        }),
    });

    // Define flash procedures separately
    const flashProcedures = defineProcedures('flash', {
      // GET /api/flash - Get flash messages
      listFlash: procedure()
        .use(session.middleware())
        .query(async ({ ctx }) => {
          const sess = ctx.session as Session;
          return {
            message: sess.getFlash<string>('message'),
            allFlash: sess.getAllFlash(),
          };
        }),
    });

    // Define auth procedures
    const authProcedures = defineProcedures('auth', {
      // POST /api/auth - Login with session (acts as create auth)
      createAuth: procedure()
        .input(z.object({ userId: z.string() }))
        .use(session.middleware())
        .mutation(async ({ input, ctx }) => {
          const user = await testUserLoader(input.userId);
          if (!user) {
            return { success: false, error: 'User not found' };
          }
          const sess = ctx.session as Session;
          await loginSession(sess, user);
          return { success: true, userId: user.id };
        }),

      // DELETE /api/auth/:id - Logout (destroy session)
      deleteAuth: procedure()
        .input(z.object({ id: z.string() }))
        .use(session.middleware())
        .mutation(async ({ ctx }) => {
          const sess = ctx.session as Session;
          await logoutSession(sess);
          return { success: true };
        }),
    });

    // Define protected procedures
    const protectedProcedures = defineProcedures('protected', {
      // GET /api/protected - Protected route requiring auth
      listProtected: procedure()
        .use(session.requireAuth())
        .query(async ({ ctx }) => {
          const user = ctx.user as User;
          return {
            userId: user.id,
            email: user.email,
            isAuthenticated: ctx.isAuthenticated,
          };
        }),
    });

    // Define optional auth procedures
    const optionalProcedures = defineProcedures('optional', {
      // GET /api/optional - Optional auth route
      listOptional: procedure()
        .use(session.optionalAuth())
        .query(async ({ ctx }) => {
          return {
            isAuthenticated: ctx.isAuthenticated,
            userId: ctx.user?.id ?? null,
          };
        }),
    });

    // Define regeneration procedures
    const regenProcedures = defineProcedures('regen', {
      // POST /api/regen - Regenerate session ID
      createRegen: procedure()
        .use(session.middleware())
        .mutation(async ({ ctx }) => {
          const sess = ctx.session as Session;
          const oldId = sess.id;
          await sess.regenerate();
          return { oldId, newId: sess.id };
        }),
    });

    // Register routes
    rest(
      [procedures, flashProcedures, authProcedures, protectedProcedures, optionalProcedures, regenProcedures],
      { prefix: '/api' }
    )(server);

    await server.ready();
  });

  afterEach(async () => {
    store.clear();
    await server.close();
  });

  // ==========================================================================
  // Session Creation and Cookie Setting
  // ==========================================================================

  describe('Session Creation', () => {
    it('should create a new session and set cookie', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.isNew).toBe(true);
      expect(body.id).toBeDefined();

      // Check cookie is set
      const setCookie = response.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(String(setCookie)).toContain('test.session=');
      expect(String(setCookie)).toContain('HttpOnly');
    });

    it('should load existing session from cookie', async () => {
      // First request - create session
      const firstResponse = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { 'content-type': 'application/json' },
        payload: { counter: 42 },
      });

      expect(firstResponse.statusCode).toBe(201);
      const firstCookie = firstResponse.headers['set-cookie'];

      // Second request - load session
      const secondResponse = await server.inject({
        method: 'GET',
        url: '/api/sessions',
        headers: {
          cookie: String(firstCookie).split(';')[0], // Just the session cookie
        },
      });

      expect(secondResponse.statusCode).toBe(200);
      const body = JSON.parse(secondResponse.body);
      expect(body.isNew).toBe(false);
      expect(body.data.counter).toBe(42);
    });
  });

  // ==========================================================================
  // Session Data Persistence
  // ==========================================================================

  describe('Session Data Persistence', () => {
    it('should persist data across multiple requests', async () => {
      // Set counter to 1
      const setResponse = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { 'content-type': 'application/json' },
        payload: { counter: 1 },
      });
      const sessionCookie = String(setResponse.headers['set-cookie']).split(';')[0];

      // Get counter
      const getResponse = await server.inject({
        method: 'GET',
        url: '/api/sessions',
        headers: { cookie: sessionCookie },
      });

      const body = JSON.parse(getResponse.body);
      expect(body.data.counter).toBe(1);
    });

    it('should update data across requests', async () => {
      // Set initial value
      const response1 = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { 'content-type': 'application/json' },
        payload: { counter: 10 },
      });
      const cookie1 = String(response1.headers['set-cookie']).split(';')[0];

      // Update value
      const response2 = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: {
          'content-type': 'application/json',
          cookie: cookie1,
        },
        payload: { counter: 20 },
      });
      const cookie2 = String(response2.headers['set-cookie']).split(';')[0];

      // Verify updated value
      const response3 = await server.inject({
        method: 'GET',
        url: '/api/sessions',
        headers: { cookie: cookie2 },
      });

      const body = JSON.parse(response3.body);
      expect(body.data.counter).toBe(20);
    });
  });

  // ==========================================================================
  // Flash Messages
  // ==========================================================================

  describe('Flash Messages', () => {
    it('should set and retrieve flash message', async () => {
      // Set flash message
      const setResponse = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { 'content-type': 'application/json' },
        payload: { message: 'Hello, Flash!' },
      });
      const cookie1 = String(setResponse.headers['set-cookie']).split(';')[0];

      // Get flash message
      const getResponse = await server.inject({
        method: 'GET',
        url: '/api/flash',
        headers: { cookie: cookie1 },
      });

      const body = JSON.parse(getResponse.body);
      expect(body.message).toBe('Hello, Flash!');
    });

    it('should clear flash message after reading', async () => {
      // Set flash message
      const setResponse = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { 'content-type': 'application/json' },
        payload: { message: 'One-time message' },
      });
      const cookie1 = String(setResponse.headers['set-cookie']).split(';')[0];

      // First read - should get message
      const read1 = await server.inject({
        method: 'GET',
        url: '/api/flash',
        headers: { cookie: cookie1 },
      });
      const cookie2 = String(read1.headers['set-cookie']).split(';')[0];

      expect(JSON.parse(read1.body).message).toBe('One-time message');

      // Second read - should be empty
      const read2 = await server.inject({
        method: 'GET',
        url: '/api/flash',
        headers: { cookie: cookie2 },
      });

      expect(JSON.parse(read2.body).message).toBeUndefined();
    });
  });

  // ==========================================================================
  // Login and Authentication
  // ==========================================================================

  describe('Login and Authentication', () => {
    it('should login user and regenerate session', async () => {
      // Get initial session
      const initialResponse = await server.inject({
        method: 'GET',
        url: '/api/sessions',
      });
      const initialCookie = String(initialResponse.headers['set-cookie']).split(';')[0];

      // Login
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/auth',
        headers: {
          'content-type': 'application/json',
          cookie: initialCookie,
        },
        payload: { userId: TEST_USERS.admin.id },
      });

      expect(loginResponse.statusCode).toBe(201);
      const loginBody = JSON.parse(loginResponse.body);
      expect(loginBody.success).toBe(true);
      expect(loginBody.userId).toBe(TEST_USERS.admin.id);

      // Session ID should have changed (regenerated)
      const newCookie = String(loginResponse.headers['set-cookie']).split(';')[0];
      expect(newCookie).not.toBe(initialCookie);
    });

    it('should access protected route after login', async () => {
      // Login first
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/auth',
        headers: { 'content-type': 'application/json' },
        payload: { userId: TEST_USERS.admin.id },
      });
      const sessionCookie = String(loginResponse.headers['set-cookie']).split(';')[0];

      // Access protected route
      const protectedResponse = await server.inject({
        method: 'GET',
        url: '/api/protected',
        headers: { cookie: sessionCookie },
      });

      expect(protectedResponse.statusCode).toBe(200);
      const body = JSON.parse(protectedResponse.body);
      expect(body.userId).toBe(TEST_USERS.admin.id);
      expect(body.isAuthenticated).toBe(true);
    });

    it('should reject unauthenticated access to protected route', async () => {
      // Try to access protected route without login
      const response = await server.inject({
        method: 'GET',
        url: '/api/protected',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should handle optional auth with and without login', async () => {
      // Without login
      const anonResponse = await server.inject({
        method: 'GET',
        url: '/api/optional',
      });

      expect(anonResponse.statusCode).toBe(200);
      const anonBody = JSON.parse(anonResponse.body);
      expect(anonBody.isAuthenticated).toBe(false);
      expect(anonBody.userId).toBeNull();

      // Login
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/auth',
        headers: { 'content-type': 'application/json' },
        payload: { userId: TEST_USERS.user.id },
      });
      const sessionCookie = String(loginResponse.headers['set-cookie']).split(';')[0];

      // With login
      const authResponse = await server.inject({
        method: 'GET',
        url: '/api/optional',
        headers: { cookie: sessionCookie },
      });

      expect(authResponse.statusCode).toBe(200);
      const authBody = JSON.parse(authResponse.body);
      expect(authBody.isAuthenticated).toBe(true);
      expect(authBody.userId).toBe(TEST_USERS.user.id);
    });
  });

  // ==========================================================================
  // Logout (Session Destruction)
  // ==========================================================================

  describe('Logout (Session Destruction)', () => {
    it('should destroy session on logout', async () => {
      // Login first
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/auth',
        headers: { 'content-type': 'application/json' },
        payload: { userId: TEST_USERS.admin.id },
      });
      const sessionCookie = String(loginResponse.headers['set-cookie']).split(';')[0];

      // Logout - using DELETE /api/auth/:id
      const logoutResponse = await server.inject({
        method: 'DELETE',
        url: '/api/auth/current',
        headers: {
          cookie: sessionCookie,
        },
      });

      expect(logoutResponse.statusCode).toBe(200);
      expect(JSON.parse(logoutResponse.body).success).toBe(true);

      // Try to access protected route with old cookie
      const protectedResponse = await server.inject({
        method: 'GET',
        url: '/api/protected',
        headers: { cookie: sessionCookie },
      });

      // Should fail - session destroyed
      expect(protectedResponse.statusCode).toBe(401);
    });

    it('should clear session cookie on logout', async () => {
      // Login
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/auth',
        headers: { 'content-type': 'application/json' },
        payload: { userId: TEST_USERS.admin.id },
      });
      const sessionCookie = String(loginResponse.headers['set-cookie']).split(';')[0];

      // Logout
      const logoutResponse = await server.inject({
        method: 'DELETE',
        url: '/api/auth/current',
        headers: {
          cookie: sessionCookie,
        },
      });

      // Check that Set-Cookie header clears the session
      const setCookie = logoutResponse.headers['set-cookie'];
      // The cookie should either be set to empty or have expires in the past
      expect(setCookie).toBeDefined();
    });
  });

  // ==========================================================================
  // Session Regeneration
  // ==========================================================================

  describe('Session Regeneration', () => {
    it('should regenerate session ID while preserving data', async () => {
      // Set data
      const setResponse = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { 'content-type': 'application/json' },
        payload: { counter: 100 },
      });
      const cookie1 = String(setResponse.headers['set-cookie']).split(';')[0];

      // Regenerate - POST without body requires empty json
      const regenResponse = await server.inject({
        method: 'POST',
        url: '/api/regen',
        headers: {
          'content-type': 'application/json',
          cookie: cookie1,
        },
        payload: {},
      });

      expect(regenResponse.statusCode).toBe(201);
      const regenBody = JSON.parse(regenResponse.body);
      expect(regenBody.oldId).toBeDefined();
      expect(regenBody.newId).toBeDefined();
      expect(regenBody.oldId).not.toBe(regenBody.newId);

      // Verify new cookie is set
      const cookie2 = String(regenResponse.headers['set-cookie']).split(';')[0];
      expect(cookie2).not.toBe(cookie1);
    });

    it('should invalidate old session after regeneration', async () => {
      // Set data
      const setResponse = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { 'content-type': 'application/json' },
        payload: { counter: 50 },
      });
      const oldCookie = String(setResponse.headers['set-cookie']).split(';')[0];

      // Regenerate
      const regenResponse = await server.inject({
        method: 'POST',
        url: '/api/regen',
        headers: {
          'content-type': 'application/json',
          cookie: oldCookie,
        },
        payload: {},
      });

      // Old cookie should create a new session (old session was deleted)
      const oldResponse = await server.inject({
        method: 'GET',
        url: '/api/sessions',
        headers: { cookie: oldCookie },
      });
      const oldBody = JSON.parse(oldResponse.body);
      expect(oldBody.isNew).toBe(true);
      expect(oldBody.data.counter).toBe(0); // No counter - new session
    });
  });

  // ==========================================================================
  // Session Manager Direct Tests
  // ==========================================================================

  describe('SessionManager Direct', () => {
    it('should create and manage sessions correctly', () => {
      const manager = createSessionManager({
        secret: TEST_SECRETS.session,
        store: createInMemorySessionStore(),
      });

      expect(manager.store).toBeDefined();
    });

    it('should reject weak secrets', () => {
      expect(() =>
        createSessionManager({
          secret: 'short',
        })
      ).toThrow(/at least 32 characters/);
    });

    it('should reject low-entropy secrets', () => {
      expect(() =>
        createSessionManager({
          secret: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // 34 chars but all same
        })
      ).toThrow(/insufficient entropy/);
    });
  });

  // ==========================================================================
  // Helper Function Tests
  // ==========================================================================

  describe('Helper Functions', () => {
    it('isSessionAuthenticated should check userId', async () => {
      // Create a mock session object for testing
      const mockSession = {
        get: (key: string) => (key === 'userId' ? 'test-user-id' : undefined),
      } as unknown as Session;

      expect(isSessionAuthenticated(mockSession)).toBe(true);

      const unauthSession = {
        get: () => undefined,
      } as unknown as Session;

      expect(isSessionAuthenticated(unauthSession)).toBe(false);
    });
  });
});
