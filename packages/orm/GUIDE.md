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

## Learn More

See [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for complete documentation.
