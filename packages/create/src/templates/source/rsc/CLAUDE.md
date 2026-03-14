# CLAUDE.md

This is a VeloxTS full-stack application using React Server Components.

Full documentation: **[veloxts.dev/docs](https://www.veloxts.dev/docs/)**

## Skills

- `/veloxts` — VeloxTS-specific help (code generation, REST routes, server actions, validation, troubleshooting)
- `/feature-dev` — Guided feature development with codebase analysis

## Project Structure

```
__PROJECT_NAME__/
├── app/                    # RSC application layer
│   ├── pages/              # File-based routing (server components)
│   ├── layouts/            # Layout components
│   └── actions/            # Server actions ('use server')
├── src/
│   ├── api/                # API layer (Fastify embedded in Vinxi)
│   │   ├── handler.ts      # API handler for /api/* routes
│   │   ├── database.ts     # Prisma client
│   │   ├── procedures/     # API procedure definitions
│   │   └── schemas/        # Zod schemas
│   ├── entry.client.tsx    # Client hydration
│   └── entry.server.tsx    # Server rendering
├── prisma/
├── app.config.ts           # Vinxi configuration
└── package.json
```

## Commands

```bash
__RUN_CMD__ dev         # Start dev server with HMR
__RUN_CMD__ build       # Build for production
__RUN_CMD__ start       # Start production server
__RUN_CMD__ db:push     # Push database schema
__RUN_CMD__ db:generate # Generate Prisma client
__RUN_CMD__ db:studio   # Open Prisma Studio
```

### Code Generation

```bash
__RUN_CMD__ velox make resource Post --crud     # Full CRUD resource
__RUN_CMD__ velox make procedure Users --crud   # Procedure only
__RUN_CMD__ velox make resource Post --dry-run  # Preview without writing
```

## Key Concepts

### File-Based Routing
- `app/pages/index.tsx` → `/`
- `app/pages/users.tsx` → `/users`
- `app/pages/users/[id].tsx` → `/users/:id`
- `app/pages/[...slug].tsx` → catch-all

Pages are Server Components by default. Use `'use client'` for interactivity.

### Server Actions with `validated()`

```typescript
// app/actions/users.ts
'use server';
import { validated, validatedMutation, validatedQuery } from '@veloxts/web/server';
import { z } from 'zod';

export const searchUsers = validatedQuery(
  z.object({ query: z.string().optional() }),
  async (input) => db.user.findMany({ where: { name: { contains: input.query } } })
);

export const updateUser = validatedMutation(
  z.object({ id: z.string(), name: z.string() }),
  async (input, ctx) => db.user.update({ where: { id: input.id }, data: input })
);

// Custom options: rateLimit, maxInputSize, requireAuth, requireRoles
export const createUser = validated(CreateUserSchema, handler, {
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
});
```

### Procedure Bridge Pattern

Reuse API procedures as server actions:

```typescript
'use server';
import { action } from '@veloxts/web/server';
import { postProcedures } from '@/api/procedures/posts';

export const createPost = action.fromProcedure(
  postProcedures.procedures.createPost,
  { parseFormData: true }
);
```

### API Routes
All `/api/*` routes are handled by embedded Fastify with full VeloxTS conventions.

## Procedure Naming Conventions (CRITICAL)

| Prefix | HTTP Method | Route Pattern | Builder |
|--------|-------------|---------------|---------|
| `get*` | GET | `/resource/:id` | `.query()` |
| `list*`, `find*` | GET | `/resource` | `.query()` |
| `create*`, `add*` | POST | `/resource` | `.mutation()` |
| `update*`, `edit*` | PUT | `/resource/:id` | `.mutation()` |
| `patch*` | PATCH | `/resource/:id` | `.mutation()` |
| `delete*`, `remove*` | DELETE | `/resource/:id` | `.mutation()` |

## Common Gotchas

**Always call `procedure()` with parentheses** — `procedure.input(...)` fails, use `procedure().input(...)`.

**`.rest()` paths exclude `/api` prefix** — it's added automatically.

**Prisma 7**: Database URL is in `prisma.config.ts`, NOT in `schema.prisma`. Never add `url` to the datasource block.

**Prisma Decimals**: Use `z.coerce.number()` for input, `z.any().transform(val => Number(val))` for output. Dates: `z.coerce.date()`.

**MCP**: For Claude Desktop, set `"cwd": "/path/to/project"` in `.mcp.json`. CLI: `npx @veloxts/mcp`.
