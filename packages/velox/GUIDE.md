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

## Ecosystem Presets

Automatically configure ecosystem packages based on your environment:

```typescript
import { veloxApp, usePresets } from '@veloxts/velox';

const app = await veloxApp({ port: 3030 });

// Auto-configure based on NODE_ENV
await usePresets(app);

await app.start();
```

### Environment Defaults

| Package | Development | Test | Production |
|---------|-------------|------|------------|
| Cache | memory | memory | redis |
| Queue | sync | sync | bullmq |
| Mail | log | log | resend |
| Storage | local | local | s3 |
| Events | ws | ws | ws + redis |

### Production Environment Variables

For production, set these environment variables:

```bash
REDIS_URL=redis://localhost:6379
RESEND_API_KEY=re_xxxxx
S3_BUCKET=my-bucket
AWS_REGION=us-east-1  # optional, defaults to us-east-1
```

### Custom Overrides

```typescript
await usePresets(app, {
  overrides: {
    mail: { driver: 'smtp', config: { host: 'localhost' } },
    cache: { config: { maxSize: 5000 } },
  },
});
```

### Selective Registration

```typescript
// Only register specific packages
await usePresets(app, { only: ['cache', 'queue'] });

// Exclude specific packages
await usePresets(app, { except: ['scheduler'] });
```

## Learn More

- [GitHub Repository](https://github.com/veloxts/velox-ts-framework)
- [@veloxts/router](https://www.npmjs.com/package/@veloxts/router) - Procedures
- [@veloxts/client](https://www.npmjs.com/package/@veloxts/client) - Frontend client
