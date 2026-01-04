# CLAUDE.md

This file provides guidance to Claude Code and other AI assistants.

## Project Overview

**__PROJECT_NAME__** is a VeloxTS full-stack application using **tRPC-only** architecture:
- **Backend**: Fastify + VeloxTS + tRPC (apps/api)
- **Frontend**: React + Vite + TanStack Router (apps/web)
- **Database**: Prisma with __DATABASE_DISPLAY__

This template uses tRPC exclusively for type-safe internal communication. No REST adapter is included.

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
├── api/               # Backend (VeloxTS + Fastify + tRPC)
│   ├── src/
│   │   ├── procedures/  # tRPC procedures
│   │   ├── schemas/     # Zod schemas
│   │   ├── router.ts    # tRPC router setup
│   │   └── config/      # App configuration
│   └── prisma/
│       └── schema.prisma
│
└── web/               # Frontend (React + Vite)
    └── src/
        ├── routes/      # TanStack Router pages
        ├── api.ts       # tRPC client
        └── styles/      # CSS modules
```

## Why tRPC-Only?

| Feature | tRPC | REST |
|---------|------|------|
| Type Safety | Full inference | Manual types |
| Network | Single `/trpc` endpoint | Multiple endpoints |
| Best For | Internal frontend | Third-party integrations |
| Overhead | Minimal | REST adapter layer |

Choose tRPC-only when:
- Your React frontend is the only API consumer
- You want maximum type safety with zero overhead
- You don't need REST for external integrations

### API Development (apps/api)

**Creating a tRPC procedure:**

```typescript
// apps/api/src/procedures/posts.ts
import { procedure, procedures, z } from '@veloxts/velox';

export const postProcedures = procedures('posts', {
  // tRPC query
  list: procedure()
    .output(z.array(PostSchema))
    .query(async ({ ctx }) => {
      return ctx.db.post.findMany();
    }),

  // tRPC query with input
  byId: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(PostSchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.post.findUnique({ where: { id: input.id } });
    }),

  // tRPC mutation
  create: procedure()
    .input(CreatePostSchema)
    .output(PostSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.post.create({ data: input });
    }),
});
```

Then register in `src/router.ts`:

```typescript
import { createRouter } from '@veloxts/router';
import { postProcedures } from './procedures/posts';

export const appRouter = createRouter({
  posts: postProcedures,
});

export type AppRouter = typeof appRouter;
```

## Prisma 7 Configuration

This project uses Prisma 7 which has breaking changes:
- Database URL is configured in `prisma.config.ts`, NOT in `schema.prisma`
- NEVER add `url` property to the datasource block in `schema.prisma`

### Frontend Development (apps/web)

**Using tRPC client:**

```typescript
// apps/web/src/routes/posts.tsx
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../api';

function PostsPage() {
  // Full type safety - types flow from backend
  const { data: posts, isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: () => api.posts.list.query(),
  });

  const createPost = useMutation({
    mutationFn: (data) => api.posts.create.mutate(data),
  });

  if (isLoading) return <p>Loading...</p>;

  return (
    <ul>
      {posts?.map(post => (
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
3. **Import AppRouter type** in frontend
4. Types flow automatically through tRPC client

## tRPC Endpoint

All procedures are accessed via single tRPC endpoint:

```
POST /trpc/{namespace.procedure}
```

Examples:
- `POST /trpc/posts.list` - List posts
- `POST /trpc/posts.byId` - Get post by ID
- `POST /trpc/health.check` - Health check

## Migrating to REST (if needed later)

If you need REST endpoints for external consumers, add the REST adapter:

```typescript
// apps/api/src/index.ts
import { restAdapter } from '@veloxts/router';
import { appRouter } from './router';

// Add REST routes alongside tRPC
app.register(restAdapter(appRouter, { prefix: '/api' }));
```

This auto-generates REST endpoints from procedure names:
- `posts.list` → `GET /api/posts`
- `posts.byId` → `GET /api/posts/:id`
- `posts.create` → `POST /api/posts`

## Common Gotchas (IMPORTANT)

These patterns prevent common mistakes when building VeloxTS applications.

### Procedure Builder Syntax

**Always call `procedure()` with parentheses:**

```typescript
// ✅ Correct
list: procedure()
  .output(schema)
  .query(...)

// ❌ Wrong - causes "procedure.output is not a function"
list: procedure
  .output(schema)
```

### Procedure Naming Conventions

VeloxTS uses naming conventions to determine procedure type in REST adapter mode. Even in tRPC-only mode, follow these conventions for consistency and potential future REST migration:

**Query procedures** (read operations):
- Prefixes: `get*`, `list*`, `find*`
- Use `.query()` builder

**Mutation procedures** (write operations):
- Prefixes: `create*`, `add*`, `update*`, `edit*`, `patch*`, `delete*`, `remove*`
- Use `.mutation()` builder

```typescript
// Good - clear intent from naming
listPosts: procedure().query(...)      // Query
getPostById: procedure().query(...)    // Query
createPost: procedure().mutation(...)  // Mutation
updatePost: procedure().mutation(...)  // Mutation
```

### Handling Prisma Decimals in Zod Schemas

Prisma returns `Decimal` objects for decimal fields. Standard Zod validation fails.

**Input schemas** - use `z.coerce.number()`:
```typescript
price: z.coerce.number().positive()
```

**Output schemas** - use `z.any().transform()`:
```typescript
price: z.any().transform((val) => Number(val))
```

**Dates** - use `z.coerce.date()`:
```typescript
createdAt: z.coerce.date()
updatedAt: z.coerce.date()
```

### MCP Project Path

For Claude Desktop, specify the project path explicitly in `.mcp.json`:

```json
{
  "mcpServers": {
    "velox": {
      "command": "npx",
      "args": ["@veloxts/mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

CLI fallback: `__RUN_CMD__ velox make procedure Posts`

## Database

After schema changes:

```bash
__RUN_CMD__ db:push      # Apply changes
__RUN_CMD__ db:generate  # Regenerate client
```

Access via context: `ctx.db.post.findMany()`

## Code Generation

### Available Generators

| Generator | Alias | Description |
|-----------|-------|-------------|
| `procedure` | `p` | tRPC procedure with queries/mutations |
| `schema` | `s` | Zod validation schema |
| `model` | `m` | Prisma model definition |
| `test` | `t` | Unit/integration test file |

### Usage Examples

```bash
# Generate a procedure
__RUN_CMD__ velox make procedure Posts

# Generate a schema
__RUN_CMD__ velox make schema Post

# Preview without writing files
__RUN_CMD__ velox make --dry-run procedure Posts

# JSON output for scripting
__RUN_CMD__ velox make procedure Posts --json
```

## Error Handling

VeloxTS uses structured error codes for AI tooling:

```typescript
// Error format: VeloxError[E1001]: Message
import { VeloxError } from '@veloxts/core';

const getPost = procedure()
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const post = await ctx.db.post.findUnique({ where: { id: input.id } });

    if (!post) {
      throw VeloxError.notFound('Post', input.id);
    }

    return post;
  });
```

## Development Workflow

### Hot Module Replacement (HMR)

```bash
# Default: HMR enabled
__RUN_CMD__ velox dev

# Disable HMR
__RUN_CMD__ velox dev --no-hmr
```

### CLI JSON Output

All CLI commands support `--json` for scripting:

```bash
velox procedures list --json
velox introspect all --json
```

## AI-Powered Development with MCP

VeloxTS includes a **Model Context Protocol (MCP) server** that gives AI assistants like Claude direct access to your project structure. This enables intelligent code assistance with full awareness of your procedures, schemas, and types.

### What You Get

- **Resources**: Real-time project introspection (procedures, schemas)
- **Tools**: Code generation and database migration commands
- **Prompts**: Best practice templates for tRPC procedures

### Setup for Claude Code (CLI)

The MCP server auto-discovers VeloxTS projects:

```bash
# Start the MCP server
npx @veloxts/mcp

# Or with debug logging
npx @veloxts/mcp --debug
```

### Setup for Claude Desktop

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "veloxts": {
      "command": "npx",
      "args": ["@veloxts/mcp"]
    }
  }
}
```

Restart Claude Desktop after adding the configuration.

### What Claude Can Do With MCP

| Capability | Description |
|------------|-------------|
| Generate Code | Create procedures, schemas, models |
| Run Migrations | Check status, run, rollback, fresh, reset |
| Access Context | List procedures, schemas, types |

### Example Prompts

1. **"Generate a CRUD procedure set for BlogPost"**
2. **"Show me all my tRPC procedures and their input/output types"**
3. **"Add pagination to the posts.list procedure"**
4. **"Create a schema for Comment with validation"**

### Available MCP Resources

| Resource | Description |
|----------|-------------|
| `velox://procedures` | All procedures with types |
| `velox://schemas` | Zod validation schemas |
| `velox://errors` | Error catalog with fix suggestions |
| `velox://project` | Project metadata and file paths |
