# @veloxts/router

Procedure-based routing with hybrid tRPC and REST adapters.

## Quick Start

```typescript
import { procedure, procedures } from '@veloxts/router';
import { z } from '@veloxts/validation';

export const userProcedures = procedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUniqueOrThrow({ where: { id: input.id } });
    }),

  createUser: procedure()
    .input(CreateUserSchema)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),
});
```

## Procedure API

- `.input(schema)` - Validate input with Zod
- `.output(schema)` - Validate output with Zod
- `.use(middleware)` - Add middleware
- `.guard(guard)` - Add authorization guard
- `.rest({ method, path })` - Override REST path
- `.query(handler)` - Finalize as read operation
- `.mutation(handler)` - Finalize as write operation

## REST Naming Conventions

Procedure names auto-map to HTTP methods:

| Prefix | Method | Path |
|--------|--------|------|
| `get*` | GET | `/:id` |
| `list*`, `find*` | GET | `/` |
| `create*`, `add*` | POST | `/` |
| `update*`, `edit*` | PUT | `/:id` |
| `patch*` | PATCH | `/:id` |
| `delete*`, `remove*` | DELETE | `/:id` |

## REST Overrides with `.rest()`

When naming conventions don't fit your use case, use `.rest()` as an escape hatch:

```typescript
const userProcedures = procedures('users', {
  // Override method only
  activateUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .rest({ method: 'POST' })  // Would be PUT by default
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.update({ where: { id: input.id }, data: { active: true } });
    }),

  // Override path with parameters
  getUserByEmail: procedure()
    .input(z.object({ email: z.string().email() }))
    .rest({ method: 'GET', path: '/users/by-email/:email' })
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUniqueOrThrow({ where: { email: input.email } });
    }),

  // Custom action endpoint
  sendPasswordReset: procedure()
    .input(z.object({ userId: z.string().uuid() }))
    .rest({ method: 'POST', path: '/users/:userId/password-reset' })
    .mutation(async ({ input, ctx }) => {
      // ...
    }),
});
```

**Important**: Do NOT include the API prefix in `.rest()` paths:

```typescript
// Correct - prefix is added automatically
.rest({ method: 'POST', path: '/users/:id/activate' })

// Wrong - results in /api/api/users/:id/activate
.rest({ method: 'POST', path: '/api/users/:id/activate' })
```

## Router Helper (`createRouter`)

Use `createRouter()` to eliminate redundancy when defining both collections and router:

```typescript
import { createRouter, extractRoutes } from '@veloxts/router';

// Before (redundant):
// export const collections = [healthProcedures, userProcedures];
// export const router = {
//   health: healthProcedures,
//   users: userProcedures,
// };

// After (DRY):
export const { collections, router } = createRouter(
  healthProcedures,
  userProcedures
);

export type AppRouter = typeof router;
export const routes = extractRoutes(collections);
```

If you only need the router object (not collections), use `toRouter()`:

```typescript
import { toRouter } from '@veloxts/router';

export const router = toRouter(healthProcedures, userProcedures);
// Result: { health: healthProcedures, users: userProcedures }
```

## Registering Routes

```typescript
import { registerRestRoutes } from '@veloxts/router';

await registerRestRoutes(app.server, {
  prefix: '/api',
  procedures: { users: userProcedures },
});
```

### REST Route Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | `'/api'` | URL prefix for all routes |
| `procedures` | `Record<string, ProcedureCollection>` | required | Procedure collections to register |
| `shortcuts` | `boolean` | `false` | Generate flat shortcut routes in addition to nested routes |
| `nestingWarnings` | `boolean` | `true` | Warn when nesting depth exceeds 3 levels |

When `shortcuts: true`, deeply nested resources also get flat access routes:
```typescript
// With shortcuts enabled:
// GET /organizations/:orgId/projects/:projectId/tasks/:id (nested)
// GET /tasks/:id (flat shortcut)
```

## tRPC Adapter

```typescript
import { trpc, appRouter, registerTRPCPlugin, type TRPCRouter } from '@veloxts/router';

const t = trpc();
const router = appRouter(t, [userProcedures]);

await registerTRPCPlugin(app.server, { router, prefix: '/trpc' });

// Use TRPCRouter for @trpc/react-query compatibility
export type AppRouter = TRPCRouter<typeof router>;
```

## OpenAPI Documentation

Auto-generate OpenAPI 3.0.3 specifications from your procedure definitions and serve interactive Swagger UI documentation.

### Generating OpenAPI Specs

```typescript
import { generateOpenApiSpec } from '@veloxts/router';

const spec = generateOpenApiSpec([userProcedures, postProcedures], {
  info: {
    title: 'My API',
    version: '1.0.0',
    description: 'A VeloxTS-powered API',
  },
  prefix: '/api',
  servers: [
    { url: 'http://localhost:3030', description: 'Development' },
    { url: 'https://api.example.com', description: 'Production' },
  ],
});

// Write to file
import fs from 'fs';
fs.writeFileSync('openapi.json', JSON.stringify(spec, null, 2));
```

### Swagger UI Plugin

Serve interactive API documentation with Swagger UI:

```typescript
import { swaggerUIPlugin } from '@veloxts/router';

app.server.register(swaggerUIPlugin, {
  routePrefix: '/docs',
  collections: [userProcedures, postProcedures],
  openapi: {
    info: { title: 'My API', version: '1.0.0' },
    prefix: '/api',
  },
  title: 'API Documentation',
});

// Available at:
// - /docs - Swagger UI interface
// - /docs/openapi.json - Raw OpenAPI spec
```

### Factory Functions

```typescript
import { createSwaggerUI, getOpenApiSpec, registerDocs } from '@veloxts/router';

// Create pre-configured plugin
const docs = createSwaggerUI({
  collections: [userProcedures],
  openapi: { info: { title: 'My API', version: '1.0.0' } },
});
app.server.register(docs);

// Get spec without registering routes
const spec = getOpenApiSpec({
  collections: [userProcedures],
  openapi: { info: { title: 'My API', version: '1.0.0' } },
});

// Register docs with one call
await registerDocs(app.server, {
  collections: [userProcedures],
  openapi: { info: { title: 'My API', version: '1.0.0' } },
});
```

### CLI Commands

Generate and serve OpenAPI specs from the command line:

```bash
# Basic generation
velox openapi generate --output ./openapi.json

# YAML output (auto-detected from extension)
velox openapi generate -o ./docs/api.yaml

# Full options
velox openapi generate \
  --path ./src/procedures \
  --output ./docs/openapi.json \
  --title "My API" \
  --version "1.0.0" \
  --description "API documentation" \
  --server "http://localhost:3030|Development" \
  --server "https://api.example.com|Production" \
  --prefix /api \
  --recursive \
  --pretty

# Serve documentation locally
velox openapi serve --port 8080

# Serve with hot-reload on file changes
velox openapi serve --watch -f ./docs/api.yaml
```

**Available Options:**

`velox openapi generate`:
- `-p, --path <path>` - Procedures directory (default: `./src/procedures`)
- `-o, --output <file>` - Output file path (default: `./openapi.json`)
- `-f, --format <format>` - Output format: `json` or `yaml` (auto-detected from extension)
- `-s, --server <url>` - Server URL (format: `url|description`, repeatable)
- `--prefix <prefix>` - API route prefix (default: `/api`)
- `-r, --recursive` - Scan subdirectories for procedures
- `-q, --quiet` - Suppress output except errors

`velox openapi serve`:
- `-f, --file <file>` - OpenAPI spec file (default: `./openapi.json`)
- `--port <port>` - Server port (default: `8080`)
- `--host <host>` - Host to bind (default: `localhost`)
- `-w, --watch` - Watch for file changes and hot-reload

### Security Schemes

Guards are automatically mapped to OpenAPI security requirements:

```typescript
import { procedure, authenticated, hasRole } from '@veloxts/router';

const adminProcedures = procedures('admin', {
  // 'authenticated' guard → bearerAuth security
  listStats: procedure()
    .guard(authenticated)
    .query(handler),

  // 'hasRole:admin' guard → bearerAuth security
  deleteUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .guard(hasRole('admin'))
    .mutation(handler),
});
```

Default guard mappings:

| Guard Name | Security Scheme |
|------------|-----------------|
| `authenticated` | `bearerAuth` |
| `hasRole:*` | `bearerAuth` |
| `hasPermission:*` | `bearerAuth` |
| `apiKey` | `apiKeyAuth` |

Custom security mappings:

```typescript
const spec = generateOpenApiSpec([procedures], {
  info: { title: 'API', version: '1.0.0' },
  guardToSecurityMap: {
    'custom-guard': 'oauth2',
    'internal-only': 'apiKeyAuth',
  },
  securitySchemes: {
    oauth2: {
      type: 'oauth2',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://auth.example.com/authorize',
          tokenUrl: 'https://auth.example.com/token',
          scopes: { read: 'Read access', write: 'Write access' },
        },
      },
    },
  },
});
```

### Generator Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `info` | `OpenAPIInfo` | required | API title, version, description |
| `prefix` | `string` | `'/api'` | Base path for all routes |
| `servers` | `OpenAPIServer[]` | `[]` | Server URLs |
| `tagDescriptions` | `Record<string, string>` | `{}` | Descriptions for namespace tags |
| `securitySchemes` | `Record<string, SecurityScheme>` | defaults | Custom security schemes |
| `guardToSecurityMap` | `Record<string, string>` | defaults | Guard → scheme mapping |
| `defaultSecurity` | `SecurityRequirement[]` | `[]` | Global security requirements |
| `externalDocs` | `ExternalDocs` | `undefined` | Link to external docs |
| `extensions` | `Record<string, unknown>` | `{}` | OpenAPI extensions (`x-*`) |

### Swagger UI Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `routePrefix` | `string` | `'/docs'` | UI route path |
| `specRoute` | `string` | `'{prefix}/openapi.json'` | Spec JSON path |
| `title` | `string` | `'API Documentation'` | Page title |
| `favicon` | `string` | `undefined` | Favicon URL |
| `uiConfig.deepLinking` | `boolean` | `true` | Enable deep linking |
| `uiConfig.tryItOutEnabled` | `boolean` | `true` | Enable "Try it out" |
| `uiConfig.persistAuthorization` | `boolean` | `false` | Persist auth in localStorage |
| `uiConfig.docExpansion` | `string` | `'list'` | `'list'`, `'full'`, `'none'` |

### Schema Conversion

Zod schemas are automatically converted to JSON Schema:

```typescript
// Input
z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  age: z.number().min(0).max(150).optional(),
})

// Output (JSON Schema)
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "email": { "type": "string", "format": "email" },
    "age": { "type": "number", "minimum": 0, "maximum": 150 }
  },
  "required": ["id", "email"]
}
```

### Validation

Validate generated specs for common issues:

```typescript
import { validateOpenApiSpec } from '@veloxts/router';

const spec = generateOpenApiSpec([procedures], options);
const warnings = validateOpenApiSpec(spec);

if (warnings.length > 0) {
  console.warn('OpenAPI warnings:', warnings);
}
// Possible warnings:
// - "OpenAPI spec has no paths defined"
// - "OpenAPI spec is missing info.title"
// - "Duplicate operationId: users_getUser"
```

### Route Summary

Get a summary of generated routes for debugging:

```typescript
import { getOpenApiRouteSummary } from '@veloxts/router';

const routes = getOpenApiRouteSummary([userProcedures], '/api');
console.table(routes);
// [
//   { method: 'GET', path: '/api/users/{id}', operationId: 'users_getUser', namespace: 'users' },
//   { method: 'GET', path: '/api/users', operationId: 'users_listUsers', namespace: 'users' },
//   { method: 'POST', path: '/api/users', operationId: 'users_createUser', namespace: 'users' },
// ]
```

## Middleware

```typescript
const getUser = procedure()
  .use(async ({ ctx, next }) => {
    console.log(`Request: ${ctx.request.url}`);
    return next();
  })
  .query(handler);
```

## Guard Type Narrowing (Experimental)

When using guards like `authenticated`, TypeScript doesn't know that `ctx.user` is guaranteed non-null after the guard passes. Use `guardNarrow()` to narrow the context type:

```typescript
import { authenticatedNarrow, hasRoleNarrow } from '@veloxts/auth';

// ctx.user is guaranteed non-null after guard passes
const getProfile = procedure()
  .guardNarrow(authenticatedNarrow)
  .query(({ ctx }) => {
    return { email: ctx.user.email }; // No null check needed!
  });

// Chain multiple narrowing guards
const adminAction = procedure()
  .guardNarrow(authenticatedNarrow)
  .guardNarrow(hasRoleNarrow('admin'))
  .mutation(({ ctx }) => {
    // ctx.user is non-null with roles
  });
```

**Note**: This API is experimental. The current stable alternative is to use middleware for context extension:

```typescript
const getProfile = procedure()
  .guard(authenticated)
  .use(async ({ ctx, next }) => {
    if (!ctx.user) throw new Error('Unreachable');
    return next({ ctx: { user: ctx.user } });
  })
  .query(({ ctx }) => {
    // ctx.user is non-null via middleware
  });
```

## Schema Browser-Safety

When building full-stack apps, schemas may be imported on both server and client. Avoid importing server-only dependencies in schema files:

### Safe Pattern: Pure Zod Schemas

```typescript
// src/schemas/user.ts - Safe for browser import
import { z } from '@veloxts/validation';

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;
```

### Unsafe Pattern: Server Dependencies in Schemas

```typescript
// DO NOT import server-only modules in schema files
import { db } from '@/database'; // BAD - pulls Prisma into client bundle

export const UserSchema = z.object({
  // ...
});
```

### Separating Input/Output Schemas

Keep input schemas (for mutations) separate from output schemas (with transforms):

```typescript
// src/schemas/user.input.ts - For mutations
export const CreateUserInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// src/schemas/user.output.ts - May have transforms
import { dateToIso, prismaDecimal } from '@veloxts/validation';

export const UserOutput = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  balance: prismaDecimal(),      // Transforms Prisma Decimal
  createdAt: dateToIso(),        // Transforms Date to string
});
```

### Type-Only Imports

In server actions, use type-only imports to avoid bundling server code:

```typescript
// GOOD - Type stripped at build time
import type { User } from '@/schemas/user';

// BAD - Pulls in full module graph
import { User } from '@/schemas/user';
```

## Learn More

See [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for complete documentation.
