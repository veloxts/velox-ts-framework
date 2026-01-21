# REST Naming Conventions

> **Deprecated:** This document is no longer maintained. Please refer to the official documentation at [veloxts.dev/docs](https://www.veloxts.dev/docs/).

VeloxTS automatically generates REST endpoints from procedure names using convention-over-configuration. This guide explains how procedure names map to HTTP methods and paths, when to use manual overrides, and best practices for API design.

## Table of Contents

- [Core Concept](#core-concept)
- [Naming Patterns Reference](#naming-patterns-reference)
- [Pattern Examples](#pattern-examples)
- [Manual Overrides with `.rest()`](#manual-overrides-with-rest)
- [Common Patterns](#common-patterns)
- [Warning System](#warning-system)
- [Anti-Patterns](#anti-patterns)
- [Troubleshooting](#troubleshooting)

---

## Core Concept

VeloxTS uses naming conventions to infer REST routes from procedure names. When you define a procedure like `getUser`, the framework automatically generates a REST endpoint at `GET /users/:id`.

**Key Benefits:**

- **Type-safe by default:** Frontend gets full TypeScript types via tRPC
- **REST-compatible:** External clients get auto-generated REST endpoints
- **Single source of truth:** One procedure definition serves both internal and external APIs
- **Self-documenting:** Procedure names clearly indicate their HTTP operation

**How it works:**

1. You define procedures using standard naming patterns
2. VeloxTS infers HTTP method and path from the procedure name
3. REST endpoints are auto-generated alongside tRPC routes
4. Naming convention warnings help catch mistakes in development

---

## Naming Patterns Reference

VeloxTS recognizes the following naming patterns. Pattern matching is **case-sensitive** and requires PascalCase after the prefix.

### GET Patterns (Query Procedures)

| Pattern | HTTP Method | Path | Use Case | Example |
|---------|-------------|------|----------|---------|
| `get*` | GET | `/:id` | Single resource retrieval | `getUser` → `GET /users/:id` |
| `list*` | GET | `/` | Collection listing | `listUsers` → `GET /users` |
| `find*` | GET | `/` | Search/filter operations | `findUsers` → `GET /users` |

### POST Patterns (Mutation Procedures)

| Pattern | HTTP Method | Path | Use Case | Example |
|---------|-------------|------|----------|---------|
| `create*` | POST | `/` | Create new resource | `createUser` → `POST /users` |
| `add*` | POST | `/` | Create new resource (alias) | `addUser` → `POST /users` |

### PUT Patterns (Mutation Procedures)

| Pattern | HTTP Method | Path | Use Case | Example |
|---------|-------------|------|----------|---------|
| `update*` | PUT | `/:id` | Full resource replacement | `updateUser` → `PUT /users/:id` |
| `edit*` | PUT | `/:id` | Full resource replacement (alias) | `editUser` → `PUT /users/:id` |

### PATCH Patterns (Mutation Procedures)

| Pattern | HTTP Method | Path | Use Case | Example |
|---------|-------------|------|----------|---------|
| `patch*` | PATCH | `/:id` | Partial resource update | `patchUser` → `PATCH /users/:id` |

### DELETE Patterns (Mutation Procedures)

| Pattern | HTTP Method | Path | Use Case | Example |
|---------|-------------|------|----------|---------|
| `delete*` | DELETE | `/:id` | Remove resource | `deleteUser` → `DELETE /users/:id` |
| `remove*` | DELETE | `/:id` | Remove resource (alias) | `removeUser` → `DELETE /users/:id` |

---

## Pattern Examples

### Complete CRUD Example

```typescript
import { procedure, procedures, z } from '@veloxts/velox';

export const userProcedures = procedures('users', {
  // GET /users/:id - Retrieve single user
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUniqueOrThrow({ where: { id: input.id } });
    }),

  // GET /users - List all users (with pagination)
  listUsers: procedure()
    .input(paginationInputSchema.optional())
    .output(z.object({
      data: z.array(UserSchema),
      meta: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
      }),
    }))
    .query(async ({ input, ctx }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        ctx.db.user.findMany({ skip, take: limit }),
        ctx.db.user.count(),
      ]);

      return { data: users, meta: { page, limit, total } };
    }),

  // GET /users - Search/filter users
  findUsers: procedure()
    .input(z.object({
      email: z.string().email().optional(),
      role: z.string().optional(),
    }))
    .output(z.array(UserSchema))
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findMany({
        where: {
          email: input.email ? { contains: input.email } : undefined,
          role: input.role,
        },
      });
    }),

  // POST /users - Create new user
  createUser: procedure()
    .input(CreateUserSchema)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),

  // PUT /users/:id - Full replacement update
  updateUser: procedure()
    .input(z.object({ id: z.string().uuid() }).merge(UpdateUserSchema))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.db.user.update({ where: { id }, data });
    }),

  // PATCH /users/:id - Partial update
  patchUser: procedure()
    .input(z.object({ id: z.string().uuid() }).merge(UpdateUserSchema.partial()))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.db.user.update({ where: { id }, data });
    }),

  // DELETE /users/:id - Remove user
  deleteUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.user.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
```

**Generated REST Endpoints:**

```
GET    /users/:id      # getUser
GET    /users          # listUsers, findUsers (both map to same path)
POST   /users          # createUser
PUT    /users/:id      # updateUser
PATCH  /users/:id      # patchUser
DELETE /users/:id      # deleteUser
```

### Search vs List

Both `list*` and `find*` patterns generate `GET /` endpoints. Choose based on semantic meaning:

```typescript
// Use list* for simple collection retrieval
listProducts: procedure()
  .query(async ({ ctx }) => {
    return ctx.db.product.findMany();
  }),

// Use find* for search/filter operations (clearer intent)
findProducts: procedure()
  .input(z.object({
    category: z.string().optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
  }))
  .query(async ({ input, ctx }) => {
    return ctx.db.product.findMany({
      where: {
        category: input.category,
        price: {
          gte: input.minPrice,
          lte: input.maxPrice,
        },
      },
    });
  }),
```

### Create vs Add

Both `create*` and `add*` patterns generate `POST /` endpoints. They're semantic aliases:

```typescript
// Use create* for primary resource creation
createOrder: procedure()
  .input(CreateOrderSchema)
  .mutation(async ({ input, ctx }) => {
    return ctx.db.order.create({ data: input });
  }),

// Use add* when the semantic feels more natural (e.g., adding to a collection)
addItemToCart: procedure()
  .input(z.object({ productId: z.string(), quantity: z.number() }))
  .mutation(async ({ input, ctx }) => {
    return ctx.cart.addItem(input);
  }),
```

### Update vs Edit vs Patch

```typescript
// PUT /posts/:id - Full replacement (all fields required)
updatePost: procedure()
  .input(z.object({ id: z.string() }).merge(PostSchema))
  .mutation(async ({ input, ctx }) => {
    const { id, ...data } = input;
    return ctx.db.post.update({ where: { id }, data });
  }),

// PUT /posts/:id - Alias for update (same behavior)
editPost: procedure()
  .input(z.object({ id: z.string() }).merge(PostSchema))
  .mutation(async ({ input, ctx }) => {
    const { id, ...data } = input;
    return ctx.db.post.update({ where: { id }, data });
  }),

// PATCH /posts/:id - Partial update (only changed fields)
patchPost: procedure()
  .input(z.object({ id: z.string() }).merge(PostSchema.partial()))
  .mutation(async ({ input, ctx }) => {
    const { id, ...data } = input;
    return ctx.db.post.update({ where: { id }, data });
  }),
```

**Best Practice:** Use `PATCH` for partial updates and `PUT` for full replacements. This follows HTTP semantics and makes your API more intuitive.

---

## Manual Overrides with `.rest()`

When naming conventions don't fit your use case, use the `.rest()` method to specify custom HTTP method and path.

### Override Method Only

```typescript
// Custom action that doesn't fit CRUD patterns
activateUser: procedure()
  .input(z.object({ id: z.string().uuid() }))
  .rest({ method: 'POST' })  // Infers path from namespace: POST /users/activate
  .mutation(async ({ input, ctx }) => {
    return ctx.db.user.update({
      where: { id: input.id },
      data: { isActive: true },
    });
  }),
```

### Override Path Only

```typescript
// Use different path than namespace
healthCheck: procedure()
  .rest({ path: '/health' })  // Infers method from 'get' prefix if used
  .query(async ({ ctx }) => {
    return { status: 'ok', timestamp: new Date() };
  }),
```

### Override Both Method and Path

```typescript
// Complete custom route
performSearch: procedure()
  .input(z.object({ query: z.string() }))
  .rest({ method: 'POST', path: '/search' })
  .mutation(async ({ input, ctx }) => {
    return ctx.search.execute(input.query);
  }),

// Custom action endpoint
resetPassword: procedure()
  .input(z.object({ token: z.string(), password: z.string() }))
  .rest({ method: 'POST', path: '/auth/reset-password' })
  .mutation(async ({ input, ctx }) => {
    return ctx.auth.resetPassword(input);
  }),
```

### Disable REST Endpoint

Use `.rest({ enabled: false })` to create tRPC-only procedures:

```typescript
// Internal-only procedure (no REST endpoint)
internalDataSync: procedure()
  .rest({ enabled: false })
  .mutation(async ({ ctx }) => {
    // Only accessible via tRPC, not REST
    return ctx.sync.execute();
  }),
```

---

## Common Patterns

### Nested Resources

For nested resources, use the `.parent()` method combined with naming conventions:

```typescript
// POST /posts/:postId/comments
export const commentProcedures = procedures('comments', {
  createComment: procedure()
    .parent('posts')  // Automatically infers postId parameter
    .input(z.object({ postId: z.string(), content: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.comment.create({
        data: {
          postId: input.postId,
          content: input.content,
        },
      });
    }),

  // GET /posts/:postId/comments
  listComments: procedure()
    .parent('posts')
    .input(z.object({ postId: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.comment.findMany({
        where: { postId: input.postId },
      });
    }),
});
```

### Bulk Operations

```typescript
// POST /users/bulk
createManyUsers: procedure()
  .input(z.array(CreateUserSchema))
  .rest({ method: 'POST', path: '/users/bulk' })
  .mutation(async ({ input, ctx }) => {
    return ctx.db.user.createMany({ data: input });
  }),

// DELETE /users/bulk
deleteManyUsers: procedure()
  .input(z.object({ ids: z.array(z.string().uuid()) }))
  .rest({ method: 'DELETE', path: '/users/bulk' })
  .mutation(async ({ input, ctx }) => {
    return ctx.db.user.deleteMany({
      where: { id: { in: input.ids } },
    });
  }),
```

### Custom Actions

```typescript
// POST /users/:id/verify-email
verifyEmail: procedure()
  .input(z.object({ id: z.string(), token: z.string() }))
  .rest({ method: 'POST', path: '/users/:id/verify-email' })
  .mutation(async ({ input, ctx }) => {
    return ctx.auth.verifyEmail(input.id, input.token);
  }),

// POST /orders/:id/cancel
cancelOrder: procedure()
  .input(z.object({ id: z.string() }))
  .rest({ method: 'POST', path: '/orders/:id/cancel' })
  .mutation(async ({ input, ctx }) => {
    return ctx.orders.cancel(input.id);
  }),
```

### Pagination and Filtering

```typescript
// GET /products?page=1&limit=20&category=electronics
listProducts: procedure()
  .input(z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    category: z.string().optional(),
    sortBy: z.enum(['price', 'name', 'createdAt']).optional(),
  }))
  .query(async ({ input, ctx }) => {
    const skip = (input.page - 1) * input.limit;

    const [products, total] = await Promise.all([
      ctx.db.product.findMany({
        where: { category: input.category },
        orderBy: input.sortBy ? { [input.sortBy]: 'asc' } : undefined,
        skip,
        take: input.limit,
      }),
      ctx.db.product.count({
        where: { category: input.category },
      }),
    ]);

    return {
      data: products,
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        pages: Math.ceil(total / input.limit),
      },
    };
  }),
```

---

## Warning System

VeloxTS includes a development-time warning system to catch naming convention issues early.

### Warning Types

#### 1. No Convention Match

**Trigger:** Procedure name doesn't match any known pattern

```typescript
// WARNING: "fetchUser" doesn't match any naming convention
fetchUser: procedure()  // Should be: getUser, listUsers, or findUsers
  .query(async ({ ctx }) => ctx.db.user.findMany()),
```

**Fix:** Use a standard prefix or add `.rest()` override:

```typescript
// Option 1: Use standard naming
getUser: procedure()
  .query(async ({ ctx }) => ctx.db.user.findUniqueOrThrow(...)),

// Option 2: Use .rest() override
fetchUser: procedure()
  .rest({ method: 'GET', path: '/users/:id' })
  .query(async ({ ctx }) => ctx.db.user.findUniqueOrThrow(...)),
```

#### 2. Type Mismatch

**Trigger:** Procedure name suggests one type (query/mutation) but defined as another

```typescript
// WARNING: "getUser" uses "get" prefix but is defined as mutation
getUser: procedure()
  .mutation(async ({ ctx }) => { ... }),  // Should be .query()
```

**Fix:** Match procedure type to naming convention:

```typescript
// Correct: GET operations are queries
getUser: procedure()
  .query(async ({ ctx }) => { ... }),

// Or rename if it's truly a mutation
createUser: procedure()
  .mutation(async ({ ctx }) => { ... }),
```

#### 3. Case Mismatch

**Trigger:** Procedure name has incorrect casing (must be camelCase with PascalCase resource)

```typescript
// WARNING: "getuser" has wrong casing
getuser: procedure()  // Should be: getUser
  .query(async ({ ctx }) => { ... }),

// WARNING: "GetUser" has uppercase prefix
GetUser: procedure()  // Should be: getUser
  .query(async ({ ctx }) => { ... }),
```

**Fix:** Use correct camelCase:

```typescript
getUser: procedure()  // ✓ Correct
  .query(async ({ ctx }) => { ... }),
```

#### 4. Similar Name Detected

**Trigger:** Procedure name uses non-standard prefix similar to standard ones

```typescript
// WARNING: "fetchUser" won't generate REST route
// Suggestion: Consider using "get, list, or find" prefix
fetchUser: procedure()
  .query(async ({ ctx }) => { ... }),

// Other similar patterns:
retrieveUser: procedure()  // Suggest: getUser
searchUsers: procedure()   // Suggest: findUsers
insertUser: procedure()    // Suggest: createUser
modifyUser: procedure()    // Suggest: updateUser or patchUser
destroyUser: procedure()   // Suggest: deleteUser
```

**Fix:** Use suggested standard prefix or add `.rest()`:

```typescript
// Option 1: Use standard prefix
getUser: procedure()
  .query(async ({ ctx }) => { ... }),

// Option 2: Keep name with .rest() override
fetchUser: procedure()
  .rest({ method: 'GET', path: '/users/:id' })
  .query(async ({ ctx }) => { ... }),
```

### Configuring Warnings

#### Disable All Warnings

```typescript
export const legacyProcedures = procedures('legacy', {
  customAction: procedure()
    .mutation(async ({ ctx }) => { ... }),
}, {
  warnings: false  // Disable all warnings for this namespace
});
```

#### Strict Mode (Warnings as Errors)

Useful for CI/CD to enforce naming conventions:

```typescript
export const apiProcedures = procedures('api', {
  getUser: procedure().query(async ({ ctx }) => { ... }),
}, {
  warnings: 'strict'  // Throw errors instead of warnings
});
```

#### Exclude Specific Procedures

```typescript
export const mixedProcedures = procedures('users', {
  getUser: procedure().query(async ({ ctx }) => { ... }),
  customAction: procedure().mutation(async ({ ctx }) => { ... }),  // Won't warn
}, {
  warnings: {
    except: ['customAction']  // Exclude from warnings
  }
});
```

#### Advanced Configuration

```typescript
export const userProcs = procedures('users', procs, {
  warnings: {
    strict: true,           // Treat warnings as errors
    except: ['legacy'],     // Exclude specific procedures
  }
});
```

### When Warnings Don't Appear

Warnings are suppressed in these cases:

1. **Production mode:** Warnings only show in `NODE_ENV !== 'production'`
2. **Explicit `.rest()` override:** If you provide both `method` and `path` in `.rest()`
3. **Excluded procedures:** If listed in `warnings.except`
4. **Disabled warnings:** If `warnings: false`

---

## Anti-Patterns

### Avoid: Inconsistent Naming

```typescript
// BAD: Mixing conventions
export const userProcedures = procedures('users', {
  getUser: procedure().query(...),     // ✓ Standard
  fetchUsers: procedure().query(...),  // ✗ Non-standard (use listUsers)
  addUser: procedure().mutation(...),  // ✓ Standard
  insertUser: procedure().mutation(...), // ✗ Non-standard (use createUser)
});
```

```typescript
// GOOD: Consistent naming
export const userProcedures = procedures('users', {
  getUser: procedure().query(...),
  listUsers: procedure().query(...),
  createUser: procedure().mutation(...),
  updateUser: procedure().mutation(...),
});
```

### Avoid: Wrong Procedure Type

```typescript
// BAD: Naming suggests query but defined as mutation
getUserData: procedure()
  .mutation(async ({ ctx }) => {  // ✗ Should be .query()
    return ctx.db.user.findMany();
  }),
```

```typescript
// GOOD: Match naming to procedure type
listUsers: procedure()
  .query(async ({ ctx }) => {  // ✓ GET operations are queries
    return ctx.db.user.findMany();
  }),

createUser: procedure()
  .mutation(async ({ ctx, input }) => {  // ✓ POST operations are mutations
    return ctx.db.user.create({ data: input });
  }),
```

### Avoid: Ignoring `:id` Parameter Requirements

```typescript
// BAD: get* pattern expects :id but procedure doesn't handle it
getUser: procedure()
  .query(async ({ ctx }) => {  // ✗ Where's the ID?
    return ctx.db.user.findMany();  // Returns all users!
  }),
```

```typescript
// GOOD: Provide :id input for single resource retrieval
getUser: procedure()
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx }) => {  // ✓ Uses ID parameter
    return ctx.db.user.findUniqueOrThrow({ where: { id: input.id } });
  }),

// Or use list* pattern for collections
listUsers: procedure()
  .query(async ({ ctx }) => {  // ✓ No ID needed for collections
    return ctx.db.user.findMany();
  }),
```

### Avoid: Overusing `.rest()` When Conventions Work

```typescript
// BAD: Unnecessary .rest() override
getUser: procedure()
  .rest({ method: 'GET', path: '/users/:id' })  // ✗ Convention already does this!
  .query(async ({ input, ctx }) => { ... }),
```

```typescript
// GOOD: Let conventions work for standard CRUD
getUser: procedure()
  .query(async ({ input, ctx }) => { ... }),  // ✓ Auto-generates GET /users/:id
```

Only use `.rest()` for non-standard routes:

```typescript
// GOOD: .rest() for custom actions
activateUser: procedure()
  .rest({ method: 'POST', path: '/users/:id/activate' })  // ✓ Not CRUD
  .mutation(async ({ input, ctx }) => { ... }),
```

---

## Troubleshooting

### Issue: REST endpoint not generated

**Symptoms:** tRPC works but REST endpoint returns 404

**Causes:**

1. Procedure name doesn't match any convention
2. Wrong procedure type (query vs mutation)
3. Incorrect casing in procedure name

**Solution:**

```typescript
// Check development console for warnings like:
// [users/fetchUser] "fetchUser" doesn't match any naming convention
// Suggestion: Use a standard prefix (get, list, find, create, update, patch, delete)

// Fix by using standard naming:
getUser: procedure()  // Instead of fetchUser
  .query(async ({ ctx }) => { ... }),

// Or add explicit .rest() override:
fetchUser: procedure()
  .rest({ method: 'GET', path: '/users/:id' })
  .query(async ({ ctx }) => { ... }),
```

### Issue: Wrong HTTP method generated

**Symptoms:** Endpoint exists but uses wrong HTTP verb (e.g., POST instead of GET)

**Causes:**

1. Using `.mutation()` when you meant `.query()`
2. Procedure name suggests different operation than implementation

**Solution:**

```typescript
// BAD: get* pattern with .mutation()
getUser: procedure()
  .mutation(async ({ ctx }) => { ... }),  // Generates POST (wrong!)

// GOOD: Match procedure type to naming
getUser: procedure()
  .query(async ({ ctx }) => { ... }),  // Generates GET (correct!)
```

**Rule of thumb:**

- `get*`, `list*`, `find*` → Always use `.query()`
- `create*`, `add*`, `update*`, `edit*`, `patch*`, `delete*`, `remove*` → Always use `.mutation()`

### Issue: `:id` parameter not working

**Symptoms:** `GET /users/123` returns 404 or unexpected results

**Causes:**

1. Forgot to define input schema with `id` field
2. Using wrong naming pattern (e.g., `list*` instead of `get*`)

**Solution:**

```typescript
// BAD: Missing input schema
getUser: procedure()
  .query(async ({ ctx }) => {  // No way to get ID!
    return ctx.db.user.findMany();
  }),

// GOOD: Define input schema with ID
getUser: procedure()
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx }) => {
    return ctx.db.user.findUniqueOrThrow({ where: { id: input.id } });
  }),
```

### Issue: Naming warnings in production

**Symptoms:** Console warnings appearing in production logs

**Causes:**

- `NODE_ENV` not set to `'production'`

**Solution:**

```bash
# Set NODE_ENV in production environment
NODE_ENV=production node dist/index.js
```

Warnings are automatically suppressed when `NODE_ENV === 'production'`.

### Issue: Multiple procedures map to same endpoint

**Symptoms:** `listUsers` and `findUsers` both generate `GET /users`

**Explanation:** This is expected! Both patterns generate `GET /` for the namespace.

**Solution:**

Choose the pattern that best describes the operation's intent:

```typescript
// Use list* for simple collection retrieval
listUsers: procedure()
  .query(async ({ ctx }) => ctx.db.user.findMany()),

// Use find* for search/filter (more descriptive for this use case)
findUsers: procedure()
  .input(z.object({ email: z.string().optional() }))
  .query(async ({ input, ctx }) => {
    return ctx.db.user.findMany({
      where: { email: input.email },
    });
  }),

// Or use .rest() to differentiate:
listUsers: procedure()
  .rest({ path: '/users' })
  .query(async ({ ctx }) => ctx.db.user.findMany()),

findUsers: procedure()
  .rest({ path: '/users/search' })
  .query(async ({ input, ctx }) => { ... }),
```

### Issue: Custom action doesn't fit CRUD patterns

**Symptoms:** Action like "activate", "publish", "verify" doesn't match conventions

**Solution:** Use `.rest()` with custom path:

```typescript
// Custom action endpoints
activateUser: procedure()
  .input(z.object({ id: z.string() }))
  .rest({ method: 'POST', path: '/users/:id/activate' })
  .mutation(async ({ input, ctx }) => { ... }),

publishPost: procedure()
  .input(z.object({ id: z.string() }))
  .rest({ method: 'POST', path: '/posts/:id/publish' })
  .mutation(async ({ input, ctx }) => { ... }),

verifyEmail: procedure()
  .input(z.object({ token: z.string() }))
  .rest({ method: 'POST', path: '/auth/verify-email' })
  .mutation(async ({ input, ctx }) => { ... }),
```

---

## Summary

**Key Takeaways:**

1. **Use standard naming patterns** for automatic REST generation
2. **Match procedure type to naming:** queries for `get/list/find`, mutations for `create/update/patch/delete`
3. **Use `.rest()` override** only when conventions don't fit
4. **Enable strict mode in CI/CD** to enforce conventions: `warnings: 'strict'`
5. **Listen to development warnings** - they guide you toward correct patterns

**Quick Reference:**

```typescript
// Standard CRUD patterns (auto-generate REST)
getUser      → GET    /users/:id
listUsers    → GET    /users
findUsers    → GET    /users
createUser   → POST   /users
updateUser   → PUT    /users/:id
patchUser    → PATCH  /users/:id
deleteUser   → DELETE /users/:id

// Custom routes (use .rest())
customAction → .rest({ method: 'POST', path: '/custom' })
```

For more information, see:

- [Procedure Builder API Reference](/docs/api/procedure-builder.md)
- [REST Adapter Documentation](/docs/api/rest-adapter.md)
- [Type Safety Guide](/docs/guides/type-safety.md)
