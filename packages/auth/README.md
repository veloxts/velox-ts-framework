# @veloxts/auth

**Pre-Alpha Notice:** This framework is in early development (v0.5.x). APIs are subject to change. Not recommended for production use.

## What is this?

Authentication and authorization package for the VeloxTS Framework, providing JWT, sessions, guards, and auth adapters.

## Part of @veloxts/velox

This package is part of the VeloxTS Framework. For the complete framework experience, install:

```bash
npm install @veloxts/velox
```

Visit [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for the complete framework documentation.

## Standalone Installation

```bash
npm install @veloxts/auth
```

Required peer dependencies:

```bash
npm install @veloxts/core @veloxts/router fastify @fastify/cookie
```

## Documentation

For detailed documentation, usage examples, and API reference, see [GUIDE.md](./GUIDE.md).

## Quick Example

```typescript
import { veloxApp, defineProcedures, procedure, rest, z } from '@veloxts/velox';
import { jwtManager, authMiddleware } from '@veloxts/auth';

const jwt = jwtManager({
  secret: process.env.JWT_SECRET!,
  accessTokenExpiry: '15m',
});

const auth = authMiddleware({ jwt, userLoader: async (id) => db.user.findUnique({ where: { id } }) });

const profileProcedures = defineProcedures('profile', {
  getProfile: procedure()
    .use(auth.requireAuth())
    .output(z.object({ id: z.string(), name: z.string(), email: z.string() }))
    .query(({ ctx }) => ctx.user),
});

const app = await veloxApp({ port: 3000 });
app.routes(rest([profileProcedures], { prefix: '/api' }));
await app.start();
// GET /api/profile -> Returns authenticated user
```

## Learn More

- [Full Documentation](./GUIDE.md)
- [VeloxTS Framework](https://www.npmjs.com/package/@veloxts/velox)
- [GitHub Repository](https://github.com/veloxts/velox-ts-framework)

## License

MIT
