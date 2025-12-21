# @veloxts/orm - Complete Guide

> **Alpha Release** - This framework is in early development. APIs may change between versions. Not recommended for production use yet.

Prisma wrapper with enhanced developer experience for the VeloxTS framework.

## Installation

```bash
npm install @veloxts/orm @prisma/client
# or
pnpm add @veloxts/orm @prisma/client
```

Note: `@prisma/client` is a peer dependency. You'll also need the `prisma` CLI as a dev dependency:

```bash
npm install -D prisma
# or
pnpm add -D prisma
```

## Quick Start

### 1. Initialize Prisma

```bash
npx prisma init
```

This creates a `prisma` directory with a `schema.prisma` file.

### 2. Define Your Schema

Edit `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

### 4. Integrate with VeloxTS

```typescript
import { veloxApp } from '@veloxts/core';
import { databasePlugin } from '@veloxts/orm';
import { PrismaClient } from '@prisma/client';

// Create Prisma client
const prisma = new PrismaClient();

// Create VeloxTS app
const app = await veloxApp({
  port: 3030,
  logger: true,
});

// Register database plugin
await app.register(databasePlugin({ client: prisma }));

// Start server
await app.start();
console.log(`Server running on ${app.address}`);
```

## Core API

### `databasePlugin(config)`

Creates a VeloxTS plugin that integrates Prisma with automatic lifecycle management.

**Configuration:**

```typescript
interface OrmPluginConfig {
  client: PrismaClient;          // Your Prisma client instance
  connect?: boolean;              // Auto-connect on startup (default: true)
  disconnect?: boolean;           // Auto-disconnect on shutdown (default: true)
}
```

**Example:**

```typescript
import { databasePlugin } from '@veloxts/orm';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

const dbPlugin = databasePlugin({
  client: prisma,
  connect: true,      // Connect when app starts
  disconnect: true,   // Disconnect on graceful shutdown
});

await app.register(dbPlugin);
```

### Context Extension

The database plugin extends the VeloxTS context with a `db` property:

```typescript
// Type definition is automatically available
declare module '@veloxts/core' {
  interface BaseContext {
    db: PrismaClient;
  }
}

// Use in procedures
export const userProcedures = defineProcedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      // ctx.db is fully typed as PrismaClient
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
      });

      if (!user) {
        throw new NotFoundError('User', input.id);
      }

      return user;
    }),
});
```

## Database Queries

The `ctx.db` object provides full access to Prisma's query API:

### Finding Records

```typescript
// Find unique record
const user = await ctx.db.user.findUnique({
  where: { id: userId },
});

// Find unique or throw
const user = await ctx.db.user.findUniqueOrThrow({
  where: { id: userId },
});

// Find first matching record
const user = await ctx.db.user.findFirst({
  where: { email: 'alice@example.com' },
});

// Find many with filters
const users = await ctx.db.user.findMany({
  where: {
    email: { contains: '@example.com' },
    createdAt: { gte: new Date('2025-01-01') },
  },
  orderBy: { createdAt: 'desc' },
  take: 10,
  skip: 0,
});
```

### Creating Records

```typescript
// Create single record
const user = await ctx.db.user.create({
  data: {
    name: 'Alice',
    email: 'alice@example.com',
  },
});

// Create with relations
const post = await ctx.db.post.create({
  data: {
    title: 'Hello World',
    content: 'My first post',
    author: {
      connect: { id: userId },
    },
  },
  include: { author: true }, // Include related data
});
```

### Updating Records

```typescript
// Update single record
const user = await ctx.db.user.update({
  where: { id: userId },
  data: { name: 'Alice Smith' },
});

// Update many
const result = await ctx.db.user.updateMany({
  where: { email: { contains: '@old-domain.com' } },
  data: { email: 'migrated@new-domain.com' },
});
console.log(`Updated ${result.count} users`);

// Upsert (update or create)
const user = await ctx.db.user.upsert({
  where: { email: 'alice@example.com' },
  update: { name: 'Alice Updated' },
  create: {
    name: 'Alice',
    email: 'alice@example.com',
  },
});
```

### Deleting Records

```typescript
// Delete single record
const user = await ctx.db.user.delete({
  where: { id: userId },
});

// Delete many
const result = await ctx.db.user.deleteMany({
  where: { createdAt: { lt: new Date('2024-01-01') } },
});
console.log(`Deleted ${result.count} users`);
```

### Aggregations and Counting

```typescript
// Count records
const count = await ctx.db.user.count({
  where: { email: { contains: '@example.com' } },
});

// Aggregate
const stats = await ctx.db.post.aggregate({
  _count: true,
  _avg: { views: true },
  _sum: { views: true },
  where: { published: true },
});
```

### Transactions

```typescript
// Transaction with array of operations
const [user, post] = await ctx.db.$transaction([
  ctx.db.user.create({ data: { name: 'Alice', email: 'alice@example.com' } }),
  ctx.db.post.create({ data: { title: 'Hello', content: 'World' } }),
]);

// Interactive transaction
const result = await ctx.db.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { name: 'Bob', email: 'bob@example.com' },
  });

  const post = await tx.post.create({
    data: {
      title: 'Bob\'s Post',
      content: 'Hello from Bob',
      authorId: user.id,
    },
  });

  return { user, post };
});
```

## Database Migrations

VeloxTS provides CLI commands for managing database migrations via Prisma:

### Development Workflow

```bash
# Create migration after schema changes
npx prisma migrate dev --name add_user_table

# Apply migrations
velox migrate

# Force push schema (dev only, skips migrations)
velox migrate --force

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Production Workflow

```bash
# Deploy pending migrations
velox migrate --deploy

# Or use Prisma directly
npx prisma migrate deploy
```

## Manual Connection Management

For advanced use cases, you can manually manage connections:

```typescript
import { createDatabase } from '@veloxts/orm';
import { PrismaClient } from '@prisma/client';

const db = createDatabase({
  client: new PrismaClient(),
});

// Manually connect
await db.connect();
console.log('Connected:', db.isConnected);

// Use the client
const users = await db.client.user.findMany();

// Check connection status
const status = db.getStatus();
console.log(status);
// {
//   state: 'connected',
//   connectedAt: Date,
//   disconnectedAt: null,
//   errorCount: 0,
//   lastError: null
// }

// Manually disconnect
await db.disconnect();
```

## Practical Examples

### CRUD Procedures

Complete example of CRUD operations:

```typescript
import { defineProcedures, procedure } from '@veloxts/router';
import { z, paginationInputSchema } from '@veloxts/validation';
import { NotFoundError } from '@veloxts/core';

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const userProcedures = defineProcedures('users', {
  // GET /users/:id
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
      });

      if (!user) {
        throw new NotFoundError('User', input.id);
      }

      return user;
    }),

  // GET /users
  listUsers: procedure()
    .input(paginationInputSchema)
    .output(z.object({
      data: z.array(UserSchema),
      meta: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
      }),
    }))
    .query(async ({ input, ctx }) => {
      const skip = (input.page - 1) * input.limit;

      const [data, total] = await Promise.all([
        ctx.db.user.findMany({
          skip,
          take: input.limit,
          orderBy: { createdAt: 'desc' },
        }),
        ctx.db.user.count(),
      ]);

      return {
        data,
        meta: { page: input.page, limit: input.limit, total },
      };
    }),

  // POST /users
  createUser: procedure()
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),

  // PUT /users/:id (deferred to v1.1+)
  // DELETE /users/:id (deferred to v1.1+)
});
```

### Relationships

Working with related data:

```typescript
// Schema with relations
model User {
  id    String  @id @default(uuid())
  name  String
  posts Post[]
}

model Post {
  id       String @id @default(uuid())
  title    String
  authorId String
  author   User   @relation(fields: [authorId], references: [id])
}

// Query with relations
const userProcedures = defineProcedures('users', {
  getUserWithPosts: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUnique({
        where: { id: input.id },
        include: {
          posts: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
    }),
});
```

## Configuration Best Practices

### Environment Variables

Store connection strings in `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
```

### Production Setup

```typescript
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
  errorFormat: 'minimal',
});

const dbPlugin = databasePlugin({
  client: prisma,
  connect: true,
  disconnect: true,
});
```

### Connection Pooling

Prisma handles connection pooling automatically. Configure in `schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Connection pool settings via URL parameters:
  // ?connection_limit=10&pool_timeout=20
}
```

## Error Handling

The ORM plugin integrates with VeloxTS's error handling:

```typescript
import { NotFoundError, VeloxError } from '@veloxts/core';

try {
  const user = await ctx.db.user.findUniqueOrThrow({
    where: { id: userId },
  });
} catch (error) {
  if (error.code === 'P2025') {
    // Prisma "Record not found" error
    throw new NotFoundError('User', userId);
  }
  throw new VeloxError('Database error', 500);
}
```

## MVP Limitations

The current v0.1.0 release focuses on core functionality:

**Included:**
- Prisma client integration
- Context extension (`ctx.db`)
- Connection lifecycle management
- Basic migration commands

**Deferred to v1.1+:**
- Database seeding utilities
- Migration rollback via CLI
- Query logging middleware
- Advanced connection pooling configuration

## Related Packages

- [@veloxts/core](/packages/core) - Core framework with context system
- [@veloxts/router](/packages/router) - Procedure definitions using database queries
- [@veloxts/validation](/packages/validation) - Schema validation for inputs/outputs
- [@veloxts/cli](/packages/cli) - CLI with `velox migrate` command

## TypeScript Support

All exports are fully typed with comprehensive JSDoc documentation. The package includes type definitions and declaration maps for excellent IDE support.

## License

MIT
