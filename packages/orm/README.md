# @veloxts/orm

**Pre-Alpha Notice:** This framework is in early development (v0.4.x). APIs are subject to change. Not recommended for production use.

## What is this?

Prisma ORM integration package for the VeloxTS Framework, providing enhanced developer experience for database operations.

## Part of @veloxts/velox

This package is part of the VeloxTS Framework. For the complete framework experience, install:

```bash
npm install @veloxts/velox
```

Visit [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for the complete framework documentation.

## Standalone Installation

```bash
npm install @veloxts/orm @prisma/client
```

Note: `@prisma/client` is a peer dependency. You'll also need the `prisma` CLI as a dev dependency.

## Documentation

For detailed documentation, usage examples, and API reference, see [GUIDE.md](./GUIDE.md).

## Quick Example

```typescript
import { veloxApp } from '@veloxts/core';
import { createDatabasePlugin } from '@veloxts/orm';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = await veloxApp({ port: 3030 });

await app.register(createDatabasePlugin({ client: prisma }));
await app.start();
```

## Learn More

- [Full Documentation](./GUIDE.md)
- [VeloxTS Framework](https://www.npmjs.com/package/@veloxts/velox)
- [GitHub Repository](https://github.com/veloxts/velox-ts-framework)

## License

MIT
