# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VeloxTS Framework** is a Laravel-inspired TypeScript full-stack web framework designed to provide exceptional developer experience and type safety for full-stack TypeScript developers. The framework is currently in MVP development (v0.1.0).

**Key Characteristics:**
- Type safety without code generation (direct type imports using `typeof` and `as const`)
- Hybrid API architecture (tRPC for internal, auto-generated REST for external)
- Convention over configuration with Laravel-style elegance
- Built on Fastify, tRPC, Prisma, and Zod
- Targets Node.js v20+ with TypeScript v5+

**Key Defaults (IMPORTANT - memorize these):**
- **Default API port:** `3030` (not 3210)
- **How to start a new project:** `npx create-velox-app my-app` (recommended)
- **create-velox-app templates:** 5 templates available
  - `--default` (or no flag) - Basic REST API with user CRUD procedures
  - `--auth` - Full authentication (JWT, sessions, guards)
  - `--trpc` - tRPC-only setup for type-safe internal APIs
  - `--rsc` - Full-stack React Server Components with Vinxi
  - `--rsc-auth` - RSC + JWT authentication with `validated()` server actions

## Commands

### Build
```bash
pnpm build             # Compile TypeScript to dist/ (uses Turborepo)
pnpm type-check        # Run TypeScript type checking
pnpm test              # Run tests with Vitest
pnpm lint              # Run Biome linting
```

### Smoke Test
```bash
cd packages/create && pnpm smoke-test           # Test default template
cd packages/create && pnpm smoke-test --default # Explicit default template
cd packages/create && pnpm smoke-test --auth    # Test auth template
cd packages/create && pnpm smoke-test --trpc    # Test tRPC template
cd packages/create && pnpm smoke-test --rsc     # Test RSC full-stack template
cd packages/create && pnpm smoke-test --rsc-auth # Test RSC + auth template
```

**IMPORTANT:** Always use CLI arguments (`--auth`, `--default`, `--trpc`, `--rsc`, `--rsc-auth`) to select templates. Do NOT use environment variables like `SMOKE_TEMPLATE=auth` - the script does not support this pattern.

The smoke test validates the entire `create-velox-app` scaffolder workflow:
1. Builds the scaffolder and all monorepo packages
2. Creates a test project with local `@veloxts/*` packages linked via `file:` references
3. Generates Prisma client and pushes database schema
4. Builds and runs the app, testing `/api/health` and `/api/users` endpoints
5. For `--auth`: Also tests authentication endpoints (`/auth/register`, `/auth/login`, `/auth/me`)
6. For `--trpc`: Tests tRPC-only endpoints without REST adapter
7. For `--rsc`: Tests full-stack RSC app with Vinxi, React 19, and file-based routing
8. For `--rsc-auth`: Tests RSC + JWT auth with `validated()` server actions and auth pages

**Run this before publishing** to catch template errors early.

### Development

The VeloxTS CLI provides a powerful development server with Hot Module Replacement (HMR):

```bash
velox dev              # Start dev server with HMR (default)
velox dev --no-hmr     # Disable HMR, use legacy tsx watch mode
velox dev --verbose    # Enable detailed HMR diagnostics
velox dev --port 4000  # Custom port (default: 3030)
```

#### HMR Features (Default)
- Fast, efficient reloads with sub-second restart times
- Precise timing metrics (startup, reload, total uptime)
- Smart error classification with actionable suggestions
- Formatted console output with visual indicators
- Automatic `velox:ready` IPC integration for accurate timing

#### HMR Configuration
Add to your project's `package.json`:
```json
{
  "hotHook": {
    "boundaries": [
      "src/procedures/**/*.ts",
      "src/schemas/**/*.ts",
      "src/handlers/**/*.ts"
    ]
  }
}
```

Boundaries define which files trigger HMR reloads. Common patterns:
- `src/procedures/**/*.ts` - API procedure definitions
- `src/schemas/**/*.ts` - Zod validation schemas
- `src/config/**/*.ts` - Configuration files

#### Server Ready Signal
For accurate HMR timing, add this to your server entry point after `app.start()`:

```typescript
await app.start();

// Send ready signal to CLI for accurate HMR timing
if (process.send) {
  process.send({ type: 'velox:ready' });
}
```

The CLI listens for this message to measure actual server boot time vs process startup time.

#### Graceful Shutdown
To prevent connection pool leaks during HMR restarts, add shutdown handlers:

```typescript
// Graceful shutdown - disconnect Prisma to prevent connection pool leaks
const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

All scaffolded templates include these patterns by default.

### Publishing to npm (or Verdaccio for local testing)

**IMPORTANT: Always use `pnpm publish`, never `npm publish`**

This monorepo uses pnpm workspaces with `workspace:*` protocol for inter-package dependencies. When publishing:
- `pnpm publish` automatically converts `workspace:*` → actual version numbers (e.g., `0.1.0`)
- `npm publish` does NOT convert these references, causing broken packages

#### Publishing procedure:
```bash
# 1. Build all packages
pnpm build

# 2. Publish each package in dependency order using pnpm
for pkg in core validation orm router auth client cli; do
  cd packages/$pkg
  pnpm publish --registry <registry-url> --no-git-checks
  cd ../..
done

# 3. Publish create-velox-app
cd packages/create
pnpm publish --registry <registry-url> --no-git-checks
```

#### Local testing with Verdaccio:
```bash
# Start Verdaccio
npx verdaccio

# Publish to local registry
pnpm publish --registry http://localhost:4873 --no-git-checks

# Test scaffolder
npm create velox-app@0.1.0 my-app --registry http://localhost:4873
```

## Architecture

### Core Philosophy

1. **Type Safety Without Code Generation**
   - Types flow from backend to frontend through direct imports
   - Uses `as const` assertions and `typeof` for type inference
   - Zero build-time code generation required
   - Compile-time validation of API contracts

2. **Hybrid API Architecture**
   - **Internal communication:** tRPC for type-safe frontend-backend calls
   - **External APIs:** Auto-generated REST endpoints from same business logic
   - Single source of truth for validation and handlers via procedure definitions
   - Naming conventions infer HTTP methods (e.g., `getUser` → `GET /users/:id`)

3. **Convention Over Configuration**
   - Naming conventions automatically generate routes
   - Sensible defaults with escape hatches available
   - Progressive disclosure of complexity (simple by default, powerful when needed)

### Monorepo Structure

The framework is organized as a pnpm monorepo with Turborepo:

```
packages/
├── core/           # @veloxts/core - Fastify wrapper, DI container, plugin system
├── router/         # @veloxts/router - tRPC + REST routing with procedures
├── validation/     # @veloxts/validation - Zod integration
├── orm/            # @veloxts/orm - Prisma wrapper with enhanced DX
├── auth/           # @veloxts/auth - Authentication & authorization (JWT + Sessions)
├── client/         # @veloxts/client - Type-safe frontend API client
├── cli/            # @veloxts/cli - Developer tooling
├── create/         # create-velox-app - Project scaffolder
├── velox/          # @veloxts/velox - Unified meta-package (re-exports core packages)
├── web/            # @veloxts/web - RSC + Vinxi integration
├── mcp/            # @veloxts/mcp - Model Context Protocol server
│
│ # Ecosystem Packages (Early Preview)
├── cache/          # @veloxts/cache - Multi-driver caching (memory, Redis)
├── queue/          # @veloxts/queue - Background jobs (sync, BullMQ)
├── mail/           # @veloxts/mail - Email sending (SMTP, Resend, React Email)
├── storage/        # @veloxts/storage - File storage (local, S3/R2)
├── scheduler/      # @veloxts/scheduler - Cron task scheduling
└── events/         # @veloxts/events - Real-time broadcasting (WebSocket, SSE)

apps/
├── playground/     # Development testing application
└── docs/           # Documentation site (future)

tooling/
├── biome-config/   # Shared Biome configuration
├── tsconfig/       # Shared TypeScript configurations
├── testing/        # Shared test utilities
└── benchmarks/     # Performance benchmarks
```

### Package Dependencies

Build order follows these layers:
1. **Foundation:** `@veloxts/core` (no framework dependencies)
2. **Core features:** `@veloxts/validation`, `@veloxts/orm` (depend on core)
3. **Routing:** `@veloxts/router` (depends on validation + orm)
4. **High-level:** `@veloxts/auth` (depends on router)
5. **Tooling:** `@veloxts/cli` (depends on all), `@veloxts/client` (standalone)

### Key Abstractions

#### Procedure Definition API
The core abstraction is the **procedure** - a fluent builder pattern for defining type-safe API endpoints:

```typescript
export const userProcedures = procedures('users', {
  getUser: procedure
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUnique({ where: { id: input.id } });
    }),

  createUser: procedure
    .input(CreateUserSchema)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    })
});
```

Type inference flows through the procedure chain automatically.

#### REST Adapter Pattern
REST endpoints are auto-generated from procedure naming conventions:

**Supported naming patterns:**
- `getUser` / `get*` → `GET /users/:id` (single resource)
- `listUsers` / `list*` → `GET /users` (collection)
- `findUser` / `find*` → `GET /users` (search/filter)
- `createUser` / `create*` → `POST /users` (201 Created)
- `addUser` / `add*` → `POST /users` (201 Created)
- `updateUser` / `update*` → `PUT /users/:id` (full update)
- `editUser` / `edit*` → `PUT /users/:id` (full update)
- `patchUser` / `patch*` → `PATCH /users/:id` (partial update)
- `deleteUser` / `delete*` → `DELETE /users/:id` (200/204)
- `removeUser` / `remove*` → `DELETE /users/:id` (200/204)

Manual overrides available via `.rest()` method.

#### Context Object
Request-scoped state extended via TypeScript declaration merging:

```typescript
interface BaseContext {
  request: FastifyRequest;
  reply: FastifyReply;
}

// Plugins extend context via declaration merging
declare module '@veloxts/core' {
  interface BaseContext {
    db: PrismaClient;    // from @veloxts/orm
    user?: User;         // from @veloxts/auth
  }
}
```

### Authentication (`@veloxts/auth`)

The auth package provides two authentication strategies:

#### JWT Authentication
Stateless token-based auth using access/refresh token pairs:

```typescript
import { authPlugin, jwtManager, authenticated, hasRole } from '@veloxts/auth';

// Configure JWT auth
const jwt = jwtManager({
  secret: process.env.JWT_SECRET!,
  refreshSecret: process.env.JWT_REFRESH_SECRET!,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
});

// Use guards in procedures
const getProfile = procedure()
  .guard(authenticated)
  .query(({ ctx }) => ctx.user);

const adminOnly = procedure()
  .guard(hasRole('admin'))
  .mutation(({ ctx, input }) => { /* ... */ });
```

#### Session-Based Authentication
Cookie-based sessions as alternative to JWT. Useful for SSR apps or when token storage is a concern:

```typescript
import {
  sessionMiddleware,
  loginSession,
  logoutSession,
  inMemorySessionStore
} from '@veloxts/auth';

// Create session middleware
const session = sessionMiddleware({
  secret: process.env.SESSION_SECRET!,  // 32+ chars, 16+ unique
  store: inMemorySessionStore(),  // Use Redis in production
  cookie: {
    name: 'session',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 86400,  // 24 hours
  },
  expiration: {
    ttl: 86400,           // Session lifetime in seconds
    sliding: true,        // Reset TTL on activity
    absoluteTimeout: 604800,  // Max lifetime (7 days)
  },
  userLoader: async (userId) => db.user.findUnique({ where: { id: userId } }),
});

// Apply middleware to procedures
const getProfile = procedure()
  .use(session.requireAuth())  // Requires authenticated session
  .query(({ ctx }) => ctx.user);

const publicPage = procedure()
  .use(session.optionalAuth())  // User optional
  .query(({ ctx }) => ({ user: ctx.user ?? null }));

// Login helper - regenerates session ID for security
await loginSession(ctx.session, { id: user.id, email: user.email });

// Logout helper - destroys session completely
await logoutSession(ctx.session);

// Check authentication status
if (isSessionAuthenticated(ctx)) {
  // ctx.user is available
}

// Flash messages (one-time data)
ctx.session.flash('success', 'Profile updated!');
const message = ctx.session.getFlash('success');  // Returns once, then removed
```

**Session Features:**
- HMAC-SHA256 signed session IDs with timing-safe verification
- Sliding expiration with optional absolute timeout
- Flash messages for one-time notifications
- Session regeneration on login (prevents session fixation)
- In-memory store (development) or Redis (production)
- Cookie security: httpOnly, secure, sameSite

### Ecosystem Packages (Early Preview)

These packages provide Laravel-style infrastructure patterns. **APIs may change before v1.0.**

#### `@veloxts/cache` - Multi-Driver Caching
```typescript
import { cachePlugin } from '@veloxts/cache';

// Memory cache (development)
app.use(cachePlugin({ driver: 'memory', config: { maxSize: 1000 } }));

// Redis cache (production)
app.use(cachePlugin({ driver: 'redis', config: { url: process.env.REDIS_URL } }));

// Usage
await ctx.cache.put('user:123', user, '30m');
const user = await ctx.cache.get('user:123');
const data = await ctx.cache.remember('key', '1h', async () => fetchData());
await ctx.cache.tags(['users']).flush();  // Tag-based invalidation
```

#### `@veloxts/queue` - Background Job Processing
```typescript
import { queuePlugin, defineJob, dispatch } from '@veloxts/queue';

// Define a job
const SendWelcomeEmail = defineJob('send-welcome-email', {
  input: z.object({ userId: z.string(), email: z.string() }),
  handler: async ({ data }) => {
    await sendEmail(data.email, 'Welcome!');
  },
});

// Dispatch
await dispatch(SendWelcomeEmail, { userId: '123', email: 'user@example.com' });

// Drivers: 'sync' (immediate), 'bullmq' (Redis-backed)
```

#### `@veloxts/mail` - Email with React Templates
```typescript
import { mailPlugin, send } from '@veloxts/mail';

// SMTP or Resend driver
app.use(mailPlugin({
  driver: 'resend',
  config: { apiKey: process.env.RESEND_API_KEY },
  defaults: { from: 'noreply@example.com' },
}));

// Send with React Email template
await send({
  to: 'user@example.com',
  subject: 'Welcome!',
  react: <WelcomeEmail name="John" />,
});
```

#### `@veloxts/storage` - File Storage Abstraction
```typescript
import { storagePlugin } from '@veloxts/storage';

// Local or S3/R2 driver
app.use(storagePlugin({
  driver: 'local',
  config: { root: './uploads', baseUrl: '/files' },
}));

// Usage
await ctx.storage.put('avatars/user-123.jpg', buffer);
const url = await ctx.storage.url('avatars/user-123.jpg');
const stream = await ctx.storage.stream('large-file.zip');
await ctx.storage.delete('old-file.pdf');
```

#### `@veloxts/scheduler` - Cron Task Scheduling
```typescript
import { schedulerPlugin, schedule } from '@veloxts/scheduler';

app.use(schedulerPlugin());

// Fluent API
schedule('cleanup-expired-sessions')
  .call(async () => { await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }); })
  .daily()
  .at('03:00')
  .withoutOverlapping();

schedule('send-daily-digest')
  .call(sendDigestEmails)
  .weekdays()
  .at('09:00');
```

#### `@veloxts/events` - Real-Time Broadcasting
```typescript
import { eventsPlugin, broadcast } from '@veloxts/events';

// WebSocket or SSE driver (optional Redis for scaling)
app.use(eventsPlugin({
  driver: 'ws',
  redis: { url: process.env.REDIS_URL },  // Optional pub/sub
}));

// Broadcast to channel
broadcast('orders', { event: 'order.created', data: { orderId: '123' } });

// Private channels with auth
broadcast(`user.${userId}`, { event: 'notification', data: message });
```

## MVP Scope (v0.1.0)

Currently building toward MVP with these constraints:

### Included in MVP
- Monorepo infrastructure (pnpm + Turborepo + Changesets)
- `@veloxts/core` - Basic Fastify wrapper with simplified plugin system
- `@veloxts/validation` - Zod integration
- `@veloxts/router` - Procedure API with tRPC + REST adapter (full REST verb support)
- `@veloxts/orm` - Prisma client wrapper (manual migrations)
- `@veloxts/auth` - JWT authentication, session management, guards, rate limiting
- `@veloxts/client` - Type-safe API client for frontend
- `@veloxts/cli` - Basic commands (`velox dev`, `velox migrate`, `velox make`)
- `@veloxts/web` - RSC + Vinxi integration with file-based routing
- `@veloxts/velox` - Unified meta-package
- `@veloxts/mcp` - Model Context Protocol server
- `create-velox-app` - Project scaffolding with 5 templates: default, auth, trpc, rsc, and rsc-auth

### Ecosystem Packages (Early Preview)
- `@veloxts/cache` - Multi-driver caching (memory, Redis)
- `@veloxts/queue` - Background job processing (sync, BullMQ)
- `@veloxts/mail` - Email sending (SMTP, Resend, React Email)
- `@veloxts/storage` - File storage abstraction (local, S3/R2)
- `@veloxts/scheduler` - Cron task scheduling
- `@veloxts/events` - Real-time broadcasting (WebSocket, SSE)

### Deferred to v1.1+
- Nested resource routing
- Full DI container with decorators
- React hooks for data fetching
- Migration runner CLI
- Database seeding system

## Development Timeline

Currently in **Week 1** of 6-week MVP sprint:

- Week 1: Foundation + Core package
- Week 2: Router + Validation packages
- Week 3: ORM + Client packages
- Week 4: Playground app validation
- Week 5: CLI + Create tooling
- Week 6: Polish + Release v0.1.0

## Technology Stack

- **Runtime:** Node.js v20+
- **Language:** TypeScript v5+ (strict mode)
- **HTTP Server:** Fastify
- **RPC Layer:** tRPC
- **Validation:** Zod
- **ORM:** Prisma
- **Monorepo:** pnpm workspaces + Turborepo
- **Versioning:** Changesets (synchronized across packages)
- **Testing:** Vitest (when tests are added)
- **CLI Framework:** Commander.js (when CLI is built)

## Prisma 7 Configuration (IMPORTANT)

VeloxTS uses Prisma 7 which has significant breaking changes from Prisma 5/6. **Memorize these patterns.**

### Configuration File (`prisma.config.ts`)
Required in Prisma 7. Database URL is configured here, NOT in `schema.prisma`:

```typescript
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
```

### Schema Changes (`schema.prisma`)
- **`url` NOT allowed** in datasource block (breaking change)
- **`output` required** in generator block

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"  // Required in v7
}

datasource db {
  provider = "sqlite"
  // NO url here - it's in prisma.config.ts
}
```

### Runtime: Driver Adapters Required
**Breaking change**: `datasourceUrl` and `datasources` options REMOVED from PrismaClient constructor.

Must use driver adapters for direct database connections:

```typescript
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });
```

### Required Dependencies by Database

**SQLite:**
```json
{
  "@prisma/adapter-better-sqlite3": "7.2.0",
  "@prisma/client": "7.2.0",
  "better-sqlite3": "11.9.1",
  "prisma": "7.2.0"
}
```

**PostgreSQL:**
```typescript
import { PrismaPg } from '@prisma/adapter-pg';
// Prisma 7: Pass connectionString directly (NOT a Pool instance)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });
```

**MySQL:** `@prisma/adapter-mysql`
**LibSQL/Turso:** `@prisma/adapter-libsql`

### Vite SSR Compatibility
Vite's SSR module evaluation doesn't automatically load `.env` files. Must explicitly load dotenv:

```typescript
import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..');
dotenv.config({ path: resolve(projectRoot, '.env') });
```

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Unknown property datasourceUrl` | Prisma 7 removed this option | Use driver adapter instead |
| `Unknown property datasources` | Prisma 7 removed this option | Use driver adapter instead |
| `needs non-empty valid PrismaClientOptions` | No adapter or accelerateUrl provided | Add driver adapter |
| `Generating into @prisma/client not allowed` | Wrong output path | Use `.prisma/client` instead |

## Working with This Codebase

### When Adding New Features
1. Consider which package the feature belongs to based on the dependency graph
2. Follow convention over configuration principles - prefer sensible defaults
3. Use TypeScript's type system for safety, not runtime validation where possible
4. Maintain type inference chains - avoid explicit type annotations where inference works
5. Keep the API surface minimal and composable

### Code Style
- Use `as const` assertions to preserve literal types
- Prefer `typeof` for deriving types from runtime values
- Leverage declaration merging for extensibility
- Follow Laravel-inspired naming (e.g., procedures, guards, policies)
- Write self-documenting code - comments only where logic isn't self-evident

### Dependency Versioning
- **Always use fixed versions** (no caret `^` or tilde `~`) for all dependencies
- ✅ `"zod": "3.24.4"` - Fixed version, reproducible builds
- ❌ `"zod": "^3.24.4"` - Caret allows minor/patch updates
- ❌ `"zod": "~3.24.4"` - Tilde allows patch updates
- This ensures reproducible builds and prevents unexpected breaking changes
- Applies to both `dependencies` and `devDependencies` in all package.json files

### TypeScript Type Safety - STRICT CONSTRAINTS

**CRITICAL: The following rules are MANDATORY and non-negotiable:**

1. **NEVER use `any` type** - This completely defeats TypeScript's type safety
   - ❌ `const value: any = ...`
   - ❌ `function process(data: any) { ... }`
   - ✅ Use `unknown` and type guards instead
   - ✅ Use proper generic constraints

2. **NEVER use `as any` type assertions** - This bypasses all type checking
   - ❌ `(request as any).context = ...`
   - ❌ `await register(plugin as any)`
   - ✅ Use proper type narrowing or `unknown` with double assertion
   - ✅ Example: `as unknown as TargetType` (only in tests for invalid inputs)

3. **NEVER use `@ts-expect-error` or `@ts-ignore`** - These suppress TypeScript errors
   - ❌ `// @ts-expect-error - fix this later`
   - ❌ `// @ts-ignore`
   - ✅ Fix the underlying type issue properly
   - ✅ If truly needed, use a proper type solution (e.g., `Object.defineProperty`, generics)

4. **Acceptable Type Patterns:**
   - ✅ `unknown` with type guards and narrowing
   - ✅ Generic constraints: `<T extends BaseType>`
   - ✅ Type predicates: `function isX(val: unknown): val is X`
   - ✅ Discriminated unions with type narrowing
   - ✅ Declaration merging for extensibility
   - ✅ Double assertion ONLY in tests: `as unknown as TestType`

5. **Code Review Checklist:**
   - All code must pass `pnpm type-check` with zero errors
   - All code must pass `pnpm lint` with zero warnings
   - Search for `any`, `as any`, `@ts-expect-error`, `@ts-ignore` = all must be zero
   - If you find yourself needing `any`, redesign the types instead

**Why This Matters:**
- Type safety is a core pillar of VeloxTS Framework
- `any` propagates through the codebase like a virus, destroying type safety
- Users expect compile-time guarantees - `any` breaks this promise
- Performance optimizations rely on type information
- Refactoring becomes dangerous without proper types

### Current Development Phase
The project is in early foundation work. Focus is on:
- Setting up monorepo infrastructure correctly
- Building core abstractions that enable type safety
- Validating the type flow from backend to frontend works without codegen
- Keeping scope tight to hit MVP in 6 weeks

### RSC Server/Client Separation (CRITICAL for @veloxts/web)

When working with React Server Components and server actions, strict module boundaries must be maintained to prevent Node.js code from bleeding into the client bundle.

#### The Problem

Even with `'use server'` directives, Vite's bundler analyzes the import graph of client components. If a client component imports a server action that imports Node.js-only dependencies, those dependencies get pulled into the client bundle analysis, causing errors like:
- `No loader is configured for .node files` (native modules)
- `Failed to resolve import 'esbuild'`
- `Module 'node:fs' externalized for browser compatibility`

#### Current Mitigation (Browser Stubs)

`@veloxts/web` provides browser stubs in `packages/web/src/app/create-app.ts` via `NODE_BUILTIN_STUBS`. This is a **temporary workaround**, not a proper solution.

```typescript
// These stubs are applied to the client router's Vite config
const NODE_BUILTIN_STUBS: Record<string, string> = {
  'node:fs': 'data:text/javascript,export default {};...',
  'esbuild': 'data:text/javascript,export default {};...',
  // ... more stubs
};
```

**Problems with stubs:**
1. Whack-a-mole maintenance - new deps need new stubs
2. Masks architectural violations
3. Bundle size bloat from dead code
4. Type safety erosion

#### Recommended Architecture Patterns

**1. Type-Only Imports in Server Actions**

Server action files should use type-only imports for shared types:

```typescript
// GOOD - Type stripped at build time
'use server';
import type { CompiledProcedure } from '@veloxts/router';
import type { ActionResult } from '@veloxts/web';

// BAD - Pulls in full module graph
import { CompiledProcedure } from '@veloxts/router';
```

**2. Isolate Database/Heavy Dependencies**

Database clients and native modules should only be imported in files that are exclusively server-side:

```typescript
// app/actions/users.ts
'use server';

// GOOD - Dynamic import at runtime (server only)
export async function getUsers() {
  const { db } = await import('@/api/database');
  return db.user.findMany();
}

// BAD - Static import analyzed at bundle time
import { db } from '@/api/database';
export async function getUsers() {
  return db.user.findMany();
}
```

**3. Procedure Bridge Pattern**

When bridging procedures to server actions, pass procedure identifiers rather than importing procedures directly:

```typescript
// GOOD - Server action with lazy procedure loading
'use server';
export async function login(input: LoginInput) {
  const { executeProcedure } = await import('@veloxts/web/server');
  const { authProcedures } = await import('@/api/procedures/auth');
  return executeProcedure(authProcedures.procedures.createSession, input);
}

// BAD - Static imports pull entire procedure graph
import { authProcedures } from '@/api/procedures/auth';
export async function login(input: LoginInput) {
  // ...
}
```

**4. Package Export Conditions (Future)**

`@veloxts/web` should eventually provide separate entry points:

```json
{
  "exports": {
    ".": {
      "server": "./dist/index.server.js",
      "client": "./dist/index.client.js"
    }
  }
}
```

#### Adding New Stubs (If Absolutely Necessary)

If a new Node.js module causes client bundle errors:

1. **First, try to fix the import chain** - Use dynamic imports or type-only imports
2. **If stubs are unavoidable**, add to `NODE_BUILTIN_STUBS` in `packages/web/src/app/create-app.ts`
3. **Document why** the stub is needed and which import chain causes it
4. **Add a TODO** to fix properly via module separation

```typescript
// In NODE_BUILTIN_STUBS
'new-problematic-module': 'data:text/javascript,export default {};',
// TODO: Remove once we split @veloxts/web exports (issue #XXX)
```

#### Testing for Module Leaks

After changes to server actions or `@veloxts/web`:

```bash
# Run RSC smoke test - will fail if client bundle has Node.js deps
cd packages/create && pnpm smoke-test --rsc-auth
```

Watch for these warning signs in Vite output:
- `Module externalized for browser compatibility`
- `No loader configured for .node files`
- Very large client bundle sizes (>500KB suggests server code leaking)

### Reference Documents
Key planning documents in `/.plans/`:
- `/.plans/0.requirements.md` - Full specification with Laravel inspiration philosophy
- `/.plans/ROADMAP.md` - 6-week implementation timeline
- `/.plans/ARCHITECTURE.md` - Technical architecture and design patterns
- `/plan/MVP-SCOPE.md` - What's included vs deferred to v1.1

## Deployment Targets

**MVP Focus:**
- Long-running servers (Railway, Render, Fly.io, DigitalOcean)
- Docker containers
- Environment-based configuration

**Future Support:**
- Serverless (AWS Lambda, Vercel Functions)
- Edge runtimes

## Framework Inspiration

Heavily inspired by **Laravel's** developer experience philosophy:
- Convention over configuration
- Elegant, expressive syntax
- Batteries included (but modular)
- Progressive disclosure of complexity
- Composition over reinvention

Adapted for TypeScript's strengths:
- Compile-time type safety instead of runtime magic
- Unified full-stack language
- Modern async patterns
- Cloud-native deployment
