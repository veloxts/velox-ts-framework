# VeloxTS Framework - MVP Feature Scope

## Version 0.1.0 - Minimum Viable Product

This document defines what features are **included** in the MVP release and what is **deferred** to future versions.

---

## ✅ INCLUDED in MVP v0.1.0

### Core Infrastructure
- ✅ **Monorepo with pnpm + Turborepo**
  - Workspace configuration
  - Build pipelines
  - Changesets for version management
  - Shared tooling configs (TypeScript, Biome)

### @veloxts/core
- ✅ **Basic Fastify server wrapper**
  - Server creation and configuration
  - Simple plugin registration system
  - Basic context object
- ✅ **Plugin system (simplified)**
  - Register plugins with options
  - Plugin lifecycle hooks
  - No full DI container yet (deferred)

### @veloxts/validation
- ✅ **Zod integration**
  - Schema definition utilities
  - Validation middleware
  - Common schema library (ids, pagination, emails, etc.)
  - Type inference from schemas

### @veloxts/router
- ✅ **Procedure definition API**
  - Fluent builder pattern (`.input()`, `.output()`, `.query()`, `.mutation()`)
  - Type inference through procedure chain
  - Basic middleware support (`.use()`)
- ✅ **tRPC integration**
  - tRPC router creation from procedures
  - Type-safe internal API calls
  - Basic error handling
- ✅ **REST adapter (limited)**
  - Auto-generation from naming conventions
  - **GET and POST only**
  - Basic path generation
  - Manual override with `.rest()` method

### @veloxts/orm
- ✅ **Prisma client wrapper**
  - Database client configuration
  - Context plugin for database access
  - TypeScript integration
- ✅ **Manual migrations**
  - Support for running Prisma migrations
  - No CLI migration runner yet (use Prisma CLI directly)

### @veloxts/client
- ✅ **Type-safe API client**
  - Fetch-based client with type inference
  - Automatic type import from backend
  - Basic error handling
  - Request/response type safety

### @veloxts/cli
- ✅ **Basic commands**
  - `velox dev` - Development server with hot reload
  - `velox migrate` - Run Prisma migrations
  - Basic command structure

### create-velox-app
- ✅ **Project scaffolding**
  - One default template
  - Interactive setup wizard (basic)
  - Dependency installation
  - Post-install instructions
  - Generated project works out-of-the-box

### Developer Experience
- ✅ **Type safety without code generation**
  - Direct type imports from backend to frontend
  - Compile-time validation
  - Full IDE autocomplete support
- ✅ **Convention over configuration**
  - Naming conventions infer routes
  - Sensible defaults
  - Minimal boilerplate

### Documentation (Minimal)
- ✅ **Package READMEs**
  - Basic usage for each package
  - Installation instructions
  - Simple examples
- ✅ **Getting Started Guide**
  - Quick start tutorial
  - Basic concepts
  - First CRUD API example
- ✅ **Example Application**
  - Simple working example in repository
  - Demonstrates core features

### Testing
- ✅ **Basic test coverage**
  - Smoke tests for all packages
  - Critical path integration tests
  - ~40-60% coverage (not comprehensive yet)

---

## ⏳ DEFERRED to v1.1 and Beyond

### Authentication (@veloxts/auth) - v1.1
- ⏳ JWT authentication system
- ⏳ Guards and policies
- ⏳ User model helpers
- ⏳ Password hashing (bcrypt/argon2)
- ⏳ CSRF protection
- ⏳ Rate limiting
- ⏳ Session management
- ⏳ Pluggable auth adapters (BetterAuth, Clerk, Auth0)

### Advanced Routing - v1.1
- ⏳ **Nested resource routing**
  - Hierarchical resources (`/posts/:postId/comments`)
  - Multi-level nesting with warnings
  - Flat access generation
- ⏳ **Full REST verb support**
  - PUT method
  - PATCH method
  - DELETE method
  - Complete REST conventions
- ⏳ **Advanced middleware**
  - Middleware composition
  - Conditional middleware
  - Async middleware chains

### Dependency Injection - v1.1
- ⏳ **Full DI container**
  - Decorator-based injection (`@Injectable()`, `@Inject()`)
  - Metadata reflection
  - Lifecycle management
  - Scoped/singleton/transient services

### CLI Advanced Features - v1.1
- ⏳ **Code generators**
  - `velox generate procedure <name>`
  - `velox generate schema <name>`
  - `velox generate migration <name>`
  - `velox generate model <name>`
- ⏳ **Database seeding**
  - `velox db:seed` command
  - Seeder class system
  - Seed data management
- ⏳ **Multiple project templates**
  - Minimal template
  - Full-stack template
  - API-only template
  - Custom template support

### Frontend Integration - v1.1
- ⏳ **React hooks**
  - `useQuery` hook
  - `useMutation` hook
  - Integration with @tanstack/react-query
  - Optimistic updates
  - Cache management
- ⏳ **Advanced client features**
  - Request/response interceptors
  - Retry logic
  - Timeout configuration
  - Progress tracking

### ORM Advanced Features - v1.1
- ⏳ **Migration runner**
  - Migration status checking
  - Rollback functionality
  - Migration history
  - CLI integration
- ⏳ **Seeding system**
  - Seeder classes
  - Seed ordering
  - Factory pattern support
  - Relationship seeding

### Developer Tooling - v1.1
- ⏳ **Procedure discovery**
  - Automatic procedure file scanning
  - Convention-based registration
  - Hot reload for new procedures
- ⏳ **Enhanced dev server**
  - Better error messages
  - Request logging
  - Performance metrics
  - Debug mode

### Documentation - v1.1+
- ⏳ **Full documentation site**
  - VitePress-based site
  - Comprehensive guides
  - API reference
  - Advanced recipes
  - Video tutorials
- ⏳ **Migration guides**
  - From Express
  - From NestJS
  - From AdonisJS
  - From Next.js API routes

### Testing - v1.1
- ⏳ **Comprehensive test coverage**
  - 80%+ code coverage
  - Integration test suite
  - E2E testing utilities
  - Type testing with tsd
  - Performance benchmarks
- ⏳ **Testing utilities**
  - Test helpers for procedures
  - Mock server utilities
  - Database test helpers
  - Factory pattern support

### Performance - v1.1+
- ⏳ **Optimizations**
  - Response caching
  - Query optimization
  - Bundle size reduction
  - Lazy loading strategies
  - Memory profiling
- ⏳ **Monitoring**
  - Performance metrics
  - Error tracking integration
  - APM support
  - Health check endpoints

### Advanced Features - v1.2+
- ⏳ WebSocket/SSE support
- ⏳ Background job processing
- ⏳ Email templating system
- ⏳ File storage abstraction
- ⏳ OpenAPI/Swagger documentation auto-generation
- ⏳ GraphQL support (alongside tRPC/REST)
- ⏳ Admin panel generator
- ⏳ Multi-tenancy support

---

## MVP Success Criteria

### Functional Requirements
The MVP must allow developers to:
1. ✅ Create a new project in < 5 minutes
2. ✅ Define type-safe procedures with input/output validation
3. ✅ Access procedures via tRPC from frontend
4. ✅ Access procedures via auto-generated REST API
5. ✅ Integrate with Prisma database
6. ✅ Run development server with hot reload
7. ✅ Deploy to production (long-running server)

### Non-Functional Requirements
1. ✅ Type errors caught at compile time (no runtime type generation)
2. ✅ Full IDE autocomplete support
3. ✅ Hot reload completes in < 2 seconds
4. ✅ Request latency < 20ms (p50) for simple endpoints
5. ✅ Clear error messages
6. ✅ No critical bugs

### Documentation Requirements
1. ✅ Each package has README with basic usage
2. ✅ Getting started guide exists
3. ✅ At least one working example application
4. ✅ Clear upgrade path to v1.1 documented

---

## Decision Rationale

### Why Defer Authentication?
- Authentication adds significant complexity
- MVP can validate core concepts without auth
- Developers can add their own auth temporarily
- Better to get auth right in v1.1 than rush it in MVP

### Why Defer Nested Routing?
- Flat routing covers 80% of use cases
- Nested routing requires careful API design
- Can be added without breaking changes
- Focus MVP on core type safety features

### Why Defer Full DI Container?
- Simple plugin system is sufficient for MVP
- Full DI adds complexity to initial implementation
- Can be added later without breaking changes
- Allows faster iteration on core features

### Why Defer Code Generators?
- Manual file creation is acceptable for MVP
- Generators require stable APIs
- Better to design generators after API is validated
- Developers can copy-paste from examples initially

### Why Include Basic CLI?
- `velox dev` is essential for good DX
- Hot reload is table stakes for modern frameworks
- `velox migrate` simplifies database setup
- Advanced commands can wait for v1.1

---

## Version Naming Strategy

- **v0.1.0** - MVP (6 weeks)
- **v0.2.0-v0.9.0** - Beta releases with breaking changes allowed
- **v1.0.0** - First stable release (includes auth, nested routing, full DI)
- **v1.1.0+** - Incremental feature additions
- **v2.0.0** - Major version with potential breaking changes

---

## Upgrade Path from MVP to v1.1

All v0.1.0 APIs will remain backwards compatible in v1.1. New features will be additive:

```typescript
// v0.1.0 code
const procedure = createProcedure();

// v1.1 code (backwards compatible)
const procedure = createProcedure();
procedure.use(auth.middleware()); // New feature, opt-in
```

Developers can upgrade incrementally without rewriting existing code.

---

## Timeline Summary

| Version | Timeline | Focus |
|---------|----------|-------|
| v0.1.0 | Weeks 1-6 | Core functionality, type safety, basic DX |
| v0.2.0 | Week 7 | Bug fixes, small improvements |
| v1.0.0 | Weeks 8-12 | Auth, nested routing, full DI, polish |
| v1.1.0+ | Ongoing | Advanced features, community requests |

---

**Current Status:** In Development - Week 1 (Foundation)
**Target Release:** v0.1.0 by end of Week 6
**Next Major Release:** v1.0.0 by Week 12
