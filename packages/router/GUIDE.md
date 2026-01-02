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
      return ctx.db.user.findUnique({ where: { id: input.id } });
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

## Registering Routes

```typescript
import { registerRestRoutes } from '@veloxts/router';

await registerRestRoutes(app.server, {
  prefix: '/api',
  procedures: { users: userProcedures },
});
```

## tRPC Adapter

```typescript
import { trpc, appRouter, registerTRPCPlugin } from '@veloxts/router';

const t = trpc();
const router = appRouter(t, [userProcedures]);

await registerTRPCPlugin(app.server, { router, prefix: '/trpc' });

export type AppRouter = typeof router;
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

### CLI Command

Generate OpenAPI specs from the command line:

```bash
# Basic generation
velox openapi generate --output ./openapi.json

# Full options
velox openapi generate \
  --path ./src/procedures \
  --output ./docs/openapi.json \
  --title "My API" \
  --version "1.0.0" \
  --description "API documentation" \
  --server http://localhost:3030 \
  --server https://api.example.com \
  --prefix /api

# Serve documentation locally
velox openapi serve --port 8080
```

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

## Learn More

See [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for complete documentation.
