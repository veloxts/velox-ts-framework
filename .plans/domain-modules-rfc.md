# RFC: Domain Modules (`defineModule()`)

> **Status:** Proposition — gathering feedback before implementation.

## Problem

VeloxTS has a clean composition hierarchy for endpoints:

```
procedure()      → single endpoint (input + output + middleware + handler)
procedures()     → collection of endpoints (grouped by resource namespace)
    ???          → vertical domain slice (procedures + services + middleware + lifecycle)
definePlugin()   → low-level server plugin (Fastify wrapper)
```

The missing layer between `procedures()` and `definePlugin()` is a **module** — a self-contained vertical domain that bundles its own procedures, services, middleware, and lifecycle into a single unit you can mount with `app.module(billing)`.

Today, achieving this requires Pattern 3 ("Vertical Domain Slices") from the architectural patterns doc — manually writing a `definePlugin` with `server.decorate()`, Symbol keys, `rest()` route registration, lifecycle hooks, and scattered declaration merging. It works but has no convention, no type inference for services, and every team reinvents the wiring.

**Goals:**

- Reduce boilerplate for vertical domain organization in large apps
- Enable npm-publishable domain modules (drop-in features)
- First-class `app.module()` with service container, inter-module DI, and lifecycle
- Stay true to VeloxTS philosophy: convention over config, type-safe, zero ceremony

## Design Decisions (confirmed)

- **Route prefix:** Auto-prefix from module name, with opt-out (`prefix: false`)
- **tRPC namespace:** Configurable — no prefix by default, `trpcPrefix: true` enables it

## The API Surface

### 1. `defineModule()` — Module Definition

```typescript
import { defineModule } from '@veloxts/core';
import { procedure, procedures } from '@veloxts/router';

export const billingModule = defineModule('billing', {
  // Services this module provides (auto-injected into procedure context)
  services: {
    stripe: {
      factory: () => new StripeService(process.env.STRIPE_SECRET!),
      close: (s) => s.disconnect(),
    },
    invoiceCalculator: {
      factory: () => new InvoiceCalculator(),
    },
  },

  // Module-wide middleware (applied to all procedures in this module)
  middleware: [requireAuth, requireStripeCustomer],

  // The procedures this module exposes
  procedures: billingProcedures,

  // Lifecycle hooks
  async boot(services) {
    await services.stripe.warmCache();
  },
  async shutdown(services) {
    await services.stripe.disconnect();
  },
});
```

**What it does under the hood:**

1. Creates a Fastify encapsulation scope (isolation by default)
2. For each service: calls `factory()`, stores on scope, injects via `onRequest` hook
3. Applies module middleware to all procedures
4. Registers `rest(procedures)` with namespace as prefix
5. Registers `onClose` cleanup hooks
6. Type system infers `ctx.stripe` and `ctx.invoiceCalculator` automatically

### 2. `app.module()` — Module Registration

```typescript
const app = await veloxApp({ port: 3030 });

// Mount modules — each gets its own encapsulation scope
app.module(billingModule);
app.module(inventoryModule);
app.module(analyticsModule);

await app.start();
```

### 3. Inter-Module Dependencies (DI)

Modules can declare imports to access services from other modules:

```typescript
export const orderModule = defineModule('orders', {
  imports: [billingModule],

  services: {
    orderProcessor: {
      // `imported` gives typed access to imported modules' services
      factory: (imported) => new OrderProcessor(imported.billing.stripe),
    },
  },

  procedures: orderProcedures,
});
```

**Type safety:** `imported.billing.stripe` is fully typed as `StripeService` — inferred from `billingModule`'s service definitions. No declaration merging needed.

### 4. Module Exports (Encapsulation)

By default, all services are module-private. Use `exports` to make services available to importing modules:

```typescript
export const billingModule = defineModule('billing', {
  services: {
    stripe: { factory: () => new StripeService(...) },      // exported
    internalCache: { factory: () => new Map() },             // private
  },

  // Only exported services are accessible via `imports`
  exports: ['stripe'],

  procedures: billingProcedures,
});
```

### 5. Module Encapsulation & Security

Modules handle privacy and access control at multiple layers:

**Service visibility (DI encapsulation):**

- By default, services decorated on the server are accessible to sibling scopes
- Use Fastify's child scopes to isolate module internals
- `exports: ['stripe']` explicitly controls what's importable by other modules
- Services not in `exports` are invisible to other modules

**Private / Admin modules:**

An admin module can be locked down at three levels:

```typescript
// 1. Module middleware — blocks unauthorized requests before any procedure runs
export const adminModule = defineModule('admin', {
  middleware: [requireAuth, requireRole('admin')],
  procedures: adminProcedures,
  exports: [],  // nothing shared with other modules
});

// 2. Network isolation — register inside a Fastify encapsulation scope
app.server.register(async (adminScope) => {
  adminScope.addHook('onRequest', requireInternalNetwork);
  adminScope.register(adminModule);  // fully isolated scope
});

// 3. Procedure guards — individual procedure-level authorization
const adminProcedures = procedures('admin', {
  deleteUser: procedure()
    .guard(hasRole('super-admin'))
    .use(auditLogMiddleware)
    .mutation(deleteUserHandler),
});
```

**Security layers:**

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| Module middleware | `middleware: [requireAdmin]` | All procedures in the module |
| Procedure guards | `.guard(hasRole('admin'))` | Individual procedures |
| Fastify encapsulation | `server.register(scope => ...)` | Network-level isolation |
| DI encapsulation | `exports: []` | Service visibility between modules |

### 6. Module Lifecycle

```
defineModule() → register → boot → [running] → shutdown → close
```

| Hook | When | Use case |
|------|------|----------|
| `factory()` | During `register` | Create service instances |
| `boot(services)` | After all modules registered, before `app.start()` | Warm caches, verify connections |
| `shutdown(services)` | During `app.stop()` | Flush queues, disconnect clients |
| `close(service)` | Per-service cleanup | Individual resource cleanup |

## How It Composes With Existing Primitives

| Existing primitive | Role in module system |
|---|---|
| `definePlugin()` | Module uses this internally for Fastify registration |
| `procedures()` | Module wraps procedure collections |
| `rest()` | Module auto-registers REST routes from procedures |
| `defineContextPlugin()` | Module replaces this pattern for service injection |
| Middleware / Guards | Module applies these to all its procedures |
| Declaration merging | Module-scoped services don't need it (type-inferred) |

**Key insight:** `defineModule()` doesn't replace anything — it composes existing primitives with less ceremony. You can still use raw `definePlugin()` for non-domain plugins (CORS, logging, etc.).

## CLI Integration

```bash
velox make module billing
```

Scaffolds:

```
src/modules/billing/
├── index.ts          # defineModule(...) with exports
├── procedures.ts     # billingProcedures
├── schemas.ts        # Zod schemas for input/output
├── services/         # Service classes
│   └── StripeService.ts
└── middleware.ts      # Domain-specific middleware
```

## Publishable Modules (npm packages)

Third parties could publish domain modules:

```typescript
// @acme/velox-billing
import { defineModule } from '@veloxts/core';

export const billingModule = defineModule('billing', {
  services: { ... },
  procedures: billingProcedures,
});

// Consumer's app
import { billingModule } from '@acme/velox-billing';
app.module(billingModule);
```

## Where It Lives

**Recommendation: `@veloxts/core`** — alongside `definePlugin()`, since modules are the higher-level version of plugins. The module system is thin enough to live in core, and having it available by default encourages the pattern without requiring an extra dependency.

## Design Principles

1. **Modules are optional** — small apps use `procedures()` directly, no modules needed
2. **Progressive adoption** — extract a module from existing code without rewriting
3. **Type-inferred services** — no declaration merging for module-scoped services
4. **Encapsulation by default** — services are private unless explicitly exported
5. **Composable** — modules import other modules, forming a dependency graph
6. **Convention over config** — `velox make module` scaffolds the standard structure
7. **No decorators, no reflection** — pure TypeScript, pure inference

## Open Questions

1. **Lazy loading?** Should `app.module()` support `app.module(() => import('./modules/billing'))` for code-splitting?
2. **Module-scoped middleware vs procedure-level middleware?** Should module middleware be additive (stacks with procedure-level) or exclusive?
3. **Circular dependency detection?** How to handle and report circular `imports` between modules at registration time?

## Implementation Phases

### Phase 1: Core `defineModule()` + `app.module()`

- Module definition with services, middleware, procedures, lifecycle
- Service factory + cleanup hooks
- Auto REST route registration with prefix (opt-out via `prefix: false`)
- Type inference for module services in procedure context

### Phase 2: Inter-module DI

- `imports` field with typed access to exported services
- `exports` field for encapsulation
- Circular dependency detection

### Phase 3: CLI + Documentation

- `velox make module <name>` scaffolding command
- Documentation page in advanced section
- Update architectural patterns doc to reference modules

### Phase 4: Publishable module conventions

- Package.json conventions for VeloxTS modules
- Module discovery / registry patterns
- Version compatibility checking
