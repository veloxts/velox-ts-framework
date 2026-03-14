# CLAUDE.md

This file provides guidance to Claude Code and other AI assistants.

Full documentation: **[veloxts.dev/docs](https://www.veloxts.dev/docs/)**

## Skills

- `/veloxts` — VeloxTS-specific help (code generation, REST routes, validation, troubleshooting)
- `/feature-dev` — Guided feature development with codebase analysis

## Project Overview

**__PROJECT_NAME__** is a VeloxTS full-stack application:
- **Backend**: Fastify + VeloxTS (`apps/api`)
- **Frontend**: React + Vite + TanStack Router (`apps/web`)
- **Database**: Prisma 7 with __DATABASE_DISPLAY__

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
__RUN_CMD__ velox make resource Post --crud     # Full CRUD resource
__RUN_CMD__ velox make procedure Users --crud   # Procedure only
__RUN_CMD__ velox make schema Post              # Zod schema only
__RUN_CMD__ velox make resource Post --dry-run  # Preview without writing
```

Options: `--crud`, `--paginated`, `--soft-delete`, `--timestamps`, `--force`, `--json`

### Migrations & Seeding

```bash
__RUN_CMD__ velox migrate status    # Show migration status
__RUN_CMD__ velox migrate run      # Run pending migrations
__RUN_CMD__ velox migrate rollback # Rollback last migration
__RUN_CMD__ velox db seed          # Run all seeders
__RUN_CMD__ velox db seed --fresh  # Fresh database + seed
```

## Architecture

```
apps/
├── api/               # Backend (VeloxTS + Fastify)
│   ├── src/
│   │   ├── procedures/  # API procedures
│   │   ├── schemas/     # Zod schemas
│   │   └── config/      # App configuration
│   └── prisma/
└── web/               # Frontend (React + Vite)
    └── src/
        ├── routes/      # TanStack Router pages
        └── components/
```

### Creating a Procedure

```typescript
import { procedure, procedures, z } from '@veloxts/velox';

export const postProcedures = procedures('posts', {
  getPost: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(PostSchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.post.findUniqueOrThrow({ where: { id: input.id } });
    }),
});
```

Register in `src/router.ts` by importing and adding to `createRouter()`.

### Resource API (Context-Dependent Outputs)

```typescript
import { resourceSchema, resource, procedure, z } from '@veloxts/velox';

const UserSchema = resourceSchema()
  .public('id', z.string().uuid())
  .public('name', z.string())
  .authenticated('email', z.string().email())
  .admin('internalNotes', z.string().nullable())
  .build();

// Use tagged views with .output() or resource() helper:
// .output(UserSchema.public) — type-safe on the builder chain
// resource(data, UserSchema.authenticated) — runtime projection
```

## Procedure Naming Conventions (CRITICAL)

| Prefix | HTTP Method | Route Pattern | Builder |
|--------|-------------|---------------|---------|
| `get*` | GET | `/resource/:id` | `.query()` |
| `list*`, `find*` | GET | `/resource` | `.query()` |
| `create*`, `add*` | POST | `/resource` | `.mutation()` |
| `update*`, `edit*` | PUT | `/resource/:id` | `.mutation()` |
| `patch*` | PATCH | `/resource/:id` | `.mutation()` |
| `delete*`, `remove*` | DELETE | `/resource/:id` | `.mutation()` |

**React Query mapping**: `get*`/`list*`/`find*` prefixes use `useQuery`/`useSuspenseQuery`. All others use `useMutation`.

## Common Gotchas

**Always call `procedure()` with parentheses** — `procedure.input(...)` fails, use `procedure().input(...)`.

**`.rest()` paths exclude `/api` prefix** — it's added automatically. `/posts/:id/publish` not `/api/posts/:id/publish`.

**Prisma 7**: Database URL is in `prisma.config.ts`, NOT in `schema.prisma`. Never add `url` to the datasource block.

**Prisma Decimals**: Use `z.coerce.number()` for input, `z.any().transform(val => Number(val))` for output. Dates: `z.coerce.date()`.

**MCP**: For Claude Desktop, set `"cwd": "/path/to/project"` in `.mcp.json`. CLI: `npx @veloxts/mcp`.
