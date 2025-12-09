# CLAUDE.md

This file provides guidance to Claude Code and other AI assistants.

## Project Overview

**__PROJECT_NAME__** is a VeloxTS full-stack application with:
- **Backend**: Fastify + VeloxTS (apps/api)
- **Frontend**: React + Vite + TanStack Router (apps/web)
- **Database**: Prisma with SQLite
- **Auth**: JWT authentication with guards

## Commands

```bash
__RUN_CMD__ dev          # Start both API (__API_PORT__) and Web (__WEB_PORT__)
__RUN_CMD__ build        # Build both apps
__RUN_CMD__ db:push      # Push database schema
__RUN_CMD__ db:studio    # Open Prisma Studio
```

## Architecture

### Workspace Structure

```
apps/
├── api/               # Backend (VeloxTS + Fastify)
│   ├── src/
│   │   ├── procedures/  # API procedures
│   │   ├── schemas/     # Zod schemas
│   │   └── config/      # App configuration
│   └── prisma/
│       └── schema.prisma
│
└── web/               # Frontend (React + Vite)
    └── src/
        ├── routes/      # TanStack Router pages
        ├── components/  # React components
        └── styles/      # CSS modules
```

### API Development (apps/api)

**Creating a new procedure:**

```typescript
// apps/api/src/procedures/posts.ts
import { defineProcedures, procedure, z } from '@veloxts/velox';

export const postProcedures = defineProcedures('posts', {
  // GET /api/posts/:id
  getPost: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(PostSchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.post.findUnique({ where: { id: input.id } });
    }),

  // POST /api/posts
  createPost: procedure()
    .input(CreatePostSchema)
    .output(PostSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.post.create({ data: input });
    }),
});
```

Then register in `src/procedures/index.ts` and add to collections in `src/index.ts`.

### Frontend Development (apps/web)

**Creating a new route:**

```typescript
// apps/web/src/routes/posts.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@veloxts/client';

export const Route = createFileRoute('/posts')({
  component: PostsPage,
});

function PostsPage() {
  const { data: posts, isLoading } = useQuery(['posts'], '/posts');

  if (isLoading) return <p>Loading...</p>;

  return (
    <ul>
      {posts?.data.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

### Type Safety

VeloxTS provides end-to-end type safety without code generation:

1. **Define schemas** in `apps/api/src/schemas/`
2. **Use in procedures** with `.input()` and `.output()`
3. **Import in frontend** via `@veloxts/client` hooks
4. Types flow automatically from backend to frontend

## Authentication

This project includes full JWT authentication:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create new account |
| `/api/auth/login` | POST | Login and get tokens |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/logout` | POST | Revoke current token |
| `/api/auth/me` | GET | Get current user (protected) |

### Environment Variables (Required for Production)

```bash
JWT_SECRET=<64+ chars>           # Generate: openssl rand -base64 64
JWT_REFRESH_SECRET=<64+ chars>   # Generate: openssl rand -base64 64
```

## Procedure Naming Conventions

| Procedure Name | HTTP Method | Route |
|----------------|-------------|-------|
| `getUser` | GET | `/users/:id` |
| `listUsers` | GET | `/users` |
| `createUser` | POST | `/users` |
| `updateUser` | PUT | `/users/:id` |
| `patchUser` | PATCH | `/users/:id` |
| `deleteUser` | DELETE | `/users/:id` |

## Database

After schema changes:

```bash
__RUN_CMD__ db:push      # Apply changes
__RUN_CMD__ db:generate  # Regenerate client
```

Access via context: `ctx.db.user.findMany()`
