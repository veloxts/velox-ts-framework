/**
 * @veloxts/router - Nested Routes Tests
 * Tests for nested resource routes (e.g., /posts/:postId/comments/:id)
 */

import { veloxApp } from '@veloxts/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineProcedures, procedure } from '../procedure/builder.js';
import { generateRestRoutes, registerRestRoutes, rest } from '../rest/adapter.js';
import { buildNestedRestPath } from '../rest/naming.js';
import type { ParentResourceConfig } from '../types.js';

describe('buildNestedRestPath', () => {
  const parent: ParentResourceConfig = {
    namespace: 'posts',
    paramName: 'postId',
  };

  it('should build nested path with ID parameter', () => {
    const mapping = { method: 'GET', path: '/:id', hasIdParam: true } as const;

    const path = buildNestedRestPath(parent, 'comments', mapping);

    expect(path).toBe('/posts/:postId/comments/:id');
  });

  it('should build nested path without ID parameter', () => {
    const mapping = { method: 'GET', path: '/', hasIdParam: false } as const;

    const path = buildNestedRestPath(parent, 'comments', mapping);

    expect(path).toBe('/posts/:postId/comments');
  });

  it('should handle custom parent param names', () => {
    const customParent: ParentResourceConfig = {
      namespace: 'posts',
      paramName: 'post_id',
    };
    const mapping = { method: 'GET', path: '/:id', hasIdParam: true } as const;

    const path = buildNestedRestPath(customParent, 'comments', mapping);

    expect(path).toBe('/posts/:post_id/comments/:id');
  });

  it('should handle nested resources for all HTTP methods', () => {
    // GET collection
    expect(
      buildNestedRestPath(parent, 'comments', { method: 'GET', path: '/', hasIdParam: false })
    ).toBe('/posts/:postId/comments');

    // GET single
    expect(
      buildNestedRestPath(parent, 'comments', { method: 'GET', path: '/:id', hasIdParam: true })
    ).toBe('/posts/:postId/comments/:id');

    // POST
    expect(
      buildNestedRestPath(parent, 'comments', { method: 'POST', path: '/', hasIdParam: false })
    ).toBe('/posts/:postId/comments');

    // PUT
    expect(
      buildNestedRestPath(parent, 'comments', { method: 'PUT', path: '/:id', hasIdParam: true })
    ).toBe('/posts/:postId/comments/:id');

    // PATCH
    expect(
      buildNestedRestPath(parent, 'comments', { method: 'PATCH', path: '/:id', hasIdParam: true })
    ).toBe('/posts/:postId/comments/:id');

    // DELETE
    expect(
      buildNestedRestPath(parent, 'comments', { method: 'DELETE', path: '/:id', hasIdParam: true })
    ).toBe('/posts/:postId/comments/:id');
  });
});

describe('procedure().parent()', () => {
  it('should create procedure with parent resource using default param name', () => {
    const proc = procedure()
      .parent('posts')
      .input(z.object({ postId: z.string(), id: z.string() }))
      .query(async ({ input }) => ({ postId: input.postId, id: input.id }));

    expect(proc.parentResource).toEqual({
      namespace: 'posts',
      paramName: 'postId',
    });
  });

  it('should create procedure with parent resource using custom param name', () => {
    const proc = procedure()
      .parent('posts', 'post_id')
      .input(z.object({ post_id: z.string(), id: z.string() }))
      .query(async ({ input }) => ({ post_id: input.post_id, id: input.id }));

    expect(proc.parentResource).toEqual({
      namespace: 'posts',
      paramName: 'post_id',
    });
  });

  it('should derive singular param name from plural namespace', () => {
    // Simple plural
    const usersProc = procedure()
      .parent('users')
      .query(async () => ({}));
    expect(usersProc.parentResource?.paramName).toBe('userId');

    // -ies plural
    const categoriesProc = procedure()
      .parent('categories')
      .query(async () => ({}));
    expect(categoriesProc.parentResource?.paramName).toBe('categoryId');

    // -es plural
    const boxesProc = procedure()
      .parent('boxes')
      .query(async () => ({}));
    expect(boxesProc.parentResource?.paramName).toBe('boxId');

    // Already singular or non-standard
    const dataProc = procedure()
      .parent('data')
      .query(async () => ({}));
    expect(dataProc.parentResource?.paramName).toBe('datumId');
  });

  it('should preserve other builder state when adding parent', () => {
    const inputSchema = z.object({ postId: z.string(), id: z.string() });
    const outputSchema = z.object({ content: z.string() });

    const proc = procedure()
      .input(inputSchema)
      .output(outputSchema)
      .parent('posts')
      .query(async ({ input }) => ({ content: `Post ${input.postId}, Comment ${input.id}` }));

    expect(proc.parentResource).toBeDefined();
    expect(proc.inputSchema).toBeDefined();
    expect(proc.outputSchema).toBeDefined();
  });
});

describe('generateRestRoutes with parent', () => {
  it('should generate nested routes for procedures with parent', () => {
    const collection = defineProcedures('comments', {
      getComment: procedure()
        .parent('posts')
        .input(z.object({ postId: z.string(), id: z.string() }))
        .query(async ({ input }) => ({ id: input.id, postId: input.postId })),

      listComments: procedure()
        .parent('posts')
        .input(z.object({ postId: z.string() }))
        .query(async ({ input }) => [{ id: '1', postId: input.postId }]),

      createComment: procedure()
        .parent('posts')
        .input(z.object({ postId: z.string(), content: z.string() }))
        .mutation(async ({ input }) => ({
          id: 'new',
          postId: input.postId,
          content: input.content,
        })),
    });

    const routes = generateRestRoutes(collection);

    expect(routes).toHaveLength(3);

    const getRoute = routes.find((r) => r.procedureName === 'getComment');
    expect(getRoute).toEqual({
      method: 'GET',
      path: '/posts/:postId/comments/:id',
      procedureName: 'getComment',
      procedure: collection.procedures.getComment,
    });

    const listRoute = routes.find((r) => r.procedureName === 'listComments');
    expect(listRoute).toEqual({
      method: 'GET',
      path: '/posts/:postId/comments',
      procedureName: 'listComments',
      procedure: collection.procedures.listComments,
    });

    const createRoute = routes.find((r) => r.procedureName === 'createComment');
    expect(createRoute).toEqual({
      method: 'POST',
      path: '/posts/:postId/comments',
      procedureName: 'createComment',
      procedure: collection.procedures.createComment,
    });
  });

  it('should mix nested and flat routes in same collection', () => {
    const collection = defineProcedures('comments', {
      // Nested under posts
      getComment: procedure()
        .parent('posts')
        .input(z.object({ postId: z.string(), id: z.string() }))
        .query(async ({ input }) => ({ id: input.id })),

      // Flat (not nested) - for admin or API access
      listComments: procedure().query(async () => []),
    });

    const routes = generateRestRoutes(collection);

    expect(routes).toHaveLength(2);

    const nestedRoute = routes.find((r) => r.procedureName === 'getComment');
    expect(nestedRoute?.path).toBe('/posts/:postId/comments/:id');

    const flatRoute = routes.find((r) => r.procedureName === 'listComments');
    expect(flatRoute?.path).toBe('/comments');
  });

  it('should use manual override path even with parent defined', () => {
    const collection = defineProcedures('comments', {
      getComment: procedure()
        .parent('posts')
        .rest({ method: 'GET', path: '/custom/comments/:id' })
        .query(async () => ({ id: '1' })),
    });

    const routes = generateRestRoutes(collection);

    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe('/custom/comments/:id');
  });

  it('should handle partial override with parent', () => {
    const collection = defineProcedures('comments', {
      getComment: procedure()
        .parent('posts')
        .rest({ method: 'POST' }) // Override method only
        .query(async () => ({ id: '1' })),
    });

    const routes = generateRestRoutes(collection);

    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe('POST');
    // Path should still use parent-aware building
    expect(routes[0].path).toBe('/posts/:postId/comments/:id');
  });
});

describe('Nested routes - Integration', () => {
  let app: Awaited<ReturnType<typeof veloxApp>>;

  beforeEach(async () => {
    app = await veloxApp({ port: 0, logger: false });
  });

  afterEach(async () => {
    if (app.isRunning) {
      await app.stop();
    }
  });

  it('should register and handle nested GET with ID', async () => {
    const collection = defineProcedures('comments', {
      getComment: procedure()
        .parent('posts')
        .input(z.object({ postId: z.string(), id: z.string() }))
        .query(async ({ input }) => ({
          id: input.id,
          postId: input.postId,
          content: 'Test comment',
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/posts/post-123/comments/comment-456',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: 'comment-456',
      postId: 'post-123',
      content: 'Test comment',
    });
  });

  it('should register and handle nested GET collection', async () => {
    const collection = defineProcedures('comments', {
      listComments: procedure()
        .parent('posts')
        .input(z.object({ postId: z.string() }))
        .query(async ({ input }) => [
          { id: '1', postId: input.postId, content: 'First' },
          { id: '2', postId: input.postId, content: 'Second' },
        ]),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/posts/post-123/comments',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
    expect(response.json()[0].postId).toBe('post-123');
  });

  it('should register and handle nested POST', async () => {
    const collection = defineProcedures('comments', {
      createComment: procedure()
        .parent('posts')
        .input(z.object({ postId: z.string(), content: z.string() }))
        .mutation(async ({ input }) => ({
          id: 'new-comment',
          postId: input.postId,
          content: input.content,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    // For POST on nested routes, the postId is extracted from the URL path param
    // and merged with the body - so we don't need to include it in the payload
    const response = await app.server.inject({
      method: 'POST',
      url: '/api/posts/post-123/comments',
      payload: { content: 'New comment content' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: 'new-comment',
      postId: 'post-123',
      content: 'New comment content',
    });
  });

  it('should register and handle nested PUT', async () => {
    const collection = defineProcedures('comments', {
      updateComment: procedure()
        .parent('posts')
        .input(z.object({ postId: z.string(), id: z.string(), content: z.string() }))
        .mutation(async ({ input }) => ({
          id: input.id,
          postId: input.postId,
          content: input.content,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'PUT',
      url: '/api/posts/post-123/comments/comment-456',
      payload: { content: 'Updated content' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: 'comment-456',
      postId: 'post-123',
      content: 'Updated content',
    });
  });

  it('should register and handle nested DELETE', async () => {
    const collection = defineProcedures('comments', {
      deleteComment: procedure()
        .parent('posts')
        .input(z.object({ postId: z.string(), id: z.string() }))
        .mutation(async ({ input }) => ({
          deleted: true,
          id: input.id,
          postId: input.postId,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'DELETE',
      url: '/api/posts/post-123/comments/comment-456',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      deleted: true,
      id: 'comment-456',
      postId: 'post-123',
    });
  });

  it('should work with server.register() pattern', async () => {
    const collection = defineProcedures('comments', {
      listComments: procedure()
        .parent('posts')
        .input(z.object({ postId: z.string() }))
        .query(async ({ input }) => [{ id: '1', postId: input.postId }]),
    });

    await app.server.register(rest([collection]), { prefix: '/api' });
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/posts/post-123/comments',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()[0].postId).toBe('post-123');
  });

  it('should handle multiple nested collections', async () => {
    const comments = defineProcedures('comments', {
      listComments: procedure()
        .parent('posts')
        .input(z.object({ postId: z.string() }))
        .query(async ({ input }) => [{ type: 'comment', postId: input.postId }]),
    });

    const likes = defineProcedures('likes', {
      listLikes: procedure()
        .parent('posts')
        .input(z.object({ postId: z.string() }))
        .query(async ({ input }) => [{ type: 'like', postId: input.postId }]),
    });

    await app.server.register(rest([comments, likes]), { prefix: '/api' });
    await app.start();

    const commentsResponse = await app.server.inject({
      method: 'GET',
      url: '/api/posts/post-123/comments',
    });

    const likesResponse = await app.server.inject({
      method: 'GET',
      url: '/api/posts/post-123/likes',
    });

    expect(commentsResponse.json()[0].type).toBe('comment');
    expect(likesResponse.json()[0].type).toBe('like');
  });

  it('should handle custom parent param names', async () => {
    const collection = defineProcedures('comments', {
      getComment: procedure()
        .parent('posts', 'post_id')
        .input(z.object({ post_id: z.string(), id: z.string() }))
        .query(async ({ input }) => ({
          id: input.id,
          post_id: input.post_id,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/posts/post-123/comments/comment-456',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: 'comment-456',
      post_id: 'post-123',
    });
  });

  it('should merge query params with route params for nested GET', async () => {
    const collection = defineProcedures('comments', {
      listComments: procedure()
        .parent('posts')
        .input(
          z.object({
            postId: z.string(),
            page: z.coerce.number().optional(),
            limit: z.coerce.number().optional(),
          })
        )
        .query(async ({ input }) => ({
          postId: input.postId,
          page: input.page ?? 1,
          limit: input.limit ?? 10,
        })),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/posts/post-123/comments?page=2&limit=25',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      postId: 'post-123',
      page: 2,
      limit: 25,
    });
  });
});
