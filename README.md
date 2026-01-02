# Velox TS Framework

> **Early Preview (v0.6.x)** - APIs are stabilizing but may still change. Use with caution in production.

Full-stack TypeScript framework with end-to-end type safety—no code generation required. Convention-driven APIs that generate both tRPC and REST from a single source.

## Key Features

- **Type Safety Without Code Generation** - Types flow naturally from backend to frontend using `typeof` and `as const`. No build step required for type synchronization.

- **Unified API Layer** - Define your API once with procedures, get both tRPC (for internal type-safe calls) and REST endpoints (for external consumers) automatically.

- **Full REST Support** - Convention-based routing for all HTTP methods:
  - `getUser` / `findUser` → `GET /api/users/:id`
  - `listUsers` → `GET /api/users`
  - `createUser` / `addUser` → `POST /api/users`
  - `updateUser` / `editUser` → `PUT /api/users/:id`
  - `patchUser` → `PATCH /api/users/:id`
  - `deleteUser` / `removeUser` → `DELETE /api/users/:id`

- **Built-in Authentication** - JWT and session-based auth with guards, rate limiting, CSRF protection, and token rotation.

- **Complete Ecosystem** - Production-ready packages for caching, queues, email, storage, scheduling, and real-time events—all with full DI support.

- **Modern Stack** - Built on proven technologies: Fastify, tRPC, Prisma, and Zod.

- **Elegant, Expressive Syntax** - Fluent builder APIs with full IntelliSense support and minimal boilerplate.

## Quick Start

```bash
# Create a new project (default template)
npx create-velox-app my-app

# Or with authentication included
npx create-velox-app my-app --auth

# Navigate to project
cd my-app

# Set up database
npm run db:push

# Start development server
npm run dev
```

Your API is now running at `http://localhost:3030`.

### Available Templates

| Template | Command | Description |
|----------|---------|-------------|
| Default | `npx create-velox-app my-app` | Basic REST API with user CRUD procedures |
| Auth | `npx create-velox-app my-app --auth` | Full authentication (JWT, sessions, guards) |
| tRPC | `npx create-velox-app my-app --trpc` | tRPC-only setup for type-safe internal APIs |

## Example: Defining Procedures

```typescript
import { procedure, procedures } from '@veloxts/router';
import { z } from 'zod';

export const userProcedures = procedures('users', {
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

## Ecosystem Features

VeloxTS includes a complete set of infrastructure packages for common application needs:

```typescript
// Multi-driver caching with tag-based invalidation
await ctx.cache.remember('user:123', '30m', () => fetchUser());
await ctx.cache.tags(['users']).flush();

// Background job processing
await dispatch(SendWelcomeEmail, { userId: '123', email: 'user@example.com' });

// Email with React templates
await send({
  to: 'user@example.com',
  subject: 'Welcome!',
  react: <WelcomeEmail name="John" />,
});

// File storage abstraction
await ctx.storage.put('avatars/user-123.jpg', buffer);
const url = await ctx.storage.url('avatars/user-123.jpg');

// Fluent cron scheduling
schedule('cleanup-sessions').call(cleanupExpiredSessions).daily().at('03:00');

// Real-time broadcasting
broadcast('orders', { event: 'order.created', data: { orderId: '123' } });
```

All ecosystem packages support **Dependency Injection** with symbol-based tokens, bulk provider registration, and service mocking for testing.

## Packages

### Core Packages

| Package | Description |
|---------|-------------|
| [`@veloxts/velox`](./packages/velox) | Umbrella package - all framework features in one import |
| [`@veloxts/core`](./packages/core) | Fastify wrapper, plugin system, DI container, and application lifecycle |
| [`@veloxts/router`](./packages/router) | Procedure definitions with tRPC and REST routing |
| [`@veloxts/validation`](./packages/validation) | Zod integration and common validation schemas |
| [`@veloxts/orm`](./packages/orm) | Prisma wrapper with enhanced developer experience |
| [`@veloxts/auth`](./packages/auth) | JWT, sessions, guards, rate limiting, CSRF protection |
| [`@veloxts/client`](./packages/client) | Type-safe frontend API client |
| [`@veloxts/cli`](./packages/cli) | Development server with HMR and CLI commands |
| [`@veloxts/mcp`](./packages/mcp) | Model Context Protocol server for AI tool integration |
| [`create-velox-app`](./packages/create) | Interactive project scaffolder |

### Ecosystem Packages

All ecosystem packages support Dependency Injection with symbol-based tokens, bulk registration via `registerXxxProviders()`, and service mocking for testing.

| Package | Description |
|---------|-------------|
| [`@veloxts/cache`](./packages/cache) | Multi-driver caching (memory, Redis) with tag-based invalidation |
| [`@veloxts/queue`](./packages/queue) | Background job processing with sync and BullMQ drivers |
| [`@veloxts/mail`](./packages/mail) | Email sending with SMTP, Resend, and React Email template support |
| [`@veloxts/storage`](./packages/storage) | File storage abstraction for local filesystem and S3/R2 |
| [`@veloxts/scheduler`](./packages/scheduler) | Fluent cron task scheduling with overlap protection |
| [`@veloxts/events`](./packages/events) | Real-time broadcasting via WebSocket and SSE with Redis pub/sub |

## Documentation

- [Getting Started Guide](./docs/GETTING_STARTED.md) - Complete walkthrough for new users
- [Deployment Guide](./docs/DEPLOYMENT.md) - Docker, Railway, and Render deployment
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

**v0.6.x** - Pre-release with stable core features.

The framework provides a solid foundation for building type-safe APIs:

| Feature | Status |
|---------|--------|
| Core framework | ✅ Stable |
| Procedure-based routing | ✅ All HTTP methods (GET, POST, PUT, PATCH, DELETE) |
| Prisma integration | ✅ Stable |
| Type-safe client | ✅ Stable |
| JWT Authentication | ✅ Available |
| Session Authentication | ✅ Available |
| Guards & Authorization | ✅ Available |
| Rate Limiting | ✅ Available |
| Development CLI with HMR | ✅ Available |
| Project scaffolder | ✅ Available (default, auth, trpc templates) |
| MCP Server (AI integration) | ✅ Available |
| CLI code generators | ✅ 16 generators available |
| Database seeding | ✅ Seeder generator available |
| **Ecosystem Packages** | |
| Multi-driver caching | ✅ Available (memory, Redis) |
| Background job processing | ✅ Available (sync, BullMQ) |
| Email sending | ✅ Available (SMTP, Resend, React Email) |
| File storage | ✅ Available (local, S3/R2) |
| Cron task scheduling | ✅ Available |
| Real-time broadcasting | ✅ Available (WebSocket, SSE) |
| Dependency Injection | ✅ Full DI support across all ecosystem packages |

### What Works Well

- Fluent procedure builder API with excellent type inference
- Convention-based REST route generation for all HTTP methods
- End-to-end type safety without code generation
- Comprehensive authentication system (JWT + sessions)
- Guard-based authorization with composable rules
- Hot Module Replacement in development
- Clean plugin system for extensibility
- 16 code generators (`velox make <type>`) for rapid development
- AI-native development with MCP server integration
- Complete ecosystem packages (cache, queue, mail, storage, scheduler, events)
- Symbol-based Dependency Injection with service mocking for testing

### Current Limitations

- React Server Components not yet available (planned for v0.7)
- Small ecosystem (early adopter stage)

## Contributing

This project is in pre-alpha development. We welcome feedback and bug reports through GitHub issues.

For code contributions, please open an issue first to discuss the proposed changes. The API is stabilizing but may still evolve before v1.0.

## License

[MIT](./LICENSE)
