# @veloxts/velox - Complete Guide

> **Alpha Release** - This framework is in early development. APIs may change between versions. Not recommended for production use yet.

Complete VeloxTS framework - batteries included.

## Installation

```bash
npm install @veloxts/velox
# or
pnpm add @veloxts/velox
# or
yarn add @veloxts/velox
```

## Usage

### Quick Start

```typescript
import { createVeloxApp, procedure, defineProcedures, z } from '@veloxts/velox';

const app = await createVeloxApp({ port: 3000 });

const myProcedures = defineProcedures('greet', {
  sayHello: procedure()
    .input(z.object({ name: z.string() }))
    .query(({ input }) => `Hello, ${input.name}!`),
});

await app.start();
```

### Import Patterns

VeloxTS supports three import patterns for different needs:

#### 1. Main Export (Simplest)

```typescript
import { createVeloxApp, procedure, z } from '@veloxts/velox';
```

#### 2. Subpath Imports (Better Tree-Shaking)

```typescript
import { createVeloxApp } from '@veloxts/velox/core';
import { procedure, defineProcedures } from '@veloxts/velox/router';
import { z } from '@veloxts/velox/validation';
import { createDatabasePlugin } from '@veloxts/velox/orm';
```

#### 3. Direct Package Imports (Best Tree-Shaking)

```typescript
import { createVeloxApp } from '@veloxts/core';
import { procedure, defineProcedures } from '@veloxts/router';
import { z } from '@veloxts/validation';
import { createDatabasePlugin } from '@veloxts/orm';
```

## Included Packages

This umbrella package includes:

| Package | Description |
|---------|-------------|
| `@veloxts/core` | Application bootstrap, plugins, context |
| `@veloxts/validation` | Zod integration and schema utilities |
| `@veloxts/orm` | Database plugin and Prisma integration |
| `@veloxts/router` | Procedure definitions, REST adapter, tRPC |
| `@veloxts/auth` | Authentication and authorization (v1.1+) |

## Not Included

These packages are installed separately:

- `@veloxts/client` - Type-safe frontend API client
- `@veloxts/cli` - Developer tooling CLI
- `create-velox-app` - Project scaffolder

## Documentation

- [VeloxTS Documentation](https://veloxts.dev)
- [GitHub Repository](https://github.com/veloxts/velox-ts-framework)

## License

MIT
