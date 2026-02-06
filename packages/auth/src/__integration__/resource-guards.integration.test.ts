/**
 * Integration tests for narrowing guards with Resource API auto-projection
 *
 * Tests the full end-to-end flow:
 *   HTTP request → auth plugin → narrowing guard → handler → auto-projection
 *
 * Key mechanism: `executeProcedure()` tracks the highest `accessLevel` from
 * guards that have the property. After the handler runs, if `_resourceSchema`
 * is set on the procedure, it auto-projects based on that level. Only narrowing
 * guards (`authenticatedNarrow`, `adminNarrow`) have `accessLevel` — regular
 * guards do NOT.
 *
 * @module __integration__/resource-guards.integration.test
 */

import { defineProcedures, procedure, resourceSchema, rest } from '@veloxts/router';
import { z } from '@veloxts/validation';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { authenticated } from '../guards.js';
import { adminNarrow, authenticatedNarrow } from '../guards-narrowing.js';
import { authMiddleware } from '../middleware.js';
import { createTestAuthConfig, TEST_USERS } from './fixtures.js';
import { authHeader, createTestServer } from './setup.js';

// ============================================================================
// Shared Test Schema & Data
// ============================================================================

const ProfileSchema = resourceSchema()
  .public('id', z.string())
  .public('name', z.string())
  .authenticated('email', z.string().email())
  .admin('internalNotes', z.string().nullable())
  .build();

const mockUser = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  internalNotes: 'VIP',
};

// ============================================================================
// Tests
// ============================================================================

describe('Resource Guards Integration', () => {
  // ==========================================================================
  // 1. guardNarrow(authenticatedNarrow) + .resource()
  // ==========================================================================

  describe('guardNarrow(authenticatedNarrow) + .resource()', () => {
    let server: FastifyInstance;
    let userToken: string;

    beforeEach(async () => {
      server = await createTestServer();
      userToken = server.auth.jwt.createTokenPair(TEST_USERS.user).accessToken;

      const auth = authMiddleware(createTestAuthConfig());

      const procs = defineProcedures('authprofile', {
        getAuthprofile: procedure()
          .use(auth.middleware())
          .guardNarrow(authenticatedNarrow)
          .input(z.object({ id: z.string() }))
          .resource(ProfileSchema)
          .query(async () => mockUser),
      });

      rest([procs], { prefix: '/api' })(server);
      await server.ready();
    });

    afterEach(async () => {
      await server.close();
    });

    it('returns public + authenticated fields for auth user (no admin fields)', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/authprofile/abc',
        headers: authHeader(userToken),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      });
      expect(body.internalNotes).toBeUndefined();
    });

    it('returns 401 without token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/authprofile/abc',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ==========================================================================
  // 2. guardNarrow(adminNarrow) + .resource()
  // ==========================================================================

  describe('guardNarrow(adminNarrow) + .resource()', () => {
    let server: FastifyInstance;
    let adminToken: string;
    let userToken: string;

    beforeEach(async () => {
      server = await createTestServer();
      adminToken = server.auth.jwt.createTokenPair(TEST_USERS.admin).accessToken;
      userToken = server.auth.jwt.createTokenPair(TEST_USERS.user).accessToken;

      const auth = authMiddleware(createTestAuthConfig());

      const procs = defineProcedures('adminprofile', {
        getAdminprofile: procedure()
          .use(auth.middleware())
          .guardNarrow(adminNarrow)
          .input(z.object({ id: z.string() }))
          .resource(ProfileSchema)
          .query(async () => mockUser),
      });

      rest([procs], { prefix: '/api' })(server);
      await server.ready();
    });

    afterEach(async () => {
      await server.close();
    });

    it('returns ALL fields for admin user', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/adminprofile/abc',
        headers: authHeader(adminToken),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        internalNotes: 'VIP',
      });
    });

    it('returns 403 for regular user', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/adminprofile/abc',
        headers: authHeader(userToken),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  // ==========================================================================
  // 3. No guard + .resource() → public fields only
  // ==========================================================================

  describe('No guard + .resource()', () => {
    let server: FastifyInstance;

    beforeEach(async () => {
      server = await createTestServer();

      const procs = defineProcedures('publicprofile', {
        getPublicprofile: procedure()
          .input(z.object({ id: z.string() }))
          .resource(ProfileSchema)
          .query(async () => mockUser),
      });

      rest([procs], { prefix: '/api' })(server);
      await server.ready();
    });

    afterEach(async () => {
      await server.close();
    });

    it('returns only public fields (no auth, no admin)', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/publicprofile/abc',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        id: 'user-123',
        name: 'Test User',
      });
      expect(body.email).toBeUndefined();
      expect(body.internalNotes).toBeUndefined();
    });
  });

  // ==========================================================================
  // 4. Regular guard(authenticated) + .resource() → defaults to public
  // ==========================================================================

  describe('Regular guard(authenticated) + .resource()', () => {
    let server: FastifyInstance;
    let userToken: string;

    beforeEach(async () => {
      server = await createTestServer();
      userToken = server.auth.jwt.createTokenPair(TEST_USERS.user).accessToken;

      const auth = authMiddleware(createTestAuthConfig());

      const procs = defineProcedures('regularguard', {
        getRegularguard: procedure()
          .use(auth.middleware())
          .guard(authenticated)
          .input(z.object({ id: z.string() }))
          .resource(ProfileSchema)
          .query(async () => mockUser),
      });

      rest([procs], { prefix: '/api' })(server);
      await server.ready();
    });

    afterEach(async () => {
      await server.close();
    });

    it('returns only public fields even for authenticated user (regular guard lacks accessLevel)', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/regularguard/abc',
        headers: authHeader(userToken),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // Critical: regular guards have no accessLevel, so auto-projection defaults to 'public'
      expect(body).toEqual({
        id: 'user-123',
        name: 'Test User',
      });
      expect(body.email).toBeUndefined();
      expect(body.internalNotes).toBeUndefined();
    });
  });

  // ==========================================================================
  // 5. Field filtering precision
  // ==========================================================================

  describe('Field filtering precision', () => {
    let server: FastifyInstance;
    let adminToken: string;
    let userToken: string;

    beforeEach(async () => {
      server = await createTestServer();
      adminToken = server.auth.jwt.createTokenPair(TEST_USERS.admin).accessToken;
      userToken = server.auth.jwt.createTokenPair(TEST_USERS.user).accessToken;

      const auth = authMiddleware(createTestAuthConfig());

      const procs = defineProcedures('precision', {
        // Public endpoint (no guard) → 2 fields
        getPrecision: procedure()
          .input(z.object({ id: z.string() }))
          .resource(ProfileSchema)
          .query(async () => mockUser),

        // Authenticated endpoint → 3 fields
        listPrecision: procedure()
          .use(auth.middleware())
          .guardNarrow(authenticatedNarrow)
          .resource(ProfileSchema)
          .query(async () => mockUser),

        // Admin endpoint → 4 fields
        createPrecision: procedure()
          .input(z.object({ name: z.string() }))
          .use(auth.middleware())
          .guardNarrow(adminNarrow)
          .resource(ProfileSchema)
          .mutation(async () => mockUser),
      });

      rest([procs], { prefix: '/api' })(server);
      await server.ready();
    });

    afterEach(async () => {
      await server.close();
    });

    it('public endpoint returns exactly 2 fields', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/precision/abc',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Object.keys(body)).toHaveLength(2);
      expect(Object.keys(body).sort()).toEqual(['id', 'name']);
    });

    it('authenticated endpoint returns exactly 3 fields', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/precision',
        headers: authHeader(userToken),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Object.keys(body)).toHaveLength(3);
      expect(Object.keys(body).sort()).toEqual(['email', 'id', 'name']);
    });

    it('admin endpoint returns exactly 4 fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/precision',
        headers: {
          ...authHeader(adminToken),
          'content-type': 'application/json',
        },
        payload: { name: 'test' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(Object.keys(body)).toHaveLength(4);
      expect(Object.keys(body).sort()).toEqual(['email', 'id', 'internalNotes', 'name']);
    });

    it('admin-only fields are absent from authenticated response', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/precision',
        headers: authHeader(userToken),
      });

      const body = JSON.parse(response.body);
      expect(body.internalNotes).toBeUndefined();
    });

    it('authenticated fields are absent from anonymous response', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/precision/abc',
      });

      const body = JSON.parse(response.body);
      expect(body.email).toBeUndefined();
      expect(body.internalNotes).toBeUndefined();
    });
  });

  // ==========================================================================
  // 6. Collection auto-projection via guardNarrow + .resource()
  // ==========================================================================

  describe('Collection auto-projection via guardNarrow + .resource()', () => {
    let server: FastifyInstance;
    let userToken: string;
    let adminToken: string;

    const mockUsers = [
      { id: 'u1', name: 'Alice', email: 'alice@example.com', internalNotes: 'Staff' },
      { id: 'u2', name: 'Bob', email: 'bob@example.com', internalNotes: null },
    ];

    beforeEach(async () => {
      server = await createTestServer();
      userToken = server.auth.jwt.createTokenPair(TEST_USERS.user).accessToken;
      adminToken = server.auth.jwt.createTokenPair(TEST_USERS.admin).accessToken;

      const auth = authMiddleware(createTestAuthConfig());

      // Handler returns raw array — auto-projection handles per-item filtering
      const procs = defineProcedures('collection', {
        listCollection: procedure()
          .use(auth.middleware())
          .guardNarrow(authenticatedNarrow)
          .resource(ProfileSchema)
          .query(async () => mockUsers),

        createCollection: procedure()
          .input(z.object({ name: z.string() }))
          .use(auth.middleware())
          .guardNarrow(adminNarrow)
          .resource(ProfileSchema)
          .mutation(async () => mockUsers),
      });

      rest([procs], { prefix: '/api' })(server);
      await server.ready();
    });

    afterEach(async () => {
      await server.close();
    });

    it('auto-projects each item for authenticated user', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/collection',
        headers: authHeader(userToken),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);

      for (const item of body) {
        expect(item.id).toBeDefined();
        expect(item.name).toBeDefined();
        expect(item.email).toBeDefined();
        expect(item.internalNotes).toBeUndefined();
      }

      expect(body[0]).toEqual({ id: 'u1', name: 'Alice', email: 'alice@example.com' });
      expect(body[1]).toEqual({ id: 'u2', name: 'Bob', email: 'bob@example.com' });
    });

    it('auto-projects each item for admin (all fields)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/collection',
        headers: {
          ...authHeader(adminToken),
          'content-type': 'application/json',
        },
        payload: { name: 'test' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);

      expect(body[0]).toEqual({
        id: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
        internalNotes: 'Staff',
      });
      expect(body[1]).toEqual({
        id: 'u2',
        name: 'Bob',
        email: 'bob@example.com',
        internalNotes: null,
      });
    });

    it('auto-projects array to public fields when no guard', async () => {
      const noGuardServer = await createTestServer();

      const procs = defineProcedures('pubcollection', {
        listPubcollection: procedure()
          .resource(ProfileSchema)
          .query(async () => mockUsers),
      });

      rest([procs], { prefix: '/api' })(noGuardServer);
      await noGuardServer.ready();

      const response = await noGuardServer.inject({
        method: 'GET',
        url: '/api/pubcollection',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
      expect(body[0]).toEqual({ id: 'u1', name: 'Alice' });
      expect(body[1]).toEqual({ id: 'u2', name: 'Bob' });

      await noGuardServer.close();
    });
  });
});
