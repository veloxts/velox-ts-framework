/**
 * User Procedures
 *
 * CRUD procedures for user management with authentication guards.
 */

import {
  AuthError,
  authenticated,
  hasRole,
  defineProcedures,
  GuardError,
  NotFoundError,
  procedure,
  paginationInputSchema,
  z,
} from '@veloxts/velox';

import {
  CreateUserInput,
  UpdateUserInput,
  type User,
  UserSchema,
} from '../schemas/user.js';

// ============================================================================
// Database Types
// ============================================================================

interface DbUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DbClient {
  user: {
    findUnique: (args: { where: { id: string } }) => Promise<DbUser | null>;
    findMany: (args?: { skip?: number; take?: number }) => Promise<DbUser[]>;
    create: (args: { data: { name: string; email: string } }) => Promise<DbUser>;
    update: (args: { where: { id: string }; data: { name?: string; email?: string } }) => Promise<DbUser>;
    delete: (args: { where: { id: string } }) => Promise<DbUser>;
    count: () => Promise<number>;
  };
}

function getDb(ctx: { db: unknown }): DbClient {
  return ctx.db as DbClient;
}

function toUserResponse(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    createdAt: dbUser.createdAt instanceof Date ? dbUser.createdAt.toISOString() : dbUser.createdAt,
    updatedAt: dbUser.updatedAt instanceof Date ? dbUser.updatedAt.toISOString() : dbUser.updatedAt,
  };
}

// ============================================================================
// User Procedures
// ============================================================================

export const userProcedures = defineProcedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const user = await db.user.findUnique({ where: { id: input.id } });
      if (!user) {
        throw new NotFoundError(`User with id '${input.id}' not found`);
      }
      return toUserResponse(user);
    }),

  listUsers: procedure()
    .input(paginationInputSchema.optional())
    .output(
      z.object({
        data: z.array(UserSchema),
        meta: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
        }),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const skip = (page - 1) * limit;

      const [dbUsers, total] = await Promise.all([
        db.user.findMany({ skip, take: limit }),
        db.user.count(),
      ]);

      return {
        data: dbUsers.map(toUserResponse),
        meta: { page, limit, total },
      };
    }),

  createUser: procedure()
    .guard(authenticated)
    .input(CreateUserInput)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const user = await db.user.create({ data: input });
      return toUserResponse(user);
    }),

  updateUser: procedure()
    .guard(authenticated)
    .input(z.object({ id: z.string().uuid() }).merge(UpdateUserInput))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const { id, ...data } = input;

      if (!ctx.user) {
        throw new AuthError('Authentication required', 401, 'NOT_AUTHENTICATED');
      }

      const isOwner = ctx.user.id === id;
      const isAdmin = Array.isArray(ctx.user.roles) && ctx.user.roles.includes('admin');

      if (!isOwner && !isAdmin) {
        throw new GuardError('ownership', 'You can only update your own profile', 403);
      }

      const updated = await db.user.update({ where: { id }, data });
      return toUserResponse(updated);
    }),

  patchUser: procedure()
    .guard(authenticated)
    .input(z.object({ id: z.string().uuid() }).merge(UpdateUserInput))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const { id, ...data } = input;

      if (!ctx.user) {
        throw new AuthError('Authentication required', 401, 'NOT_AUTHENTICATED');
      }

      const isOwner = ctx.user.id === id;
      const isAdmin = Array.isArray(ctx.user.roles) && ctx.user.roles.includes('admin');

      if (!isOwner && !isAdmin) {
        throw new GuardError('ownership', 'You can only update your own profile', 403);
      }

      const updated = await db.user.update({ where: { id }, data });
      return toUserResponse(updated);
    }),

  deleteUser: procedure()
    .guard(hasRole('admin'))
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      await db.user.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
