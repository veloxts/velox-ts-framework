# Prisma 7 Setup Guide

Comprehensive guide for configuring Prisma 7 driver adapters in VeloxTS applications.

## Overview

Prisma 7 introduces **driver adapters** - a new architecture that changes how database connections are configured. This guide walks you through the setup process and common pitfalls to avoid.

### What Changed in Prisma 7?

**Before (Prisma 6 and earlier):**
```prisma
// schema.prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")  // URL configured here
}
```

**After (Prisma 7+):**
```prisma
// schema.prisma
datasource db {
  provider = "sqlite"
  // NO url field - configured in prisma.config.ts instead
}
```

```typescript
// prisma.config.ts (NEW)
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
```

```typescript
// database.ts (NEW)
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client.js';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });
```

### Key Benefits of Driver Adapters

- **Separation of concerns**: CLI configuration (migrations) separate from runtime configuration (client)
- **Custom connection logic**: Full control over database connection pooling and behavior
- **Edge runtime support**: Enables serverless and edge deployments (future)
- **Better TypeScript integration**: Type-safe adapter configuration

---

## Quick Start

### 1. Install Dependencies

**For SQLite (recommended for development):**
```bash
pnpm add @prisma/client@7.1.0 @prisma/adapter-better-sqlite3@7.1.0
pnpm add -D prisma@7.1.0
```

**For PostgreSQL:**
```bash
pnpm add @prisma/client@7.1.0 @prisma/adapter-pg@7.1.0 pg@8.13.1
pnpm add -D prisma@7.1.0 @types/pg@8.11.10
```

**For MySQL:**
```bash
pnpm add @prisma/client@7.1.0 @prisma/adapter-mysql@7.1.0 mysql2@3.12.0
pnpm add -D prisma@7.1.0
```

### 2. Rebuild Native Modules (SQLite only)

If using SQLite, rebuild the native module after installation:

```bash
npm rebuild better-sqlite3
```

This step is **critical** - without it, you'll get runtime errors about missing native bindings.

### 3. Configure Prisma

Create three files in your project:

**prisma.config.ts** (at project root):
```typescript
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
```

**prisma/schema.prisma**:
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
  // NOTE: No url field in Prisma 7+
}

model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
```

**src/config/database.ts** (create database client):
```typescript
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.js';

// Validate environment variable
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create adapter with database URL
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL,
});

// Export configured Prisma client
export const prisma = new PrismaClient({ adapter });
```

### 4. Set Environment Variable

**.env**:
```bash
# SQLite (path relative to where Prisma CLI runs - usually project root)
DATABASE_URL="file:./dev.db"

# PostgreSQL
# DATABASE_URL="postgresql://user:password@localhost:5432/mydb"

# MySQL
# DATABASE_URL="mysql://user:password@localhost:3306/mydb"
```

### 5. Generate Prisma Client

```bash
pnpm prisma generate
```

This creates the Prisma client in `src/generated/prisma/`.

### 6. Push Database Schema

```bash
pnpm prisma db push
```

Your database is now ready to use!

---

## Database Adapter Options

### SQLite (Development)

**Best for:** Local development, testing, demos

**Installation:**
```bash
pnpm add @prisma/adapter-better-sqlite3@7.1.0
npm rebuild better-sqlite3  # IMPORTANT: Rebuild native module
```

**Configuration:**
```typescript
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL!, // "file:./dev.db"
});

export const prisma = new PrismaClient({ adapter });
```

**Schema:**
```prisma
datasource db {
  provider = "sqlite"
}
```

**Pros:**
- Zero configuration - just works
- No separate database server needed
- Fast for development
- Perfect for CI/CD testing

**Cons:**
- Not recommended for production
- Limited concurrency support
- No network access

---

### PostgreSQL (Production)

**Best for:** Production applications, high concurrency, complex queries

**Installation:**
```bash
pnpm add @prisma/adapter-pg@7.1.0 pg@8.13.1
pnpm add -D @types/pg@8.11.10
```

**Configuration:**
```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Export configured Prisma client
export const prisma = new PrismaClient({ adapter });

// Graceful shutdown
process.on('beforeExit', async () => {
  await pool.end();
});
```

**Schema:**
```prisma
datasource db {
  provider = "postgresql"
}

model User {
  id        String   @id @default(dbgenerated("gen_random_uuid()"))
  // ... rest of fields
}
```

**Environment:**
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
```

**Pros:**
- Production-ready
- ACID compliance
- Advanced features (JSON, full-text search, etc.)
- Excellent performance with connection pooling

**Cons:**
- Requires separate database server
- More complex deployment

---

### MySQL (Production)

**Best for:** Existing MySQL infrastructure, wide hosting support

**Installation:**
```bash
pnpm add @prisma/adapter-mysql@7.1.0 mysql2@3.12.0
```

**Configuration:**
```typescript
import { PrismaMysql } from '@prisma/adapter-mysql';
import { createPool } from 'mysql2/promise';
import { PrismaClient } from '../generated/prisma/client.js';

// Create MySQL connection pool
const pool = createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 10,
});

// Create Prisma adapter
const adapter = new PrismaMysql(pool);

// Export configured Prisma client
export const prisma = new PrismaClient({ adapter });

// Graceful shutdown
process.on('beforeExit', async () => {
  await pool.end();
});
```

**Schema:**
```prisma
datasource db {
  provider = "mysql"
}

model User {
  id        String   @id @default(uuid())
  // ... rest of fields
}
```

**Environment:**
```bash
DATABASE_URL="mysql://user:password@localhost:3306/mydb"
```

**Pros:**
- Wide hosting support
- Mature ecosystem
- Good performance

**Cons:**
- Less feature-rich than PostgreSQL
- UTF-8 handling requires careful configuration

---

## Common Errors and Solutions

### Error: "The datasource property 'url' is no longer supported"

**Symptom:**
```
Error: Prisma schema validation
  - Error code: P1012
  - Error validating: The datasource property 'url' is no longer supported.
```

**Cause:** You have a `url` field in your `schema.prisma` datasource block.

**Solution:** Remove the `url` field from `schema.prisma` and configure it in `prisma.config.ts` instead:

```prisma
// WRONG (Prisma 6 pattern)
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")  // Remove this line
}

// CORRECT (Prisma 7 pattern)
datasource db {
  provider = "sqlite"
}
```

```typescript
// prisma.config.ts
export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

### Error: "Cannot find module 'better-sqlite3'"

**Symptom:**
```
Error: Cannot find module 'better-sqlite3'
```

**Cause:** Native module not rebuilt after installation.

**Solution:** Rebuild the native module:

```bash
npm rebuild better-sqlite3
```

If that doesn't work, try a clean reinstall:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
npm rebuild better-sqlite3
```

---

### Error: "ENOENT: no such file or directory"

**Symptom:**
```
Error: ENOENT: no such file or directory, open './dev.db'
```

**Cause:** Database path in `DATABASE_URL` is relative to where the Prisma CLI runs, not where your application runs.

**Solution:** Use paths relative to the **project root** (where `prisma.config.ts` is located):

```bash
# CORRECT - relative to project root
DATABASE_URL="file:./dev.db"
DATABASE_URL="file:./prisma/dev.db"

# WRONG - absolute paths or paths relative to src/
DATABASE_URL="file:/absolute/path/to/dev.db"
DATABASE_URL="file:../dev.db"  # If running from src/
```

For runtime (application code), the adapter resolves paths the same way. Keep paths consistent.

---

### Error: "PrismaBetterSQLite3 is not a constructor"

**Symptom:**
```
TypeError: PrismaBetterSQLite3 is not a constructor
```

**Cause:** Incorrect class name - the class is `PrismaBetterSqlite3` (lowercase "qlite"), not `PrismaBetterSQLite3`.

**Solution:** Use the correct import:

```typescript
// WRONG
import { PrismaBetterSQLite3 } from '@prisma/adapter-better-sqlite3';

// CORRECT
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
//                      ^^^^ lowercase "qlite"
```

---

### Error: "Generated Prisma Client not found"

**Symptom:**
```
Error: Cannot find module './generated/prisma/client.js'
```

**Cause:** Prisma client not generated or generated to wrong location.

**Solution:**

1. Check your `schema.prisma` output path:
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"  // Must match your import path
}
```

2. Regenerate the client:
```bash
pnpm prisma generate
```

3. Verify the generated client exists:
```bash
ls -la src/generated/prisma/
```

---

### Error: "The table 'main.users' does not exist"

**Symptom:**
```
Error: The table `main.users` does not exist in the current database.
```

**Cause:** Database schema not pushed or migrations not applied.

**Solution:** Push your schema to create the tables:

```bash
pnpm prisma db push
```

Or if using migrations:

```bash
pnpm prisma migrate dev --name init
```

---

## Migration from Prisma 6

If you're upgrading an existing VeloxTS project from Prisma 6 to Prisma 7:

### Step 1: Update Dependencies

```bash
pnpm add @prisma/client@7.1.0
pnpm add -D prisma@7.1.0

# Add adapter for your database
pnpm add @prisma/adapter-better-sqlite3@7.1.0  # SQLite
# OR
pnpm add @prisma/adapter-pg@7.1.0 pg@8.13.1    # PostgreSQL
# OR
pnpm add @prisma/adapter-mysql@7.1.0 mysql2@3.12.0  # MySQL
```

### Step 2: Remove URL from Schema

Edit `prisma/schema.prisma`:

```diff
  datasource db {
    provider = "sqlite"
-   url      = env("DATABASE_URL")
  }
```

### Step 3: Create prisma.config.ts

Create `prisma.config.ts` at your project root:

```typescript
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Step 4: Update Database Client

Update your database client file (e.g., `src/config/database.ts`):

```typescript
// Before (Prisma 6)
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();

// After (Prisma 7)
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });
```

### Step 5: Rebuild Native Modules (SQLite only)

```bash
npm rebuild better-sqlite3
```

### Step 6: Regenerate Client

```bash
pnpm prisma generate
```

### Step 7: Update Package Scripts

Update `package.json` scripts to use `--config` flag:

```json
{
  "scripts": {
    "db:push": "prisma db push --config prisma.config.ts",
    "db:studio": "prisma studio --config prisma.config.ts",
    "db:migrate": "prisma migrate dev --config prisma.config.ts"
  }
}
```

---

## Environment Configuration Tips

### Development vs. Production

Use different database URLs for different environments:

**.env.development**:
```bash
DATABASE_URL="file:./dev.db"
```

**.env.production**:
```bash
DATABASE_URL="postgresql://user:password@prod-host:5432/mydb"
```

**Load the correct file:**
```typescript
// prisma.config.ts
import { config } from 'dotenv';
import path from 'node:path';

const envFile = process.env.NODE_ENV === 'production'
  ? '.env.production'
  : '.env.development';

config({ path: path.join(__dirname, envFile) });
```

### Docker Deployments

When using Docker, ensure paths are container-relative:

**docker-compose.yml**:
```yaml
services:
  app:
    build: .
    environment:
      DATABASE_URL: "postgresql://user:password@db:5432/mydb"
    volumes:
      - ./data:/app/data  # For SQLite

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
```

### Railway / Render / Fly.io

These platforms provide `DATABASE_URL` automatically. No additional configuration needed:

```typescript
// Works automatically on Railway, Render, Fly.io
export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

## VeloxTS Integration

### Using Prisma with VeloxTS Context

Extend the VeloxTS context to include your Prisma client:

**src/config/database.ts**:
```typescript
import type { BaseContext } from '@veloxts/core';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });
export type { PrismaClient };

// Extend VeloxTS context
declare module '@veloxts/core' {
  interface BaseContext {
    db: PrismaClient;
  }
}
```

**src/index.ts**:
```typescript
import { createApp } from '@veloxts/core';
import { serve } from '@veloxts/router';
import { prisma } from './config/database.js';
import { userProcedures } from './routes/users.js';

const app = createApp({
  context: () => ({ db: prisma }),
});

await serve(app, [userProcedures]);

await app.start();
```

**src/routes/users.ts**:
```typescript
import { procedure, procedures } from '@veloxts/router';
import { z } from 'zod';

export const userProcedures = procedures('users', {
  listUsers: procedure
    .query(async ({ ctx }) => {
      // ctx.db is fully typed as PrismaClient
      return ctx.db.user.findMany();
    }),

  getUser: procedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUnique({
        where: { id: input.id },
      });
    }),
});
```

---

## Performance Tips

### Connection Pooling (PostgreSQL/MySQL)

Configure connection pools for optimal performance:

**PostgreSQL:**
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Maximum pool size
  min: 5,                     // Minimum pool size
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000,
});
```

**MySQL:**
```typescript
const pool = createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 10,
  queueLimit: 0,
  waitForConnections: true,
});
```

### Query Optimization

Use Prisma's query optimization features:

```typescript
// Select only needed fields
const users = await ctx.db.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    // Exclude password, createdAt, etc.
  },
});

// Use pagination
const users = await ctx.db.user.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

// Use indexes
// In schema.prisma:
model User {
  email String @unique
  @@index([email])  // Add index for frequent queries
}
```

### Graceful Shutdown

Always disconnect Prisma on application shutdown:

```typescript
import { createApp } from '@veloxts/core';
import { prisma } from './config/database.js';

const app = createApp({
  context: () => ({ db: prisma }),
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  await app.close();
  process.exit(0);
});

await app.start();
```

---

## Troubleshooting Checklist

When encountering issues, verify:

- [ ] Prisma version is 7.x: `pnpm list prisma`
- [ ] Adapter package installed: `pnpm list @prisma/adapter-*`
- [ ] Native module rebuilt (SQLite): `npm rebuild better-sqlite3`
- [ ] No `url` field in `schema.prisma` datasource
- [ ] `prisma.config.ts` exists with correct URL
- [ ] `DATABASE_URL` environment variable is set
- [ ] Database path is relative to project root
- [ ] Correct adapter class name (e.g., `PrismaBetterSqlite3`)
- [ ] Prisma client generated: `pnpm prisma generate`
- [ ] Database schema pushed: `pnpm prisma db push`
- [ ] Generated client import path matches output path

---

## Additional Resources

- [Prisma 7 Upgrade Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-to-prisma-7)
- [Prisma Driver Adapters Documentation](https://www.prisma.io/docs/orm/overview/databases/database-drivers)
- [VeloxTS Getting Started Guide](/docs/GETTING_STARTED.md)
- [VeloxTS ORM Package](/packages/orm/README.md)

---

## Need Help?

If you encounter issues not covered in this guide:

1. Check the [VeloxTS GitHub Issues](https://github.com/veloxts/veloxts/issues)
2. Review the [Prisma Community Discussions](https://github.com/prisma/prisma/discussions)
3. Open a new issue with:
   - Prisma version: `pnpm list prisma`
   - Adapter version: `pnpm list @prisma/adapter-*`
   - Database provider (SQLite, PostgreSQL, MySQL)
   - Complete error message and stack trace
   - Relevant configuration files (schema.prisma, prisma.config.ts)
