# @veloxts/router

> **Alpha Release** - This framework is in early development. APIs may change between versions. Not recommended for production use yet.

Procedure-based routing with hybrid tRPC and REST adapters for the VeloxTS framework.

## Installation

```bash
npm install @veloxts/router @veloxts/validation
# or
pnpm add @veloxts/router @veloxts/validation
```

## Quick Start

```typescript
import { procedure, defineProcedures } from '@veloxts/router';
import { z } from '@veloxts/validation';

// Define procedures
export const userProcedures = defineProcedures('users', {
  // GET /users/:id
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUnique({ where: { id: input.id } });
    }),

  // POST /users
  createUser: procedure()
    .input(CreateUserSchema)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),
});
```

## Core Concepts

### Procedures

A **procedure** is the fundamental abstraction in VeloxTS. It defines:

1. **Input schema** - What data the endpoint expects (validated with Zod)
2. **Output schema** - What data the endpoint returns (validated with Zod)
3. **Handler** - The business logic (query for reads, mutation for writes)
4. **Middleware** - Optional request processing (auth, logging, etc.)

Procedures are type-safe from backend to frontend with zero code generation.

### Procedure Builder API

The fluent builder pattern enables composable, type-safe endpoint definitions:

```typescript
procedure()
  .input(schema)      // Define input validation
  .output(schema)     // Define output validation
  .use(middleware)    // Add middleware (optional)
  .rest(config)       // Override REST mapping (optional)
  .query(handler)     // Define read handler (GET)
  // OR
  .mutation(handler)  // Define write handler (POST/PUT/DELETE)
```

## Defining Procedures

### Query Procedures (Read Operations)

Use `.query()` for operations that read data:

```typescript
const userProcedures = defineProcedures('users', {
  // Get single user
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
      });

      if (!user) {
        throw new NotFoundError('User', input.id);
      }

      return user;
    }),

  // List users with pagination
  listUsers: procedure()
    .input(paginationInputSchema.optional())
    .output(z.object({
      data: z.array(UserSchema),
      meta: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
      }),
    }))
    .query(async ({ input, ctx }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        ctx.db.user.findMany({ skip, take: limit }),
        ctx.db.user.count(),
      ]);

      return { data, meta: { page, limit, total } };
    }),
});
```

### Mutation Procedures (Write Operations)

Use `.mutation()` for operations that modify data:

```typescript
const userProcedures = defineProcedures('users', {
  // Create user
  createUser: procedure()
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),

  // PUT /api/users/:id - Full update
  updateUser: procedure()
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1),
      email: z.string().email(),
    }))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.db.user.update({
        where: { id },
        data,
      });
    }),

  // PATCH /api/users/:id - Partial update
  patchUser: procedure()
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
    }))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.db.user.update({
        where: { id },
        data,
      });
    }),

  // DELETE /api/users/:id
  deleteUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.user.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
```

## REST Endpoint Generation

VeloxTS automatically generates REST endpoints from procedure names using **naming conventions**:

### Supported Naming Patterns

| Procedure Name | HTTP Method | REST Path | Status Code | Notes |
|---------------|-------------|-----------|-------------|-------|
| `getUser` | GET | `/users/:id` | 200 | Single resource |
| `listUsers` | GET | `/users` | 200 | Collection |
| `findUsers` | GET | `/users` | 200 | Search/filter |
| `createUser` | POST | `/users` | 201 | Create resource |
| `addUser` | POST | `/users` | 201 | Create resource |
| `updateUser` | PUT | `/users/:id` | 200 | Full update |
| `editUser` | PUT | `/users/:id` | 200 | Full update |
| `patchUser` | PATCH | `/users/:id` | 200 | Partial update |
| `deleteUser` | DELETE | `/users/:id` | 200/204 | Delete resource |
| `removeUser` | DELETE | `/users/:id` | 200/204 | Delete resource |

### Input Gathering

Different HTTP methods gather inputs from different request parts:

- **GET/DELETE**: `params` (route parameters) + `query` (query string)
- **POST**: `body` only
- **PUT/PATCH**: `params` (route parameters) + `body`

### Status Codes

- **GET**: 200 OK
- **POST**: 201 Created
- **PUT/PATCH**: 200 OK
- **DELETE**: 200 OK (with response body) or 204 No Content (if handler returns null)

### Custom REST Paths

Override naming conventions when needed:

```typescript
const userProcedures = defineProcedures('users', {
  // Custom path for search endpoint
  searchUsers: procedure()
    .rest({ method: 'GET', path: '/users/search' })
    .input(z.object({ q: z.string() }))
    .output(z.array(UserSchema))
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findMany({
        where: {
          OR: [
            { name: { contains: input.q } },
            { email: { contains: input.q } },
          ],
        },
      });
    }),

  // Custom path for password reset
  resetPassword: procedure()
    .rest({ method: 'POST', path: '/auth/password-reset' })
    .input(z.object({ email: z.string().email() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      // Send password reset email
      return { success: true };
    }),
});
```

## Registering Routes

### REST Adapter

Register REST routes with your VeloxTS app:

```typescript
import { createVeloxApp } from '@veloxts/core';
import { registerRestRoutes } from '@veloxts/router';
import { userProcedures } from './procedures/users';

const app = await createVeloxApp({ port: 3210 });

// Register REST routes
await registerRestRoutes(app.server, {
  prefix: '/api',
  procedures: {
    users: userProcedures,
  },
});

await app.start();
```

This generates the following endpoints:

```
GET    /api/users/:id      (getUser)
GET    /api/users          (listUsers)
POST   /api/users          (createUser)
GET    /api/users/search   (searchUsers)
```

### tRPC Adapter

For type-safe internal API calls from your frontend:

```typescript
import { createAppRouter, registerTRPCPlugin } from '@veloxts/router';
import { userProcedures, postProcedures } from './procedures';

// Create tRPC router
const appRouter = createAppRouter({
  users: userProcedures,
  posts: postProcedures,
});

// Register tRPC plugin
await registerTRPCPlugin(app.server, {
  router: appRouter,
  prefix: '/trpc',
});

// Export type for frontend
export type AppRouter = typeof appRouter;
```

Frontend usage:

```typescript
import { createClient } from '@veloxts/client';
import type { AppRouter } from '../server';

const api = createClient<AppRouter>({ baseUrl: '/api' });

// Fully typed calls
const user = await api.users.getUser({ id: '123' });
//    ^? User (inferred from UserSchema)
```

## Middleware

Add cross-cutting concerns with middleware:

```typescript
const loggerMiddleware: MiddlewareFunction = async ({ ctx, next }) => {
  const start = Date.now();
  console.log(`[${ctx.request.method}] ${ctx.request.url}`);

  const result = await next();

  const duration = Date.now() - start;
  console.log(`[${ctx.request.method}] ${ctx.request.url} - ${duration}ms`);

  return result;
};

const userProcedures = defineProcedures('users', {
  getUser: procedure()
    .use(loggerMiddleware)
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUnique({ where: { id: input.id } });
    }),
});
```

## Type Inference

VeloxTS automatically infers types throughout the procedure chain:

```typescript
const userProcedures = defineProcedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      // input is typed as { id: string }
      //        ^? { id: string }

      // ctx is typed as BaseContext (with extensions)
      //     ^? BaseContext & { db: PrismaClient }

      // Return type must match UserSchema
      return ctx.db.user.findUnique({ where: { id: input.id } });
      //     ^? User | null
    }),
});

// Frontend infers the complete type
const user = await api.users.getUser({ id: '123' });
//    ^? User | null
```

### Type Helpers

Extract types from procedures:

```typescript
import type {
  InferProcedureInput,
  InferProcedureOutput,
  InferProcedures,
} from '@veloxts/router';

// Infer input type
type GetUserInput = InferProcedureInput<typeof userProcedures.getUser>;
// { id: string }

// Infer output type
type GetUserOutput = InferProcedureOutput<typeof userProcedures.getUser>;
// User | null

// Infer all procedures
type UserProcedures = InferProcedures<typeof userProcedures>;
```

## Context System

Procedures receive a context object with request-scoped state:

### Base Context

```typescript
interface BaseContext {
  request: FastifyRequest;
  reply: FastifyReply;
}
```

### Extending Context

Plugins can extend context via declaration merging:

```typescript
import type { PrismaClient } from '@prisma/client';

declare module '@veloxts/core' {
  interface BaseContext {
    db: PrismaClient;       // Added by @veloxts/orm
    user?: User;            // Added by @veloxts/auth (v1.1+)
  }
}

// Now all procedures have ctx.db and ctx.user
const userProcedures = defineProcedures('users', {
  getProfile: procedure()
    .output(UserSchema)
    .query(async ({ ctx }) => {
      // ctx.db is available (typed as PrismaClient)
      // ctx.user is available (typed as User | undefined)
      if (!ctx.user) {
        throw new UnauthorizedError('Must be logged in');
      }

      return ctx.db.user.findUnique({
        where: { id: ctx.user.id },
      });
    }),
});
```

## Practical Examples

### Complete CRUD API

```typescript
import { defineProcedures, procedure } from '@veloxts/router';
import { z, paginationInputSchema } from '@veloxts/validation';
import { NotFoundError } from '@veloxts/core';

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const CreateUserInput = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export const userProcedures = defineProcedures('users', {
  // GET /users/:id
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema.nullable())
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUnique({ where: { id: input.id } });
    }),

  // GET /users
  listUsers: procedure()
    .input(paginationInputSchema.optional())
    .output(z.object({
      data: z.array(UserSchema),
      meta: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
      }),
    }))
    .query(async ({ input, ctx }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        ctx.db.user.findMany({ skip, take: limit }),
        ctx.db.user.count(),
      ]);

      return { data, meta: { page, limit, total } };
    }),

  // POST /users
  createUser: procedure()
    .input(CreateUserInput)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),

  // PUT /users/:id
  updateUser: procedure()
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100),
      email: z.string().email(),
    }))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.db.user.update({ where: { id }, data });
    }),

  // DELETE /users/:id
  deleteUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.user.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
```

### Search with Custom Path

```typescript
const postProcedures = defineProcedures('posts', {
  // GET /posts/search?q=keyword&published=true
  searchPosts: procedure()
    .rest({ method: 'GET', path: '/posts/search' })
    .input(z.object({
      q: z.string().min(1),
      published: z.boolean().optional(),
    }))
    .output(z.array(PostSchema))
    .query(async ({ input, ctx }) => {
      return ctx.db.post.findMany({
        where: {
          AND: [
            {
              OR: [
                { title: { contains: input.q } },
                { content: { contains: input.q } },
              ],
            },
            input.published !== undefined
              ? { published: input.published }
              : {},
          ],
        },
      });
    }),
});
```

### Authentication Middleware

```typescript
const authMiddleware: MiddlewareFunction = async ({ ctx, next }) => {
  const token = ctx.request.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new UnauthorizedError('Missing authentication token');
  }

  // Verify token and attach user to context
  const user = await verifyToken(token);
  (ctx as ExtendedContext).user = user;

  return next();
};

const protectedProcedures = defineProcedures('protected', {
  getProfile: procedure()
    .use(authMiddleware)
    .output(UserSchema)
    .query(async ({ ctx }) => {
      // ctx.user is guaranteed to exist after authMiddleware
      const user = (ctx as ExtendedContext).user;
      return ctx.db.user.findUnique({ where: { id: user.id } });
    }),
});
```

## Error Handling

Procedures integrate with VeloxTS error classes:

```typescript
import {
  VeloxError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
} from '@veloxts/core';

const userProcedures = defineProcedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
      });

      if (!user) {
        // Returns 404 with structured error
        throw new NotFoundError('User', input.id);
      }

      return user;
    }),

  deleteUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await ctx.db.user.delete({ where: { id: input.id } });
        return { success: true };
      } catch (error) {
        // Handle Prisma errors
        if (error.code === 'P2025') {
          throw new NotFoundError('User', input.id);
        }
        throw new VeloxError('Failed to delete user', 500);
      }
    }),
});
```

## Configuration

### Route Summary

Get a summary of generated routes:

```typescript
import { getRouteSummary } from '@veloxts/router';

const summary = getRouteSummary({
  users: userProcedures,
  posts: postProcedures,
});

console.log(summary);
// [
//   { method: 'GET', path: '/users/:id', procedure: 'users.getUser' },
//   { method: 'GET', path: '/users', procedure: 'users.listUsers' },
//   { method: 'POST', path: '/users', procedure: 'users.createUser' },
//   { method: 'GET', path: '/posts/:id', procedure: 'posts.getPost' },
//   ...
// ]
```

### Route Prefix

Apply a common prefix to all routes:

```typescript
await registerRestRoutes(app.server, {
  prefix: '/api/v1',  // All routes start with /api/v1
  procedures: {
    users: userProcedures,
  },
});

// Generates: GET /api/v1/users/:id
```

## Current Features

**Included:**
- Query procedures (GET)
- Mutation procedures (POST, PUT, PATCH, DELETE)
- Full REST verb support with smart input gathering
- Proper HTTP status codes (201, 204, etc.)
- Input/output validation with Zod
- Naming convention-based REST mapping
- Custom REST path overrides
- tRPC adapter for type-safe internal calls
- Middleware support

**Planned for Future Releases:**
- Nested resource routing
- OpenAPI/Swagger documentation generation
- Rate limiting middleware
- Request/response transformation hooks

## Related Packages

- [@veloxts/core](/packages/core) - Core framework with context and errors
- [@veloxts/validation](/packages/validation) - Zod schemas for input/output
- [@veloxts/orm](/packages/orm) - Database integration (provides ctx.db)
- [@veloxts/client](/packages/client) - Type-safe frontend API client

## TypeScript Support

All exports are fully typed with comprehensive JSDoc documentation. The package includes type definitions and declaration maps for excellent IDE support.

## License

MIT
