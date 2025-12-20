/**
 * Post Schemas
 *
 * Zod schemas for post validation.
 */

import { z } from 'zod';

/**
 * Post entity schema
 */
export const PostSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string().nullable(),
  published: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string().uuid(),
});

/**
 * Post with user relation
 */
export const PostWithUserSchema = PostSchema.extend({
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
});

/**
 * Create post input schema
 */
export const CreatePostSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional(),
  published: z.boolean().optional().default(false),
});

/**
 * Update post input schema (all fields optional)
 */
export const UpdatePostSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  published: z.boolean().optional(),
});

export type Post = z.infer<typeof PostSchema>;
export type PostWithUser = z.infer<typeof PostWithUserSchema>;
export type CreatePost = z.infer<typeof CreatePostSchema>;
export type UpdatePost = z.infer<typeof UpdatePostSchema>;
