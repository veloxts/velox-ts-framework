/**
 * @veloxts/router - REST Adapter Tests
 * Tests REST route generation from procedures and route registration
 */

import type { BaseContext } from '@veloxts/core';
import { createVeloxApp } from '@veloxts/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineProcedures, procedure } from '../procedure/builder.js';
import { generateRestRoutes, getRouteSummary, registerRestRoutes } from '../rest';

describe('generateRestRoutes', () => {
  it('should generate routes from naming conventions', () => {
    const collection = defineProcedures('users', {
      getUser: procedure()
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => ({ id: input.id, name: 'John' })),
      listUsers: procedure().query(async () => []),
      createUser: procedure()
        .input(z.object({ name: z.string() }))
        .mutation(async ({ input }) => ({ id: 'new', name: input.name })),
    });

    const routes = generateRestRoutes(collection);

    expect(routes).toHaveLength(3);

    const getRoute = routes.find((r) => r.procedureName === 'getUser');
    expect(getRoute).toEqual({
      method: 'GET',
      path: '/users/:id',
      procedureName: 'getUser',
      procedure: collection.procedures.getUser,
    });

    const listRoute = routes.find((r) => r.procedureName === 'listUsers');
    expect(listRoute).toEqual({
      method: 'GET',
      path: '/users',
      procedureName: 'listUsers',
      procedure: collection.procedures.listUsers,
    });

    const createRoute = routes.find((r) => r.procedureName === 'createUser');
    expect(createRoute).toEqual({
      method: 'POST',
      path: '/users',
      procedureName: 'createUser',
      procedure: collection.procedures.createUser,
    });
  });

  it('should skip procedures without conventions', () => {
    const collection = defineProcedures('users', {
      getUser: procedure().query(async () => ({ id: '1', name: 'John' })),
      customAction: procedure().query(async () => ({ result: 'ok' })),
    });

    const routes = generateRestRoutes(collection);

    expect(routes).toHaveLength(1);
    expect(routes[0].procedureName).toBe('getUser');
  });

  it('should use manual REST override', () => {
    const collection = defineProcedures('users', {
      activateUser: procedure()
        .rest({ method: 'POST', path: '/users/:id/activate' })
        .mutation(async () => ({ activated: true })),
    });

    const routes = generateRestRoutes(collection);

    expect(routes).toHaveLength(1);
    expect(routes[0]).toEqual({
      method: 'POST',
      path: '/users/:id/activate',
      procedureName: 'activateUser',
      procedure: collection.procedures.activateUser,
    });
  });

  it('should handle partial REST override with convention fallback', () => {
    const collection = defineProcedures('users', {
      getUser: procedure()
        .rest({ path: '/users/:userId' })
        .query(async () => ({ id: '1' })),
    });

    const routes = generateRestRoutes(collection);

    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe('GET');
    expect(routes[0].path).toBe('/users/:userId');
  });

  it('should skip route generation for partial override without convention match', () => {
    const collection = defineProcedures('users', {
      customAction: procedure()
        .rest({ method: 'POST' })
        .query(async () => ({ result: 'ok' })),
    });

    const routes = generateRestRoutes(collection);

    expect(routes).toHaveLength(0);
  });

  it('should handle empty procedure collection', () => {
    const collection = defineProcedures('empty', {});

    const routes = generateRestRoutes(collection);

    expect(routes).toHaveLength(0);
  });

  it('should generate routes for multiple resource actions', () => {
    const collection = defineProcedures('posts', {
      getPost: procedure().query(async () => ({ id: '1' })),
      listPosts: procedure().query(async () => []),
      findPosts: procedure().query(async () => []),
      createPost: procedure().mutation(async () => ({ id: 'new' })),
      addPost: procedure().mutation(async () => ({ id: 'new' })),
    });

    const routes = generateRestRoutes(collection);

    expect(routes).toHaveLength(5);
    expect(routes.filter((r) => r.method === 'GET')).toHaveLength(3);
    expect(routes.filter((r) => r.method === 'POST')).toHaveLength(2);
  });

  it('should generate PUT routes for update patterns', () => {
    const collection = defineProcedures('users', {
      updateUser: procedure()
        .input(z.object({ id: z.string(), name: z.string() }))
        .mutation(async ({ input }) => ({ id: input.id, name: input.name })),
      editUser: procedure()
        .input(z.object({ id: z.string(), email: z.string() }))
        .mutation(async ({ input }) => ({ id: input.id, email: input.email })),
    });

    const routes = generateRestRoutes(collection);

    expect(routes).toHaveLength(2);
    expect(routes[0].method).toBe('PUT');
    expect(routes[0].path).toBe('/users/:id');
    expect(routes[1].method).toBe('PUT');
    expect(routes[1].path).toBe('/users/:id');
  });

  it('should generate PATCH routes for patch pattern', () => {
    const collection = defineProcedures('users', {
      patchUser: procedure()
        .input(z.object({ id: z.string(), email: z.string().optional() }))
        .mutation(async ({ input }) => ({ id: input.id })),
    });

    const routes = generateRestRoutes(collection);

    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe('PATCH');
    expect(routes[0].path).toBe('/users/:id');
  });

  it('should generate DELETE routes for delete patterns', () => {
    const collection = defineProcedures('users', {
      deleteUser: procedure()
        .input(z.object({ id: z.string() }))
        .mutation(async () => ({ deleted: true })),
      removeUser: procedure()
        .input(z.object({ id: z.string() }))
        .mutation(async () => ({ removed: true })),
    });

    const routes = generateRestRoutes(collection);

    expect(routes).toHaveLength(2);
    expect(routes[0].method).toBe('DELETE');
    expect(routes[0].path).toBe('/users/:id');
    expect(routes[1].method).toBe('DELETE');
    expect(routes[1].path).toBe('/users/:id');
  });
});

describe('getRouteSummary', () => {
  it('should generate route summary', () => {
    const collection = defineProcedures('users', {
      getUser: procedure().query(async () => ({ id: '1' })),
      listUsers: procedure().query(async () => []),
      createUser: procedure().mutation(async () => ({ id: 'new' })),
    });

    const summary = getRouteSummary([collection]);

    expect(summary).toHaveLength(3);
    expect(summary).toContainEqual({
      method: 'GET',
      path: '/api/users/:id',
      procedure: 'getUser',
      namespace: 'users',
    });
    expect(summary).toContainEqual({
      method: 'GET',
      path: '/api/users',
      procedure: 'listUsers',
      namespace: 'users',
    });
    expect(summary).toContainEqual({
      method: 'POST',
      path: '/api/users',
      procedure: 'createUser',
      namespace: 'users',
    });
  });

  it('should use custom prefix', () => {
    const collection = defineProcedures('users', {
      getUser: procedure().query(async () => ({ id: '1' })),
    });

    const summary = getRouteSummary([collection], '/v1');

    expect(summary[0].path).toBe('/v1/users/:id');
  });

  it('should handle multiple collections', () => {
    const users = defineProcedures('users', {
      getUser: procedure().query(async () => ({ id: '1' })),
    });

    const posts = defineProcedures('posts', {
      getPost: procedure().query(async () => ({ id: '1' })),
    });

    const summary = getRouteSummary([users, posts]);

    expect(summary).toHaveLength(2);
    expect(summary.find((s) => s.namespace === 'users')).toBeDefined();
    expect(summary.find((s) => s.namespace === 'posts')).toBeDefined();
  });
});

describe('registerRestRoutes - Integration', () => {
  let app: Awaited<ReturnType<typeof createVeloxApp>>;

  beforeEach(async () => {
    app = await createVeloxApp({ port: 0, logger: false });
  });

  afterEach(async () => {
    if (app.isRunning) {
      await app.stop();
    }
  });

  it('should register GET route with ID parameter', async () => {
    const collection = defineProcedures('users', {
      getUser: procedure()
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => ({ id: input.id, name: 'John Doe' })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/users/123',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: '123', name: 'John Doe' });
  });

  it('should register GET route without parameters', async () => {
    const collection = defineProcedures('users', {
      listUsers: procedure().query(async () => [
        { id: '1', name: 'John' },
        { id: '2', name: 'Jane' },
      ]),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/users',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
  });

  it('should register POST route', async () => {
    const collection = defineProcedures('users', {
      createUser: procedure()
        .input(z.object({ name: z.string(), email: z.string().email() }))
        .mutation(async ({ input }) => ({
          id: 'new-id',
          name: input.name,
          email: input.email,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'POST',
      url: '/api/users',
      payload: { name: 'John', email: 'john@example.com' },
    });

    expect(response.statusCode).toBe(201); // Created status for create actions
    expect(response.json()).toEqual({
      id: 'new-id',
      name: 'John',
      email: 'john@example.com',
    });
  });

  it('should merge query params and route params for GET', async () => {
    const collection = defineProcedures('users', {
      getUser: procedure()
        .input(
          z.object({
            id: z.string(),
            include: z.string().optional(),
          })
        )
        .query(async ({ input }) => ({
          id: input.id,
          name: 'John',
          include: input.include,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/users/123?include=profile',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: '123',
      name: 'John',
      include: 'profile',
    });
  });

  it('should reject invalid input with error response', async () => {
    const collection = defineProcedures('users', {
      createUser: procedure()
        .input(z.object({ email: z.string().email() }))
        .mutation(async ({ input }) => ({ email: input.email })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'POST',
      url: '/api/users',
      payload: { email: 'invalid-email' },
    });

    // Validation errors result in 500 without custom error handling
    // (error handling is typically configured at the Fastify/VeloxApp level)
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.statusCode).toBeLessThan(600);
  });

  it('should use custom prefix', async () => {
    const collection = defineProcedures('users', {
      listUsers: procedure().query(async () => []),
    });

    registerRestRoutes(app.server, [collection], { prefix: '/v1' });
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/v1/users',
    });

    expect(response.statusCode).toBe(200);
  });

  it('should register multiple collections', async () => {
    const users = defineProcedures('users', {
      listUsers: procedure().query(async () => [{ id: '1', name: 'John' }]),
    });

    const posts = defineProcedures('posts', {
      listPosts: procedure().query(async () => [{ id: '1', title: 'Post 1' }]),
    });

    registerRestRoutes(app.server, [users, posts]);
    await app.start();

    const usersResponse = await app.server.inject({
      method: 'GET',
      url: '/api/users',
    });

    const postsResponse = await app.server.inject({
      method: 'GET',
      url: '/api/posts',
    });

    expect(usersResponse.statusCode).toBe(200);
    expect(postsResponse.statusCode).toBe(200);
  });

  it('should handle procedures with middleware', async () => {
    const collection = defineProcedures('users', {
      getUser: procedure()
        .use(async ({ next, ctx }) => {
          // Add timestamp to context
          return next({ ctx: { ...ctx, timestamp: Date.now() } });
        })
        .query(async ({ ctx }) => {
          const extendedCtx = ctx as BaseContext & { timestamp: number };
          return {
            id: '1',
            name: 'John',
            requestedAt: extendedCtx.timestamp,
          };
        }),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/users/1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('requestedAt');
  });

  it('should handle custom REST override', async () => {
    const collection = defineProcedures('users', {
      activateUser: procedure()
        .rest({ method: 'POST', path: '/users/:id/activate' })
        .mutation(async () => ({ activated: true })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'POST',
      url: '/api/users/123/activate',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ activated: true });
  });

  it('should coerce input types from query strings', async () => {
    const collection = defineProcedures('users', {
      listUsers: procedure()
        .input(
          z.object({
            page: z.coerce.number(),
            limit: z.coerce.number(),
          })
        )
        .query(async ({ input }) => ({
          page: input.page,
          limit: input.limit,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/users?page=2&limit=10',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      page: 2,
      limit: 10,
    });
  });

  it('should handle errors thrown in handler', async () => {
    const collection = defineProcedures('users', {
      getUser: procedure().query(async () => {
        throw new Error('User not found');
      }),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/users/123',
    });

    expect(response.statusCode).toBe(500);
  });

  it('should return 404 for non-existent routes', async () => {
    const collection = defineProcedures('users', {
      getUser: procedure().query(async () => ({ id: '1' })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/users',
    });

    expect(response.statusCode).toBe(404);
  });

  it('should register PUT route and merge params with body', async () => {
    const collection = defineProcedures('users', {
      updateUser: procedure()
        .input(z.object({ id: z.string(), name: z.string(), email: z.string() }))
        .mutation(async ({ input }) => ({
          id: input.id,
          name: input.name,
          email: input.email,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'PUT',
      url: '/api/users/123',
      payload: { name: 'John Updated', email: 'john@updated.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: '123',
      name: 'John Updated',
      email: 'john@updated.com',
    });
  });

  it('should register PATCH route and merge params with body', async () => {
    const collection = defineProcedures('users', {
      patchUser: procedure()
        .input(z.object({ id: z.string(), email: z.string().optional() }))
        .mutation(async ({ input }) => ({
          id: input.id,
          email: input.email,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'PATCH',
      url: '/api/users/456',
      payload: { email: 'patched@example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: '456',
      email: 'patched@example.com',
    });
  });

  it('should register DELETE route and return 204 for null result', async () => {
    const collection = defineProcedures('users', {
      deleteUser: procedure()
        .input(z.object({ id: z.string() }))
        .mutation(async () => null),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'DELETE',
      url: '/api/users/789',
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
  });

  it('should register DELETE route and return 200 with data', async () => {
    const collection = defineProcedures('users', {
      deleteUser: procedure()
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => ({ id: input.id, deleted: true })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'DELETE',
      url: '/api/users/789',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: '789', deleted: true });
  });

  it('should return 201 for add pattern (POST alias)', async () => {
    const collection = defineProcedures('users', {
      addUser: procedure()
        .input(z.object({ name: z.string() }))
        .mutation(async ({ input }) => ({ id: 'new', name: input.name })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'POST',
      url: '/api/users',
      payload: { name: 'Added User' },
    });

    expect(response.statusCode).toBe(201);
  });
});

describe('Input gathering', () => {
  let app: Awaited<ReturnType<typeof createVeloxApp>>;

  beforeEach(async () => {
    app = await createVeloxApp({ port: 0, logger: false });
  });

  afterEach(async () => {
    if (app.isRunning) {
      await app.stop();
    }
  });

  it('should gather input from route params for GET', async () => {
    const collection = defineProcedures('users', {
      getUser: procedure()
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => ({ id: input.id })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/users/abc123',
    });

    expect(response.json().id).toBe('abc123');
  });

  it('should gather input from query string for GET', async () => {
    const collection = defineProcedures('users', {
      findUsers: procedure()
        .input(z.object({ search: z.string() }))
        .query(async ({ input }) => ({ search: input.search })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/users?search=john',
    });

    expect(response.json().search).toBe('john');
  });

  it('should gather input from body for POST', async () => {
    const collection = defineProcedures('users', {
      createUser: procedure()
        .input(z.object({ name: z.string() }))
        .mutation(async ({ input }) => ({ name: input.name })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'POST',
      url: '/api/users',
      payload: { name: 'John Doe' },
    });

    expect(response.json().name).toBe('John Doe');
  });

  it('should merge params and query for GET', async () => {
    const collection = defineProcedures('users', {
      getUser: procedure()
        .input(
          z.object({
            id: z.string(),
            fields: z.string().optional(),
          })
        )
        .query(async ({ input }) => ({
          id: input.id,
          fields: input.fields,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/users/123?fields=name,email',
    });

    expect(response.json()).toEqual({
      id: '123',
      fields: 'name,email',
    });
  });

  it('should merge params and query for DELETE', async () => {
    const collection = defineProcedures('users', {
      deleteUser: procedure()
        .input(
          z.object({
            id: z.string(),
            force: z.coerce.boolean().optional(),
          })
        )
        .mutation(async ({ input }) => ({
          id: input.id,
          force: input.force,
          deleted: true,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'DELETE',
      url: '/api/users/456?force=true',
    });

    expect(response.json()).toEqual({
      id: '456',
      force: true,
      deleted: true,
    });
  });

  it('should use body only for POST', async () => {
    const collection = defineProcedures('users', {
      createUser: procedure()
        .input(z.object({ name: z.string(), email: z.string() }))
        .mutation(async ({ input }) => ({
          name: input.name,
          email: input.email,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'POST',
      url: '/api/users',
      payload: { name: 'Test', email: 'test@example.com' },
    });

    expect(response.json()).toEqual({
      name: 'Test',
      email: 'test@example.com',
    });
  });

  it('should merge params and body for PUT', async () => {
    const collection = defineProcedures('users', {
      updateUser: procedure()
        .input(z.object({ id: z.string(), name: z.string() }))
        .mutation(async ({ input }) => ({
          id: input.id,
          name: input.name,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'PUT',
      url: '/api/users/999',
      payload: { name: 'Updated Name' },
    });

    expect(response.json()).toEqual({
      id: '999',
      name: 'Updated Name',
    });
  });

  it('should merge params and body for PATCH', async () => {
    const collection = defineProcedures('users', {
      patchUser: procedure()
        .input(z.object({ id: z.string(), status: z.string() }))
        .mutation(async ({ input }) => ({
          id: input.id,
          status: input.status,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'PATCH',
      url: '/api/users/888',
      payload: { status: 'active' },
    });

    expect(response.json()).toEqual({
      id: '888',
      status: 'active',
    });
  });
});
