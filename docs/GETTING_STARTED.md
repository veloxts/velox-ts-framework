# Getting Started with VeloxTS Framework

> **Deprecated:** This document is no longer maintained. Please refer to the official documentation at [veloxts.dev/docs](https://www.veloxts.dev/docs/).

> **Current Version:** v0.6.x - VeloxTS is in active development with a stable API. This guide reflects the current functionality.

Welcome to VeloxTS, a TypeScript full-stack web framework focused on developer experience and type safety. This guide walks you through creating your first VeloxTS application.

## What is VeloxTS?

VeloxTS is a modern TypeScript framework that combines type safety with convention-based development, inspired by Laravel's elegance and developer experience.

**Core Features:**

- **Type safety without code generation** - Types flow naturally from backend to frontend using TypeScript's `typeof` and `as const`
- **Procedure-based API design** - Define your business logic once, get both tRPC and REST endpoints automatically
- **Full REST support** - All HTTP methods (GET, POST, PUT, PATCH, DELETE) with naming convention inference
- **Built-in authentication** - JWT and session-based auth with guards, rate limiting, and CSRF protection
- **OpenAPI generation** - Auto-generate OpenAPI 3.0.3 specs and serve Swagger UI documentation
- **CLI generators** - Scaffold procedures, schemas, models, middleware, guards, and more
- **HMR dev server** - Fast hot module replacement with sub-second reload times
- **Modern stack** - Built on Fastify, tRPC, Prisma 7, and Zod

**Why Choose VeloxTS?**

If you're building a full-stack TypeScript application and want:
- Type safety across your entire stack without code generation
- Convention-driven development that reduces boilerplate
- The flexibility to expose both internal (tRPC) and external (REST) APIs from the same code
- Laravel-inspired elegance in TypeScript

Then VeloxTS is designed for you.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** installed ([download here](https://nodejs.org/))
- **Basic TypeScript knowledge** - Familiarity with types, interfaces, and async/await
- **Command-line experience** - Comfortable running terminal commands
- **A package manager** - npm, pnpm, or yarn

## Quick Start

Create a new VeloxTS project with a single command:

```bash
# Using npx (recommended)
npx create-velox-app my-app

# Or with pnpm
pnpm create velox-app my-app

# Or with yarn
yarn create velox-app my-app
```

### Available Templates

Choose from 5 project templates:

| Template | Command | Description |
|----------|---------|-------------|
| **Default** | `npx create-velox-app my-app` | REST API with user CRUD procedures |
| **Auth** | `npx create-velox-app my-app --auth` | Full authentication (JWT, sessions, guards) |
| **tRPC** | `npx create-velox-app my-app --trpc` | tRPC-only setup for internal APIs |
| **RSC** | `npx create-velox-app my-app --rsc` | Full-stack React Server Components with Vinxi |
| **RSC + Auth** | `npx create-velox-app my-app --rsc-auth` | RSC with JWT authentication |

### First Run

Navigate to your project and start the development server:

```bash
cd my-app
npm run db:push      # Set up the database
npm run dev          # Start dev server with HMR
```

Your VeloxTS application is now running at `http://localhost:3030`

Test the API:

```bash
curl http://localhost:3030/api/health
```

You should see:

```json
{
  "status": "ok",
  "timestamp": "2025-01-02T12:00:00.000Z"
}
```

## Project Structure

The scaffolder generates a well-organized project:

```
my-app/
├── src/
│   ├── config/
│   │   └── app.ts           # Application configuration
│   ├── database/
│   │   └── index.ts         # Prisma client with driver adapter
│   ├── procedures/
│   │   ├── health.ts        # Health check endpoint
│   │   ├── users.ts         # User CRUD procedures
│   │   └── index.ts         # Procedure exports
│   ├── schemas/
│   │   └── user.ts          # Zod validation schemas
│   └── index.ts             # Application entry point
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── prisma.config.ts     # Prisma 7 configuration
├── .env                     # Environment variables
├── package.json
└── tsconfig.json
```

**Auth template adds:**
- `src/procedures/auth.ts` - Login, register, refresh, logout
- `src/guards/` - Authentication guards
- JWT and session configuration

**RSC template adds:**
- `app/` - React Server Components
- `app/routes/` - File-based routing
- `app/components/` - React components
- Server actions integration

## Your First API

Let's examine how VeloxTS procedures work.

### Defining Schemas

```typescript
// src/schemas/user.ts
import { z } from '@veloxts/validation';

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateUserInput = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export type User = z.infer<typeof UserSchema>;
```

### Defining Procedures

```typescript
// src/procedures/users.ts
import { procedure, procedures } from '@veloxts/router';
import { z } from '@veloxts/validation';
import { UserSchema, CreateUserInput } from '../schemas/user.js';

export const userProcedures = procedures('users', {
  // GET /api/users/:id
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUniqueOrThrow({ where: { id: input.id } });
    }),

  // GET /api/users
  listUsers: procedure()
    .input(z.object({
      page: z.number().optional(),
      limit: z.number().optional(),
    }).optional())
    .output(z.array(UserSchema))
    .query(async ({ input, ctx }) => {
      const limit = input?.limit ?? 10;
      const skip = ((input?.page ?? 1) - 1) * limit;
      return ctx.db.user.findMany({ skip, take: limit });
    }),

  // POST /api/users
  createUser: procedure()
    .input(CreateUserInput)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),

  // PUT /api/users/:id
  updateUser: procedure()
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().optional(),
      email: z.string().email().optional(),
    }))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.db.user.update({ where: { id }, data });
    }),

  // DELETE /api/users/:id
  deleteUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.user.delete({ where: { id: input.id } });
    }),
});
```

### REST Naming Conventions

VeloxTS infers HTTP methods from procedure names:

| Prefix | Method | Path | Example |
|--------|--------|------|---------|
| `get*` | GET | `/:id` | `getUser` → `GET /users/:id` |
| `list*`, `find*` | GET | `/` | `listUsers` → `GET /users` |
| `create*`, `add*` | POST | `/` | `createUser` → `POST /users` |
| `update*`, `edit*` | PUT | `/:id` | `updateUser` → `PUT /users/:id` |
| `patch*` | PATCH | `/:id` | `patchUser` → `PATCH /users/:id` |
| `delete*`, `remove*` | DELETE | `/:id` | `deleteUser` → `DELETE /users/:id` |

See [REST-NAMING-CONVENTIONS.md](./REST-NAMING-CONVENTIONS.md) for full documentation.

### Testing Your API

```bash
# Create a user
curl -X POST http://localhost:3030/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'

# List users
curl http://localhost:3030/api/users

# Get user by ID
curl http://localhost:3030/api/users/YOUR_USER_ID

# Update user
curl -X PUT http://localhost:3030/api/users/YOUR_USER_ID \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Updated"}'

# Delete user
curl -X DELETE http://localhost:3030/api/users/YOUR_USER_ID
```

## Authentication

VeloxTS provides comprehensive authentication out of the box.

### JWT Authentication

```typescript
import { procedure, procedures } from '@veloxts/router';
import { authenticated, hasRole } from '@veloxts/auth';

export const protectedProcedures = procedures('protected', {
  // Requires valid JWT token
  getProfile: procedure()
    .guard(authenticated)
    .query(async ({ ctx }) => {
      return ctx.user;  // User attached by auth middleware
    }),

  // Requires admin role
  adminAction: procedure()
    .guard(hasRole('admin'))
    .mutation(async ({ ctx, input }) => {
      // Only admins can access
    }),
});
```

### Auth Endpoints (with --auth template)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register` | POST | Create new user account |
| `/auth/login` | POST | Authenticate and get tokens |
| `/auth/refresh` | POST | Refresh access token |
| `/auth/logout` | POST | Invalidate session |
| `/auth/me` | GET | Get current user profile |

### Session-Based Auth

```typescript
import { sessionMiddleware, loginSession, logoutSession } from '@veloxts/auth';

// Configure session middleware
const session = sessionMiddleware({
  secret: process.env.SESSION_SECRET!,
  cookie: { secure: true, httpOnly: true, sameSite: 'lax' },
});

// In your login procedure
await loginSession(ctx.session, { id: user.id, email: user.email });

// In your logout procedure
await logoutSession(ctx.session);
```

## Resource API (Context-Dependent Outputs)

Return different fields based on access level using the Resource API:

```typescript
import { resourceSchema, resource, procedure, procedures } from '@veloxts/router';
import { authenticated, hasRole } from '@veloxts/auth';
import { z } from '@veloxts/validation';

// Define field visibility
const UserSchema = resourceSchema()
  .public('id', z.string().uuid())           // Everyone sees this
  .public('name', z.string())                // Everyone sees this
  .authenticated('email', z.string().email()) // Logged-in users see this
  .admin('internalNotes', z.string().nullable()) // Admins only
  .build();

export const userProcedures = procedures('users', {
  // Public endpoint - returns { id, name }
  getPublicProfile: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUniqueOrThrow({ where: { id: input.id } });
      return resource(user, UserSchema).forAnonymous();
    }),

  // Authenticated - returns { id, name, email }
  getProfile: procedure()
    .guard(authenticated)
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUniqueOrThrow({ where: { id: input.id } });
      return resource(user, UserSchema).forAuthenticated();
    }),

  // Admin - returns all fields
  getFullUser: procedure()
    .guard(hasRole('admin'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUniqueOrThrow({ where: { id: input.id } });
      return resource(user, UserSchema).forAdmin();
    }),
});
```

**When to use `.output()` vs `.resource()`:**

| Scenario | Method |
|----------|--------|
| Same fields for all users | `.output(zodSchema)` |
| Different fields per role | `resourceSchema()` + `resource()` |

## CLI Generators

Use `velox make` to scaffold common patterns:

```bash
# Generate a procedure
velox make procedure posts --crud

# Generate a schema
velox make schema post

# Generate a model (Prisma + schema + procedure)
velox make model comment

# Generate middleware
velox make middleware logging --timing

# Generate a guard
velox make guard ownership

# Generate a service
velox make service email

# Generate an exception
velox make exception NotFound --http
```

Available generators:
- `procedure` (p) - API procedures
- `schema` (s) - Zod validation schemas
- `model` (m) - Full model with Prisma, schema, procedure
- `middleware` (mw) - Fastify middleware
- `guard` (g) - Authentication guards
- `policy` (pol) - Authorization policies
- `service` (svc) - Business logic services
- `exception` (ex) - Custom exceptions
- `resource` (r) - Full REST resource
- `mail` (em) - Email templates
- `storage` (st) - Storage configuration

## OpenAPI Documentation

Auto-generate OpenAPI specs and serve Swagger UI:

### Programmatic Generation

```typescript
import { generateOpenApiSpec } from '@veloxts/router';

const spec = generateOpenApiSpec([userProcedures, postProcedures], {
  info: {
    title: 'My API',
    version: '1.0.0',
    description: 'A VeloxTS-powered API',
  },
  prefix: '/api',
  servers: [{ url: 'http://localhost:3030' }],
});
```

### Swagger UI Plugin

```typescript
import { swaggerUIPlugin } from '@veloxts/router';

app.server.register(swaggerUIPlugin, {
  routePrefix: '/docs',
  collections: [userProcedures],
  openapi: {
    info: { title: 'My API', version: '1.0.0' },
  },
});

// Available at:
// - /docs - Swagger UI interface
// - /docs/openapi.json - Raw OpenAPI spec
```

### CLI Generation

```bash
velox openapi generate --output ./openapi.json --title "My API" --version "1.0.0"
```

## Database Setup

VeloxTS uses Prisma 7 for database management.

### Prisma 7 Configuration

Prisma 7 requires a `prisma.config.ts` file:

```typescript
// prisma/prisma.config.ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: { url: process.env.DATABASE_URL },
});
```

### Driver Adapters

Prisma 7 uses driver adapters for database connections:

```typescript
// src/database/index.ts
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
export const db = new PrismaClient({ adapter });
```

See [PRISMA-7-SETUP.md](./PRISMA-7-SETUP.md) for detailed configuration.

### Database Commands

```bash
npm run db:generate   # Regenerate Prisma client
npm run db:push       # Push schema changes (dev)
npm run db:migrate    # Create and run migrations
```

## Development Workflow

### Available Scripts

```bash
# Development
npm run dev              # Start with HMR (port 3030)

# Build
npm run build            # Compile TypeScript
npm run start            # Run production build

# Database
npm run db:push          # Push schema to database
npm run db:generate      # Regenerate Prisma client

# Quality
npm run type-check       # Validate TypeScript
npm run lint             # Run linter
npm run test             # Run tests
```

### HMR Development

The dev server supports hot module replacement:

```bash
velox dev              # Default with HMR
velox dev --no-hmr     # Disable HMR
velox dev --verbose    # Detailed HMR diagnostics
velox dev --port 4000  # Custom port
```

Configure HMR boundaries in `package.json`:

```json
{
  "hotHook": {
    "boundaries": [
      "src/procedures/**/*.ts",
      "src/schemas/**/*.ts"
    ]
  }
}
```

## Frontend Integration

### Type-Safe Client

```typescript
import { createClient } from '@veloxts/client';
import type { AppRouter } from '../server/src';

const api = createClient<AppRouter>({
  baseUrl: 'http://localhost:3030',
});

// Fully typed API calls
const user = await api.users.getUser({ id: 'uuid' });
//    ^? User | null (inferred from backend)

const newUser = await api.users.createUser({
  name: 'Charlie',
  email: 'charlie@example.com',
});
```

### tRPC Integration

```typescript
import { trpc, appRouter, registerTRPCPlugin } from '@veloxts/router';

const t = trpc();
const router = appRouter(t, [userProcedures]);

await registerTRPCPlugin(app.server, { router, prefix: '/trpc' });

export type AppRouter = typeof router;
```

## Ecosystem Packages

VeloxTS provides Laravel-style infrastructure packages:

| Package | Description |
|---------|-------------|
| `@veloxts/cache` | Multi-driver caching (memory, Redis) |
| `@veloxts/queue` | Background job processing (sync, BullMQ) |
| `@veloxts/mail` | Email sending (SMTP, Resend, React Email) |
| `@veloxts/storage` | File storage (local, S3/R2) |
| `@veloxts/scheduler` | Cron task scheduling |
| `@veloxts/events` | Real-time broadcasting (WebSocket, SSE) |

Example usage:

```typescript
// Caching
await ctx.cache.put('user:123', user, '30m');
const user = await ctx.cache.get('user:123');

// Queues
await dispatch(SendWelcomeEmail, { userId: user.id });

// Storage
await ctx.storage.put('avatars/user.jpg', buffer);
const url = await ctx.storage.url('avatars/user.jpg');
```

## Deployment

### Environment Variables

```env
# Application
NODE_ENV=production
PORT=3030
HOST=0.0.0.0

# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Authentication (if using --auth)
JWT_SECRET="your-secret-at-least-32-chars"
JWT_REFRESH_SECRET="another-secret-at-least-64-chars"
SESSION_SECRET="session-secret-at-least-32-chars"
```

### Production Build

```bash
npm run build
npm run start
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY prisma ./prisma
RUN npx prisma generate
EXPOSE 3030
CMD ["node", "dist/index.js"]
```

## Troubleshooting

### Port Already in Use

```bash
# Change port in .env
PORT=3031
```

### Database Connection Error

Verify `DATABASE_URL` in `.env`. For Prisma 7, ensure you're using driver adapters.

### Type Errors After Schema Changes

```bash
npm run db:generate
```

### Import Errors

```bash
npm install
```

## Next Steps

1. **Explore packages:** Each package has a `GUIDE.md` with detailed documentation
2. **Try templates:** Experiment with `--auth`, `--rsc`, and `--rsc-auth` templates
3. **Generate code:** Use `velox make` to scaffold your API
4. **Add documentation:** Set up OpenAPI with `swaggerUIPlugin`

## Resources

- **GitHub:** [github.com/veloxts/velox-ts-framework](https://github.com/veloxts/velox-ts-framework)
- **Package Docs:** See `GUIDE.md` in each package directory
- **REST Conventions:** [REST-NAMING-CONVENTIONS.md](./REST-NAMING-CONVENTIONS.md)
- **Prisma 7 Setup:** [PRISMA-7-SETUP.md](./PRISMA-7-SETUP.md)
- **Deployment:** [DEPLOYMENT.md](./DEPLOYMENT.md)

---

Happy coding with VeloxTS!
