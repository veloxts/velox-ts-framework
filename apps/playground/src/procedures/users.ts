/**
 * User Procedures
 *
 * CRUD procedures for user management.
 * Demonstrates VeloxTS naming conventions for REST endpoint generation.
 *
 * Naming Convention -> HTTP Method:
 * - getUser    -> GET /users/:id
 * - listUsers  -> GET /users
 * - createUser -> POST /users
 * - searchUsers -> GET /users/search (custom override)
 */

import { authenticated, AuthError, hasRole } from '@veloxts/auth';
import { defineProcedures, GuardError, procedure } from '@veloxts/router';
import { paginationInputSchema } from '@veloxts/validation';
import { z } from 'zod';

import {
  CreateUserInput,
  SearchUserInput,
  UpdateUserInput,
  type User,
  UserSchema,
} from '../schemas/user.js';

// ============================================================================
// Database Types
// ============================================================================

/**
 * Database user record (raw from database)
 *
 * Prisma returns Date objects, which we transform to strings in the output schema.
 */
interface DbUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database client interface matching both Mock and real Prisma client
 *
 * This interface defines the subset of Prisma client methods we use.
 * Works with both MockPrismaClient and real PrismaClient.
 */
interface DbClient {
  user: {
    findUnique: (args: { where: { id: string } }) => Promise<DbUser | null>;
    findMany: (args?: { skip?: number; take?: number; where?: unknown }) => Promise<DbUser[]>;
    create: (args: { data: { name: string; email: string } }) => Promise<DbUser>;
    update: (args: { where: { id: string }; data: { name?: string; email?: string } }) => Promise<DbUser>;
    delete: (args: { where: { id: string } }) => Promise<DbUser>;
    count: (args?: { where?: unknown }) => Promise<number>;
  };
}

/**
 * Gets typed database client from context
 */
function getDb(ctx: { db: unknown }): DbClient {
  return ctx.db as DbClient;
}

/**
 * Transforms a database user to API response format
 *
 * Handles Date -> string conversion for JSON serialization.
 */
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
  /**
   * Get a single user by ID
   *
   * REST: GET /users/:id
   * tRPC: users.getUser({ id: "..." })
   */
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema.nullable())
    .query(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const user = await db.user.findUnique({ where: { id: input.id } });
      return user ? toUserResponse(user) : null;
    }),

  /**
   * List all users with pagination
   *
   * REST: GET /users?page=1&limit=10
   * tRPC: users.listUsers({ page: 1, limit: 10 })
   */
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

  /**
   * Create a new user
   *
   * REST: POST /users
   * tRPC: users.createUser({ name: "...", email: "..." })
   *
   * Requires: Authenticated user
   */
  createUser: procedure()
    .guard(authenticated)
    .input(CreateUserInput)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const user = await db.user.create({ data: input });
      return toUserResponse(user);
    }),

  /**
   * Search users by name or email
   *
   * Uses custom REST path override since "searchUsers" would map to POST.
   *
   * REST: GET /users/search?q=alice
   * tRPC: users.searchUsers({ q: "alice" })
   *
   * Note: For real Prisma, uses `contains` filter. For mock, filters in memory.
   */
  searchUsers: procedure()
    .rest({ method: 'GET', path: '/users/search' })
    .input(SearchUserInput)
    .output(z.array(UserSchema))
    .query(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const query = input.q.toLowerCase();

      // Use Prisma's contains filter for search
      // Works with both SQLite and PostgreSQL
      const dbUsers = await db.user.findMany({
        where: {
          OR: [{ name: { contains: query } }, { email: { contains: query } }],
        },
      });

      return dbUsers.map(toUserResponse);
    }),

  /**
   * Update an existing user (full update)
   *
   * REST: PUT /users/:id
   * tRPC: users.updateUser({ id: "...", name: "...", email: "..." })
   *
   * Requires: Authenticated user (own profile) or admin
   */
  updateUser: procedure()
    .guard(authenticated)
    .input(z.object({ id: z.string().uuid() }).merge(UpdateUserInput))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const { id, ...data } = input;

      // Defensive check: ensure user is populated by authenticated guard
      if (!ctx.user) {
        throw new AuthError('Authentication required', 401, 'NOT_AUTHENTICATED');
      }

      // Policy: Users can only update their own profile, admins can update anyone
      const isOwner = ctx.user.id === id;
      const isAdmin = Array.isArray(ctx.user.roles) && ctx.user.roles.includes('admin');

      if (!isOwner && !isAdmin) {
        throw new GuardError(
          'ownership',
          'You can only update your own profile unless you are an admin',
          403
        );
      }

      const updated = await db.user.update({ where: { id }, data });
      return toUserResponse(updated);
    }),

  /**
   * Partially update a user
   *
   * REST: PATCH /users/:id
   * tRPC: users.patchUser({ id: "...", name: "..." })
   *
   * Requires: Authenticated user (own profile) or admin
   */
  patchUser: procedure()
    .guard(authenticated)
    .input(z.object({ id: z.string().uuid() }).merge(UpdateUserInput))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const { id, ...data } = input;

      // Defensive check: ensure user is populated by authenticated guard
      if (!ctx.user) {
        throw new AuthError('Authentication required', 401, 'NOT_AUTHENTICATED');
      }

      // Policy: Users can only update their own profile, admins can update anyone
      const isOwner = ctx.user.id === id;
      const isAdmin = Array.isArray(ctx.user.roles) && ctx.user.roles.includes('admin');

      if (!isOwner && !isAdmin) {
        throw new GuardError(
          'ownership',
          'You can only update your own profile unless you are an admin',
          403
        );
      }

      const updated = await db.user.update({ where: { id }, data });
      return toUserResponse(updated);
    }),

  /**
   * Delete a user
   *
   * REST: DELETE /users/:id
   * tRPC: users.deleteUser({ id: "..." })
   *
   * Requires: Admin role
   */
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

/**
 * Export type for client type inference
 *
 * Frontend can import this type to get full autocomplete:
 * ```typescript
 * import type { userProcedures } from '../server/procedures/users';
 * ```
 */
export type UserProcedures = typeof userProcedures;
