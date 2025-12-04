# Developer Experience Friction Points

Documented during Week 4 (Playground App) validation of the VeloxTS framework.

## Overview

This document captures the DX issues encountered while building a real application with the VeloxTS framework. These insights will inform improvements for v1.1+.

---

## 1. Prisma 7 Driver Adapter Pattern

**Issue:** Prisma 7 introduces breaking changes with driver adapters.

**Details:**
- Cannot use `url` in `schema.prisma` datasource - must use `prisma.config.ts`
- `@prisma/adapter-better-sqlite3` class name is `PrismaBetterSqlite3` (not `PrismaBetterSQLite3`)
- Requires native module rebuild after install: `npm rebuild better-sqlite3`
- Database path in `.env` must be relative to where Prisma runs, not the project root

**Impact:** Significant onboarding friction for new users.

**Recommendation for v1.1:**
- Add clear documentation for Prisma 7 setup
- Consider `@veloxts/orm` helper: `createPrismaClient({ adapter: 'sqlite', path: './db.sqlite' })`
- CLI command: `velox db:setup` to handle adapter configuration

---

## 2. Type Transformation Between Prisma and API

**Issue:** Prisma returns `Date` objects, but JSON APIs need ISO strings.

**Details:**
- Procedures must manually transform `Date → string`:
  ```typescript
  function toUserResponse(dbUser: DbUser): User {
    return {
      ...dbUser,
      createdAt: dbUser.createdAt.toISOString(),
      updatedAt: dbUser.updatedAt.toISOString(),
    };
  }
  ```
- Creates boilerplate for every entity with Date fields
- Type mismatch between Prisma model and Zod schema

**Impact:** Repetitive code, potential for type errors.

**Recommendation for v1.1:**
- Add `@veloxts/orm` helper: `toApiResponse(prismaModel)` with automatic Date transformation
- Consider Zod transform integration: `z.date().transform(d => d.toISOString())`
- Explore Prisma middleware for automatic serialization

---

## 3. Context Type Safety in Procedures

**Issue:** Context `db` property is typed as `unknown` initially.

**Details:**
- Had to create local `DbClient` interface to type `ctx.db`
- Declaration merging pattern works but isn't obvious:
  ```typescript
  declare module '@veloxts/core' {
    interface BaseContext {
      db: PrismaClient;
    }
  }
  ```
- No clear guidance on where to put these declarations

**Impact:** Friction when accessing context properties in procedures.

**Recommendation for v1.1:**
- Provide typed context factory: `createTypedContext<{ db: PrismaClient }>()`
- Better documentation on declaration merging pattern
- Consider automatic context typing from plugins

---

## 4. tRPC + REST Dual Setup Complexity

**Issue:** Setting up both tRPC and REST requires multiple registrations.

**Details:**
- Must create separate `trpc/index.ts` with router setup
- Register `fastifyTRPCPlugin` separately from REST routes
- Context factory pattern is duplicated

**Impact:** More boilerplate than necessary for hybrid API approach.

**Recommendation for v1.1:**
- Add unified registration: `app.api({ rest: '/api', trpc: '/trpc', procedures })`
- Single context factory for both adapters
- Auto-generate tRPC router from procedure collections

---

## 5. Static File Serving Setup

**Issue:** No built-in static file serving.

**Details:**
- Must manually install `@fastify/static`
- Configure paths manually in `createApp()`
- No SPA fallback support out of the box

**Impact:** Extra setup for frontend + API projects.

**Recommendation for v1.1:**
- Add `@veloxts/core` option: `static: { root: './public', spa: true }`
- Or dedicated plugin: `createStaticPlugin({ root: './public' })`

---

## 6. Procedure Naming Convention Documentation

**Issue:** REST endpoint generation from naming conventions isn't immediately obvious.

**Details:**
- `getUser` → GET /users/:id (works)
- `listUsers` → GET /users (works)
- `createUser` → POST /users (works)
- `searchUsers` → ??? (needs `.rest()` override)

**Impact:** Developers might not know when to use `.rest()` override.

**Recommendation for v1.1:**
- Clear documentation table of naming → HTTP method mapping
- CLI command: `velox routes` to show generated routes
- Warning when procedure name doesn't match a convention

---

## 7. Mock Database for Testing

**Issue:** No built-in mock database pattern.

**Details:**
- Had to create custom `MockPrismaClient` with in-memory storage
- Prisma client interface had to be duplicated for mock
- `USE_MOCK_DB` environment variable pattern is non-standard

**Impact:** Testing setup is cumbersome.

**Recommendation for v1.1:**
- Provide `@veloxts/testing` package with mock database utilities
- Consider `createTestApp()` helper that uses in-memory storage
- Integration with Vitest for isolation

---

## 8. Error Messages for Configuration Issues

**Issue:** Cryptic errors when configuration is wrong.

**Examples:**
- Prisma URL error: "The datasource property 'url' is no longer supported"
- tRPC context error: "Request context not found"
- Database table error: "The table main.users does not exist"

**Impact:** Debugging configuration issues takes longer than necessary.

**Recommendation for v1.1:**
- Add actionable error messages with suggestions
- Validation hooks that catch common misconfigurations early
- Better startup diagnostics

---

## Summary Priority Matrix

| Issue | Severity | Effort | Priority |
|-------|----------|--------|----------|
| Type Transformation | High | Medium | P1 |
| Context Type Safety | High | Low | P1 |
| Dual API Setup | Medium | Medium | P2 |
| Error Messages | Medium | Medium | P2 |
| Mock Database | Medium | High | P2 |
| Static Serving | Low | Low | P3 |
| Naming Convention Docs | Low | Low | P3 |
| Prisma 7 Setup | Low | Medium | P3 |

---

## Notes

These friction points were identified during real application development in Week 4 of the MVP sprint. Addressing P1 items before v0.1.0 release would significantly improve adoption. P2 items should be addressed in v1.1.
