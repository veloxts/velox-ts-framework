/**
 * Type tests for @trpc/react-query compatibility
 *
 * These tests verify that the TRPCRouter type transformer correctly converts
 * VeloxTS router types to be compatible with @trpc/react-query's createTRPCReact<T>().
 */

import type { TRPCMutationProcedure, TRPCQueryProcedure } from '@trpc/server';
import { expectType } from 'tsd';
import { z } from 'zod';

// Import from the compiled dist folders directly
import type { BaseContext } from '../../../core/dist/index.js';
import type { TRPCRouter } from '../../dist/index.js';
import { createRouter, defineProcedures, procedure } from '../../dist/index.js';

// ============================================================================
// Setup: Create test procedure collections
// ============================================================================

const userProcedures = defineProcedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string() }))
    .output(z.object({ id: z.string(), name: z.string() }))
    .query(({ input }) => ({ id: input.id, name: 'Test' })),

  listUsers: procedure()
    .output(z.array(z.object({ id: z.string(), name: z.string() })))
    .query(() => []),

  createUser: procedure()
    .input(z.object({ name: z.string(), email: z.string() }))
    .output(z.object({ id: z.string(), name: z.string() }))
    .mutation(({ input }) => ({ id: '1', name: input.name })),
});

const postProcedures = defineProcedures('posts', {
  getPost: procedure()
    .input(z.object({ id: z.string() }))
    .output(z.object({ id: z.string(), title: z.string() }))
    .query(({ input }) => ({ id: input.id, title: 'Test' })),

  deletePost: procedure()
    .input(z.object({ id: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(() => ({ success: true })),
});

// Create router using createRouter
const { router } = createRouter(userProcedures, postProcedures);
type AppRouter = typeof router;

// ============================================================================
// Test: TRPCRouter transforms router type correctly
// ============================================================================

type TransformedRouter = TRPCRouter<AppRouter>;

// Transformed router should have _def property (tRPC requirement)
expectType<{
  _config: { $types: { ctx: BaseContext; meta: unknown } };
  record: Record<string, unknown>;
  procedures: Record<string, unknown>;
}>(null as unknown as TransformedRouter['_def']);

// Transformed router should have createCaller method (tRPC requirement)
expectType<(ctx: unknown) => unknown>(null as unknown as TransformedRouter['createCaller']);

// ============================================================================
// Test: Namespace structure is preserved
// ============================================================================

// Users namespace should exist
type UsersNamespace = TransformedRouter['users'];

// Posts namespace should exist
type PostsNamespace = TransformedRouter['posts'];

// ============================================================================
// Test: Query procedures are mapped correctly
// ============================================================================

// getUser should be a TRPCQueryProcedure with correct input/output types
type GetUserProcedure = UsersNamespace['getUser'];
expectType<
  TRPCQueryProcedure<{ input: { id: string }; output: { id: string; name: string }; meta: unknown }>
>(null as unknown as GetUserProcedure);

// listUsers should be a TRPCQueryProcedure
type ListUsersProcedure = UsersNamespace['listUsers'];
expectType<
  TRPCQueryProcedure<{ input: unknown; output: { id: string; name: string }[]; meta: unknown }>
>(null as unknown as ListUsersProcedure);

// getPost should be a TRPCQueryProcedure
type GetPostProcedure = PostsNamespace['getPost'];
expectType<
  TRPCQueryProcedure<{
    input: { id: string };
    output: { id: string; title: string };
    meta: unknown;
  }>
>(null as unknown as GetPostProcedure);

// ============================================================================
// Test: Mutation procedures are mapped correctly
// ============================================================================

// createUser should be a TRPCMutationProcedure with correct input/output types
type CreateUserProcedure = UsersNamespace['createUser'];
expectType<
  TRPCMutationProcedure<{
    input: { name: string; email: string };
    output: { id: string; name: string };
    meta: unknown;
  }>
>(null as unknown as CreateUserProcedure);

// deletePost should be a TRPCMutationProcedure
type DeletePostProcedure = PostsNamespace['deletePost'];
expectType<
  TRPCMutationProcedure<{ input: { id: string }; output: { success: boolean }; meta: unknown }>
>(null as unknown as DeletePostProcedure);

// ============================================================================
// Test: TRPCRouter returns never for invalid input
// ============================================================================

// Non-router types should result in never
type InvalidRouter1 = TRPCRouter<string>;
expectType<never>(null as unknown as InvalidRouter1);

type InvalidRouter2 = TRPCRouter<{ foo: string }>;
expectType<never>(null as unknown as InvalidRouter2);

// ============================================================================
// Test: Type can be used with createTRPCReact pattern
// ============================================================================

// This simulates what users would do with createTRPCReact<TRPCRouter<AppRouter>>()
// The type should be assignable to tRPC's expected router shape
type TRPCCompatible = TRPCRouter<AppRouter>;

// Access pattern that createTRPCReact uses internally
type UserGetUserInput =
  TRPCCompatible['users']['getUser'] extends TRPCQueryProcedure<infer T> ? T['input'] : never;
expectType<{ id: string }>(null as unknown as UserGetUserInput);

type UserGetUserOutput =
  TRPCCompatible['users']['getUser'] extends TRPCQueryProcedure<infer T> ? T['output'] : never;
expectType<{ id: string; name: string }>(null as unknown as UserGetUserOutput);
