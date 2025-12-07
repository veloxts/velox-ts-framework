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

## Dependency Injection

VeloxTS provides a powerful, type-safe dependency injection container inspired by Angular and NestJS. The DI system enables automatic constructor injection, lifecycle management, and clean separation of concerns.

### Overview

The DI container manages service creation, dependency resolution, and lifecycle:

- **Automatic constructor injection** via TypeScript decorators
- **Multiple provider types**: classes, factories, values, aliases
- **Lifecycle scopes**: singleton, transient, request-scoped
- **Type safety**: Full TypeScript inference without code generation
- **Circular dependency detection**
- **Fastify integration** for request-scoped services

### Accessing the Container

Every VeloxApp instance has a DI container available:

```typescript
const app = await createVeloxApp();

// Access the container
app.container.register({ /* ... */ });
const service = app.container.resolve(MyService);
```

### Tokens

Tokens are unique identifiers for services. VeloxTS supports three token types:

#### Class Tokens

Use the class itself as a token:

```typescript
@Injectable()
class UserService {
  getUsers() { /* ... */ }
}

// Register with class token
app.container.register({
  provide: UserService,
  useClass: UserService
});

// Resolve with class token
const userService = app.container.resolve(UserService);
```

#### String Tokens

Use string literals for named services:

```typescript
import { createStringToken } from '@veloxts/core';

interface DatabaseClient {
  query(sql: string): Promise<unknown>;
}

const DATABASE = createStringToken<DatabaseClient>('DATABASE');

app.container.register({
  provide: DATABASE,
  useFactory: () => createDatabaseClient()
});

const db = app.container.resolve(DATABASE);
```

#### Symbol Tokens

Use symbols for guaranteed uniqueness:

```typescript
import { createSymbolToken } from '@veloxts/core';

interface Logger {
  log(message: string): void;
}

const LOGGER = createSymbolToken<Logger>('Logger');

app.container.register({
  provide: LOGGER,
  useClass: ConsoleLogger
});

const logger = app.container.resolve(LOGGER);
```

### Provider Types

The container supports four provider types for different use cases.

#### Class Provider

Instantiate a class with automatic dependency injection:

```typescript
@Injectable()
class UserService {
  constructor(
    private db: DatabaseClient,
    private logger: Logger
  ) {}
}

app.container.register({
  provide: UserService,
  useClass: UserService,
  scope: Scope.SINGLETON
});
```

#### Factory Provider

Use a factory function to create instances:

```typescript
app.container.register({
  provide: DATABASE,
  useFactory: (config: ConfigService) => {
    return createDatabaseClient(config.databaseUrl);
  },
  inject: [ConfigService],
  scope: Scope.SINGLETON
});
```

#### Value Provider

Provide an existing value directly:

```typescript
const CONFIG = createStringToken<AppConfig>('CONFIG');

app.container.register({
  provide: CONFIG,
  useValue: {
    port: 3210,
    host: 'localhost',
    debug: true
  }
});
```

#### Existing Provider (Alias)

Create an alias to another token:

```typescript
// Register concrete implementation
app.container.register({
  provide: ConsoleLogger,
  useClass: ConsoleLogger
});

// Create an alias
app.container.register({
  provide: LOGGER,
  useExisting: ConsoleLogger
});

// Both resolve to the same instance
const logger1 = app.container.resolve(LOGGER);
const logger2 = app.container.resolve(ConsoleLogger);
// logger1 === logger2
```

### Lifecycle Scopes

Scopes determine how service instances are created and shared.

#### Singleton Scope

One instance for the entire application (default):

```typescript
@Injectable({ scope: Scope.SINGLETON })
class ConfigService {
  // Shared across all requests
}
```

**Best for:**
- Configuration services
- Database connection pools
- Cache clients
- Stateless utility services

#### Transient Scope

New instance on every resolution:

```typescript
@Injectable({ scope: Scope.TRANSIENT })
class RequestIdGenerator {
  readonly id = crypto.randomUUID();
}
```

**Best for:**
- Services with mutable state
- Factories that produce unique objects
- Services where isolation is critical

#### Request Scope

One instance per HTTP request:

```typescript
@Injectable({ scope: Scope.REQUEST })
class UserContext {
  constructor(private request: FastifyRequest) {}

  get userId(): string {
    return this.request.user?.id;
  }
}
```

**Best for:**
- User context/session data
- Request-specific caching
- Transaction management
- Audit logging with request context

**Note:** Request-scoped services require a Fastify request context. Resolving them outside a request handler throws an error.

### Decorators

Use TypeScript decorators for automatic dependency injection.

#### Prerequisites

Enable decorators in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Import `reflect-metadata` at your app's entry point:

```typescript
import 'reflect-metadata';
import { createVeloxApp } from '@veloxts/core';
```

#### @Injectable()

Marks a class as injectable:

```typescript
@Injectable()
class UserService {
  constructor(private db: DatabaseClient) {}
}

@Injectable({ scope: Scope.REQUEST })
class RequestLogger {
  constructor(private request: FastifyRequest) {}
}
```

#### @Inject()

Explicitly specifies the injection token:

```typescript
const DATABASE = createStringToken<DatabaseClient>('DATABASE');

@Injectable()
class UserService {
  constructor(
    @Inject(DATABASE) private db: DatabaseClient,
    private config: ConfigService // Auto-injected by class token
  ) {}
}
```

Use `@Inject()` when:
- Injecting by string or symbol token
- Injecting an interface (TypeScript interfaces are erased at runtime)
- Automatic type resolution doesn't work

#### @Optional()

Marks a dependency as optional:

```typescript
@Injectable()
class NotificationService {
  constructor(
    @Optional() private emailService?: EmailService,
    @Optional() @Inject(SMS_SERVICE) private smsService?: SmsService
  ) {}

  notify(message: string) {
    // Gracefully handle missing services
    this.emailService?.send(message);
    this.smsService?.send(message);
  }
}
```

If an optional dependency cannot be resolved, `undefined` is injected instead of throwing an error.

### Container API

#### Registering Services

Register a single provider:

```typescript
app.container.register({
  provide: UserService,
  useClass: UserService,
  scope: Scope.REQUEST
});
```

Register multiple providers:

```typescript
app.container.registerMany([
  { provide: UserService, useClass: UserService },
  { provide: PostService, useClass: PostService },
  { provide: CONFIG, useValue: appConfig }
]);
```

#### Resolving Services

Synchronous resolution:

```typescript
const userService = app.container.resolve(UserService);
```

Asynchronous resolution (for async factories):

```typescript
app.container.register({
  provide: DATABASE,
  useFactory: async (config) => {
    const client = createClient(config.dbUrl);
    await client.connect();
    return client;
  },
  inject: [ConfigService]
});

const db = await app.container.resolveAsync(DATABASE);
```

Optional resolution (returns `undefined` if not found):

```typescript
const service = app.container.resolveOptional(OptionalService);
if (service) {
  service.doSomething();
}
```

#### Request Context

Resolve request-scoped services with context:

```typescript
app.server.get('/users', async (request, reply) => {
  const ctx = Container.createContext(request);
  const userContext = app.container.resolve(UserContext, ctx);

  return { userId: userContext.userId };
});
```

### Integration with VeloxApp

The container is automatically attached to the Fastify server for request-scoped services:

```typescript
const app = await createVeloxApp();

// Container is already attached to app.server
// Request-scoped services work automatically

@Injectable({ scope: Scope.REQUEST })
class RequestLogger {
  constructor(private request: FastifyRequest) {}
}

app.container.register({
  provide: RequestLogger,
  useClass: RequestLogger
});

app.server.get('/log', async (request, reply) => {
  const ctx = Container.createContext(request);
  const logger = app.container.resolve(RequestLogger, ctx);
  logger.log('Request received');
  return { ok: true };
});
```

### Practical Examples

#### Complete Service Layer

```typescript
import 'reflect-metadata';
import {
  createVeloxApp,
  Injectable,
  Inject,
  Scope,
  createStringToken
} from '@veloxts/core';
import { PrismaClient } from '@prisma/client';

// Define tokens
const DATABASE = createStringToken<PrismaClient>('DATABASE');
const CONFIG = createStringToken<AppConfig>('CONFIG');

// Configuration service
@Injectable()
class ConfigService {
  get databaseUrl(): string {
    return process.env.DATABASE_URL!;
  }
}

// Database service
@Injectable()
class DatabaseService {
  constructor(@Inject(DATABASE) private db: PrismaClient) {}

  async findUser(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }
}

// Business logic service
@Injectable({ scope: Scope.REQUEST })
class UserService {
  constructor(
    private database: DatabaseService,
    private config: ConfigService
  ) {}

  async getUser(id: string) {
    return this.database.findUser(id);
  }
}

// Create app
const app = await createVeloxApp();

// Register services
app.container.register({
  provide: DATABASE,
  useFactory: (config: ConfigService) => {
    return new PrismaClient({
      datasources: { db: { url: config.databaseUrl } }
    });
  },
  inject: [ConfigService],
  scope: Scope.SINGLETON
});

app.container.register({
  provide: ConfigService,
  useClass: ConfigService
});

app.container.register({
  provide: DatabaseService,
  useClass: DatabaseService
});

app.container.register({
  provide: UserService,
  useClass: UserService,
  scope: Scope.REQUEST
});

// Use in routes
app.server.get('/users/:id', async (request, reply) => {
  const ctx = Container.createContext(request);
  const userService = app.container.resolve(UserService, ctx);

  const user = await userService.getUser(request.params.id);
  return user;
});

await app.start();
```

#### Testing with Child Containers

```typescript
import { createContainer, asClass } from '@veloxts/core';

// Create a child container for testing
const testContainer = app.container.createChild();

// Override services with mocks
class MockDatabaseService {
  async findUser(id: string) {
    return { id, name: 'Test User' };
  }
}

testContainer.register({
  provide: DatabaseService,
  useClass: MockDatabaseService
});

// Test with mocked dependencies
const userService = testContainer.resolve(UserService);
const user = await userService.getUser('123');
// user comes from MockDatabaseService
```

#### Auto-Registration

Enable auto-registration to automatically register `@Injectable` classes:

```typescript
const app = await createVeloxApp();
const autoContainer = createContainer({ autoRegister: true });

@Injectable()
class AutoService {}

// No need to manually register
const service = autoContainer.resolve(AutoService);
// Automatically registers and resolves
```

### Advanced Features

#### Circular Dependency Detection

The container detects circular dependencies:

```typescript
@Injectable()
class ServiceA {
  constructor(private b: ServiceB) {}
}

@Injectable()
class ServiceB {
  constructor(private a: ServiceA) {}
}

// Throws: Circular dependency detected: ServiceA -> ServiceB -> ServiceA
const service = app.container.resolve(ServiceA);
```

#### Container Hierarchy

Create parent-child container hierarchies:

```typescript
const parentContainer = createContainer();
parentContainer.register({
  provide: ConfigService,
  useClass: ConfigService
});

const childContainer = parentContainer.createChild();
// Child inherits ConfigService from parent
// Can override with its own providers

childContainer.register({
  provide: UserService,
  useClass: UserService
});
```

#### Debug Information

Get container statistics:

```typescript
const info = app.container.getDebugInfo();
console.log(info);
// {
//   providerCount: 5,
//   providers: [
//     'class(UserService, request)',
//     'factory(DATABASE, singleton)',
//     'value(CONFIG)',
//     'existing(LOGGER => ConsoleLogger)'
//   ],
//   hasParent: false,
//   autoRegister: false
// }
```

### Best Practices

1. **Use tokens for interfaces**: Create string or symbol tokens for interface types since TypeScript interfaces don't exist at runtime.

2. **Prefer singleton scope**: Use `Scope.SINGLETON` by default for stateless services to improve performance.

3. **Use request scope for user context**: Store user authentication, request-specific state, and transactions in request-scoped services.

4. **Avoid circular dependencies**: Refactor shared logic into a third service to break circular dependencies.

5. **Use `@Inject()` for clarity**: Explicitly specify tokens with `@Inject()` to make dependencies clear and avoid runtime type resolution issues.

6. **Test with child containers**: Create child containers in tests to override services with mocks without affecting the main container.

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
