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
cd packages/create && pnpm smoke-test
```

The smoke test validates the entire `create-velox-app` scaffolder workflow:
1. Builds the scaffolder and all monorepo packages
2. Creates a test project with local `@veloxts/*` packages linked via `file:` references
3. Generates Prisma client and pushes database schema
4. Builds and runs the app, testing `/api/health` and `/api/users` endpoints

**Run this before publishing** to catch template errors early.

### Development
This is a framework project, not an application. There is no dev server command yet. The CLI (`velox dev`) will be built in Week 5 of the roadmap.

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
├── auth/           # @veloxts/auth - Authentication & authorization (v1.1+)
├── client/         # @veloxts/client - Type-safe frontend API client
├── cli/            # @veloxts/cli - Developer tooling
└── create/         # create-velox-app - Project scaffolder

apps/
├── playground/     # Development testing application
└── docs/           # Documentation site (future)

tooling/
├── biome-config/   # Shared Biome configuration
└── tsconfig/       # Shared TypeScript configurations
```

### Package Dependencies

Build order follows these layers:
1. **Foundation:** `@veloxts/core` (no framework dependencies)
2. **Core features:** `@veloxts/validation`, `@veloxts/orm` (depend on core)
3. **Routing:** `@veloxts/router` (depends on validation + orm)
4. **High-level:** `@veloxts/auth` (depends on router) - v1.1+
5. **Tooling:** `@veloxts/cli` (depends on all), `@veloxts/client` (standalone)

### Key Abstractions

#### Procedure Definition API
The core abstraction is the **procedure** - a fluent builder pattern for defining type-safe API endpoints:

```typescript
export const userProcedures = defineProcedures('users', {
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

**MVP (v0.1.0) - GET and POST only:**
- `getUser` → `GET /users/:id`
- `listUsers` → `GET /users`
- `createUser` → `POST /users`

**v1.1+ - Full REST:**
- `updateUser` → `PUT /users/:id`
- `deleteUser` → `DELETE /users/:id`

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
    user?: User;         // from @veloxts/auth (v1.1)
  }
}
```

## MVP Scope (v0.1.0)

Currently building toward MVP with these constraints:

### Included in MVP
- Monorepo infrastructure (pnpm + Turborepo + Changesets)
- `@veloxts/core` - Basic Fastify wrapper with simplified plugin system
- `@veloxts/validation` - Zod integration
- `@veloxts/router` - Procedure API with tRPC + REST adapter (GET/POST only)
- `@veloxts/orm` - Prisma client wrapper (manual migrations)
- `@veloxts/client` - Type-safe API client for frontend
- `@veloxts/cli` - Basic commands (`velox dev`, `velox migrate`)
- `create-velox-app` - Project scaffolding with one default template

### Deferred to v1.1+
- Authentication system (`@veloxts/auth`)
- Full REST verbs (PUT, PATCH, DELETE)
- Nested resource routing
- Full DI container with decorators
- Code generators
- React hooks
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

### Reference Documents
Key planning documents in `/plan/`:
- `requirements.md` - Full specification with Laravel inspiration philosophy
- `ARCHITECTURE.md` - Technical architecture and design patterns
- `MVP-SCOPE.md` - What's included vs deferred to v1.1
- `ROADMAP.md` - 6-week implementation timeline

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
