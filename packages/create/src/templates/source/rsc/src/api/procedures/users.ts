/**
 * User Procedures
 *
 * CRUD operations for user management.
 */

import { defineProcedures, procedure } from '@veloxts/router';
import { z } from 'zod';

import { CreateUserSchema, UpdateUserSchema, UserSchema } from '../schemas/user.js';

export const userProcedures = defineProcedures('users', {
  /**
   * List all users
   * GET /api/users
   */
  listUsers: procedure()
    .output(z.array(UserSchema))
    .query(async ({ ctx }) => {
      return ctx.db.user.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }),

  /**
   * Get a single user by ID
   * GET /api/users/:id
   */
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema.nullable())
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findUnique({
        where: { id: input.id },
      });
    }),

  /**
   * Create a new user
   * POST /api/users
   */
  createUser: procedure()
    .input(CreateUserSchema)
    .output(UserSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.create({
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
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.user.update({
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
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
