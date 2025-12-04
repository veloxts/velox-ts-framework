# VeloxTS Framework - Architecture Documentation

## Overview

VeloxTS is a Laravel-inspired TypeScript full-stack framework built on modern tooling with a focus on developer experience and type safety.

---

## Core Principles

### 1. Type Safety Without Code Generation
- Direct type imports using `typeof` and `as const`
- Types flow from backend to frontend automatically
- No build-time code generation step
- Compile-time validation of API contracts

### 2. Convention Over Configuration
- Naming conventions infer HTTP methods and routes
- Sensible defaults for common use cases
- Escape hatches available when needed
- Laravel-style elegance

### 3. Hybrid API Architecture
- **Internal:** tRPC for type-safe frontend-backend communication
- **External:** Auto-generated REST API from same business logic
- Single source of truth for validation and handlers
- No code duplication

### 4. Batteries Included
- Integrated ORM (Prisma)
- Authentication system (v1.1)
- CLI tooling
- Migration management
- Validation (Zod)
- Plugin system

---

## Monorepo Structure

```
@veloxts/
├── .changeset/                   # Version management (Changesets)
├── packages/
│   ├── core/                     # @veloxts/core - Foundation
│   ├── router/                   # @veloxts/router - Procedures + tRPC/REST
│   ├── validation/               # @veloxts/validation - Zod integration
│   ├── orm/                      # @veloxts/orm - Prisma wrapper
│   ├── auth/                     # @veloxts/auth - JWT auth (v1.1)
│   ├── client/                   # @veloxts/client - Type-safe API client
│   ├── cli/                      # @veloxts/cli - Developer tooling
│   └── create/                   # create-velox-app - Project scaffolder
├── apps/
│   ├── playground/               # Dogfooding application
│   └── docs/                     # Documentation site
├── tooling/
│   ├── biome-config/             # Shared Biome configuration
│   └── tsconfig/
│       ├── base.json
│       ├── node.json
│       └── react.json
├── .npmrc                        # pnpm configuration (exact versions)
├── biome.json                    # Biome linter/formatter config
├── package.json                  # Root workspace
├── pnpm-workspace.yaml           # pnpm workspace config
├── turbo.json                    # Turborepo pipelines
└── tsconfig.json                 # Root TypeScript config
```

---

## Package Dependency Graph

```
Layer 1 (Foundation - No Dependencies):
┌─────────────────┐
│  @veloxts/core  │ ← Start here
└─────────────────┘

Layer 2 (Core Features - Depend on core):
┌─────────────────────┐  ┌─────────────────┐
│ @veloxts/validation │  │  @veloxts/orm   │
└─────────────────────┘  └─────────────────┘
           │                      │
           └──────────┬───────────┘
                      ↓
Layer 3 (Routing - Depends on validation + orm):
         ┌────────────────────┐
         │  @veloxts/router    │
         └────────────────────┘
                    ↓
Layer 4 (High-Level Features):
         ┌────────────────────┐
         │  @veloxts/auth     │ (v1.1)
         └────────────────────┘

Layer 5 (Client & Tooling - Independent):
┌─────────────────────┐  ┌─────────────────────┐
│  @veloxts/client    │  │   @veloxts/cli      │
│  (standalone)       │  │ (depends on all)    │
└─────────────────────┘  └─────────────────────┘

         ┌───────────────────┐
         │ create-velox-app  │
         │   (independent)   │
         └───────────────────┘
```

### Build Order

1. **Parallel:** `@veloxts/core`, `@veloxts/client`, `create-velox-app`
2. **Parallel:** `@veloxts/validation`, `@veloxts/orm` (after core)
3. **Sequential:** `@veloxts/router` (after validation + orm)
4. **Sequential:** `@veloxts/auth` (after router) - v1.1
5. **Final:** `@veloxts/cli` (after all others)

---

## Core Abstractions

### 1. Plugin System

**Design:** Built on Fastify's encapsulation model

```typescript
// Define a plugin
export const myPlugin = definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  dependencies: ['@veloxts/router'], // Optional
  async register(server, options) {
    // Plugin logic
    server.decorate('myFeature', () => { /* ... */ });
  }
});

// Register plugin
await server.register(myPlugin, { /* options */ });
```

**Key Features:**
- Explicit dependency declaration
- Isolated plugin contexts
- Type-safe decoration
- Lifecycle hooks integration

---

### 2. Procedure Definition API

**Design:** Fluent builder with automatic type inference (inspired by tRPC)

```typescript
import { procedure } from '@veloxts/router';
import { z } from '@veloxts/validation';

export const userProcedures = defineProcedures('users', {
  // Query procedure
  getUser: procedure
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUnique({
        where: { id: input.id }
      });
    }),

  // Mutation procedure
  createUser: procedure
    .input(CreateUserSchema)
    .output(UserSchema)
    .use(auth.middleware()) // Optional middleware
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    })
});
```

**Type Inference Flow:**
```
.input(schema) → Zod infers input type
       ↓
.output(schema) → Zod infers output type
       ↓
typeof export → TypeScript preserves types
       ↓
Frontend import → Full type safety
```

---

### 3. REST Adapter Pattern

**Design:** Convention-based mapping with override capability

#### Naming Conventions

| Procedure Name | HTTP Method | Generated Path | Example |
|---------------|-------------|----------------|---------|
| `getUser` | GET | `/:id` | `GET /users/:id` |
| `listUsers` | GET | `/` | `GET /users` |
| `createUser` | POST | `/` | `POST /users` |
| `updateUser` | PUT | `/:id` | `PUT /users/:id` (v1.1) |
| `deleteUser` | DELETE | `/:id` | `DELETE /users/:id` (v1.1) |

#### MVP Scope (v0.1.0)
- ✅ GET and POST only
- ⏳ PUT, PATCH, DELETE deferred to v1.1

#### Manual Override

```typescript
sendPasswordReset: procedure
  .input(z.object({ email: z.string() }))
  .mutation(handler)
  .rest({
    method: 'POST',
    path: '/auth/password-reset'
  })
```

---

### 4. Context Object

**Design:** Request-scoped state with plugin decorations

```typescript
// Base context (always available)
interface BaseContext {
  request: FastifyRequest;
  reply: FastifyReply;
  // Plugins add more via declaration merging
}

// Plugin decorations (via declaration merging)
declare module '@veloxts/core' {
  interface BaseContext {
    db: PrismaClient;      // from @veloxts/orm
    user?: User;           // from @veloxts/auth (v1.1)
  }
}
```

**Benefits:**
- Type-safe plugin extensions
- Request-scoped data
- IDE autocomplete support
- Clear plugin contracts

---

### 5. Type Flow Architecture

```
┌─────────────────────────────────────┐
│         Backend Procedures          │
│  .input(schema) → .output(schema)   │
└───────────────┬─────────────────────┘
                │
                │ export type AppRouter = typeof appRouter;
                │
                ↓
┌─────────────────────────────────────┐
│      Frontend Type Import           │
│  import type { AppRouter }          │
│    from '../../server'              │
└───────────────┬─────────────────────┘
                │
                ↓
┌─────────────────────────────────────┐
│       Type-Safe API Client          │
│  const api = createClient<AppRouter>│
│  const user = await api.users       │
│    .getUser({ id: '123' })          │
│  // ↑ Fully typed, autocomplete ✨  │
└─────────────────────────────────────┘
```

**Key Techniques:**
- `as const` assertions preserve literal types
- `typeof` derives types from runtime values
- TypeScript project references for fast builds
- **Zero code generation required**

---

## Technology Stack

### Core Runtime
- **Node.js:** v20+ (native fetch, top-level await)
- **TypeScript:** v5+ (strict mode, advanced types)
- **Package Manager:** pnpm (fast, efficient)

### Framework Foundation
- **HTTP Server:** Fastify (performance + plugin architecture)
- **RPC Layer:** tRPC (type-safe internal APIs)
- **Validation:** Zod (TypeScript-native schemas)
- **ORM:** Prisma (best-in-class TypeScript DX)

### Developer Tooling
- **Monorepo:** Turborepo (caching, orchestration)
- **Versioning:** Changesets (synchronized releases)
- **Linter/Formatter:** Biome (fast, unified tooling)
- **CLI Framework:** Commander.js (mature, stable)
- **Interactive Prompts:** Clack (beautiful terminal UX)
- **Testing:** Vitest (fast, TypeScript-native)

### Frontend (Optional)
- **Framework:** React (optional, pluggable)
- **State Management:** @tanstack/react-query (optional)
- **API Client:** Custom fetch wrapper (included)

---

## Design Patterns

### Convention Over Configuration
```typescript
// No configuration needed - conventions infer everything
export const userProcedures = defineProcedures('users', {
  getUser: procedure.query(handler),
  // → Generates: GET /api/users/:id

  listUsers: procedure.query(handler),
  // → Generates: GET /api/users

  createUser: procedure.mutation(handler)
  // → Generates: POST /api/users
});
```

### Progressive Disclosure of Complexity
```typescript
// Simple case - just works
createUser: procedure
  .input(CreateUserSchema)
  .mutation(handler)

// Complex case - full control available
createUser: procedure
  .input(CreateUserSchema)
  .output(UserSchema)
  .use(auth.middleware())
  .use(rateLimit.middleware())
  .rest({
    method: 'POST',
    path: '/api/v2/users',
    statusCode: 201
  })
  .mutation(handler)
```

### Composition Over Inheritance
```typescript
// Build complex functionality from simple pieces
const authMiddleware = auth.middleware();
const adminGuard = auth.can('admin');
const validate = validation.middleware();

const protectedProcedure = procedure
  .use(authMiddleware)
  .use(adminGuard)
  .use(validate);

// Reuse composed procedure
export const adminProcedures = {
  deleteUser: protectedProcedure.mutation(handler),
  banUser: protectedProcedure.mutation(handler)
};
```

---

## Dependency Management

### Version Pinning Strategy
- **Exact versions only** - All dependencies use exact versions (no `^` or `~`)
- Configured via `.npmrc` with `save-exact=true`
- Ensures consistent builds across all environments
- Prevents unexpected breaking changes from minor/patch updates

### Rationale
- **Reproducibility:** Same versions installed on all machines
- **Stability:** No surprise updates in CI/CD or production
- **Explicit upgrades:** Dependency updates are intentional and tested
- **Monorepo safety:** Prevents version conflicts across workspace packages

### Updating Dependencies
- Use `pnpm update <package>` to explicitly upgrade
- Test thoroughly before committing version bumps
- Document breaking changes in changelog

---

## Performance Considerations

### Build-Time Optimizations
- TypeScript project references for incremental builds
- Turborepo caching for fast CI/CD
- Tree-shaking friendly package exports
- No runtime code generation overhead

### Runtime Optimizations
- Fastify's compiled middleware tree (resolved at startup)
- Connection pooling for database (Prisma)
- Lazy loading of routes and modules
- Zero-copy buffer operations where possible
- Streaming responses for large payloads

### MVP vs v1.1
**MVP (v0.1.0):**
- Focus on correctness and DX
- Basic performance (good enough)
- Profile after playground app

**v1.1:**
- Performance optimizations based on profiling
- Caching strategies
- Advanced optimizations

---

## Security Considerations

### MVP (v0.1.0)
- Input validation via Zod schemas
- TypeScript type safety
- CORS configuration support
- Basic error handling

### v1.1
- JWT authentication
- CSRF protection
- Rate limiting
- Password hashing (bcrypt/argon2)
- Security headers
- SQL injection prevention (via Prisma)

---

## Deployment Architecture

### Supported Platforms
- **Long-running servers:** Railway, Render, Fly.io, DigitalOcean (recommended)
- **Containers:** Docker, AWS ECS/EKS, Google Cloud Run
- **Serverless:** AWS Lambda, Vercel Functions (basic support)

### MVP Deployment
- Focus on long-running server deployment
- Docker support
- Environment-based configuration
- Database connection pooling

### Post-MVP
- Serverless adapter optimization
- Edge runtime support (future)
- Auto-scaling recommendations
- Performance monitoring integration

---

## Comparison with Similar Frameworks

| Feature | VeloxTS | NestJS | AdonisJS | T3 Stack |
|---------|------|--------|----------|----------|
| **Type Safety** | ✅ Direct import | ✅ Decorators | ✅ TypeScript | ✅ tRPC |
| **Laravel-inspired** | ✅ Yes | ❌ No | ✅ Yes | ❌ No |
| **Auto REST** | ✅ Yes | ❌ Manual | ❌ Manual | ❌ No |
| **tRPC Built-in** | ✅ Yes | ❌ Add-on | ❌ No | ✅ Yes |
| **Fastify** | ✅ Yes | ❌ Express | ✅ Yes | ❌ Next.js |
| **Opinionated** | ✅ Medium | ⚠️ Heavy | ✅ Medium | ⚠️ Light |
| **Full-stack** | ✅ Yes | ❌ Backend | ❌ Backend | ✅ Yes |

**VeloxTS's Unique Value:**
- Laravel DX + TypeScript type safety
- Hybrid API (tRPC + auto-generated REST)
- Batteries included but modular
- Fast iteration with simplified core

---

## Future Considerations (Post v1.1)

### Potential Features
- GraphQL support (alongside tRPC/REST)
- WebSocket/SSE for real-time features
- Background job processing
- Email templating system
- File storage abstraction
- Testing utilities
- Admin panel generator
- OpenAPI/Swagger documentation

### Community Ecosystem
- Plugin marketplace
- Third-party integrations
- Starter templates
- Deployment guides
- Video tutorials
- Community Discord

---

## References

- **Inspiration:** Laravel PHP Framework
- **Type Safety:** tRPC approach
- **Server:** Fastify ecosystem
- **ORM:** Prisma methodology
- **Validation:** Zod patterns
- **Philosophy:** Convention over configuration, progressive disclosure

---

**Last Updated:** December 2024
**Status:** MVP Development (v0.1.0)
