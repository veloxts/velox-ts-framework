# VeloxTS Framework - Implementation Roadmap

## Overview

**Framework Name:** VeloxTS (fast, modern, TypeScript-native)
**Target:** Full-stack TypeScript developers and solo developers
**Timeline:** 6 weeks to MVP v0.1.0
**Philosophy:** Laravel-inspired DX with TypeScript type safety

---

## Accelerated 6-Week Timeline

### Week 1: Foundation + Core
**Goal:** Monorepo infrastructure + basic server working

**Days 1-2: Monorepo Setup**
- Initialize pnpm workspace structure
- Configure Turborepo with basic pipelines
- Set up Changesets for version management
- Create shared TypeScript configs in `tooling/`
- Biome configuration for linting and formatting

**Days 3-7: @veloxts/core Package**
- Basic Fastify server wrapper
- Simple plugin registration system
- Basic context object types
- Minimal smoke tests

**Validation Criteria:**
- ✅ Server starts and handles HTTP requests
- ✅ Can register simple plugins
- ✅ Build system works across monorepo

---

### Week 2: Router + Validation
**Goal:** Procedure API with tRPC + basic REST generation

**Build in Parallel:**

**@veloxts/validation:**
- Basic Zod integration
- Simple validation middleware
- Common schema library (ids, pagination, etc.)
- Minimal tests

**@veloxts/router:**
- Procedure builder API (simplified)
- tRPC integration (basic)
- REST adapter with naming conventions (GET, POST only)
- Basic tests

**Validation Criteria:**
- ✅ Can define procedures with input/output schemas
- ✅ tRPC endpoints respond correctly
- ✅ REST endpoints auto-generate from naming conventions
- ✅ Type inference flows correctly

**Defer to v1.1:**
- Nested resource routing
- PUT, PATCH, DELETE verbs
- Advanced middleware composition
- Procedure discovery system

---

### Week 3: ORM + Client
**Goal:** Database integration + type-safe frontend client

**Build in Parallel:**

**@veloxts/orm:**
- Basic Prisma client wrapper
- Context plugin for database access
- Manual migration support (no CLI yet)
- Basic tests

**@veloxts/client:**
- Fetch-based client with type inference
- Basic error handling
- Browser tests

**Validation Criteria:**
- ✅ Can access Prisma via context
- ✅ Frontend client has full type safety
- ✅ Can make type-safe API calls from frontend

**Defer to v1.1:**
- Migration runner CLI
- Seeding system
- React hooks
- Advanced error handling/interceptors

---

### Week 4: Playground App
**Goal:** Validate framework works end-to-end

**Tasks:**
1. Create basic playground app structure
2. Implement 2-3 simple procedures (users CRUD)
3. Set up basic Prisma schema
4. Test tRPC + REST endpoints
5. Build minimal frontend to test client
6. Document all DX friction points

**Validation Criteria:**
- ✅ Can create working app with current packages
- ✅ Type safety works end-to-end
- ✅ Basic CRUD operations function
- ✅ DX is acceptable

**Scope Limitations:**
- Just users resource (no complex relations yet)
- No authentication
- No file uploads or advanced features
- Focus on validating core API

---

### Week 5: CLI + Create
**Goal:** Developers can bootstrap new projects

**@veloxts/cli (minimal):**
- `velox dev` command with hot reload
- `velox migrate` command (runs Prisma migrations)
- Basic command structure

**create-velox-app:**
- One default template
- Interactive wizard (basic)
- Dependency installation
- Post-install instructions

**Validation Criteria:**
- ✅ Can run `npx create-velox-app my-app`
- ✅ Project scaffolds correctly
- ✅ `pnpm dev` starts development server
- ✅ Hot reload works on file changes

**Defer to v1.1:**
- Code generators (procedures, schemas, migrations)
- Multiple project templates
- Seeding commands

---

### Week 6: Polish + Release
**Goal:** Release usable MVP v0.1.0

**Tasks:**
1. Fix critical bugs found in playground
2. Add basic README for each package
3. Write minimal getting started guide
4. Basic performance testing
5. Publish all packages to npm
6. Create example app in repository

**Validation Criteria:**
- ✅ Can create new project and build CRUD API
- ✅ Type safety works without code generation
- ✅ Performance is acceptable (not optimized yet)
- ✅ No critical bugs

**Documentation (minimal):**
- README in each package with basic usage
- Getting started guide
- Simple example application
- Link to full requirements document

---

## MVP Milestones

| Milestone | Week | Description | Validation |
|-----------|------|-------------|------------|
| **M1** | 1 | Foundation Complete | Monorepo builds, server starts |
| **M2** | 2 | Procedures Working | tRPC functional, basic REST |
| **M3** | 3 | Data Layer Ready | Database integration, type-safe client |
| **M4** | 4 | End-to-End Validated | Type safety proven, DX acceptable |
| **M5** | 5 | Tooling Complete | Can create projects, dev server works |
| **M6** | 6 | MVP Released | v0.1.0 published to npm |

---

## Post-MVP Roadmap (v1.1)

**Weeks 7-10: Polish & Advanced Features**

### Authentication (@veloxts/auth)
- JWT authentication system
- Guards and policies
- User model helpers
- Security best practices

### Nested Routing
- Hierarchical resource support
- Multi-level nesting with warnings
- Flat access generation

### Full REST Support
- PUT, PATCH, DELETE verbs
- Complete REST conventions
- Custom path overrides

### Developer Experience
- Code generators (procedures, schemas, migrations)
- Multiple project templates
- React hooks for @veloxts/client
- Comprehensive documentation site

### Architecture
- Full DI container with decorators
- Advanced middleware composition
- Procedure discovery system
- Lifecycle hook system

### Quality
- 80%+ test coverage
- Performance optimizations
- Security audit
- Migration guides from other frameworks

---

## Success Metrics

### Developer Experience
- ⏱️ Time to "Hello World" < 5 minutes
- 🐛 90%+ bugs caught at compile time
- ⌨️ 100% public API has autocomplete
- 🔥 Hot reload < 2 seconds
- 📝 Common tasks < 10 lines of code

### Performance
- ⚡ Request latency < 10ms (p50)
- 🚀 Throughput > 10k req/s
- 💾 Memory usage < 100MB baseline
- 🏃 Startup time < 2 seconds

### Quality
- ✅ > 80% test coverage (v1.1)
- 🔒 Zero known vulnerabilities
- 📚 100% public API documented
- 🎯 100% public API typed

---

## Critical Path Dependencies

```
Week 1: Foundation
   ↓
Week 2: Validation + Router (parallel)
   ↓
Week 3: ORM + Client (parallel)
   ↓
Week 4: Playground (validation)
   ↓
Week 5: CLI + Create (tooling)
   ↓
Week 6: Polish + Release
```

**Key Insight:** Weeks 2 and 3 have parallel work opportunities. Use specialized Claude Code agents for complex packages (TypeScript specialist for Router, Node.js performance engineer for ORM).

---

## Next Immediate Steps

### Day 1 Actions:
1. ✅ Update root `package.json` name to "@veloxts/framework"
2. ✅ Create `pnpm-workspace.yaml`
3. ✅ Create `turbo.json` configuration
4. ✅ Set up package directories: `packages/core`, `packages/router`, etc.
5. ✅ Configure shared TypeScript in `tooling/tsconfig/`
6. ✅ Set up Changesets for version management
7. ✅ Configure Biome for linting and formatting
8. ✅ Create `.npmrc` for exact version pinning

### Days 2-3 Actions:
1. Scaffold @veloxts/core package structure
2. Implement basic Fastify server wrapper
3. Create simple plugin registration
4. Write first smoke test
5. Verify build system works

### Week 1 Target:
**Server starts, responds to HTTP requests, can register basic plugins.**

Let's build fast and iterate! 🚀
