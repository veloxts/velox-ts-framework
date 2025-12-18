# VeloxTS Framework

> **Alpha Release** - This framework is in early development. APIs may change. Not recommended for production use yet.

A TypeScript-first full-stack web framework focused on developer experience and end-to-end type safety.

## Key Features

- **Type Safety Without Code Generation** - Types flow naturally from backend to frontend using `typeof` and `as const`. No build step required for type synchronization.

- **Unified API Layer** - Define your API once with procedures, get both tRPC (for internal type-safe calls) and REST endpoints (for external consumers) automatically.

- **Convention Over Configuration** - Sensible defaults with escape hatches. Naming conventions auto-generate REST routes:
  - `getUser` becomes `GET /api/users/:id`
  - `listUsers` becomes `GET /api/users`
  - `createUser` becomes `POST /api/users`

- **Modern Stack** - Built on proven technologies: Fastify, tRPC, Prisma, and Zod.

- **Elegant, Expressive Syntax** - Clean APIs that are easy to read and write.

## Quick Start

```bash
# Create a new project
npx create-velox-app my-app

# Navigate to project
cd my-app

# Set up database
npm run db:push

# Start development server
npm run dev
```

Your API is now running at `http://localhost:3030`.

## Example: Defining Procedures

```typescript
import { procedure, defineProcedures } from '@veloxts/router';
import { z } from 'zod';

export const userProcedures = defineProcedures('users', {
  // GET /api/users/:id
  getUser: procedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUnique({ where: { id: input.id } });
    }),

  // GET /api/users
  listUsers: procedure
    .query(async ({ ctx }) => {
      return ctx.db.user.findMany();
    }),

  // POST /api/users
  createUser: procedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),
});
```

## Packages

| Package | Description |
|---------|-------------|
| [`@veloxts/core`](./packages/core) | Fastify wrapper, plugin system, and application lifecycle |
| [`@veloxts/router`](./packages/router) | Procedure definitions with tRPC and REST routing |
| [`@veloxts/validation`](./packages/validation) | Zod integration and common validation schemas |
| [`@veloxts/orm`](./packages/orm) | Prisma wrapper with enhanced developer experience |
| [`@veloxts/client`](./packages/client) | Type-safe frontend API client |
| [`@veloxts/cli`](./packages/cli) | Development server and CLI commands |
| [`create-velox-app`](./packages/create) | Project scaffolder |

## Documentation

- [Getting Started Guide](./docs/GETTING_STARTED.md) - Complete walkthrough for new users
- [Prisma 7 Setup Guide](./docs/PRISMA-7-SETUP.md) - Comprehensive guide for configuring Prisma 7 driver adapters
- [REST Naming Conventions](./docs/REST-NAMING-CONVENTIONS.md) - Complete reference for procedure naming patterns
- [Test Development Guide](./docs/TEST-DEVELOPMENT-GUIDE.md) - Testing patterns and utilities
- [Package READMEs](./packages) - Detailed documentation for each package

## Requirements

- Node.js 20 or later
- TypeScript 5 or later
- pnpm, npm, or yarn

## Project Structure

A typical VeloxTS project:

```
my-app/
├── src/
│   ├── index.ts              # Application entry point
│   ├── config/
│   │   └── index.ts          # Configuration
│   ├── database/
│   │   └── index.ts          # Prisma client
│   └── procedures/
│       ├── index.ts          # Procedure exports
│       ├── users.ts          # User procedures
│       └── health.ts         # Health check
├── prisma/
│   └── schema.prisma         # Database schema
├── package.json
└── tsconfig.json
```

## Development

This is a monorepo managed with pnpm and Turborepo.

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm type-check

# Lint
pnpm lint
```

## Current Status

**v0.1.0-alpha** - Initial MVP release.

This is an early alpha. The framework provides a solid foundation but is not feature-complete:

| Feature | Status |
|---------|--------|
| Core framework | Available |
| Procedure-based routing | GET and POST only |
| Prisma integration | Available |
| Type-safe client | Available |
| Development CLI | Basic (`velox dev`) |
| Project scaffolder | Available |
| Authentication | Planned for v1.1 |
| PUT/PATCH/DELETE | Planned for v1.1 |
| CLI generators | Planned for v1.1 |

### What Works Well

- Fluent procedure builder API with excellent type inference
- Convention-based REST route generation
- End-to-end type safety without code generation
- Clean plugin system for extensibility

### Known Limitations

- Only GET and POST HTTP methods in v0.1.0
- No built-in authentication (use external packages or wait for v1.1)
- CLI is minimal - no code generators yet
- Limited documentation and examples

## Contributing

This project is in early alpha. **Contributions are not expected at this time.** The API is still stabilizing and significant changes are planned for v1.1.

If you're interested in following development, watch the repository for updates.

## License

[MIT](./LICENSE)
