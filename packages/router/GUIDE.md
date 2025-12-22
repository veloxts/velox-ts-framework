# @veloxts/router

Procedure-based routing with hybrid tRPC and REST adapters.

## Quick Start

```typescript
import { procedure, defineProcedures } from '@veloxts/router';
import { z } from '@veloxts/validation';

export const userProcedures = defineProcedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUnique({ where: { id: input.id } });
    }),

  createUser: procedure()
    .input(CreateUserSchema)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),
});
```

## Procedure API

- `.input(schema)` - Validate input with Zod
- `.output(schema)` - Validate output with Zod
- `.use(middleware)` - Add middleware
- `.guard(guard)` - Add authorization guard
- `.rest({ method, path })` - Override REST path
- `.query(handler)` - Finalize as read operation
- `.mutation(handler)` - Finalize as write operation

## REST Naming Conventions

Procedure names auto-map to HTTP methods:

| Prefix | Method | Path |
|--------|--------|------|
| `get*` | GET | `/:id` |
| `list*` | GET | `/` |
| `create*` | POST | `/` |
| `update*` | PUT | `/:id` |
| `patch*` | PATCH | `/:id` |
| `delete*` | DELETE | `/:id` |

## Registering Routes

```typescript
import { registerRestRoutes } from '@veloxts/router';

await registerRestRoutes(app.server, {
  prefix: '/api',
  procedures: { users: userProcedures },
});
```

## tRPC Adapter

```typescript
import { trpc, appRouter, registerTRPCPlugin } from '@veloxts/router';

const t = trpc();
const router = appRouter(t, [userProcedures]);

await registerTRPCPlugin(app.server, { router, prefix: '/trpc' });

export type AppRouter = typeof router;
```

## Middleware

```typescript
const getUser = procedure()
  .use(async ({ ctx, next }) => {
    console.log(`Request: ${ctx.request.url}`);
    return next();
  })
  .query(handler);
```

## Learn More

See [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for complete documentation.
