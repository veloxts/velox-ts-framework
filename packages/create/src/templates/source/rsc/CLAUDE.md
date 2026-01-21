# CLAUDE.md

This is a VeloxTS full-stack application using React Server Components.

## Documentation

Full documentation is available at **[veloxts.dev/docs](https://www.veloxts.dev/docs/)**.

## Claude Code Skills

When using Claude Code (CLI), these skills are available:

### `/veloxts` - VeloxTS Development Assistant

```
/veloxts
```

VeloxTS-specific help for:
- Code generation (`velox make resource`, `velox make procedure`)
- REST route inference from naming conventions
- Server actions with `validated()`
- Validation with Zod schemas
- Troubleshooting common errors

### `/feature-dev` - Guided Feature Development

```
/feature-dev
```

General-purpose skill for:
- Codebase understanding and architecture analysis
- Step-by-step implementation guidance
- Best practices for VeloxTS patterns

## Project Structure

```
__PROJECT_NAME__/
├── app/                    # Application layer (RSC)
│   ├── pages/              # File-based routing (RSC pages)
│   │   ├── index.tsx       # Home page (/)
│   │   └── users.tsx       # Users page (/users)
│   ├── layouts/            # Layout components
│   │   └── root.tsx        # Root layout (wraps all pages)
│   └── actions/            # Server actions
│       ├── users.ts        # User-related actions
│       └── posts.ts        # Post actions (procedure bridge)
├── src/                    # Source layer
│   ├── api/                # API layer (Fastify embedded in Vinxi)
│   │   ├── handler.ts      # API handler for /api/* routes
│   │   ├── database.ts     # Prisma client
│   │   ├── procedures/     # API procedure definitions
│   │   └── schemas/        # Zod validation schemas
│   ├── entry.client.tsx    # Client hydration entry
│   └── entry.server.tsx    # Server rendering entry
├── prisma/
│   └── schema.prisma       # Database schema
├── app.config.ts           # Vinxi configuration
└── package.json
```

## Key Concepts

### React Server Components (RSC)
- Pages in `app/pages/` are Server Components by default
- They run on the server and can directly access the database
- Use `'use client'` directive for client-side interactivity

### File-Based Routing
- `app/pages/index.tsx` → `/`
- `app/pages/users.tsx` → `/users`
- `app/pages/users/[id].tsx` → `/users/:id` (dynamic route)
- `app/pages/[...slug].tsx` → catch-all route

### Server Actions
- Defined in `app/actions/` with `'use server'` directive
- Type-safe with Zod validation
- Can be called directly from client components

### Validated Actions (Recommended)
Use `validated()` for secure server actions with built-in protection:
```typescript
// app/actions/users.ts
'use server';
import { validated, validatedMutation, validatedQuery } from '@veloxts/web/server';
import { z } from 'zod';

// Public query (no auth required)
export const searchUsers = validatedQuery(
  z.object({ query: z.string().optional() }),
  async (input) => {
    return db.user.findMany({ where: { name: { contains: input.query } } });
  }
);

// Protected mutation (requires auth by default)
export const updateUser = validatedMutation(
  z.object({ id: z.string(), name: z.string() }),
  async (input, ctx) => {
    // ctx.user is typed and available
    return db.user.update({ where: { id: input.id }, data: input });
  }
);

// Custom security options
export const createUser = validated(
  CreateUserSchema,
  async (input) => { /* ... */ },
  {
    rateLimit: { maxRequests: 10, windowMs: 60_000 },
    maxInputSize: 10 * 1024,
  }
);

// With role-based authorization
export const deleteUser = validated(
  DeleteUserSchema,
  async (input) => { /* ... */ },
  {
    requireAuth: true,
    requireRoles: ['admin'],
  }
);
```

Security features:
- **Input validation** - Zod schema validation
- **Input sanitization** - Prototype pollution prevention
- **Input size limits** - DoS protection (default 1MB)
- **Rate limiting** - Sliding window per IP
- **Authentication** - Optional via `requireAuth: true`
- **Authorization** - Custom callbacks via `authorize`

### Procedure Bridge Pattern
Server actions can bridge to API procedures for code reuse:
```typescript
// app/actions/posts.ts
'use server';
import { action } from '@veloxts/web/server';
import { postProcedures } from '@/api/procedures/posts';

export const createPost = action.fromProcedure(
  postProcedures.procedures.createPost,
  { parseFormData: true }  // Auto-parse FormData
);
```

This pattern:
- Reuses procedure validation, guards, and business logic
- Type safety flows from procedure → action → form
- Works with HTML forms for progressive enhancement

### API Routes
- All `/api/*` routes are handled by embedded Fastify
- Procedures defined in `src/api/procedures/`
- Full VeloxTS type safety and REST conventions

## Commands

```bash
# Development
__RUN_CMD__ dev         # Start dev server with HMR

# Database
__RUN_CMD__ db:generate # Generate Prisma client
__RUN_CMD__ db:push     # Push schema to database
__RUN_CMD__ db:migrate  # Run migrations
__RUN_CMD__ db:studio   # Open Prisma Studio

# Production
__RUN_CMD__ build       # Build for production
__RUN_CMD__ start       # Start production server
```

## Development

1. Run `__RUN_CMD__ db:push` to set up the database
2. Run `__RUN_CMD__ dev` to start the development server
3. Open http://localhost:__API_PORT__ in your browser

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## Common Gotchas (IMPORTANT)

These patterns prevent common mistakes when building VeloxTS applications.

### Procedure Builder Syntax

**Always call `procedure()` with parentheses:**

```typescript
// ✅ Correct
getPost: procedure()
  .input(schema)
  .query(...)

// ❌ Wrong - causes "procedure.input is not a function"
getPost: procedure
  .input(schema)
```

### Procedure Naming Conventions

VeloxTS uses naming conventions to determine HTTP methods for REST endpoints:

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

Follow these conventions for consistency across procedures and server actions.

### Custom REST Routes

When using `.rest()` to override routes, do NOT include the API prefix:

```typescript
// ✅ Correct - prefix is applied automatically
.rest({ method: 'POST', path: '/posts/:id/publish' })

// ❌ Wrong - results in /api/api/posts/:id/publish
.rest({ method: 'POST', path: '/api/posts/:id/publish' })
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

CLI fallback: `__RUN_CMD__ velox make procedure Posts --crud`

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
