# @veloxts/velox

Complete VeloxTS Framework - batteries included for type-safe, full-stack TypeScript applications.

## Quick Start

```bash
npx create-velox-app my-app
cd my-app
npm run db:migrate
npm run dev
```

Or use directly:

```typescript
import { veloxApp, procedure, defineProcedures, z } from '@veloxts/velox';

const app = await veloxApp({ port: 3030 });

const greetProcedures = defineProcedures('greet', {
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

## Learn More

- [GitHub Repository](https://github.com/veloxts/velox-ts-framework)
- [@veloxts/router](https://www.npmjs.com/package/@veloxts/router) - Procedures
- [@veloxts/client](https://www.npmjs.com/package/@veloxts/client) - Frontend client
