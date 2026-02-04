# @veloxts/velox

Complete VeloxTS Framework - batteries included for type-safe, full-stack TypeScript applications.

## Quick Start

```bash
npx create-velox-app my-app
cd my-app
npm run db:push
npm run dev
```

Your API is running at `http://localhost:3030`.

Your web app is running at `http://localhost:8080`.

## Basic Usage

```typescript
import { veloxApp, procedure, procedures, z } from '@veloxts/velox';

const app = await veloxApp({ port: 3030 });

const greetProcedures = procedures('greet', {
  sayHello: procedure()
    .input(z.object({ name: z.string() }))
    .query(({ input }) => `Hello, ${input.name}!`),
});

app.routes([greetProcedures]);
await app.start();
```

## What's Included

- **@veloxts/core** - Application bootstrap, plugins, context, DI
- **@veloxts/validation** - Zod integration and schema utilities
- **@veloxts/orm** - Database plugin and Prisma integration
- **@veloxts/router** - Procedures, REST adapter, tRPC
- **@veloxts/auth** - Authentication and authorization

Separate packages: `@veloxts/client`, `@veloxts/cli`, `create-velox-app`

## Import Patterns

```typescript
// Main export
import { veloxApp, procedure, z } from '@veloxts/velox';

// Subpath imports (better tree-shaking)
import { veloxApp } from '@veloxts/velox/core';
import { procedure } from '@veloxts/velox/router';

// Direct packages (best tree-shaking)
import { veloxApp } from '@veloxts/core';
import { procedure } from '@veloxts/router';
```

## REST Naming Conventions

Procedure names auto-map to HTTP methods:

- `getUser` → GET `/users/:id`
- `listUsers` → GET `/users`
- `createUser` → POST `/users`
- `updateUser` → PUT `/users/:id`
- `deleteUser` → DELETE `/users/:id`

## Type Safety

Types flow from backend to frontend without code generation:

```typescript
// Frontend
import { createClient } from '@veloxts/client';
import type { userProcedures } from '../server/procedures';

const api = createClient<{ users: typeof userProcedures }>({ baseUrl: '/api' });
const user = await api.users.getUser({ id: '123' }); // Fully typed
```

## Resource API (Context-Dependent Outputs)

Return different fields based on user access level:

```typescript
import { resourceSchema, resource, procedure, procedures, z } from '@veloxts/velox';
import { authenticated, hasRole } from '@veloxts/auth';

const UserSchema = resourceSchema()
  .public('id', z.string())
  .public('name', z.string())
  .authenticated('email', z.string())
  .admin('internalNotes', z.string().nullable())
  .build();

const userProcedures = procedures('users', {
  // Public: returns { id, name }
  getPublicProfile: procedure()
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.id } });
      return resource(user, UserSchema).forAnonymous();
    }),

  // Authenticated: returns { id, name, email }
  getProfile: procedure()
    .guard(authenticated)
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.id } });
      return resource(user, UserSchema).forAuthenticated();
    }),

  // Admin: returns all fields
  getFullUser: procedure()
    .guard(hasRole('admin'))
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.id } });
      return resource(user, UserSchema).forAdmin();
    }),
});
```

## Environment-Aware Configuration

VeloxTS provides comprehensive environment-aware configuration through two complementary APIs:

- **`getServerConfig()`** - Server configuration (must be set at app construction)
- **`usePresets()`** - Ecosystem plugin registration (applied after construction)

### Quick Start

```typescript
import { veloxApp, getServerConfig, usePresets } from '@veloxts/velox';

// 1. Environment-aware server config
const app = await veloxApp(getServerConfig());

// 2. Auto-configure ecosystem packages
await usePresets(app);

await app.start();
```

### Server Configuration

`getServerConfig()` returns environment-appropriate server settings:

```typescript
// Auto-detect from NODE_ENV
const config = getServerConfig();

// Explicit environment
const config = getServerConfig('production');

// With overrides
const config = getServerConfig('production', {
  port: 4000,
  fastify: { bodyLimit: 10 * 1048576 },  // 10MB
});

const app = await veloxApp(config);
```

#### Server Defaults by Environment

| Setting | Development | Test | Production |
|---------|-------------|------|------------|
| **Port** | 3030 | 0 (random) | PORT env or 3030 |
| **Host** | localhost | localhost | 0.0.0.0 |
| **Logger** | debug + pretty | false | warn |
| **Trust Proxy** | false | false | true |
| **Body Limit** | default | default | 1MB |
| **Request Timeout** | default | default | 30s |
| **Connection Timeout** | default | default | 60s |

**Why these defaults?**
- **Development:** Pretty logs, localhost binding, no restrictions
- **Test:** Random port (parallel tests), silent logging, localhost isolation
- **Production:** All interfaces, proxy trust, conservative limits, minimal logging

### Ecosystem Presets

`usePresets()` automatically registers ecosystem packages:

```typescript
await usePresets(app);  // Auto-configure based on NODE_ENV

// With overrides
await usePresets(app, {
  overrides: {
    mail: { driver: 'smtp', config: { host: 'localhost' } },
    cache: { config: { maxSize: 5000 } },
  },
});

// Selective registration
await usePresets(app, { only: ['cache', 'queue'] });
await usePresets(app, { except: ['scheduler'] });
```

:::note
**Auth is NOT auto-registered** because it requires secrets. See [Auth Presets](#auth-presets) below.
:::

#### Ecosystem Defaults by Environment

| Package | Development | Test | Production |
|---------|-------------|------|------------|
| Cache | memory | memory | redis |
| Queue | sync | sync | bullmq |
| Mail | log | log | resend |
| Storage | local | local | s3 |
| Events | ws | ws | ws + redis |

**Why these defaults?**
- **Development:** No external services, fast startup, console email logs
- **Test:** Smaller limits, temp storage, sync execution for deterministic tests
- **Production:** Distributed services (Redis, S3, Resend), horizontal scaling

#### Production Environment Variables

```bash
REDIS_URL=redis://localhost:6379
RESEND_API_KEY=re_xxxxxxxxxxxxx
S3_BUCKET=my-bucket
AWS_REGION=us-east-1  # optional, defaults to us-east-1
```

### Auth Presets

Auth requires secrets from environment variables, so it's not auto-registered. Use `getAuthPreset()` to get environment-aware defaults:

```typescript
import { getAuthPreset } from '@veloxts/velox';
import { authPlugin } from '@veloxts/auth';

const authPreset = getAuthPreset();

await app.register(authPlugin({
  jwt: {
    secret: process.env.JWT_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    ...authPreset.jwt,  // accessTokenExpiry, refreshTokenExpiry
  },
  rateLimit: authPreset.rateLimit,
  session: authPreset.session,
  cookie: authPreset.cookie,
}));
```

#### Auth Defaults by Environment

| Setting | Development | Test | Production |
|---------|-------------|------|------------|
| **Access Token Expiry** | 15m | 1h | 5m |
| **Refresh Token Expiry** | 7d | 7d | 1d |
| **Rate Limit (max)** | 100 | 1000 | 5 |
| **Rate Limit (window)** | 15min | 15min | 15min |
| **Session TTL** | 7 days | 1 hour | 4 hours |
| **Session Absolute Timeout** | 7 days | 1 hour | 24 hours |
| **Cookie Secure** | false | false | true |
| **Cookie SameSite** | lax | lax | strict |
| **Cookie HttpOnly** | true | true | true |

**Why these defaults?**
- **Development:** Longer tokens (15m), relaxed rate limits (100), HTTP cookies for localhost
- **Test:** Very relaxed limits (1000), 1-hour tokens, short sessions for isolation
- **Production:** Short tokens (5m), strict rate limits (5), HTTPS-only, strict CSRF protection

### Security Validation

Validate production security requirements at startup:

```typescript
import { validateSecurityOrThrow } from '@veloxts/velox';

// Validates in production, silent in dev/test
validateSecurityOrThrow();

// Or validate auth secrets specifically
import { validateAuthSecrets } from '@veloxts/velox';
validateAuthSecrets();  // Throws if JWT_SECRET missing in production
```

**What it validates:**
- Required environment variables are set (DATABASE_URL)
- JWT secrets are present and meet minimum length (32 characters)
- Secrets are not weak patterns (e.g., "secret", "password")
- Secrets have sufficient entropy

#### Required Production Environment Variables

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=<32+ character secret>
JWT_REFRESH_SECRET=<32+ character secret>
SESSION_SECRET=<32+ character secret>  # If using session middleware
```

**Generate secure secrets:**

```bash
openssl rand -base64 48
```

## Learn More

- [GitHub Repository](https://github.com/veloxts/velox-ts-framework)
- [@veloxts/router](https://www.npmjs.com/package/@veloxts/router) - Procedures
- [@veloxts/client](https://www.npmjs.com/package/@veloxts/client) - Frontend client
