/**
 * Ergonomics test: verify the actual developer-facing syntax works.
 *
 * This tests the FINAL API shape developers will use:
 * ```
 * .query({
 *   [ArticleSchema.admin.key]: adminHandler,
 *   [ArticleSchema.public.key]: publicHandler,
 * })
 * ```
 */

import { expectTypeOf } from 'expect-type';

// ============================================================================
// Simulated .build() output with .key properties
// ============================================================================

interface BaseCtx {
  user?: { id: string; email: string; role?: string };
}

interface AuthCtx extends BaseCtx {
  user: { id: string; email: string; role?: string };
}

interface AdminCtx extends BaseCtx {
  user: { id: string; email: string; role: 'admin' };
}

interface TaggedView<TLevel extends string, TNarrows = unknown> {
  readonly _level: TLevel;
  readonly key: TLevel;
  readonly _narrows?: TNarrows;
  readonly fields: ReadonlyArray<{ name: string }>;
}

interface ArticleSchemaType {
  readonly admin: TaggedView<'admin', AdminCtx>;
  readonly authenticated: TaggedView<'authenticated', AuthCtx>;
  readonly public: TaggedView<'public', BaseCtx>;
  readonly fields: ReadonlyArray<{ name: string }>;
}

declare const ArticleSchema: ArticleSchemaType;

// Handler type with context narrowing
type Handler<TInput, TCtx> = (args: {
  readonly input: TInput;
  readonly ctx: TCtx;
}) => unknown | Promise<unknown>;

// Handler map keyed by level string literals extracted from schema
type HandlerMap<TSchema, TInput> = {
  [K in keyof TSchema as TSchema[K] extends TaggedView<infer L, unknown>
    ? L
    : never]?: TSchema[K] extends TaggedView<string, infer TNarrows>
    ? Handler<TInput, TNarrows extends BaseCtx ? TNarrows : BaseCtx>
    : never;
};

// Accept function
declare function query<TInput>(
  schema: ArticleSchemaType,
  handlers: HandlerMap<ArticleSchemaType, TInput>
): void;

// ============================================================================
// Test: Developer-facing syntax using [Schema.level.key]
// ============================================================================

// This is the actual syntax developers will write:
{
  type Input = { id: string };

  query(ArticleSchema, {
    [ArticleSchema.admin.key]: async ({ input, ctx }) => {
      expectTypeOf(ctx).toEqualTypeOf<AdminCtx>();
      return { id: input.id, auditLog: 'x' };
    },
    [ArticleSchema.public.key]: async ({ input, ctx }) => {
      expectTypeOf(ctx).toEqualTypeOf<BaseCtx>();
      return { id: input.id };
    },
  });
}

// Test: Partial coverage with .key syntax
{
  query(ArticleSchema, {
    [ArticleSchema.admin.key]: async ({ ctx }) => {
      expectTypeOf(ctx.user.role).toEqualTypeOf<'admin'>();
      return {};
    },
  });
}

// Test: All three levels with .key syntax
{
  query(ArticleSchema, {
    [ArticleSchema.admin.key]: async () => ({}),
    [ArticleSchema.authenticated.key]: async () => ({}),
    [ArticleSchema.public.key]: async () => ({}),
  });
}

// Test: Verify that ArticleSchema.admin.key === 'admin' (string literal)
{
  expectTypeOf(ArticleSchema.admin.key).toEqualTypeOf<'admin'>();
  expectTypeOf(ArticleSchema.authenticated.key).toEqualTypeOf<'authenticated'>();
  expectTypeOf(ArticleSchema.public.key).toEqualTypeOf<'public'>();
}
