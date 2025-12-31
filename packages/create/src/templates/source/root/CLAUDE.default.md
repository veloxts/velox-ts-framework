# CLAUDE.md

This file provides guidance to Claude Code and other AI assistants.

## Project Overview

**__PROJECT_NAME__** is a VeloxTS full-stack application with:
- **Backend**: Fastify + VeloxTS (apps/api)
- **Frontend**: React + Vite + TanStack Router (apps/web)
- **Database**: Prisma with SQLite

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
import { procedure, procedures, z } from '@veloxts/velox';

export const postProcedures = procedures('posts', {
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

## Prisma 7 Configuration

This project uses Prisma 7 which has breaking changes:
- Database URL is configured in `prisma.config.ts`, NOT in `schema.prisma`
- NEVER add `url` property to the datasource block in `schema.prisma`

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

## Code Generation

### Available Generators

| Generator | Alias | Description |
|-----------|-------|-------------|
| `procedure` | `p` | API procedure with queries/mutations |
| `schema` | `s` | Zod validation schema |
| `model` | `m` | Prisma model definition |
| `migration` | `mig` | Database migration file |
| `test` | `t` | Unit/integration test file |
| `resource` | `r` | Complete CRUD resource (all above) |
| `seeder` | `seed` | Database seeder |
| `factory` | `f` | Test data factory |

### Usage Examples

```bash
# Generate a complete CRUD resource
__RUN_CMD__ velox make resource Post --crud

# Generate just a procedure
__RUN_CMD__ velox make procedure Users --crud

# Generate with soft-delete support
__RUN_CMD__ velox m r Comment --soft-delete

# Preview without writing files
__RUN_CMD__ velox make --dry-run resource Post

# JSON output for scripting
__RUN_CMD__ velox make resource Post --json
```

### Generator Options

**Common Options:**
- `--dry-run, -d` - Preview changes without writing
- `--force, -f` - Overwrite existing files
- `--json` - Output results as JSON

**Resource/Procedure Options:**
- `--crud, -c` - Generate full CRUD operations
- `--paginated, -P` - Include pagination for list
- `--soft-delete, -s` - Add soft delete support
- `--timestamps, -t` - Include timestamps (default: true)

## Migration Runner

### Commands

| Command | Description |
|---------|-------------|
| `velox migrate status` | Show migration status |
| `velox migrate run` | Run pending migrations |
| `velox migrate rollback` | Rollback last migration |
| `velox migrate fresh` | Drop all tables and re-run |
| `velox migrate reset` | Rollback all then re-run |

### Usage

```bash
# Check status
__RUN_CMD__ velox migrate status

# Run pending migrations
__RUN_CMD__ velox migrate run

# Development mode (creates migration from schema diff)
__RUN_CMD__ velox migrate run --dev

# Rollback last migration
__RUN_CMD__ velox migrate rollback

# Fresh database
__RUN_CMD__ velox migrate fresh

# JSON output
__RUN_CMD__ velox migrate status --json
```

## Database Seeding

### Commands

```bash
# Run all seeders
__RUN_CMD__ velox db seed

# Run specific seeder
__RUN_CMD__ velox db seed UserSeeder

# Fresh seed (truncate first)
__RUN_CMD__ velox db seed --fresh

# Preview
__RUN_CMD__ velox db seed --dry-run
```

### Seeder Example

```typescript
// apps/api/src/database/seeders/UserSeeder.ts
import type { Seeder } from '@veloxts/cli';

export const UserSeeder: Seeder = {
  name: 'UserSeeder',
  dependencies: [],

  async run(db) {
    await db.user.createMany({
      data: [
        { email: 'admin@example.com', name: 'Admin' },
        { email: 'user@example.com', name: 'User' },
      ],
    });
  },
};
```

## Error Handling

VeloxTS uses structured error codes for AI tooling:

```typescript
// Error format: VeloxError[E1001]: Message
// E1xxx - Core errors
// E2xxx - Generator errors
// E3xxx - Seeding errors
// E4xxx - Migration errors
// E5xxx - Dev server errors
```

### Common Patterns

```typescript
import { VeloxError } from '@veloxts/core';

const getUser = procedure()
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const user = await ctx.db.user.findUnique({ where: { id: input.id } });

    if (!user) {
      throw VeloxError.notFound('User', input.id);
    }

    return user;
  });
```

## Development Workflow

### Hot Module Replacement (HMR)

```bash
# Default: HMR enabled
__RUN_CMD__ velox dev

# With verbose timing
__RUN_CMD__ velox dev --verbose

# Disable HMR
__RUN_CMD__ velox dev --no-hmr
```

### CLI JSON Output

All CLI commands support `--json` for scripting:

```bash
velox migrate status --json
velox db seed --json --dry-run
velox procedures list --json
```

### Recommended Flow

1. Define Zod schemas in `apps/api/src/schemas/`
2. Generate resource: `velox make resource Post --crud`
3. Customize generated procedures as needed
4. Run migrations: `velox migrate run --dev`
5. Seed data: `velox db seed --fresh`
6. Test endpoints with Thunder Client or curl

## AI-Powered Development with MCP

VeloxTS includes a **Model Context Protocol (MCP) server** that gives AI assistants like Claude direct access to your project structure. This enables intelligent code assistance with full awareness of your procedures, schemas, routes, and error codes.

### What You Get

- **Resources**: Real-time project introspection (procedures, routes, schemas, errors)
- **Tools**: Code generation and database migration commands
- **Prompts**: Best practice templates for common VeloxTS tasks

### Setup for Claude Code (CLI)

The MCP server auto-discovers VeloxTS projects:

```bash
# Start the MCP server
npx velox-mcp

# Or with debug logging
npx velox-mcp --debug
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
| Generate Code | Create procedures, schemas, models, resources, tests |
| Run Migrations | Check status, run, rollback, fresh, reset |
| Access Context | List procedures, routes, schemas, error codes |

### Example Prompts

1. **"Generate a complete CRUD resource for BlogPost with pagination"**
2. **"Show me all my API procedures and their REST endpoints"**
3. **"Run pending database migrations and show the status"**

### Available MCP Resources

| Resource | Description |
|----------|-------------|
| `velox://procedures` | All procedures with types and REST mappings |
| `velox://routes` | Complete REST route table |
| `velox://schemas` | Zod validation schemas |
| `velox://errors` | Error catalog with fix suggestions |
| `velox://project` | Project metadata and file paths |
