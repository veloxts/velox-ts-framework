/**
 * Post Procedures
 *
 * Nested CRUD operations for posts under users.
 * Uses .parent('users') to enable automatic path parameter merging.
 * Routes: /api/users/:userId/posts/*
 */

import { procedure, procedures } from '@veloxts/router';
import { z } from 'zod';

import { db } from '../database.js';
import {
  CreatePostSchema,
  PostSchema,
  PostWithUserSchema,
  UpdatePostSchema,
} from '../schemas/post.js';

export const postProcedures = procedures('posts', {
  /**
   * List all posts for a user
   * GET /api/users/:userId/posts
   */
  listPosts: procedure()
    .parent('users')
    .input(z.object({ userId: z.string().uuid() }))
    .output(z.array(PostSchema))
    .query(async ({ input }) => {
      // Verify user exists
      const user = await db.user.findUnique({
        where: { id: input.userId },
      });

      if (!user) {
        throw Object.assign(new Error('User not found'), { statusCode: 404 });
      }

      return db.post.findMany({
        where: { userId: input.userId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  /**
   * Get a single post by ID
   * GET /api/users/:userId/posts/:id
   */
  getPost: procedure()
    .parent('users')
    .input(z.object({ userId: z.string().uuid(), id: z.string().uuid() }))
    .output(PostWithUserSchema)
    .query(async ({ input }) => {
      const post = await db.post.findFirst({
        where: {
          id: input.id,
          userId: input.userId,
        },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      });

      if (!post) {
        throw Object.assign(new Error('Post not found'), { statusCode: 404 });
      }

      return post;
    }),

  /**
   * Create a new post for a user
   * POST /api/users/:userId/posts
   */
  createPost: procedure()
    .parent('users')
    .input(CreatePostSchema.extend({ userId: z.string().uuid() }))
    .output(PostSchema)
    .mutation(async ({ input }) => {
      const { userId, ...data } = input;

      // Verify user exists
      const user = await db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw Object.assign(new Error('User not found'), { statusCode: 404 });
      }

      return db.post.create({
        data: {
          ...data,
          userId,
        },
      });
    }),

  /**
   * Update an existing post
   * PUT /api/users/:userId/posts/:id
   */
  updatePost: procedure()
    .parent('users')
    .input(UpdatePostSchema.extend({ userId: z.string().uuid(), id: z.string().uuid() }))
    .output(PostSchema)
    .mutation(async ({ input }) => {
      const { id, userId, ...data } = input;

      // Verify post belongs to user
      const post = await db.post.findFirst({
        where: { id, userId },
      });

      if (!post) {
        throw Object.assign(new Error('Post not found'), { statusCode: 404 });
      }

      return db.post.update({
        where: { id },
        data,
      });
    }),

  /**
   * Delete a post
   * DELETE /api/users/:userId/posts/:id
   */
  deletePost: procedure()
    .parent('users')
    .input(z.object({ userId: z.string().uuid(), id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      // Verify post belongs to user
      const post = await db.post.findFirst({
        where: { id: input.id, userId: input.userId },
      });

      if (!post) {
        throw Object.assign(new Error('Post not found'), { statusCode: 404 });
      }

      await db.post.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
