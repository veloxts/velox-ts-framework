# CLAUDE.md

This file provides guidance to Claude Code and other AI assistants.

Full documentation: **[veloxts.dev/docs](https://www.veloxts.dev/docs/)**

## Skills

- `/veloxts` — VeloxTS-specific help (code generation, tRPC patterns, validation, troubleshooting)
- `/feature-dev` — Guided feature development with codebase analysis

## Project Overview

**__PROJECT_NAME__** is a VeloxTS application using **tRPC-only** architecture:
- **Backend**: Fastify + VeloxTS + tRPC (`apps/api`)
- **Frontend**: React + Vite + TanStack Router (`apps/web`)
- **Database**: Prisma 7 with __DATABASE_DISPLAY__

No REST adapter — tRPC handles all frontend-backend communication via `POST /trpc/{namespace.procedure}`.

## Commands

```bash
__RUN_CMD__ dev          # Start API (__API_PORT__) + Web (__WEB_PORT__)
__RUN_CMD__ build        # Build both apps
__RUN_CMD__ db:push      # Push database schema
__RUN_CMD__ db:generate  # Regenerate Prisma client
__RUN_CMD__ db:studio    # Open Prisma Studio
```

### Code Generation

```bash
__RUN_CMD__ velox make procedure Posts          # tRPC procedure
__RUN_CMD__ velox make schema Post              # Zod schema
__RUN_CMD__ velox make resource Post --dry-run  # Preview without writing
```

## Architecture

```
apps/
├── api/               # Backend (VeloxTS + Fastify + tRPC)
│   ├── src/
│   │   ├── procedures/  # tRPC procedures
│   │   ├── schemas/     # Zod schemas
│   │   └── router.ts    # tRPC router setup
│   └── prisma/
└── web/               # Frontend (React + Vite)
    └── src/
        ├── routes/      # TanStack Router pages
        └── api.ts       # tRPC client
```

### Creating a Procedure

```typescript
import { procedure, procedures, z } from '@veloxts/velox';

export const postProcedures = procedures('posts', {
  list: procedure()
    .output(z.array(PostSchema))
    .query(async ({ ctx }) => ctx.db.post.findMany()),

  create: procedure()
    .input(CreatePostSchema)
    .output(PostSchema)
    .mutation(async ({ input, ctx }) => ctx.db.post.create({ data: input })),
});
```

Register in `src/router.ts`. Frontend uses tRPC client: `api.posts.list.query()`.

### Resource API (Context-Dependent Outputs)

```typescript
const UserSchema = resourceSchema()
  .public('id', z.string().uuid())
  .public('name', z.string())
  .authenticated('email', z.string().email())
  .build();

// .output(UserSchema.public) — tagged view on builder chain
// resource(data, UserSchema.authenticated) — runtime projection
```

## Procedure Naming Conventions

Even in tRPC-only mode, follow these for consistency and potential future REST migration:

- **Queries** (`.query()`): `get*`, `list*`, `find*`
- **Mutations** (`.mutation()`): `create*`, `add*`, `update*`, `edit*`, `patch*`, `delete*`, `remove*`

## Common Gotchas

**Always call `procedure()` with parentheses** — `procedure.output(...)` fails, use `procedure().output(...)`.

**Prisma 7**: Database URL is in `prisma.config.ts`, NOT in `schema.prisma`. Never add `url` to the datasource block.

**Prisma Decimals**: Use `z.coerce.number()` for input, `z.any().transform(val => Number(val))` for output. Dates: `z.coerce.date()`.

**Adding REST later**: Import `restAdapter` from `@veloxts/router` and register with `app.register(restAdapter(appRouter, { prefix: '/api' }))`.

**MCP**: For Claude Desktop, set `"cwd": "/path/to/project"` in `.mcp.json`. CLI: `npx @veloxts/mcp`.
