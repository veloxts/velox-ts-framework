# CLAUDE.md

This is a VeloxTS full-stack application using React Server Components with JWT Authentication.

Full documentation: **[veloxts.dev/docs](https://www.veloxts.dev/docs/)**

## Skills

- `/veloxts` — VeloxTS-specific help (code generation, REST routes, auth, server actions, troubleshooting)
- `/feature-dev` — Guided feature development with codebase analysis

## Project Structure

```
__PROJECT_NAME__/
├── app/                    # RSC application layer
│   ├── pages/              # File-based routing (server components)
│   │   ├── auth/           # Login, register pages
│   │   └── dashboard/      # Protected pages
│   ├── layouts/            # Layout components
│   └── actions/            # Server actions
│       ├── users.ts        # User actions with validated()
│       └── auth.ts         # Auth actions (procedure bridge)
├── src/
│   ├── api/                # API layer (Fastify embedded in Vinxi)
│   │   ├── handler.ts      # API handler with auth plugin
│   │   ├── database.ts     # Prisma client
│   │   ├── procedures/     # API procedures (auth, health, users)
│   │   ├── schemas/        # Zod schemas
│   │   └── utils/auth.ts   # JWT helpers, token store
│   ├── entry.client.tsx
│   └── entry.server.tsx
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

## Authentication

### Auth Architecture

Uses the **Procedure Bridge Pattern** — server actions call auth procedures directly, tokens stored in httpOnly cookies:

```typescript
// app/actions/auth.ts
'use server';
import { authAction } from '@veloxts/web/server';

export const login = authAction.fromTokenProcedure(
  authProcedures.procedures.createSession,
  { parseFormData: true, contextExtensions: { db }, skipGuards: true }
);

export const logout = authAction.fromLogoutProcedure(
  authProcedures.procedures.deleteSession,
  { contextExtensions: { db }, skipGuards: true }
);
```

### Auth Endpoints (REST API)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create account (rate limited) |
| `/api/auth/login` | POST | Get tokens (rate limited) |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/logout` | POST | Revoke token (protected) |
| `/api/auth/me` | GET | Current user (protected) |

### Environment Variables (Required for Production)

```bash
JWT_SECRET=<64+ chars>           # openssl rand -base64 64
JWT_REFRESH_SECRET=<64+ chars>   # openssl rand -base64 64
```

### `ctx.user` Behavior

`ctx.user` only contains fields returned by `userLoader` in `src/api/handler.ts`. Default: `{ id, email, name, roles }`.

To add fields: update `userLoader` return value in `src/api/handler.ts`, then update related schemas.

### Roles

Stored as JSON string array (`["user"]`). Parsed with `parseUserRoles()` from `@veloxts/auth`. When adding roles, update: `prisma/schema.prisma` default, `src/api/schemas/auth.ts`, and any guards.

## Key Concepts

### File-Based Routing
- `app/pages/index.tsx` → `/`
- `app/pages/users/[id].tsx` → `/users/:id`
- `app/pages/[...slug].tsx` → catch-all

Pages are Server Components by default. Use `'use client'` for interactivity.

### Server Actions with `validated()`

```typescript
'use server';
import { validated, validatedMutation, validatedQuery } from '@veloxts/web/server';

export const searchUsers = validatedQuery(schema, handler);           // Public
export const updateProfile = validatedMutation(schema, handler);      // Auth required
export const adminAction = validated(schema, handler, {               // Custom
  requireAuth: true, requireRoles: ['admin'],
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
});
```

### Guards

```typescript
import { authenticated, hasRole, allOf, anyOf } from '@veloxts/auth';

.guard(authenticated)           // Logged-in user
.guard(hasRole('admin'))        // Role check
.guard(allOf([g1, g2]))        // AND
.guard(anyOf([g1, g2]))        // OR
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

## Common Gotchas

**Always call `procedure()` with parentheses** — `procedure.guard(...)` fails, use `procedure().guard(...)`.

**`.rest()` paths exclude `/api` prefix** — it's added automatically.

**Prisma 7**: Database URL is in `prisma.config.ts`, NOT in `schema.prisma`. Never add `url` to the datasource block.

**Prisma Decimals**: Use `z.coerce.number()` for input, `z.any().transform(val => Number(val))` for output. Dates: `z.coerce.date()`.

**MCP**: For Claude Desktop, set `"cwd": "/path/to/project"` in `.mcp.json`. CLI: `npx @veloxts/mcp`.
