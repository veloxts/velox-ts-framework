# @veloxts/core

Core foundation for VeloxTS Framework providing application bootstrap, plugin system, and error handling.

## Installation

```bash
npm install @veloxts/core
```

## Quick Start

```typescript
import { veloxApp } from '@veloxts/core';

const app = await veloxApp({ port: 3030 });
await app.start();
console.log(`Server running at ${app.address}`);
```

## Application Setup

Create a VeloxTS application with sensible defaults:

```typescript
const app = await veloxApp({
  port: 3030,          // Port to listen on
  host: '0.0.0.0',     // Host to bind to
  logger: true,        // Enable logging
});
```

The `VeloxApp` instance provides lifecycle methods:

- `app.start()` - Start the HTTP server
- `app.stop()` - Stop the server gracefully
- `app.register(plugin)` - Register Fastify plugins
- `app.server` - Access underlying Fastify instance

## Plugin System

Create reusable plugins with `definePlugin()`:

```typescript
import { definePlugin } from '@veloxts/core';
import { PrismaClient } from '@prisma/client';

export const databasePlugin = definePlugin({
  name: '@myapp/database',
  version: '1.0.0',
  async register(server, options) {
    const db = new PrismaClient();
    server.decorate('db', db);
    server.addHook('onClose', async () => {
      await db.$disconnect();
    });
  },
});

await app.register(databasePlugin);
```

## Context Extension

Extend the base context using TypeScript declaration merging:

```typescript
import type { PrismaClient } from '@prisma/client';

declare module '@veloxts/core' {
  interface BaseContext {
    db: PrismaClient;
  }
}

// Now ctx.db is available with full type safety
```

## Error Handling

Use structured error classes for consistent API responses:

```typescript
import {
  VeloxError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
} from '@veloxts/core';

// Basic error
throw new VeloxError('Something went wrong', 500);

// Validation error with field details
throw new ValidationError('Invalid input', {
  email: 'Must be a valid email',
  age: 'Must be at least 18',
});

// Resource not found
throw new NotFoundError('User', userId);

// Authentication required
throw new UnauthorizedError('Must be logged in');

// Insufficient permissions
throw new ForbiddenError('Admin access required');
```

## Graceful Shutdown

Handle shutdown signals properly:

```typescript
const shutdown = async () => {
  await app.stop();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.start();
```

## Complete Example

```typescript
import { veloxApp, definePlugin } from '@veloxts/core';
import { PrismaClient } from '@prisma/client';

// Database plugin
const databasePlugin = definePlugin({
  name: '@myapp/database',
  async register(server) {
    const db = new PrismaClient();
    server.decorate('db', db);
    server.addHook('onClose', () => db.$disconnect());
  },
});

// Create app
const app = await veloxApp({
  port: Number(process.env.PORT) || 3030,
  logger: true,
});

// Register plugins
await app.register(databasePlugin);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await app.stop();
  process.exit(0);
});

// Start server
await app.start();
console.log(`Server running at ${app.address}`);
```

## Learn More

- [@veloxts/router](https://www.npmjs.com/package/@veloxts/router) - Procedure-based routing
- [@veloxts/validation](https://www.npmjs.com/package/@veloxts/validation) - Schema validation
- [@veloxts/orm](https://www.npmjs.com/package/@veloxts/orm) - Prisma integration
- [VeloxTS Framework](https://www.npmjs.com/package/@veloxts/velox) - Complete framework

## License

MIT
