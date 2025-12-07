# VeloxTS Framework - MVP Feature Scope

## Version 0.1.0 - 0.3.x (MVP Complete ✅)

This document defines what features were **included** in the MVP release and what is **deferred** to future versions.

---

## ✅ INCLUDED in MVP (v0.1.0 - v0.3.x)

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
- ✅ **REST adapter**
  - Auto-generation from naming conventions
  - **Full REST verb support (GET, POST, PUT, PATCH, DELETE)**
  - Smart input gathering (params, query, body based on method)
  - Proper HTTP status codes (201 for POST, 204 for DELETE with no body)
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

### @veloxts/velox (v0.3.0+)
- ✅ **Umbrella package**
  - Single import for all backend packages
  - Re-exports core, validation, orm, router, auth
  - Subpath exports for tree-shaking
  - Simplified dependency management
- ✅ **Dynamic versioning**
  - `VELOX_VERSION` reads from package.json at runtime

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

## ✅ COMPLETED in v0.4.x

### Authentication (@veloxts/auth) - v0.4 ✅
- ✅ JWT authentication system (HS256, token pairs, refresh tokens)
- ✅ Guards and policies (role-based, permission-based, composable)
- ✅ User model helpers (declaration merging for extensibility)
- ✅ Password hashing (bcrypt/argon2 with scrypt fallback)
- ✅ Rate limiting (in-memory with Redis documentation)
- ✅ Security hardening (CVE-2015-9235 prevention, timing-safe comparison, entropy validation)
- ✅ Token revocation infrastructure (TokenStore interface)
- ✅ CSRF protection (Signed Double Submit Cookie pattern, HMAC-SHA256)
- ✅ Session management (cookie-based sessions with pluggable stores)

---

## ⏳ DEFERRED to v0.4+ and Beyond

### Authentication Advanced Features - v0.4+
- ⏳ Pluggable auth adapters (BetterAuth, Clerk, Auth0)

### Advanced Routing - v0.4
- ⏳ **Nested resource routing**
  - Hierarchical resources (`/posts/:postId/comments`)
  - Multi-level nesting with warnings
  - Flat access generation
- ⏳ **Advanced middleware**
  - Middleware composition
  - Conditional middleware
  - Async middleware chains

### Dependency Injection - v0.4
- ⏳ **Full DI container**
  - Decorator-based injection (`@Injectable()`, `@Inject()`)
  - Metadata reflection
  - Lifecycle management
  - Scoped/singleton/transient services

### CLI Advanced Features - v0.5
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

### Frontend Integration - v0.5
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

### ORM Advanced Features - v0.5
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

### Developer Tooling - v0.5
- ⏳ **Procedure discovery**
  - Automatic procedure file scanning
  - Convention-based registration
  - Hot reload for new procedures
- ⏳ **Enhanced dev server**
  - Better error messages
  - Request logging
  - Performance metrics
  - Debug mode

### AI-Native Development - v0.6
- ⏳ **CLAUDE.md in scaffolder**
  - Ship AI instructions with every project
- ⏳ **Machine-readable CLI**
  - `--json` flag for all commands
- ⏳ **Structured error codes**
  - `VeloxError[E1001]` with fix suggestions
- ⏳ **MCP Server** (`@veloxts/mcp`)
  - Expose VeloxTS context to AI tools
- ⏳ **Type introspection**
  - `velox introspect` command

### Documentation - v0.5+
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

### Testing - v0.4+
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

### Performance - v0.8+
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

### Ecosystem Packages - v0.7+
- ⏳ `@veloxts/queue` - Background job processing
- ⏳ `@veloxts/mail` - Email templating system
- ⏳ `@veloxts/storage` - File storage abstraction
- ⏳ `@veloxts/events` - WebSocket/SSE support
- ⏳ `@veloxts/cache` - Caching layer
- ⏳ `@veloxts/monitor` - Debugging dashboard

### Advanced Features - v0.8+
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
4. ✅ Clear upgrade path to v0.4+ documented

---

## Decision Rationale

### Why Defer Authentication?
- Authentication adds significant complexity
- MVP can validate core concepts without auth
- Developers can add their own auth temporarily
- Better to get auth right in v0.4 than rush it in MVP

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
- Advanced commands can wait for v0.5

---

## Version Naming Strategy

- **v0.1.0 - v0.3.x** - MVP (complete ✅)
- **v0.4.x** - Stable foundation (auth, full REST)
- **v0.5.x** - Developer experience (code generators, React hooks)
- **v0.6.x** - AI-native development (CLAUDE.md, MCP, `--json` CLI)
- **v0.7.x** - Ecosystem expansion (queue, mail, storage)
- **v0.8.x** - Polish (performance, monitoring)
- **v0.9.x** - Release candidate (stabilization)
- **v1.0.0** - Mature release (production-ready, stable API)

---

## Upgrade Path from MVP to v0.4+

All MVP APIs will remain backwards compatible in v0.4+. New features will be additive:

```typescript
// MVP code (v0.3.x)
import { procedure } from '@veloxts/velox';

// v0.4+ code (backwards compatible)
import { procedure, auth } from '@veloxts/velox';
procedure.use(auth.middleware()); // New feature, opt-in
```

Developers can upgrade incrementally without rewriting existing code.

---

## Version Roadmap

| Version | Focus | Key Deliverables |
|---------|-------|------------------|
| v0.3.x | ✅ MVP Complete | Umbrella package, dynamic versioning |
| v0.4.x | Stable Foundation | Auth, full REST, starter kits |
| v0.5.x | Developer Experience | Code generators, React hooks, seeders |
| v0.6.x | AI-Native | CLAUDE.md, MCP server, `--json` CLI |
| v0.7.x | Ecosystem | Queue, mail, storage, events |
| v0.8.x | Polish | Performance, monitoring, admin panel |
| v0.9.x | Release Candidate | Final stabilization, community feedback |
| **v1.0.0** | **Mature Release** | Production-ready, stable API, full docs |

---

**Current Status:** MVP Complete (v0.3.x)
**Next Release:** v0.4.0 - Stable Foundation
**Mature Release:** v1.0.0
