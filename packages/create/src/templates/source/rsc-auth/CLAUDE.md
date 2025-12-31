# CLAUDE.md

This is a VeloxTS full-stack application using React Server Components with JWT Authentication.

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
