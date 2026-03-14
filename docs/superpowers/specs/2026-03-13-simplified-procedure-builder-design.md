# Simplified Procedure Builder API

**Date:** 2026-03-13
**Status:** Draft
**Scope:** `@veloxts/router`, `@veloxts/auth`
**Breaking:** Yes (pre-v1.0)

## Problem

The current procedure builder exposes too many concepts for developers to learn before they can define endpoints with role-based output:

- **Two guard types**: `guard()` vs `guardNarrow()` — the distinction exists solely to serve the Resource API but leaks complexity to everyone.
- **Three output methods**: `.output()`, `.expose()`, `.resource()` (deprecated) — three ways to say "what this endpoint returns."
- **Three projection strategies**: tagged schema views, auto-projection via guard, manual `resource()` helper in handlers.
- **Silent footgun**: `.guard(authenticated)` + `.expose(UserSchema)` (untagged) silently defaults to `public` projection, contradicting developer intent.

A framework inspired by Laravel's "elegant simplicity" should not require developers to learn a second vocabulary when graduating from static output to role-based field visibility.

## Design Principle

**One method per concern. Progressive complexity through what you pass, not which methods you learn.**

The developer's learning curve:

1. `.output(ZodSchema)` — I know exactly what I return
2. `.output(ResourceSchema.authenticated)` — I return a fixed projection of a resource schema
3. `.query({ [level]: handler })` — I run different logic per access level

Each step adds one concept. No new methods, no vocabulary switches.

## The Three Levels

### Level 1 — Static Output (the 80% case)

Same fields for every caller. Simple allow/deny gate.

```typescript
getUser: procedure()
  .input(z.object({ id: z.string().uuid() }))
  .guard(authenticated)
  .output(UserZodSchema)
  .query(async ({ input, ctx }) => {
    return ctx.db.user.findUnique({ where: { id: input.id } });
  })
```

- `.guard()` = gate (pass or 401)
- `.output()` = Zod schema, validated after handler
- `.query()` = single handler function

This is unchanged from today's API.

### Level 2 — Fixed Projection (tagged resource view)

One access level's view of a resource schema, applied to all callers who pass the gate.

```typescript
getProfile: procedure()
  .input(z.object({ id: z.string().uuid() }))
  .guard(authenticated)
  .output(UserSchema.authenticated)
  .query(async ({ input, ctx }) => {
    return ctx.db.user.findUnique({ where: { id: input.id } });
  })
```

- `.guard()` = still a simple gate
- `.output()` = tagged resource view (e.g., `UserSchema.authenticated`), auto-projects the handler's return value to that level's visible fields
- `.query()` = single handler function

The developer changes **what they pass** to `.output()`, not which method they call. The handler returns the full object; the framework strips fields not visible at the tagged level.

### Level 3 — Branched Handlers (per access level)

Different callers get different queries, different data, different field visibility — all from one procedure.

```typescript
getArticle: procedure()
  .input(z.object({ id: z.string().uuid() }))
  .output(ArticleSchema)
  .query({
    [ArticleSchema.admin]: async ({ input, ctx }) => {
      return ctx.db.article.findUnique({
        where: { id: input.id },
        include: { auditLog: true, author: true },
      });
    },
    [ArticleSchema.editor]: async ({ input, ctx }) => {
      return ctx.db.article.findUnique({
        where: { id: input.id },
        include: { author: true },
      });
    },
    [ArticleSchema.public]: async ({ input, ctx }) => {
      return ctx.db.article.findUnique({
        where: { id: input.id },
        select: { id: true, title: true },
      });
    },
  })
```

- **No `.guard()` on the procedure** — guards are embedded in the access level definitions (enforced at compile time)
- `.output()` = untagged resource schema (the full schema, not a tagged view)
- `.query()` = handler map keyed by schema access levels
- Runtime: walks hierarchy from most privileged to least (reverse of array order), evaluates each level's guard, executes the highest matching branch
- Each branch's return value is auto-projected through its level's field visibility

**Context narrowing in branches**: each branch's handler receives a context where `ctx.user` is narrowed based on the guard that passed. For example, the `admin` branch knows `ctx.user` exists and has admin privileges. This replaces the role `guardNarrow()` played — the narrowing happens implicitly per branch rather than on the builder chain.

**Same pattern for mutations:**

```typescript
updateArticle: procedure()
  .input(UpdateArticleSchema)
  .output(ArticleSchema)
  .mutation({
    [ArticleSchema.admin]: async ({ input, ctx }) => {
      // Can update any field including audit metadata
      return ctx.db.article.update({ where: { id: input.id }, data: input });
    },
    [ArticleSchema.editor]: async ({ input, ctx }) => {
      // Can only update content fields
      const { title, body } = input;
      return ctx.db.article.update({ where: { id: input.id }, data: { title, body } });
    },
  })
```

### Why Branched Handlers Instead of Post-Projection

Projection is not cosmetic field filtering. Different access levels often require fundamentally different queries:

- **Public**: `SELECT id, title FROM articles` — lightweight, no joins
- **Editor**: `SELECT id, title, body FROM articles JOIN authors ON ...` — adds relations
- **Admin**: `SELECT * FROM articles JOIN authors JOIN audit_logs ON ...` — full graph with sensitive relations

If every branch ran the same query and only differed in which fields are stripped, we'd waste database resources fetching data the caller will never see. Branched handlers let each access level optimize its own data-fetching strategy.

## Type-Level Enforcement

The builder's generic type parameters enforce mutual exclusivity between the guard path and the branching path at compile time.

### Builder Type Signature Sketch

```typescript
// Simplified — shows the generic flow, not the full implementation

type OutputMode = 'zod' | 'tagged' | 'resource';

interface ProcedureBuilder<TInput, TOutput, TContext, TGuarded extends boolean, TOutputMode extends OutputMode> {
  input<T>(schema: ZodSchema<T>): ProcedureBuilder<T, TOutput, TContext, TGuarded, TOutputMode>;

  // .guard() sets TGuarded to true
  guard(guard: GuardDef): ProcedureBuilder<TInput, TOutput, TContext, true, TOutputMode>;

  // .output() overloads:
  // Zod schema → TOutputMode = 'zod'
  output<T>(schema: ZodSchema<T>): ProcedureBuilder<TInput, T, TContext, TGuarded, 'zod'>;
  // Tagged resource view → TOutputMode = 'tagged'
  output<TSchema>(schema: TaggedResourceView<TSchema>): ProcedureBuilder<TInput, TSchema, TContext, TGuarded, 'tagged'>;
  // Untagged resource schema → TOutputMode = 'resource' (requires TGuarded = false)
  output<TSchema>(schema: ResourceSchema<TSchema>): TGuarded extends true
    ? never  // compile error: can't use untagged resource schema with .guard()
    : ProcedureBuilder<TInput, TSchema, TContext, false, 'resource'>;

  // .query() overloads based on TOutputMode:
  // 'zod' or 'tagged' → single handler
  query(handler: Handler<TInput, TOutput, TContext>): TOutputMode extends 'resource' ? never : CompiledProcedure;
  // 'resource' → handler map (only when TGuarded is false)
  query(handlers: HandlerMap<TInput, TContext, TSchema>): TOutputMode extends 'resource' ? CompiledProcedure : never;

  // .mutation() mirrors .query()
  mutation(handler: Handler<TInput, TOutput, TContext>): TOutputMode extends 'resource' ? never : CompiledProcedure;
  mutation(handlers: HandlerMap<TInput, TContext, TSchema>): TOutputMode extends 'resource' ? CompiledProcedure : never;
}
```

This is a sketch — the actual implementation will need careful generic plumbing, especially for `HandlerMap` which maps schema level symbols to handlers with level-specific context types.

```typescript
// Level 1: .guard() + Zod schema + single handler ✅
procedure().guard(authenticated).output(UserZodSchema).query(handler)

// Level 2: .guard() + tagged view + single handler ✅
procedure().guard(authenticated).output(UserSchema.authenticated).query(handler)

// Level 3: no guard + untagged resource schema + handler map ✅
procedure().output(ArticleSchema).query({
  [ArticleSchema.admin]: adminHandler,
  [ArticleSchema.public]: publicHandler,
})

// ❌ Compile error: .guard() + handler map
procedure().guard(authenticated).output(ArticleSchema).query({
  [ArticleSchema.admin]: adminHandler,
})

// ❌ Compile error: no guard + untagged resource schema + single handler
procedure().output(ArticleSchema).query(singleHandler)
```

### Rules

| `.guard()` present? | `.output()` receives | `.query()` / `.mutation()` accepts |
|---------------------|---------------------|-----------------------------------|
| Yes | Zod schema | Single handler |
| Yes | Tagged resource view | Single handler |
| No | Untagged resource schema | Handler map (required) |
| No | Zod schema | Single handler (no auth) |

### tRPC Return Types

- **Level 1 & 2**: concrete return type, inferred from the handler and/or output schema. Unchanged from today.
- **Level 3**: the tRPC client sees the **most permissive branch's output type** (the admin/highest-level branch). At runtime, the server returns the matched branch's projected data, which is always a subset of the most permissive type. Fields not present at the caller's level are simply absent from the response — the client receives fewer fields than the type allows, but never fields the type doesn't describe. This is the same trade-off as optional fields: the type is wider than any single response, but each response is valid against it.

  ```typescript
  // tRPC client type for a Level 3 procedure:
  // If admin branch returns { id, title, reviewNotes, draft, auditLog }
  // The client type is: { id: string; title: string; reviewNotes?: string; draft?: string; auditLog?: string }
  // Fields beyond public are optional — present only if the caller's level includes them
  ```

  **Alternative for strict typing**: developers who want exact types per role should use separate procedures (`getArticle` for public, `getArticleAdmin` for admin). Level 3 branching optimizes for single-endpoint convenience, not maximal compile-time precision on the client.

## Access Level Definitions

Guards for branched procedures are defined alongside the access level hierarchy in `defineAccessLevels()`. This collocates three related concerns: hierarchy order, field visibility tiers, and authorization logic.

**Breaking change from current API**: the current `defineAccessLevels()` takes `groups` as a direct second positional argument. This spec changes the signature to accept an options object `{ guards, groups }` as the second argument, combining both guard functions and group definitions. The current `resourceSchema()` also changes: it already accepts access level configs, but those configs now carry guard functions, coupling field visibility with authorization. This coupling is intentional — it ensures guard logic and field visibility cannot drift apart.

### Built-in Default

`@veloxts/router` ships with a built-in `defaultAccess` covering the three most common levels, so most apps don't need to call `defineAccessLevels()` themselves:

```typescript
import { defaultAccess } from '@veloxts/router';
// Equivalent to:
// defineAccessLevels(['public', 'authenticated', 'admin'], {
//   guards: {
//     authenticated: (ctx) => !!ctx.user,
//     admin: (ctx) => ctx.user?.role === 'admin',
//   },
// })

// Use directly with resourceSchema:
const UserSchema = resourceSchema(defaultAccess)
  .public('id', z.string())
  .authenticated('email', z.string())
  .admin('internalNotes', z.string())
  .build();
```

For custom guard logic with the standard three levels:

```typescript
import { defineAccessLevels } from '@veloxts/router';

const access = defineAccessLevels(['public', 'authenticated', 'admin'], {
  guards: {
    authenticated: (ctx) => !!ctx.user,
    admin: (ctx) => ctx.user?.role === 'admin',
    // public: implicit — no guard, always matches as fallback
  },
});
```

### Custom Levels

For content platforms, SaaS with tiered roles, etc.:

```typescript
const access = defineAccessLevels(
  ['public', 'reviewer', 'editor', 'admin'],
  {
    guards: {
      reviewer: (ctx) => ctx.user?.roles.includes('reviewer'),
      editor: (ctx) => ctx.user?.roles.includes('editor'),
      admin: (ctx) => ctx.user?.role === 'admin',
    },
    groups: {
      staff: ['editor', 'admin'],
      content: ['reviewer', 'editor', 'admin'],
    },
  }
);
```

### Guard Function Contract

Each guard is a pure function: `(ctx: BaseContext) => boolean | Promise<boolean>`

- Returns `true` if the caller qualifies for that access level
- Returns `false` otherwise
- Async guards are supported for cases requiring database lookups (e.g., resource ownership checks)
- The `public` level never has a guard — it is the implicit fallback
- If a guard throws, the error propagates as a 500 (guards should return `false` for access denial, not throw)
- Guards are evaluated from **most privileged to least privileged** (reverse of the array order in `defineAccessLevels()`). Given `['public', 'reviewer', 'editor', 'admin']`, evaluation order is: `admin` → `editor` → `reviewer` → `public`. First `true` wins.

This makes guards trivially unit-testable:

```typescript
describe('access level guards', () => {
  it('grants editor to users with editor role', () => {
    const ctx = { user: { roles: ['editor'] } } as BaseContext;
    expect(access.guards.editor(ctx)).toBe(true);
  });

  it('denies editor to regular users', () => {
    const ctx = { user: { roles: [] } } as BaseContext;
    expect(access.guards.editor(ctx)).toBe(false);
  });
});
```

### Resource Schema Integration

Resource schemas consume access levels to define field visibility tiers:

```typescript
const ArticleSchema = resourceSchema(access)
  .public('id', z.string().uuid())
  .public('title', z.string())
  .reviewer('reviewNotes', z.string())
  .editor('draft', z.string())
  .admin('auditLog', z.string())
  .build();

// ArticleSchema.admin    → { id, title, reviewNotes, draft, auditLog }
// ArticleSchema.editor   → { id, title, reviewNotes, draft }
// ArticleSchema.reviewer → { id, title, reviewNotes }
// ArticleSchema.public   → { id, title }
// ArticleSchema.staff    → group, resolves to editor ∪ admin fields
```

### Handler Map Key Mechanism

Each access level on a built resource schema exposes a unique `Symbol` alongside its tagged Zod schema. These symbols serve as computed property keys in handler maps:

```typescript
// After .build(), each level has both a tagged schema and a symbol key:
// ArticleSchema.admin        → TaggedResourceSchema (for .output())
// ArticleSchema.admin.key    → Symbol('admin')      (for handler map keys)
// ArticleSchema.editor.key   → Symbol('editor')
// ArticleSchema.public.key   → Symbol('public')

// Shorthand: ArticleSchema.keys.admin === ArticleSchema.admin.key

.query({
  [ArticleSchema.admin.key]: adminHandler,
  [ArticleSchema.editor.key]: editorHandler,
  [ArticleSchema.public.key]: publicHandler,
})
```

**Syntactic sugar**: to avoid the `.key` suffix in handler maps, `resourceSchema().build()` also returns a `keys` proxy. The examples throughout this spec use the shorthand `[ArticleSchema.admin]` — this requires `ArticleSchema.admin` to be overloaded: when used as a value in `.output()`, it's the tagged schema; when used as a computed property key, it resolves to the symbol via `[Symbol.toPrimitive]`. If this overloading proves too magical, the explicit `.key` form is the fallback.

**Implementation options** (decide during implementation):

1. **`Symbol.toPrimitive` overload**: `ArticleSchema.admin` returns a symbol when used in `[...]` bracket context — cleanest DX but relies on JavaScript coercion
2. **Explicit `.key` property**: `[ArticleSchema.admin.key]` — no magic, slightly more verbose
3. **String keys with branded types**: `[ArticleSchema.keys.admin]` where keys are branded strings — compatible with JSON serialization

TypeScript enforces that only levels defined on the schema can be used as keys. A typo like `[ArticleSchema.moderator]` produces a compile error regardless of which implementation option is chosen.

## Runtime Execution (Level 3)

When a Level 3 procedure is called:

1. **Input validation** — validate input against `.input()` schema
2. **Branch selection** — iterate access levels from most privileged to least:
   - Evaluate each level's guard function against the request context
   - First guard that returns `true` selects that branch
   - If no guard matches, fall through to `public` (if a public branch exists)
   - If no branch matches at all, return 403
3. **Middleware** — run `.use()` middleware chain (if any)
4. **Handler execution** — execute the selected branch's handler
5. **Auto-projection** — project the handler's return value through the matched level's field visibility
6. **Output validation** — validate projected result (development mode)

### Partial Branch Coverage

Not every procedure needs a handler for every level. Omitted levels fall through to the next lower level:

```typescript
.query({
  [ArticleSchema.admin]: adminHandler,
  // editor not defined — falls through to public
  [ArticleSchema.public]: publicHandler,
})
```

An editor-level caller matches the `editor` guard but finds no `editor` branch, so the system falls to `public`. The return value is projected through `public` visibility.

Partial coverage and fallthrough semantics apply identically to `.mutation()` handler maps.

## REST Route Generation

- **Level 1 & 2**: unchanged — `getUser` → `GET /api/users/:id`
- **Level 3**: still one endpoint — branching is an internal implementation detail. `getArticle` → `GET /api/articles/:id` regardless of how many branches exist.

### Opt-In Separate Routes

If a developer wants distinct URLs per access level, they can use `.rest()` overrides per branch:

```typescript
getArticle: procedure()
  .input(z.object({ id: z.string().uuid() }))
  .output(ArticleSchema)
  .query({
    [ArticleSchema.admin]: {
      handler: adminHandler,
      rest: { path: '/admin/articles/:id' },
    },
    [ArticleSchema.public]: {
      handler: publicHandler,
    },
  })
```

This is opt-in. By default, all branches share one route.

## OpenAPI / Swagger Integration

For Level 3 procedures, the OpenAPI spec documents:

- **One endpoint** (unless `.rest()` overrides create separate routes)
- **Response schema**: the **most permissive level's schema** (e.g., admin), with fields beyond public marked as `description: "Requires [level] access"`. This gives API consumers the complete picture of what the endpoint can return. Fields are not marked as `required` unless they appear at the `public` level.
- **Security**: a `description` note on the operation indicating that response fields vary by authentication level

Implementation detail: the `generateOpenApiSpec()` function will detect Level 3 procedures and annotate field descriptions with their minimum required access level.

## Migration Path

### What Gets Removed

| Removed | Replaced By |
|---------|-------------|
| `guardNarrow()` | `.guard()` for gates (Level 1-2); schema-embedded guards for branching (Level 3) |
| `.expose()` | `.output()` — now accepts Zod schemas, tagged resource views, and untagged resource schemas |
| `.resource()` | Already deprecated, now deleted |
| `resource()` / `resourceCollection()` in handlers | Auto-projection from `.output()` handles this. These functions are **kept in the API** as utilities for advanced manual projection, but are no longer required for standard use. |
| `authenticatedNarrow` / `adminNarrow` | `defineAccessLevels()` with `guards` option |
| Two guard types (regular vs narrowing) | One `.guard()` for gates; `defineAccessLevels` for branching |

### What Stays Unchanged

| Kept | Notes |
|------|-------|
| `procedure()` factory | Unchanged |
| `.input()` | Unchanged |
| `.guard()` | Unchanged — simple allow/deny gate for Level 1-2 |
| `.output()` | Expanded — now accepts resource schemas and tagged views |
| `.use()` | Unchanged — middleware chain |
| `.rest()` | Unchanged — route overrides |
| `.query()` / `.mutation()` | Expanded — now accepts handler maps for Level 3 |
| `procedures()` / `defineProcedures()` | Unchanged — procedure grouping |
| `resourceSchema()` + `.build()` | Unchanged — field visibility tiers |
| `defineAccessLevels()` | Expanded — now carries guard functions |

### Migration Steps

1. **Replace `.expose(Schema.level)` with `.output(Schema.level)`** — mechanical rename
2. **Replace `.expose(Schema)` + `.guardNarrow()` with Level 3 branching** — restructure handler into handler map, move guard logic to `defineAccessLevels()`
3. **Replace `guardNarrow(authenticatedNarrow)` with `.guard(authenticated)`** for Level 1-2 cases where context narrowing was the only goal
4. **Delete `resource()` / `resourceCollection()` calls in handlers** where `.output()` auto-projection now handles projection
5. **Move guard functions from `authenticatedNarrow` / `adminNarrow` to `defineAccessLevels()` config**

### Codemod Potential

Steps 1 and 3 are mechanical and could be automated with a codemod. Steps 2 and 4 require judgment about query optimization per branch.

## Impact on Other Packages

| Package | Impact |
|---------|--------|
| `@veloxts/router` | Primary changes — builder, executor, types, resource integration |
| `@veloxts/auth` | Remove `guards-narrowing.ts`; update guard exports |
| `@veloxts/client` | May need updated type inference for Level 3 return types |
| `@veloxts/cli` | Update `velox make procedure` code generation |
| `@veloxts/web` | Update server action bridges if they reference `.expose()` |
| `@veloxts/mcp` | Update if procedure introspection references `.expose()` |
| `create-velox-app` | Update all templates (default, auth, trpc, rsc, rsc-auth) |
| Documentation | Full rewrite of procedures and resource API pages |

## Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Breaking changes acceptable | Yes | Pre-v1.0, this is the time to get it right |
| Branch selection strategy | Most specific wins (top-down) | Developers shouldn't worry about branch ordering |
| Guard location for Level 3 | Embedded in `defineAccessLevels()` | Collocates hierarchy, visibility, and auth; testable pure functions |
| tRPC return type for Level 3 | Concrete type of highest matching branch | No union types; tRPC's value is static inference |
| REST routes for Level 3 | One endpoint by default, opt-in separate | Keeps API surface clean; developers can override with `.rest()` |
| `.guard()` + handler map | Compile error | Prevents ambiguity; forces developer to choose gate or branching |
| Mutations support branching | Yes | Different roles may have different mutation logic and permissions |
| Partial branch coverage | Fall through to next lower level | Not every level needs its own handler |

### Groups in Handler Maps

Access level groups (e.g., `staff: ['editor', 'admin']`) are **not valid as handler map keys**. Groups are for field visibility aggregation in `resourceSchema()` — they define which fields a group can see. In handler maps, branches are keyed by individual levels only. If `editor` and `admin` should run the same handler, assign the same function:

```typescript
const sharedStaffHandler = async ({ input, ctx }) => { /* ... */ };

.query({
  [ArticleSchema.admin.key]: sharedStaffHandler,
  [ArticleSchema.editor.key]: sharedStaffHandler,
  [ArticleSchema.public.key]: publicHandler,
})
```

## Resolved Design Questions

1. **`.deprecated()` method**: Applies per-procedure, not per-branch. The endpoint is deprecated as a whole.

2. **Middleware (`.use()`) in Level 3**: Middleware runs **once, before branch selection**. Middleware concerns (logging, rate limiting, CORS) are independent of which branch will execute. If branch-specific middleware is needed, call it inside the handler.

3. **`.rest()` per-branch syntax**: Uses `{ handler, rest }` objects in the handler map. This introduces a second shape for handler map values, but keeps the API surface minimal. No new method needed.

4. **Default access levels**: `@veloxts/router` ships `defaultAccess` with `['public', 'authenticated', 'admin']` and standard guards. Most apps use this directly; custom levels are opt-in.

5. **Error responses per branch**: If no branch matches and no `public` fallback exists, the procedure returns a `403 Forbidden` with a standard error body. Custom error handling can be added via `.use()` middleware or a global error handler. Not configurable per-procedure in v1.0.

## Open Questions

1. **Handler map key syntax**: The spec proposes three options (`Symbol.toPrimitive`, explicit `.key`, or branded strings). The final choice should be validated with a TypeScript prototype to confirm ergonomics and type inference work correctly.

2. **Context narrowing precision**: How precisely should branch handler context types be narrowed? The guard function `(ctx) => ctx.user?.role === 'admin'` returns `boolean`, which doesn't carry enough type information to narrow `ctx.user.role` to `'admin'`. Options: accept loose narrowing (just guarantee `ctx.user` exists), or require guards to return type predicates.

3. **Performance of async guard evaluation**: Level 3 evaluates guards top-down. If all guards are async, this means sequential `await` calls. Should guards be evaluated in parallel with the first-matching result used? This changes semantics if guards have side effects (they shouldn't, but worth documenting).
