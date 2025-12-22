# @veloxts/core

Core foundation for VeloxTS Framework providing application bootstrap, plugin system, and dependency injection.

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

## Dependency Injection

VeloxTS provides a powerful DI container for managing service dependencies:

```typescript
import { Injectable, Inject, Scope, singleton, scoped } from '@veloxts/core';

@Injectable()
class UserService {
  constructor(private db: PrismaClient) {}

  async getUser(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }
}

// Register services
app.container.register(singleton(UserService));

// Resolve in procedures
const userService = app.container.resolve(UserService);
```

### Lifecycle Scopes

- `Scope.SINGLETON` - One instance for entire application
- `Scope.REQUEST` - One instance per HTTP request
- `Scope.TRANSIENT` - New instance every time

### Succinct Helpers

```typescript
import { singleton, scoped, transient, value, factory } from '@veloxts/core';

// Class services
app.container.register(singleton(ConfigService));
app.container.register(scoped(UserContext));
app.container.register(transient(RequestLogger));

// Values
app.container.register(value(CONFIG, { port: 3030 }));

// Factories
app.container.register(
  factory(DATABASE, (config) => new PrismaClient({ url: config.dbUrl }), [ConfigService])
);
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
