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

const getProfile = procedure()
  .use(session.required())
  .query(({ ctx }) => ctx.user);

const publicPage = procedure()
  .use(session.optional())
  .query(({ ctx }) => ({ user: ctx.user ?? null }));

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

const getProfile = procedure()
  .use(auth.required())
  .query(({ ctx }) => ctx.user);

const publicEndpoint = procedure()
  .use(auth.optional())
  .query(({ ctx }) => ({ user: ctx.user ?? null }));
```

## Guards

```typescript
import { authenticated, hasRole, hasPermission } from '@veloxts/auth';

// Require authentication
const getProfile = procedure()
  .guard(authenticated)
  .query(({ ctx }) => ctx.user);

// Require admin role
const adminOnly = procedure()
  .guard(hasRole('admin'))
  .mutation(handler);

// Require specific permission
const canEdit = procedure()
  .guard(hasPermission('posts.write'))
  .mutation(handler);

// Chain multiple guards (all must pass)
const adminWithPermission = procedure()
  .guard(authenticated)
  .guard(hasRole('admin'))
  .mutation(handler);
```

## Resource API Integration

Guards work seamlessly with the Resource API for context-dependent outputs:

```typescript
import { resource, resourceSchema } from '@veloxts/router';
import { authenticatedNarrow, adminNarrow } from '@veloxts/auth';

const UserSchema = resourceSchema()
  .public('id', z.string())
  .public('name', z.string())
  .authenticated('email', z.string())
  .admin('internalNotes', z.string().nullable())
  .build();

// Anonymous - returns { id, name }
const getPublicUser = procedure()
  .query(async ({ input, ctx }) => {
    const user = await ctx.db.user.findUnique({ where: { id: input.id } });
    return resource(user, UserSchema).forAnonymous();
  });

// Authenticated - returns { id, name, email }
const getUser = procedure()
  .guardNarrow(authenticatedNarrow)
  .query(async ({ input, ctx }) => {
    const user = await ctx.db.user.findUnique({ where: { id: input.id } });
    return resource(user, UserSchema).for(ctx); // Auto-detects level
  });

// Admin - returns all fields
const getFullUser = procedure()
  .guardNarrow(adminNarrow)
  .query(async ({ input, ctx }) => {
    const user = await ctx.db.user.findUnique({ where: { id: input.id } });
    return resource(user, UserSchema).forAdmin();
  });
```

## Password Hashing

```typescript
import { hashPassword, verifyPassword, passwordHasher, DEFAULT_HASH_CONFIG } from '@veloxts/auth';

// Simple usage (uses DEFAULT_HASH_CONFIG: bcrypt, 12 rounds)
const hash = await hashPassword('password');
const valid = await verifyPassword('password', hash);

// Custom configuration
const hasher = passwordHasher({
  ...DEFAULT_HASH_CONFIG,
  bcryptRounds: 14, // Increase for higher security
});
const customHash = await hasher.hash('password');
```

## Learn More

See [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for complete documentation.
