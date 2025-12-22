/**
 * User Procedures
 *
 * CRUD procedures for user management with authentication guards.
 * Clean implementation without boilerplate:
 * - No manual DbUser/DbClient interfaces needed
 * - No toUserResponse() transformation needed
 * - Output schema automatically serializes Date → string via withTimestamps()
 */

import {
  AuthError,
  authenticated,
  GuardError,
  hasRole,
  NotFoundError,
  paginationInputSchema,
  procedure,
  procedures,
  z,
} from '@veloxts/velox';

import {
  CreateUserInput,
  ListUsersResponse,
  UpdateUserInput,
  UserSchema,
} from '../schemas/user.js';

// ============================================================================
// User Procedures
// ============================================================================

export const userProcedures = procedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.id } });
      if (!user) {
        throw new NotFoundError(`User with id '${input.id}' not found`);
      }
      // Return Prisma object directly - output schema handles Date serialization
      return user;
    }),

  listUsers: procedure()
    .input(paginationInputSchema.optional())
    .output(ListUsersResponse)
    .query(async ({ input, ctx }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        ctx.db.user.findMany({ skip, take: limit }),
        ctx.db.user.count(),
      ]);

      // Return Prisma objects directly - output schema serializes dates
      return { data: users, meta: { page, limit, total } };
    }),

  createUser: procedure()
    .guard(authenticated)
    .input(CreateUserInput)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),

  updateUser: procedure()
    .guard(authenticated)
    .input(z.object({ id: z.string().uuid() }).merge(UpdateUserInput))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      if (!ctx.user) {
        throw new AuthError('Authentication required', 401, 'NOT_AUTHENTICATED');
      }

      const isOwner = ctx.user.id === id;
      const isAdmin = Array.isArray(ctx.user.roles) && ctx.user.roles.includes('admin');

      if (!isOwner && !isAdmin) {
        throw new GuardError('ownership', 'You can only update your own profile', 403);
      }

      return ctx.db.user.update({ where: { id }, data });
    }),

  patchUser: procedure()
    .guard(authenticated)
    .input(z.object({ id: z.string().uuid() }).merge(UpdateUserInput))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      if (!ctx.user) {
        throw new AuthError('Authentication required', 401, 'NOT_AUTHENTICATED');
      }

      const isOwner = ctx.user.id === id;
      const isAdmin = Array.isArray(ctx.user.roles) && ctx.user.roles.includes('admin');

      if (!isOwner && !isAdmin) {
        throw new GuardError('ownership', 'You can only update your own profile', 403);
      }

      return ctx.db.user.update({ where: { id }, data });
    }),

  deleteUser: procedure()
    .guard(hasRole('admin'))
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.user.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
