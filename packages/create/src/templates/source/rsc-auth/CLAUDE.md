# CLAUDE.md

This is a VeloxTS full-stack application using React Server Components with JWT Authentication.

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
- Authentication and guards
- Server actions with `validated()`
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
│   │   ├── users.tsx       # Users page (/users)
│   │   ├── auth/           # Auth pages
│   │   │   ├── login.tsx   # Login page
│   │   │   └── register.tsx # Registration page
│   │   └── dashboard/      # Protected pages
│   │       └── index.tsx   # Dashboard (requires auth)
│   ├── layouts/            # Layout components
│   │   └── root.tsx        # Root layout
│   └── actions/            # Server actions
│       ├── users.ts        # User actions with validated()
│       └── auth.ts         # Auth actions
├── src/                    # Source layer
│   ├── api/                # API layer (Fastify embedded in Vinxi)
│   │   ├── handler.ts      # API handler with auth plugin
│   │   ├── database.ts     # Prisma client
│   │   ├── procedures/     # API procedure definitions
│   │   │   ├── auth.ts     # Authentication procedures
│   │   │   ├── health.ts   # Health check
│   │   │   └── users.ts    # User CRUD
│   │   ├── schemas/        # Zod validation schemas
│   │   └── utils/          # Utilities
│   │       └── auth.ts     # JWT helpers, token store
│   ├── entry.client.tsx    # Client hydration
│   └── entry.server.tsx    # Server rendering
├── prisma/
│   └── schema.prisma       # Database schema (with password field)
├── app.config.ts           # Vinxi configuration
└── package.json
```

## Authentication

### JWT-Based Authentication with httpOnly Cookies
- Access tokens (15 min expiry) stored in httpOnly cookies
- Refresh tokens (7 day expiry) stored in httpOnly cookies
- Secure password hashing (bcrypt)
- Rate limiting on auth endpoints
- Token revocation support
- Tokens are NOT accessible to JavaScript (XSS protection)

### Auth Architecture

This template uses the **Procedure Bridge Pattern** for authentication:

1. **Server Actions** (`app/actions/auth.ts`) call auth procedures directly
2. **Tokens are stored in httpOnly cookies** by server actions (not localStorage)
3. **API requests use cookies** via `credentials: 'include'`

```typescript
// app/actions/auth.ts - Procedure Bridge Pattern
'use server';
import { authAction } from '@veloxts/web/server';
import { authProcedures } from '@/api/procedures/auth';
import { db } from '@/api/database';

// Login: executes procedure directly, stores tokens in httpOnly cookies
export const login = authAction.fromTokenProcedure(
  authProcedures.procedures.createSession,
  { parseFormData: true, contextExtensions: { db }, skipGuards: true }
);

// Register: same pattern
export const register = authAction.fromTokenProcedure(
  authProcedures.procedures.createAccount,
  { parseFormData: true, contextExtensions: { db }, skipGuards: true }
);

// Logout: clears auth cookies
export const logout = authAction.fromLogoutProcedure(
  authProcedures.procedures.deleteSession,
  { contextExtensions: { db }, skipGuards: true }
);
```

### Why Procedure Bridge vs HTTP Fetch?

| Aspect | Procedure Bridge | HTTP Fetch |
|--------|-----------------|------------|
| Network | Direct in-process | HTTP round-trip |
| Type Safety | Full inference | Lost at boundary |
| Cookie Access | Yes (server action) | No (client-side) |
| Guards/Middleware | Reused | Bypassed |
| URL Hardcoding | None | Required |

### Auth Endpoints (REST API)
```
POST /api/auth/register  - Create new account
POST /api/auth/login     - Authenticate, get tokens
POST /api/auth/refresh   - Refresh access token
POST /api/auth/logout    - Revoke current token
GET  /api/auth/me        - Get current user (protected)
```

### Client-Side Auth

```typescript
// Dashboard - uses cookies automatically
const response = await fetch('/api/auth/me', {
  credentials: 'include',  // Sends httpOnly cookies
});

// Logout - uses server action
import { logout } from '@/app/actions/auth';
await logout();  // Clears cookies server-side
```

### Password Requirements
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- Not a common password

### Authentication Context (`ctx.user`)

**Important:** `ctx.user` is NOT the raw database user - it only contains fields explicitly returned by `userLoader` in `src/api/handler.ts`.

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

#### Common Mistake

```typescript
// ❌ WRONG - organizationId is undefined (not in userLoader)
const orgId = ctx.user.organizationId;

// ✅ CORRECT - After adding to userLoader in src/api/handler.ts
const orgId = ctx.user.organizationId;

// ✅ ALTERNATIVE - Use getFullUser helper when you need extra fields
import { getFullUser } from '@/api/utils/auth';
const fullUser = await getFullUser(ctx);
const orgId = fullUser.organizationId;
```

## Server Actions with validated()

Use the `validated()` helper for secure server actions:

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

// Authenticated mutation (ctx.user available)
export const updateProfile = validatedMutation(
  z.object({ name: z.string() }),
  async (input, ctx) => {
    return db.user.update({ where: { id: ctx.user.id }, data: input });
  }
);

// Custom security options with rate limiting
export const createUser = validated(
  CreateUserSchema,
  async (input) => { /* ... */ },
  {
    rateLimit: { maxRequests: 10, windowMs: 60_000 },
    maxInputSize: 10 * 1024,
  }
);

// Role-based authorization
export const adminDeleteUser = validated(
  DeleteUserSchema,
  async (input) => { /* ... */ },
  {
    requireAuth: true,
    requireRoles: ['admin'],
  }
);
```

### Security Features
- **Input validation** - Zod schema validation
- **Input sanitization** - Prototype pollution prevention
- **Input size limits** - DoS protection (default 1MB)
- **Rate limiting** - Sliding window per IP
- **Authentication** - Optional via `requireAuth: true`
- **Authorization** - Role-based via `requireRoles`

## Commands

```bash
# Development
__RUN_CMD__ dev         # Start dev server

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
4. Register an account at /auth/register
5. Access protected pages at /dashboard

## Environment Variables

Required for production:
```bash
# Generate with: openssl rand -base64 64
JWT_SECRET="..."
JWT_REFRESH_SECRET="..."
```

## API Endpoints

### Public
- `GET /api/health` - Health check
- `GET /api/users` - List users

### Authentication
- `POST /api/auth/register` - Create account (rate limited)
- `POST /api/auth/login` - Get tokens (rate limited)
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout (protected)
- `GET /api/auth/me` - Current user (protected)

### Protected (require Bearer token)
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## Common Gotchas (IMPORTANT)

These patterns prevent common mistakes when building VeloxTS applications.

### Procedure Builder Syntax

**Always call `procedure()` with parentheses:**

```typescript
// ✅ Correct
getUser: procedure()
  .guard(authenticated)
  .input(schema)
  .query(...)

// ❌ Wrong - causes "procedure.guard is not a function"
getUser: procedure
  .guard(authenticated)
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
.rest({ method: 'POST', path: '/users/:id/activate' })

// ❌ Wrong - results in /api/api/users/:id/activate
.rest({ method: 'POST', path: '/api/users/:id/activate' })
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

### Extending User Context

The `ctx.user` object is populated by `userLoader` in `src/api/handler.ts` (inline in `createAuthConfig()`).

To add fields to `ctx.user` (e.g., `organizationId`):

1. Update `userLoader` in `src/api/handler.ts`:
```typescript
userLoader: async (userId: string) => {
  const user = await db.user.findUnique({ where: { id: userId } });
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: parseUserRoles(user.roles),
    organizationId: user.organizationId, // Add new fields here
  };
},
```

2. Update related schemas (`UserSchema`, `UpdateUserInput`, etc.).

### Role Configuration

Roles are stored as a JSON string array in the database (e.g., `["user"]`, `["admin"]`).

The `parseUserRoles()` function from `@veloxts/auth` safely parses the JSON string:
```typescript
// Imported and used in src/api/handler.ts
import { parseUserRoles } from '@veloxts/auth';
roles: parseUserRoles(user.roles),  // Converts '["user"]' to ['user']
```

When adding new roles, update:
- `prisma/schema.prisma` - Default value in the roles field
- `src/api/schemas/auth.ts` - Role validation schemas (if using enum validation)
- Any guards or server actions that check for specific roles

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
