# @veloxts/auth

Authentication and authorization for VeloxTS Framework.

## Features

- Session management (cookie-based)
- JWT authentication (stateless tokens)
- Password hashing (bcrypt)
- CSRF protection
- Guards (role/permission-based)
- Rate limiting

## Session Authentication

```typescript
import { sessionMiddleware } from '@veloxts/auth';

const session = sessionMiddleware({
  secret: process.env.SESSION_SECRET!,
  expiration: { ttl: 86400, sliding: true },
});

const getProfile = procedure
  .use(session.requireAuth())
  .query(({ ctx }) => ctx.user);

// Login/Logout
await ctx.session.login(user);
await ctx.session.logout();
```

## JWT Authentication

```typescript
import { jwtManager, authMiddleware } from '@veloxts/auth';

const jwt = jwtManager({
  secret: process.env.JWT_SECRET!,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
});

const auth = authMiddleware({
  jwt: { secret: process.env.JWT_SECRET! },
  userLoader: (userId) => db.user.findUnique({ where: { id: userId } }),
});

const getProfile = procedure
  .use(auth.requireAuth())
  .query(({ ctx }) => ctx.user);
```

## Guards

```typescript
import { hasRole, hasPermission } from '@veloxts/auth';

const adminOnly = procedure
  .use(auth.middleware({ guards: [hasRole('admin')] }))
  .mutation(handler);

const canEdit = procedure
  .use(auth.middleware({ guards: [hasPermission('posts.write')] }))
  .mutation(handler);
```

## Password Hashing

```typescript
import { hashPassword, verifyPassword } from '@veloxts/auth';

const hash = await hashPassword('password', { cost: 12 });
const valid = await verifyPassword('password', hash);
```

## Learn More

See [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for complete documentation.
