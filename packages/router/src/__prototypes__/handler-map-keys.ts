/**
 * Prototype: Handler Map Key Typing
 *
 * GATE for Phase 2 of simplified procedure builder.
 *
 * Tests whether TypeScript can constrain handler map keys at compile time,
 * using either unique symbols or branded strings as computed property keys.
 *
 * Success criteria:
 * 1. Valid level keys are accepted as computed property keys
 * 2. Invalid/typo keys produce compile errors
 * 3. Handler input type is properly constrained per branch
 * 4. Per-branch context narrowing works via phantom types
 * 5. Partial coverage is allowed (not all levels required)
 * 6. At least one non-public branch is required
 */

// ============================================================================
// Approach 1: Unique Symbol Keys
// ============================================================================

/**
 * Simulates what .build() would produce — each level gets a unique symbol key
 */
declare const ADMIN_KEY: unique symbol;
declare const AUTH_KEY: unique symbol;
declare const PUBLIC_KEY: unique symbol;

type AdminKey = typeof ADMIN_KEY;
type AuthKey = typeof AUTH_KEY;
type PublicKey = typeof PUBLIC_KEY;

interface BaseCtx {
  user?: { id: string; email: string; role?: string };
}

interface AuthenticatedCtx extends BaseCtx {
  user: { id: string; email: string; role?: string };
}

interface AdminCtx extends BaseCtx {
  user: { id: string; email: string; role: 'admin' };
}

/**
 * Simulated schema view produced by .build()
 */
interface SchemaView<TLevel extends string, TKey extends symbol, TNarrows = unknown> {
  readonly _level: TLevel;
  readonly key: TKey;
  readonly _narrows?: TNarrows;
  readonly fields: ReadonlyArray<{ name: string }>;
}

/**
 * Simulated full schema with views
 */
interface TestSchema {
  readonly admin: SchemaView<'admin', AdminKey, AdminCtx>;
  readonly authenticated: SchemaView<'authenticated', AuthKey, AuthenticatedCtx>;
  readonly public: SchemaView<'public', PublicKey, BaseCtx>;
}

// Handler type — context is narrowed per branch
type Handler<TInput, TContext, TOutput = unknown> = (args: {
  readonly input: TInput;
  readonly ctx: TContext;
}) => TOutput | Promise<TOutput>;

// ============================================================================
// HandlerMap type — the core test
// ============================================================================

/**
 * Maps schema view symbol keys to handlers with narrowed context types.
 *
 * This is the critical type: it must:
 * 1. Only accept valid symbol keys from the schema
 * 2. Make all branches optional (partial coverage)
 * 3. Narrow context type per branch based on the level's phantom type
 */
type SymbolHandlerMap<TSchema, TInput> = {
  [K in keyof TSchema as TSchema[K] extends SchemaView<string, infer S extends symbol, unknown>
    ? S
    : never]?: TSchema[K] extends SchemaView<string, symbol, infer TNarrows>
    ? Handler<TInput, TNarrows extends BaseCtx ? TNarrows : BaseCtx>
    : never;
};

type ValidHandlerMap<TSchema, TInput> = SymbolHandlerMap<TSchema, TInput>;

// ============================================================================
// Test harness — function that accepts a handler map
// ============================================================================

declare function defineHandlers<TInput>(
  schema: TestSchema,
  handlers: ValidHandlerMap<TestSchema, TInput>
): void;

// ============================================================================
// Approach 2: Branded String Keys (fallback)
// ============================================================================

type BrandedKey<T extends string> = T & { readonly __levelKey: unique symbol };

declare const adminBrandedKey: BrandedKey<'admin'>;
declare const authBrandedKey: BrandedKey<'authenticated'>;
declare const publicBrandedKey: BrandedKey<'public'>;

interface BrandedSchemaView<TLevel extends string, TNarrows = unknown> {
  readonly _level: TLevel;
  readonly key: BrandedKey<TLevel>;
  readonly _narrows?: TNarrows;
}

interface BrandedTestSchema {
  readonly admin: BrandedSchemaView<'admin', AdminCtx>;
  readonly authenticated: BrandedSchemaView<'authenticated', AuthenticatedCtx>;
  readonly public: BrandedSchemaView<'public', BaseCtx>;
}

/**
 * String-based handler map — uses string literal types as keys
 */
type StringHandlerMap<TSchema, TInput> = {
  [K in keyof TSchema as TSchema[K] extends BrandedSchemaView<infer L, unknown>
    ? L
    : never]?: TSchema[K] extends BrandedSchemaView<string, infer TNarrows>
    ? Handler<TInput, TNarrows extends BaseCtx ? TNarrows : BaseCtx>
    : never;
};

declare function defineHandlersBranded<TInput>(
  schema: BrandedTestSchema,
  handlers: StringHandlerMap<BrandedTestSchema, TInput>
): void;

// ============================================================================
// Exports for type tests
// ============================================================================

export type {
  AdminCtx,
  AdminKey,
  AuthKey,
  AuthenticatedCtx,
  BaseCtx,
  BrandedTestSchema,
  Handler,
  PublicKey,
  StringHandlerMap,
  SymbolHandlerMap,
  TestSchema,
  ValidHandlerMap,
};

export {
  ADMIN_KEY,
  AUTH_KEY,
  PUBLIC_KEY,
  adminBrandedKey,
  authBrandedKey,
  defineHandlers,
  defineHandlersBranded,
  publicBrandedKey,
};
