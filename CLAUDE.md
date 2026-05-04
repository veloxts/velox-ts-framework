# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VeloxTS Framework** is a TypeScript full-stack web framework (v0.9.x) providing exceptional developer experience and type safety. Built on Fastify, tRPC, Prisma, and Zod. Targets Node.js v20+ with TypeScript v5+.

**Key Defaults (IMPORTANT):**
- **Default API port:** `3030` (not 3210)
- **Default database:** SQLite (via Prisma 7 + better-sqlite3 adapter)
- **How to start a new project:** `npx create-velox-app my-app`
- **Templates:** `--default`, `--auth`, `--trpc`, `--rsc`, `--rsc-auth`

**Documentation:** [veloxts.dev/docs](https://www.veloxts.dev/docs/) (local: `apps/docs/src/content`)

## Commands

**IMPORTANT (macOS):** Do NOT use `timeout` (Linux-only). Run commands directly.

```bash
pnpm build             # Build all packages (Turborepo)
pnpm type-check        # TypeScript checking
pnpm test              # Vitest
pnpm lint              # Biome linting
```

### Smoke Test
```bash
cd packages/create && pnpm smoke-test --auth    # Test auth template
cd packages/create && pnpm smoke-test --default # Test default template
cd packages/create && pnpm smoke-test --trpc    # Test tRPC template
cd packages/create && pnpm smoke-test --rsc     # Test RSC template
cd packages/create && pnpm smoke-test --rsc-auth # Test RSC + auth template
```

**IMPORTANT:** Always use CLI arguments to select templates. Do NOT use environment variables.

### Development
```bash
velox dev              # Start dev server with HMR (default port 3030)
velox dev --no-hmr     # Disable HMR, use legacy tsx watch
velox dev --port 4000  # Custom port
velox dev --all        # Run frontend + backend concurrently
```

All scaffolded templates include HMR config, `velox:ready` IPC signal, and graceful Prisma shutdown by default.

### Publishing

**Always use `pnpm publish`, never `npm publish`** — pnpm converts `workspace:*` to actual versions.

```bash
pnpm build
for pkg in core validation orm router auth client cli; do
  cd packages/$pkg && pnpm publish --registry <url> --no-git-checks && cd ../..
done
cd packages/create && pnpm publish --registry <url> --no-git-checks
```

## Architecture

### Core Philosophy
1. **Type Safety Without Code Generation** — types flow through direct imports, `as const`, `typeof`
2. **Hybrid API** — tRPC for internal, auto-generated REST for external, single procedure definition
3. **Convention Over Configuration** — naming conventions generate routes, sensible defaults

### Package Dependency Layers
1. `@veloxts/core` (foundation)
2. `@veloxts/validation`, `@veloxts/orm` (depend on core)
3. `@veloxts/router` (depends on validation + orm)
4. `@veloxts/auth` (depends on router)
5. `@veloxts/cli` (depends on all), `@veloxts/client` (standalone)

Ecosystem packages (cache, queue, mail, storage, scheduler, events) are implemented but APIs may change before v1.0.

### Procedure Definition API

```typescript
export const userProcedures = procedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUniqueOrThrow({ where: { id: input.id } });
    }),

  createUser: procedure()
    .input(CreateUserSchema)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    })
});
```

### REST Naming Conventions

- `get*` → `GET /:id` | `list*` / `find*` → `GET /`
- `create*` / `add*` → `POST /` (201) | `update*` / `edit*` → `PUT /:id`
- `patch*` → `PATCH /:id` | `delete*` / `remove*` → `DELETE /:id`

Manual overrides via `.rest()` method.

### Resource API (Field-Level Visibility)

`.output()` accepts both Zod schemas and tagged resource views:

```typescript
const UserSchema = resourceSchema()
  .public('id', z.string().uuid())
  .public('name', z.string())
  .authenticated('email', z.string().email())
  .admin('internalNotes', z.string().nullable())
  .build();

export const userProcedures = procedures('users', {
  getPublicProfile: procedure()
    .output(UserSchema.public)          // → { id, name }
    .query(async ({ input, ctx }) => {
      return resource(user, UserSchema.public);
    }),

  getProfile: procedure()
    .guard(authenticated)
    .output(UserSchema.authenticated)   // → { id, name, email }
    .query(async ({ input, ctx }) => {
      return resource(user, UserSchema.authenticated);
    }),
});
```

**`.output()` accepts:**
- `.output(zodSchema)` — Same fields for all users
- `.output(UserSchema.authenticated)` — Tagged resource view (auto-projects by access level)

### Authentication (`@veloxts/auth`)

**JWT:** `jwtManager({ secret, refreshSecret, accessTokenExpiry, refreshTokenExpiry })`
**Sessions:** `sessionMiddleware({ secret, store, cookie, expiration, userLoader })`

Guards: `authenticated`, `hasRole('admin')` — use with `.guard()` on procedures.

### Context Object

Extended via declaration merging:
```typescript
declare module '@veloxts/core' {
  interface BaseContext {
    db: PrismaClient;    // from @veloxts/orm
    user?: User;         // from @veloxts/auth
  }
}
```

## Prisma 7 Configuration (IMPORTANT)

Breaking changes from Prisma 5/6:

- **`prisma.config.ts` required** — database URL goes here, NOT in `schema.prisma`
- **`output` required** in generator: `output = "../node_modules/.prisma/client"`
- **Driver adapters required** — `datasourceUrl`/`datasources` removed from PrismaClient

```typescript
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });
```

**Vite SSR:** Must explicitly load dotenv (Vite doesn't auto-load `.env` in SSR).

| Error | Solution |
|-------|----------|
| `Unknown property datasourceUrl/datasources` | Use driver adapter |
| `needs non-empty valid PrismaClientOptions` | Add driver adapter |
| `Generating into @prisma/client not allowed` | Use `.prisma/client` output |

## Coding Standards

### Code Style
- `as const` for literal types, `typeof` for runtime-derived types
- Declaration merging for extensibility
- Laravel-inspired naming (procedures, guards, policies)
- **Always use fixed dependency versions** (no `^` or `~`)

### TypeScript Type Safety — STRICT CONSTRAINTS

**NEVER use:**
- `any` or `as any` — use `unknown` with type guards, generic constraints, or `as unknown as TargetType` (tests only)
- `@ts-expect-error` or `@ts-ignore` — fix the underlying type issue

**All code must pass `pnpm type-check` and `pnpm lint` with zero errors/warnings.**

### Git Workflow

**Never push directly to main.** Use feature branches + PRs.

- Branch names: `feat/<name>`, `fix/<name>`, `chore/<name>`, `test/<name>`
- Commits: `type(scope): description` (e.g., `feat(router): add Level 3 branching`)
- Merge: `gh pr merge --squash --delete-branch`

### RSC Server/Client Separation (CRITICAL for @veloxts/web)

Strict module boundaries prevent Node.js code from bleeding into client bundles:

1. **Type-only imports** in server action files: `import type { X } from '...'`
2. **Dynamic imports** for database/heavy deps: `const { db } = await import('@/api/database')`
3. **Procedure bridge pattern**: lazy-load procedures in server actions

`@veloxts/web` has browser stubs (`NODE_BUILTIN_STUBS`) as a temporary workaround. Prefer fixing import chains over adding stubs. Test with `pnpm smoke-test --rsc-auth`.

### Reference Documents
- `/.plans/0.requirements.md` — Full specification
- `/.plans/ARCHITECTURE.md` — Technical architecture
- `/.plans/PACKAGES-SPEC.md` — Package specifications
