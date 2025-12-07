/**
 * Integration tests for guards with router procedures
 *
 * Tests guard execution within the procedure middleware chain:
 * - Role-based guards
 * - Permission guards
 * - Custom guards
 * - Guard composition
 *
 * @module __integration__/guards.integration.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { defineProcedures, procedure, rest, type ProcedureCollection } from '@veloxts/router';
import { z } from '@veloxts/validation';

import { hasRole, hasPermission, guard } from '../guards.js';
import { authMiddleware } from '../middleware.js';
import type { User } from '../types.js';
import { createTestAuthConfig, createTestAuthConfigNoLoader, TEST_USERS } from './fixtures.js';
import { authHeader, createTestServer } from './setup.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('Guards Integration', () => {
  let server: FastifyInstance;
  let adminToken: string;
  let userToken: string;
  let guestToken: string;
  let multiRoleToken: string;
  let procedures: ProcedureCollection;

  beforeEach(async () => {
    server = await createTestServer();

    // Create tokens for different user types
    adminToken = server.auth.jwt.createTokenPair(TEST_USERS.admin).accessToken;
    userToken = server.auth.jwt.createTokenPair(TEST_USERS.user).accessToken;
    guestToken = server.auth.jwt.createTokenPair(TEST_USERS.guest).accessToken;
    multiRoleToken = server.auth.jwt.createTokenPair(TEST_USERS.multiRole).accessToken;

    // Create auth middleware instance
    const auth = authMiddleware(createTestAuthConfig());

    // Define procedures with guard middleware
    procedures = defineProcedures('admin', {
      // GET /api/admin/:id - Admin-only route
      getAdmin: procedure()
        .input(z.object({ id: z.string() }))
        .use(auth.middleware({ guards: [hasRole('admin')] }))
        .query(async ({ ctx }) => {
          const user = ctx.user as User;
          return { userId: user.id, adminAccess: true };
        }),

      // GET /api/admin - Either admin OR user role can access
      listAdmin: procedure()
        .use(auth.middleware({ guards: [hasRole(['admin', 'user'])] }))
        .query(async ({ ctx }) => {
          const user = ctx.user as User;
          return { userId: user.id, userAccess: true };
        }),

      // POST /api/admin - Admin role with specific permission (tests AND logic)
      createAdmin: procedure()
        .input(z.object({ name: z.string() }))
        .use(auth.middleware({ guards: [hasRole('admin'), hasPermission('admin:create')] }))
        .mutation(async ({ input, ctx }) => {
          const user = ctx.user as User;
          return { createdBy: user.id, name: input.name };
        }),
    });

    // Register routes
    rest([procedures], { prefix: '/api' })(server);

    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  // ==========================================================================
  // Role-Based Guards
  // ==========================================================================

  describe('Role-Based Guards', () => {
    it('should allow admin to access admin-only route', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/admin/123',
        headers: authHeader(adminToken),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.adminAccess).toBe(true);
    });

    it('should deny regular user from admin-only route', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/admin/123',
        headers: authHeader(userToken),
      });

      expect(response.statusCode).toBe(403);
    });

    it('should deny guest (no roles) from admin-only route', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/admin/123',
        headers: authHeader(guestToken),
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow regular user to access route with user or admin roles', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/admin',
        headers: authHeader(userToken),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.userAccess).toBe(true);
    });

    it('should allow admin to access route with user or admin roles', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/admin',
        headers: authHeader(adminToken),
      });

      expect(response.statusCode).toBe(200);
    });
  });

  // ==========================================================================
  // Multiple Guards (AND logic)
  // ==========================================================================

  describe('Multiple Guards (AND logic)', () => {
    it('should allow user with both required role AND permission', async () => {
      // Create admin with permission
      const adminWithPerm: User = {
        id: 'admin-perm-123',
        email: 'admin-perm@example.com',
        roles: ['admin'],
        permissions: ['admin:create'],
      };

      // Create a config with a userLoader that returns our specific user
      const configWithUser = {
        ...createTestAuthConfigNoLoader(),
        userLoader: async (userId: string) =>
          userId === adminWithPerm.id ? adminWithPerm : null,
      };
      const customServer = await createTestServer({ authOptions: configWithUser });
      const auth = authMiddleware(configWithUser);

      const customProcedures = defineProcedures('adminperm', {
        createAdminPerm: procedure()
          .input(z.object({ name: z.string() }))
          .use(auth.middleware({ guards: [hasRole('admin'), hasPermission('admin:create')] }))
          .mutation(async ({ input, ctx }) => {
            return { createdBy: (ctx.user as User).id, name: input.name };
          }),
      });

      rest([customProcedures], { prefix: '/api' })(customServer);
      await customServer.ready();

      const token = customServer.auth.jwt.createTokenPair(adminWithPerm).accessToken;

      const response = await customServer.inject({
        method: 'POST',
        url: '/api/adminperm',
        headers: {
          ...authHeader(token),
          'content-type': 'application/json',
        },
        payload: { name: 'Test' },
      });

      expect(response.statusCode).toBe(201);
      await customServer.close();
    });

    it('should deny user with role but missing permission', async () => {
      // Admin has role but no permission
      const response = await server.inject({
        method: 'POST',
        url: '/api/admin',
        headers: {
          ...authHeader(adminToken),
          'content-type': 'application/json',
        },
        payload: { name: 'Test' },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  // ==========================================================================
  // Custom Guards
  // ==========================================================================

  describe('Custom Guards', () => {
    it('should work with custom guard function', async () => {
      const customServer = await createTestServer();

      // Custom guard that checks if user ID matches a pattern
      const isVerifiedUser = guard<{ user?: User & { email?: string } }>('isVerifiedUser', async (ctx) => {
        return ctx.user?.email?.endsWith('@example.com') ?? false;
      });

      const auth = authMiddleware(createTestAuthConfig());

      const customProcedures = defineProcedures('verified', {
        getVerified: procedure()
          .input(z.object({ id: z.string() }))
          .use(auth.middleware({ guards: [isVerifiedUser] }))
          .query(async ({ ctx }) => {
            return { verified: true, email: (ctx.user as User).email };
          }),
      });

      rest([customProcedures], { prefix: '/api' })(customServer);

      await customServer.ready();

      // Admin has @example.com email
      const token = customServer.auth.jwt.createTokenPair(TEST_USERS.admin).accessToken;

      const response = await customServer.inject({
        method: 'GET',
        url: '/api/verified/123',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.verified).toBe(true);

      await customServer.close();
    });

    it('should deny with custom guard returning false', async () => {
      const customServer = await createTestServer();

      // Guard that always fails
      const alwaysDeny = guard('alwaysDeny', async () => false);

      const auth = authMiddleware(createTestAuthConfig());

      const customProcedures = defineProcedures('denied', {
        getDenied: procedure()
          .input(z.object({ id: z.string() }))
          .use(auth.middleware({ guards: [alwaysDeny] }))
          .query(async () => ({ shouldNotReach: true })),
      });

      rest([customProcedures], { prefix: '/api' })(customServer);

      await customServer.ready();

      const token = customServer.auth.jwt.createTokenPair(TEST_USERS.admin).accessToken;

      const response = await customServer.inject({
        method: 'GET',
        url: '/api/denied/123',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(403);

      await customServer.close();
    });
  });

  // ==========================================================================
  // Permission Guards
  // ==========================================================================

  describe('Permission Guards', () => {
    it('should work with permission-based guards', async () => {
      // User with permissions
      const userWithPerms: User = {
        id: 'user-with-perms',
        email: 'perms@example.com',
        permissions: ['users:read', 'users:write'],
      };

      // Create a config with a userLoader that returns our specific user
      const configWithUser = {
        ...createTestAuthConfigNoLoader(),
        userLoader: async (userId: string) =>
          userId === userWithPerms.id ? userWithPerms : null,
      };
      const customServer = await createTestServer({ authOptions: configWithUser });
      const auth = authMiddleware(configWithUser);

      const permProcedures = defineProcedures('permissions', {
        getPermissions: procedure()
          .input(z.object({ id: z.string() }))
          .use(auth.middleware({ guards: [hasPermission('users:read')] }))
          .query(async () => ({ hasReadAccess: true })),
      });

      rest([permProcedures], { prefix: '/api' })(customServer);

      await customServer.ready();

      const token = customServer.auth.jwt.createTokenPair(userWithPerms).accessToken;

      const response = await customServer.inject({
        method: 'GET',
        url: '/api/permissions/123',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hasReadAccess).toBe(true);

      await customServer.close();
    });

    it('should deny when user lacks required permission', async () => {
      // User without permissions - use config without userLoader
      const userNoPerms: User = {
        id: 'user-no-perms',
        email: 'noperms@example.com',
        permissions: [],
      };

      const noLoaderConfig = createTestAuthConfigNoLoader();
      const customServer = await createTestServer({ authOptions: noLoaderConfig });
      const auth = authMiddleware(noLoaderConfig);

      const permProcedures = defineProcedures('restricted', {
        getRestricted: procedure()
          .input(z.object({ id: z.string() }))
          .use(auth.middleware({ guards: [hasPermission('admin:access')] }))
          .query(async () => ({ restricted: true })),
      });

      rest([permProcedures], { prefix: '/api' })(customServer);

      await customServer.ready();

      const token = customServer.auth.jwt.createTokenPair(userNoPerms).accessToken;

      const response = await customServer.inject({
        method: 'GET',
        url: '/api/restricted/123',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(403);

      await customServer.close();
    });
  });

  // ==========================================================================
  // Multiple Roles
  // ==========================================================================

  describe('Multiple Roles', () => {
    it('should allow access when user has one of multiple roles', async () => {
      // multiRole user has ['user', 'editor', 'moderator']
      // Route requires 'moderator' role
      const customServer = await createTestServer();
      const auth = authMiddleware(createTestAuthConfig());

      const multiRoleProcedures = defineProcedures('multirole', {
        getModeratorContent: procedure()
          .input(z.object({ id: z.string() }))
          .use(auth.middleware({ guards: [hasRole('moderator')] }))
          .query(async ({ ctx }) => {
            return { roles: (ctx.user as User).roles, hasAccess: true };
          }),
      });

      rest([multiRoleProcedures], { prefix: '/api' })(customServer);
      await customServer.ready();

      const token = customServer.auth.jwt.createTokenPair(TEST_USERS.multiRole).accessToken;

      const response = await customServer.inject({
        method: 'GET',
        url: '/api/multirole/123',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.roles).toContain('moderator');
      expect(body.hasAccess).toBe(true);

      await customServer.close();
    });

    it('should allow access when user has any of multiple allowed roles', async () => {
      // Route allows 'admin' OR 'editor' - multiRole user has 'editor'
      const customServer = await createTestServer();
      const auth = authMiddleware(createTestAuthConfig());

      const editorProcedures = defineProcedures('editor', {
        getEditorContent: procedure()
          .input(z.object({ id: z.string() }))
          .use(auth.middleware({ guards: [hasRole(['admin', 'editor'])] }))
          .query(async ({ ctx }) => {
            return { roles: (ctx.user as User).roles };
          }),
      });

      rest([editorProcedures], { prefix: '/api' })(customServer);
      await customServer.ready();

      const token = customServer.auth.jwt.createTokenPair(TEST_USERS.multiRole).accessToken;

      const response = await customServer.inject({
        method: 'GET',
        url: '/api/editor/123',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      await customServer.close();
    });

    it('should deny access when user lacks all required roles', async () => {
      // Route requires 'admin' - multiRole user has ['user', 'editor', 'moderator'] (no admin)
      const response = await server.inject({
        method: 'GET',
        url: '/api/admin/123',
        headers: authHeader(multiRoleToken),
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
