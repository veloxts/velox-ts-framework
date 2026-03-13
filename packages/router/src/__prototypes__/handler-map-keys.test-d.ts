/**
 * Type-level tests for handler map key constraints.
 *
 * These tests validate that TypeScript can constrain handler map keys
 * at compile time using both symbol keys and branded string keys.
 *
 * Run with: cd packages/router && pnpm type-check
 */

import { expectTypeOf } from 'expect-type';

import type {
  AdminCtx,
  AdminKey,
  AuthenticatedCtx,
  AuthKey,
  BaseCtx,
  BrandedTestSchema,
  PublicKey,
  StringHandlerMap,
  SymbolHandlerMap,
  TestSchema,
  ValidHandlerMap,
} from './handler-map-keys.js';
import {
  ADMIN_KEY,
  AUTH_KEY,
  adminBrandedKey,
  authBrandedKey,
  defineHandlers,
  defineHandlersBranded,
  PUBLIC_KEY,
  publicBrandedKey,
} from './handler-map-keys.js';

// ============================================================================
// Approach 1: Symbol Keys
// ============================================================================

// Test 1: Valid handler map with all keys compiles
{
  const schema = {} as TestSchema;
  type Input = { id: string };

  defineHandlers(schema, {
    [ADMIN_KEY]: async ({ input, ctx }) => {
      expectTypeOf(input).toEqualTypeOf<Input>();
      expectTypeOf(ctx).toEqualTypeOf<AdminCtx>();
      return { id: input.id, secret: 'x' };
    },
    [AUTH_KEY]: async ({ input, ctx }) => {
      expectTypeOf(input).toEqualTypeOf<Input>();
      expectTypeOf(ctx).toEqualTypeOf<AuthenticatedCtx>();
      return { id: input.id, email: ctx.user.email };
    },
    [PUBLIC_KEY]: async ({ input, ctx }) => {
      expectTypeOf(input).toEqualTypeOf<Input>();
      expectTypeOf(ctx).toEqualTypeOf<BaseCtx>();
      return { id: input.id };
    },
  });
}

// Test 2: Partial coverage — not all levels required
{
  const schema = {} as TestSchema;
  type Input = { id: string };

  // Only admin and public — editor falls through to public
  defineHandlers(schema, {
    [ADMIN_KEY]: async ({ input }) => ({ id: input.id, secret: 'x' }),
    [PUBLIC_KEY]: async ({ input }) => ({ id: input.id }),
  });
}

// Test 3: Single branch is allowed
{
  const schema = {} as TestSchema;
  type Input = { id: string };

  defineHandlers(schema, {
    [ADMIN_KEY]: async ({ input }) => ({ id: input.id }),
  });
}

// Test 4: Context narrowing — admin branch knows user has admin role
{
  const schema = {} as TestSchema;
  type Input = { id: string };

  defineHandlers(schema, {
    [ADMIN_KEY]: async ({ ctx }) => {
      // ctx.user is narrowed to AdminCtx — user is required and has role: 'admin'
      expectTypeOf(ctx.user).toEqualTypeOf<{ id: string; email: string; role: 'admin' }>();
      return {};
    },
    [AUTH_KEY]: async ({ ctx }) => {
      // ctx.user is narrowed to AuthenticatedCtx — user is required
      expectTypeOf(ctx.user).toEqualTypeOf<{ id: string; email: string; role?: string }>();
      return {};
    },
    [PUBLIC_KEY]: async ({ ctx }) => {
      // ctx.user is optional in public context
      expectTypeOf(ctx.user).toEqualTypeOf<
        { id: string; email: string; role?: string } | undefined
      >();
      return {};
    },
  });
}

// Test 5: HandlerMap type resolves correctly
{
  type Map = SymbolHandlerMap<TestSchema, { id: string }>;

  // Each key should be optional
  type AdminHandler = Map[AdminKey];
  type AuthHandler = Map[AuthKey];
  type PublicHandler = Map[PublicKey];

  expectTypeOf<AdminHandler>().not.toBeNever();
  expectTypeOf<AuthHandler>().not.toBeNever();
  expectTypeOf<PublicHandler>().not.toBeNever();
}

// ============================================================================
// Approach 2: Branded String Keys
// ============================================================================

// Test 6: Branded string keys work as computed property keys
{
  const schema = {} as BrandedTestSchema;
  type Input = { id: string };

  defineHandlersBranded(schema, {
    admin: async ({ input, ctx }) => {
      expectTypeOf(ctx).toEqualTypeOf<AdminCtx>();
      return { id: input.id };
    },
    authenticated: async ({ input, ctx }) => {
      expectTypeOf(ctx).toEqualTypeOf<AuthenticatedCtx>();
      return { id: input.id };
    },
    public: async ({ input, ctx }) => {
      expectTypeOf(ctx).toEqualTypeOf<BaseCtx>();
      return { id: input.id };
    },
  });
}

// Test 7: Branded string partial coverage
{
  const schema = {} as BrandedTestSchema;
  type Input = { id: string };

  defineHandlersBranded(schema, {
    admin: async ({ input }) => ({ id: input.id }),
    public: async ({ input }) => ({ id: input.id }),
  });
}

// Test 8: Branded string context narrowing
{
  const schema = {} as BrandedTestSchema;

  defineHandlersBranded(schema, {
    admin: async ({ ctx }) => {
      expectTypeOf(ctx.user).toEqualTypeOf<{ id: string; email: string; role: 'admin' }>();
      return {};
    },
    authenticated: async ({ ctx }) => {
      expectTypeOf(ctx.user).toEqualTypeOf<{ id: string; email: string; role?: string }>();
      return {};
    },
  });
}

// Test 9: StringHandlerMap type is well-formed
{
  type Map = StringHandlerMap<BrandedTestSchema, { id: string }>;

  // Keys should be the string level names
  type AdminHandler = Map['admin'];
  type AuthHandler = Map['authenticated'];
  type PublicHandler = Map['public'];

  expectTypeOf<AdminHandler>().not.toBeNever();
  expectTypeOf<AuthHandler>().not.toBeNever();
  expectTypeOf<PublicHandler>().not.toBeNever();
}
