# @veloxts/core

> **Alpha Release** - This framework is in early development. APIs may change between versions. Not recommended for production use yet.

Foundation package for the VeloxTS framework - provides the core Fastify wrapper, plugin system, and base context.

## Installation

```bash
npm install @veloxts/core
# or
pnpm add @veloxts/core
```

## Quick Start

```typescript
import { createVeloxApp } from '@veloxts/core';

// Create application
const app = await createVeloxApp({
  port: 3210,
  host: '0.0.0.0',
  logger: true,
});

// Start server
await app.start();
console.log(`Server running on ${app.address}`);
```

## Core API

### `createVeloxApp(config?)`

Creates a new VeloxTS application instance with sensible defaults.

**Configuration Options:**

```typescript
interface VeloxAppConfig {
  port?: number;              // Port to listen on (default: 3000)
  host?: string;              // Host to bind to (default: '0.0.0.0')
  logger?: boolean | object;  // Enable logging (default: true in dev)
  fastify?: FastifyOptions;   // Additional Fastify options
}
```

**Example:**

```typescript
const app = await createVeloxApp({
  port: 4000,
  host: '127.0.0.1',
  logger: {
    level: 'info',
    prettyPrint: true,
  },
  fastify: {
    requestTimeout: 30000,
    bodyLimit: 1048576 * 10, // 10MB
  },
});
```

**Returns:** Promise resolving to `VeloxApp` instance

### VeloxApp Instance

The application instance provides methods for lifecycle management:

```typescript
interface VeloxApp {
  server: FastifyInstance;        // Underlying Fastify server
  config: VeloxAppConfig;          // Application configuration
  isRunning: boolean;             // Server running state
  address: string | null;         // Server address if running

  // Methods
  start(): Promise<void>;         // Start the server
  stop(): Promise<void>;          // Stop the server gracefully
  register(plugin, options?): Promise<void>;  // Register a plugin
  onShutdown(handler): void;      // Add shutdown handler
}
```

**Example:**

```typescript
const app = await createVeloxApp();

// Register plugins
await app.register(databasePlugin);
await app.register(routerPlugin);

// Add shutdown hook
app.onShutdown(async () => {
  console.log('Cleaning up resources...');
});

// Start server
await app.start();
console.log(`Server running at ${app.address}`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await app.stop();
});
```

## Plugin System

VeloxTS's plugin system extends functionality while maintaining type safety and encapsulation.

### Defining Plugins

Use `definePlugin()` to create reusable plugins:

```typescript
import { definePlugin } from '@veloxts/core';
import { PrismaClient } from '@prisma/client';

export const databasePlugin = definePlugin({
  name: '@myapp/database',
  version: '1.0.0',
  async register(server, options) {
    const db = new PrismaClient();

    // Decorate server with database client
    server.decorate('db', db);

    // Add lifecycle hook
    server.addHook('onClose', async () => {
      await db.$disconnect();
    });
  },
});
```

### Extending Context

Use TypeScript declaration merging to extend the base context:

```typescript
import type { PrismaClient } from '@prisma/client';

declare module '@veloxts/core' {
  interface BaseContext {
    db: PrismaClient;
  }
}
```

Now `ctx.db` is available in all route handlers with full type safety.

### Registering Plugins

```typescript
// Register with app instance
await app.register(databasePlugin);

// Register with options
await app.register(databasePlugin, {
  connectionString: process.env.DATABASE_URL,
});
```

### Plugin Example: Database Integration

Complete example integrating Prisma:

```typescript
import { definePlugin, type BaseContext } from '@veloxts/core';
import { PrismaClient } from '@prisma/client';

// Define plugin
export const databasePlugin = definePlugin({
  name: '@myapp/database',
  version: '1.0.0',
  async register(server, options) {
    const prisma = new PrismaClient({
      log: options?.log || ['error'],
    });

    // Test connection
    await prisma.$connect();

    // Decorate Fastify instance
    server.decorate('db', prisma);

    // Graceful shutdown
    server.addHook('onClose', async () => {
      await prisma.$disconnect();
    });

    console.log('Database connected');
  },
});

// Extend context
declare module '@veloxts/core' {
  interface BaseContext {
    db: PrismaClient;
  }
}

// Use in app
const app = await createVeloxApp();
await app.register(databasePlugin);
```

## Context System

The context object provides request-scoped state accessible throughout the request lifecycle.

### Base Context

Every request has a base context:

```typescript
interface BaseContext {
  request: FastifyRequest;  // Fastify request object
  reply: FastifyReply;      // Fastify reply object
}
```

### Accessing Context

Context is available in route handlers:

```typescript
app.server.get('/users', async (request, reply) => {
  // Access base context
  const { request: req, reply: rep } = request.context;

  // Access plugin-extended properties
  const users = await request.context.db.user.findMany();

  return users;
});
```

### Context in Procedures

When using `@veloxts/router`, context is passed to procedure handlers:

```typescript
import { procedure } from '@veloxts/router';

const getUsers = procedure()
  .query(async ({ ctx }) => {
    // ctx has type BaseContext with extensions
    return ctx.db.user.findMany();
  });
```

## Error Handling

VeloxTS provides structured error classes for consistent API responses.

### Error Classes

```typescript
import {
  VeloxError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
} from '@veloxts/core';
```

### `VeloxError`

Base error class with status code:

```typescript
throw new VeloxError('Something went wrong', 500);

// Response:
// {
//   "error": "Something went wrong",
//   "statusCode": 500
// }
```

### `ValidationError`

Validation errors with field-level details:

```typescript
throw new ValidationError('Invalid input', {
  email: 'Must be a valid email address',
  age: 'Must be at least 18',
});

// Response:
// {
//   "error": "Invalid input",
//   "statusCode": 400,
//   "fields": {
//     "email": "Must be a valid email address",
//     "age": "Must be at least 18"
//   }
// }
```

### `NotFoundError`

Resource not found errors:

```typescript
throw new NotFoundError('User', userId);

// Response:
// {
//   "error": "User not found",
//   "statusCode": 404,
//   "resource": "User",
//   "id": "123"
// }
```

### `UnauthorizedError`

Authentication required:

```typescript
throw new UnauthorizedError('Invalid credentials');

// Response:
// {
//   "error": "Invalid credentials",
//   "statusCode": 401
// }
```

### `ForbiddenError`

Insufficient permissions:

```typescript
throw new ForbiddenError('Insufficient permissions');

// Response:
// {
//   "error": "Insufficient permissions",
//   "statusCode": 403
// }
```

### Error Handler Example

```typescript
import { VeloxError, NotFoundError } from '@veloxts/core';

app.server.get('/users/:id', async (request, reply) => {
  try {
    const user = await request.context.db.user.findUnique({
      where: { id: request.params.id },
    });

    if (!user) {
      throw new NotFoundError('User', request.params.id);
    }

    return user;
  } catch (error) {
    if (error instanceof VeloxError) {
      // VeloxError is automatically handled by Fastify
      throw error;
    }

    // Handle unexpected errors
    throw new VeloxError('Internal server error', 500);
  }
});
```

## Configuration

### Default Configuration

```typescript
{
  port: 3210,
  host: '0.0.0.0',
  logger: process.env.NODE_ENV !== 'production',
}
```

### Environment-Based Configuration

```typescript
const app = await createVeloxApp({
  port: Number(process.env.PORT) || 3210,
  host: process.env.HOST || '0.0.0.0',
  logger: process.env.NODE_ENV !== 'production',
  fastify: {
    trustProxy: process.env.TRUST_PROXY === 'true',
  },
});
```

### Production Configuration

```typescript
const app = await createVeloxApp({
  port: 3210,
  host: '0.0.0.0',
  logger: {
    level: 'warn',
    prettyPrint: false,
  },
  fastify: {
    trustProxy: true,
    requestTimeout: 30000,
    bodyLimit: 1048576, // 1MB
    disableRequestLogging: true,
  },
});
```

## Lifecycle Management

### Graceful Shutdown

```typescript
const app = await createVeloxApp();

// Add custom shutdown handlers
app.onShutdown(async () => {
  console.log('Cleaning up resources...');
  await database.disconnect();
  await cache.flush();
});

// Handle SIGTERM (e.g., from Kubernetes, Docker)
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await app.stop();
  process.exit(0);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await app.stop();
  process.exit(0);
});

await app.start();
```

### Startup and Shutdown Hooks

Plugins can register lifecycle hooks:

```typescript
export const lifecyclePlugin = definePlugin({
  name: 'lifecycle',
  version: '1.0.0',
  async register(server, options) {
    // Called when server starts listening
    server.addHook('onListen', async () => {
      console.log('Server is listening');
    });

    // Called when server is closing
    server.addHook('onClose', async () => {
      console.log('Server is closing');
    });

    // Called for each request
    server.addHook('onRequest', async (request, reply) => {
      console.log(`Request: ${request.method} ${request.url}`);
    });
  },
});
```

## Advanced Usage

### Custom Fastify Instance

For advanced scenarios, you can pass a custom Fastify instance:

```typescript
import Fastify from 'fastify';

const fastify = Fastify({
  logger: true,
  requestIdHeader: 'x-request-id',
  trustProxy: true,
});

const app = await createVeloxApp({ fastify });
```

### Accessing Fastify Directly

The underlying Fastify instance is available via `app.server`:

```typescript
const app = await createVeloxApp();

// Add Fastify plugins
await app.server.register(fastifyCors, {
  origin: true,
});

// Add raw routes
app.server.get('/custom', async (request, reply) => {
  return { message: 'Custom route' };
});
```

## Practical Examples

### Complete Application Setup

```typescript
import { createVeloxApp } from '@veloxts/core';
import { createDatabasePlugin } from '@veloxts/orm';
import { registerRestRoutes } from '@veloxts/router';
import { PrismaClient } from '@prisma/client';
import { userProcedures } from './procedures/users';

// Initialize
const prisma = new PrismaClient();
const app = await createVeloxApp({
  port: Number(process.env.PORT) || 3210,
  logger: true,
});

// Register database plugin
await app.register(createDatabasePlugin({ client: prisma }));

// Register API routes
await registerRestRoutes(app.server, {
  prefix: '/api',
  procedures: {
    users: userProcedures,
  },
});

// Graceful shutdown
const shutdown = async () => {
  await app.stop();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
await app.start();
console.log(`Server running at ${app.address}`);
```

## Related Packages

- [@veloxts/router](/packages/router) - Procedure-based routing
- [@veloxts/validation](/packages/validation) - Schema validation with Zod
- [@veloxts/orm](/packages/orm) - Prisma integration
- [@veloxts/client](/packages/client) - Type-safe frontend API client
- [@veloxts/cli](/packages/cli) - Developer tooling

## TypeScript Support

All exports are fully typed with comprehensive JSDoc documentation. The package includes type definitions and declaration maps for excellent IDE support.

## License

MIT
