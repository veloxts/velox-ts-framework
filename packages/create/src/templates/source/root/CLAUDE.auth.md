# CLAUDE.md

This file provides guidance to Claude Code and other AI assistants.

## Project Overview

**__PROJECT_NAME__** is a VeloxTS full-stack application with:
- **Backend**: Fastify + VeloxTS (apps/api)
- **Frontend**: React + Vite + TanStack Router (apps/web)
- **Database**: Prisma with __DATABASE_DISPLAY__
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

Then register in `src/router.ts` by importing and adding to `createRouter()`:

```typescript
// src/router.ts
import { postProcedures } from './procedures/posts.js';

export const { collections, router } = createRouter(
  healthProcedures,
  authProcedures,
  userProcedures,
  postProcedures  // Add here
);
```

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

## Procedure Naming Conventions (CRITICAL)

VeloxTS uses naming conventions to determine both HTTP methods and React Query hook types.

### HTTP Method Mapping

| Procedure Name | HTTP Method | Route |
|----------------|-------------|-------|
| `getUser` | GET | `/users/:id` |
| `listUsers` | GET | `/users` |
| `findUsers` | GET | `/users` (search) |
| `createUser` | POST | `/users` |
| `addUser` | POST | `/users` |
| `updateUser` | PUT | `/users/:id` |
| `editUser` | PUT | `/users/:id` |
| `patchUser` | PATCH | `/users/:id` |
| `deleteUser` | DELETE | `/users/:id` |
| `removeUser` | DELETE | `/users/:id` |

### React Query Hook Mapping

**Query procedures** (use `useQuery`, `useSuspenseQuery`):
- Prefixes: `get*`, `list*`, `find*`
- Example: `api.users.getUser.useQuery({ id })` ✅
- Example: `api.users.listUsers.useSuspenseQuery({})` ✅

**Mutation procedures** (use `useMutation`):
- Prefixes: `create*`, `add*`, `update*`, `edit*`, `patch*`, `delete*`, `remove*`
- Example: `api.users.createUser.useMutation()` ✅
- Example: `api.posts.updatePost.useMutation()` ✅

### Common Mistake

If you see "useSuspenseQuery is not a function" or similar errors, your procedure name doesn't follow the convention:

```typescript
// ❌ Wrong - "fetchCampaigns" is not a query prefix, treated as mutation
const { data } = api.campaigns.fetchCampaigns.useQuery({});  // Error!

// ✅ Correct - "listCampaigns" is a query prefix
const { data } = api.campaigns.listCampaigns.useQuery({});
```

## Common Gotchas (IMPORTANT)

These patterns prevent common mistakes when building VeloxTS applications.

### Procedure Builder Syntax

**Always call `procedure()` with parentheses:**

```typescript
// ✅ Correct
getCampaign: procedure()
  .guard(authenticated)
  .input(schema)
  .query(...)

// ❌ Wrong - causes "procedure.guard is not a function"
getCampaign: procedure
  .guard(authenticated)
```

### Custom REST Routes

When using `.rest()` to override routes, do NOT include the API prefix:

```typescript
// ✅ Correct - prefix is applied automatically
.rest({ method: 'POST', path: '/campaigns/:id/activate' })

// ❌ Wrong - results in /api/api/campaigns/:id/activate
.rest({ method: 'POST', path: '/api/campaigns/:id/activate' })
```

**Note:** Path parameters (`:id`) are NOT auto-extracted into input. Pass them in the request body.

### Handling Prisma Decimals in Zod Schemas

Prisma returns `Decimal` objects for decimal fields. Standard Zod validation fails.

**Input schemas** - use `z.coerce.number()`:
```typescript
bidAmount: z.coerce.number().positive().max(1000)
```

**Output schemas** - use `z.any().transform()`:
```typescript
bidAmount: z.any().transform((val) => Number(val))
balance: z.any().transform((val) => Number(val))
```

**Dates** - use `z.coerce.date()`:
```typescript
createdAt: z.coerce.date()
updatedAt: z.coerce.date()
```

### Authentication Context (`ctx.user`)

**Important:** `ctx.user` is NOT the raw database user - it only contains fields explicitly returned by `userLoader` in `src/config/auth.ts`.

#### How ctx.user Gets Populated

1. JWT token is validated from cookie/header
2. User ID is extracted from token payload
3. `userLoader(userId)` is called to fetch user data
4. Only the fields returned by `userLoader` are available on `ctx.user`

#### Default Fields

The default `userLoader` returns:
```typescript
{
  id: string;
  email: string;
  name: string;
  roles: string[];
}
```

#### Adding Fields to ctx.user

To add a field like `organizationId`:

1. Update `userLoader` in `src/config/auth.ts`:
```typescript
async function userLoader(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: parseUserRoles(user.roles),
    organizationId: user.organizationId, // Add new fields here
  };
}
```

2. Update related schemas (`UserSchema`, `UpdateUserInput`, etc.).

#### Common Mistake

```typescript
// ❌ WRONG - organizationId is undefined (not in userLoader)
const orgId = ctx.user.organizationId;

// ✅ CORRECT - After adding to userLoader in src/config/auth.ts
const orgId = ctx.user.organizationId;

// ✅ ALTERNATIVE - Use getFullUser helper when you need extra fields
import { getFullUser } from '@/utils/auth';
const fullUser = await getFullUser(ctx);
const orgId = fullUser.organizationId;
```

### Role Configuration

Roles are stored as a JSON string array in the database (e.g., `["user"]`, `["admin"]`).

The `parseUserRoles()` function from `@veloxts/auth` safely parses the JSON string:
```typescript
// Imported and used in src/config/auth.ts
import { parseUserRoles } from '@veloxts/auth';
roles: parseUserRoles(user.roles),  // Converts '["user"]' to ['user']
```

When adding new roles, update:
- `prisma/schema.prisma` - Default value in the roles field
- `src/schemas/auth.ts` - Role validation schemas (if using enum validation)
- Any guards that check for specific roles (e.g., `hasRole('admin')`)

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

CLI fallback: `__RUN_CMD__ velox make procedure Posts --crud`

## Guards and Policies

### Using Guards

Guards protect procedures from unauthorized access:

```typescript
import { authenticated, hasRole, hasPermission, allOf, anyOf } from '@veloxts/auth';

// Require authentication
const getProfile = procedure()
  .guard(authenticated)
  .query(({ ctx }) => ctx.user);

// Require specific role
const adminDashboard = procedure()
  .guard(hasRole('admin'))
  .query(({ ctx }) => { /* ... */ });

// Require permission
const deletePost = procedure()
  .guard(hasPermission('posts.delete'))
  .mutation(({ ctx, input }) => { /* ... */ });

// Combine guards (AND logic)
const adminWithPermission = procedure()
  .guard(allOf([hasRole('admin'), hasPermission('users.manage')]))
  .mutation(({ ctx, input }) => { /* ... */ });

// Any of guards (OR logic)
const moderatorOrAdmin = procedure()
  .guard(anyOf([hasRole('admin'), hasRole('moderator')]))
  .mutation(({ ctx, input }) => { /* ... */ });
```

### Available Guards

| Guard | Description |
|-------|-------------|
| `authenticated` | Requires logged-in user |
| `emailVerified` | Requires verified email |
| `hasRole(role)` | Checks user role |
| `hasPermission(perm)` | Checks user permission |
| `hasAnyPermission(perms)` | Any permission matches |
| `allOf(guards)` | All guards must pass |
| `anyOf(guards)` | Any guard must pass |
| `not(guard)` | Inverts guard result |

### Resource Policies

Define authorization rules for resources:

```typescript
import { definePolicy, registerPolicy, authorize } from '@veloxts/auth';

// Define policy for Post resource
const PostPolicy = definePolicy<User, Post>({
  view: () => true,
  create: (user) => user.emailVerified,
  update: (user, post) => user.id === post.authorId,
  delete: (user, post) => user.id === post.authorId || user.role === 'admin',
});

// Register the policy
registerPolicy('Post', PostPolicy);

// Use in procedures
const deletePost = procedure()
  .guard(authenticated)
  .mutation(async ({ ctx, input }) => {
    const post = await ctx.db.post.findUnique({ where: { id: input.id } });

    // Throws 403 if unauthorized
    await authorize(ctx.user, 'delete', 'Post', post);

    return ctx.db.post.delete({ where: { id: input.id } });
  });
```

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
