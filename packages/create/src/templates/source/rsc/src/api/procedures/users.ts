/**
 * User Procedures
 *
 * CRUD operations for user management.
 * Uses direct db import for proper PrismaClient typing.
 */

import { defineProcedures, procedure } from '@veloxts/router';
import { z } from 'zod';

import { db } from '../database.js';
import { CreateUserSchema, UpdateUserSchema, UserSchema } from '../schemas/user.js';

export const userProcedures = defineProcedures('users', {
  /**
   * List all users
   * GET /api/users
   */
  listUsers: procedure()
    .output(z.array(UserSchema))
    .query(async () => {
      return db.user.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }),

  /**
   * Get a single user by ID
   * GET /api/users/:id
   */
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input }) => {
      const user = await db.user.findUnique({
        where: { id: input.id },
      });

      if (!user) {
        throw Object.assign(new Error('User not found'), { statusCode: 404 });
      }

      return user;
    }),

  /**
   * Create a new user
   * POST /api/users
   */
  createUser: procedure()
    .input(CreateUserSchema)
    .output(UserSchema)
    .mutation(async ({ input }) => {
      return db.user.create({
        data: input,
      });
    }),

  /**
   * Update an existing user
   * PUT /api/users/:id
   */
  updateUser: procedure()
    .input(UpdateUserSchema.extend({ id: z.string().uuid() }))
    .output(UserSchema)
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.user.update({
        where: { id },
        data,
      });
    }),

  /**
   * Delete a user
   * DELETE /api/users/:id
   */
  deleteUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      await db.user.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
