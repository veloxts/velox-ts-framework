# @veloxts/orm

Prisma ORM integration with automatic lifecycle management.

## Quick Start

```typescript
import { veloxApp } from '@veloxts/core';
import { databasePlugin } from '@veloxts/orm';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = await veloxApp({ port: 3030 });

await app.register(databasePlugin({ client: prisma }));
await app.start();
```

## Prisma 7 Setup

Create `prisma.config.ts`:

```typescript
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: { url: process.env.DATABASE_URL },
});
```

Use driver adapter (Prisma 7 requirement):

```typescript
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });
```

## Using in Procedures

```typescript
export const userProcedures = procedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.id } });
      if (!user) throw new NotFoundError('User', input.id);
      return user;
    }),

  createUser: procedure()
    .input(z.object({ name: z.string(), email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),
});
```

## Migrations

```bash
npx prisma migrate dev --name add_users  # Create migration
npx prisma migrate deploy                # Apply migrations
velox migrate                            # VeloxTS CLI shortcut
```

## Multi-Tenancy (Schema-per-Tenant)

For SaaS applications requiring tenant isolation, import from `@veloxts/orm/tenant`:

```typescript
import {
  createTenantClientPool,
  createTenantSchemaManager,
  createTenantProvisioner,
  createTenant,
} from '@veloxts/orm/tenant';
```

### Setup

```typescript
// 1. Schema manager (DDL operations)
const schemaManager = createTenantSchemaManager({
  databaseUrl: process.env.DATABASE_URL!,
  schemaPrefix: 'tenant_', // PostgreSQL schema prefix
});

// 2. Client pool (manages PrismaClient per tenant)
const clientPool = createTenantClientPool({
  baseDatabaseUrl: process.env.DATABASE_URL!,
  createClient: (schemaName) => {
    const url = `${process.env.DATABASE_URL}?schema=${schemaName}`;
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({ adapter });
  },
  maxClients: 50, // LRU eviction when exceeded
});

// 3. Tenant middleware namespace
const tenant = createTenant({
  loadTenant: (id) => publicDb.tenant.findUnique({ where: { id } }),
  clientPool,
  publicClient: publicDb, // For shared data in 'public' schema
});
```

### Using in Procedures

```typescript
const getUsers = procedure()
  .use(auth.requireAuth())
  .use(tenant.middleware()) // Adds ctx.tenant, ctx.db (scoped)
  .query(({ ctx }) => ctx.db.user.findMany());
```

The middleware:
1. Extracts `tenantId` from JWT claims (`ctx.auth.token.tenantId`)
2. Loads tenant from public schema
3. Validates tenant status (must be `active`)
4. Gets tenant-scoped database client from pool
5. Adds `ctx.tenant`, `ctx.db`, and optionally `ctx.publicDb`

### Provisioning Tenants

```typescript
const provisioner = createTenantProvisioner({
  schemaManager,
  publicClient: publicDb,
  clientPool,
});

// Create new tenant (creates schema + runs migrations)
const result = await provisioner.provision({
  slug: 'acme-corp',
  name: 'Acme Corporation',
});
// result.tenant.schemaName === 'tenant_acme_corp'

// Migrate all tenant schemas
await provisioner.migrateAll();
```

### Architecture

```
PostgreSQL Database
├── public schema (shared)
│   └── tenants table
└── tenant_acme_corp schema (isolated)
    ├── users
    ├── posts
    └── ...
```

### JWT Integration

Add `tenantId` to your JWT payload when generating tokens:

```typescript
const tokens = await jwt.generateTokens({
  sub: user.id,
  email: user.email,
  tenantId: user.tenantId, // Include tenant ID
});
```

## Learn More

See [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for complete documentation.
