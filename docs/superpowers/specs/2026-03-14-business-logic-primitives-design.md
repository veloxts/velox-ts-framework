# Business Logic Primitives for VeloxTS

**Date:** 2026-03-14
**Status:** Draft
**Scope:** B2B SaaS applications with complex business rules, multi-step operations, external service orchestration

## Problem Statement

VeloxTS handles simple to moderate business logic well (guards, validation, resource API) but lacks infrastructure for complex B2B operations: multi-step workflows, domain-level error handling, decoupled side effects, database atomicity, and fine-grained authorization on the procedure chain. Developers building SaaS apps with inventory management, payment flows, multi-tenant logic, and approval workflows must invent their own patterns.

## Design Philosophy

**Layered complexity — three tiers:**

- **Tier 1** (80% of procedures): Guards, policies, simple handlers. Zero new concepts.
- **Tier 2** (15%): Transactional mutations with domain events. Two new keywords.
- **Tier 3** (5%): Pipelines with revert actions. Full power for multi-service orchestration.

**Principles:**

- Sensible defaults with escape hatches that don't get in the way if not used.
- Hybrid: built-in primitives for universal needs, integration guides for specialized concerns.
- Extend existing packages only — no new packages.
- One factory function per concept — no proliferating variants.
- Explicit over magical — complexity under the hood should be visible.

## Package Placement

| Primitive | Package | Rationale |
|---|---|---|
| `DomainError` base class | `@veloxts/core` | Foundational, any package can throw |
| `DomainEvent`, event bus | `@veloxts/events` | Alongside broadcast events, separate concern internally |
| `.transactional()` | `@veloxts/router` | Procedure builder chain |
| `.through()`, `defineStep()`, `defineRevert()` | `@veloxts/router` | Procedure builder chain |
| `.policy()` on builder | `@veloxts/router` | Procedure builder chain |
| `.throws()` | `@veloxts/router` | Procedure builder chain |
| `.emits()` | `@veloxts/router` | Procedure builder chain |
| `.useAfter()` | `@veloxts/router` | Procedure builder chain |

## Phasing

**Phase 1 — Foundations** (unblocks everything else):
- Domain error classes (`DomainError<TData>`)
- Domain events (internal event bus, typed emit/on, async listeners)
- Transaction middleware (`.transactional()`)

**Phase 2 — Composition:**
- Pipeline pattern (`.through()`, `defineStep()`, revert actions)
- Policy integration on procedure chain (`.policy()`)

**Phase 3 — Advanced:**
- Post-handler hooks (`.useAfter()`)
- State machine integration guide

---

## Complete Procedure Chain

```typescript
fulfillOrder: procedure()
  .input(FulfillOrderSchema)             // existing
  .output(OrderSchema)                   // existing
  .guard(authenticated)                  // existing
  .policy(OrderPolicy.fulfill)           // NEW (Phase 2)
  .use(loadOrder)                        // existing
  .throws(InsufficientStock, PaymentFailed)  // NEW (Phase 1)
  .transactional()                       // NEW (Phase 1)
  .through(                              // NEW (Phase 2)
    validateInventory,
    reserveStock,
    chargePayment.onRevert(refundPayment),
  )
  .emits(OrderFulfilled)                 // NEW (Phase 1)
  .rest({ method: 'POST' })             // existing
  .mutation(async ({ input, ctx }) => {
    return ctx.db.order.update({
      where: { id: input.orderId },
      data: { status: 'fulfilled', chargeId: input.chargeId },
    });
  })
  .useAfter(auditLog)                   // NEW (Phase 3)
```

---

## Primitive 1: Domain Errors

### Definition

```typescript
// In your domain module
export class InsufficientStock extends DomainError<{
  sku: string;
  requested: number;
  available: number;
}> {
  readonly code = 'INSUFFICIENT_STOCK';
  readonly status = 422;
  readonly message = 'Not enough inventory';
}

export class TierExceeded extends DomainError<{
  currentTier: string;
  requiredTier: string;
}> {
  readonly code = 'TIER_EXCEEDED';
  readonly status = 403;
  readonly message = 'Subscription upgrade required';
}
```

### Throwing

```typescript
throw new InsufficientStock({
  sku: 'ABC-123',
  requested: 10,
  available: 3,
});
```

### Declaring on procedures

```typescript
createOrder: procedure()
  .input(CreateOrderSchema)
  .throws(InsufficientStock, TierExceeded)
  .mutation(async ({ input, ctx }) => { ... })
```

`.throws()` serves two purposes:
1. Documents what domain errors a procedure can produce.
2. Enables the client to type-narrow on `error.code`.

Undeclared `DomainError` subclasses still work at runtime — they just don't get client-side type narrowing.

### Client-side error handling

The current client throws exceptions. Domain errors continue to be thrown — the client catches them as typed `VeloxClientError` with a discriminated `code` property:

```typescript
try {
  const order = await client.orders.createOrder(data);
} catch (error) {
  if (error instanceof VeloxClientError) {
    switch (error.code) {
      case 'INSUFFICIENT_STOCK':
        // error.data is typed: { sku, requested, available }
        showStockWarning(error.data.available);
        break;
      case 'TIER_EXCEEDED':
        showUpgradePrompt();
        break;
    }
  }
}
```

**No Result pattern.** The client API stays consistent — procedures return `Promise<TOutput>` and throw on errors. `.throws()` enriches the error type on `VeloxClientError` so `catch` blocks get type narrowing.

**Type system implementation:** `.throws()` adds a `TErrors` generic parameter to `CompiledProcedure`. `ClientFromRouter<TRouter>` threads this through so `VeloxClientError` carries the union of declared error codes and their data types. This requires adding a generic parameter to `CompiledProcedure` and threading it through `ProcedureCollection` → `ClientFromRouter`.

### Implementation notes

- `DomainError<TData>` extends `VeloxFailure` (the existing error base class) — inherits status codes, error catalog integration, fix suggestions in dev mode.
- `code` is a string literal per class, not an enum. The client type system unions them from what `.throws()` declares.
- `data` is typed via the generic parameter and flows to the client.
- The REST adapter serializes `DomainError` using the existing error response format, with the addition of `code` and `data` fields.
- Domain errors integrate with OpenAPI generation — `.throws()` declarations appear as error response schemas in generated OpenAPI output.

---

## Primitive 2: Domain Events

Domain events are internal server-side events, separate from broadcast events (which push to clients via WebSocket/SSE). They live in the same `@veloxts/events` package but are a distinct concept.

### DomainEvent base class

```typescript
// Provided by @veloxts/events
abstract class DomainEvent<TData extends Record<string, unknown> = Record<string, unknown>> {
  readonly data: TData;
  readonly timestamp: Date;
  readonly correlationId?: string;

  constructor(data: TData, options?: { correlationId?: string }) {
    this.data = data;
    this.timestamp = new Date();
    this.correlationId = options?.correlationId;
  }

  // Event name derived from class name for the event bus
  // OrderCreated → 'OrderCreated'
  static get eventName(): string { return this.name; }
}
```

`events.on(OrderCreated, handler)` uses the class constructor as the event key — no string registration needed.

### Definition

```typescript
export class OrderCreated extends DomainEvent<{
  orderId: string;
  customerId: string;
  total: number;
}> {}

export class OrderFulfilled extends DomainEvent<{
  orderId: string;
  trackingNumber: string;
}> {}
```

### Declarative — auto-emitted after successful mutation

**With mapping function** (recommended — handler return type rarely matches event payload exactly):

```typescript
createOrder: procedure()
  .emits(OrderCreated, (result) => ({
    orderId: result.id,
    customerId: result.customerId,
    total: result.total,
  }))
  .mutation(async ({ input, ctx }) => {
    return ctx.db.order.create({ data: input });
  })
```

**Without mapping** (when return type matches event payload exactly):

```typescript
createOrder: procedure()
  .emits(OrderCreated)
  .mutation(async ({ input, ctx }) => {
    // Return type must match DomainEvent<TData> — TypeScript enforces this
    return { orderId: order.id, customerId: order.customerId, total: order.total };
  })
```

The mapping function is the recommended approach — it keeps the handler's return type (the API response) decoupled from the event payload shape. Without a mapping function, TypeScript enforces that the return type matches `DomainEvent<TData>` at compile time.

### Imperative — for conditional or multiple events

```typescript
fulfillOrder: procedure()
  .mutation(async ({ input, ctx }) => {
    const order = await ctx.db.order.update({ ... });

    if (order.items.every(i => i.shipped)) {
      ctx.events.emit(new OrderFulfilled({
        orderId: order.id,
        trackingNumber: order.tracking,
      }));
    }

    return order;
  })
```

### Listeners

```typescript
// Registered at app level, in domain module setup
events.on(OrderCreated, async (payload) => {
  await sendConfirmationEmail(payload.customerId);
});

events.on(OrderCreated, async (payload) => {
  await allocateInventory(payload.orderId);
});

events.on(OrderCreated, async (payload) => {
  await auditLog('order.created', payload);
});
```

### Bridging domain events to broadcast events

```typescript
events.on(OrderCreated, async (payload) => {
  broadcast.to(`customer.${payload.customerId}`).send('order:created', payload);
});
```

### Behavior

- Listeners are async by default — they run after the response is sent (non-blocking).
- Listener errors are logged but do not fail the request. The mutation already succeeded.
- Failed listeners can be retried via `@veloxts/queue` if configured: `events.on(OrderCreated, handler, { retryable: true })`.
- Listeners fire in registration order but run concurrently by default.
- Sequential execution available: `events.on(OrderCreated, handler, { sequential: true })`.
- When `.transactional()` is used, `.emits()` events fire after commit, not inside the transaction.
- The existing events plugin already declares `ctx.events` as `EventsManager` (broadcast events). To avoid a naming collision, the domain event emitter extends `EventsManager` with domain event capabilities:

```typescript
// In @veloxts/events — EventsManager gains domain event methods
declare module '@veloxts/core' {
  interface BaseContext {
    events: EventsManager; // already exists — enhanced with .emit() and .on() for domain events
  }
}
```

`ctx.events` becomes the unified entry point for both broadcast events and domain events. The `EventsManager` class is extended with `.emit(domainEvent)` for internal pub/sub alongside its existing broadcast methods (`.to()`, `.send()`). No new context key needed.

---

## Primitive 3: Transaction Middleware

### Usage

```typescript
createOrder: procedure()
  .transactional()
  .mutation(async ({ input, ctx }) => {
    const order = await ctx.db.order.create({ data: input });
    const items = await ctx.db.orderItem.createMany({ data: input.items });
    // If items fail, order is rolled back automatically
    return order;
  })
```

### How it works

- `.transactional()` wraps the handler in `ctx.db.$transaction(async (tx) => { ... })`.
- Replaces `ctx.db` with the transactional client `tx` so all queries use the same transaction.
- On handler throw: automatic rollback.
- On handler return: automatic commit.
- Domain events (`.emits()`) fire after commit, not inside the transaction.

### Options

```typescript
.transactional({ isolationLevel: 'Serializable', timeout: 10_000 })
```

### Scope

This is intentionally narrow — database atomicity only. It does not wrap external API calls. For multi-service atomicity, use pipelines with revert actions.

---

## Primitive 4: Pipeline with Compensating Actions

### Core principle

**`.through()` prepares. `.mutation()` commits.**

Pipeline steps validate, enrich, and coordinate external services. The terminal handler (`.mutation()` or `.query()`) performs the final operation and returns the result. `.through()` never replaces `.mutation()`.

### Defining steps

```typescript
const validateInventory = defineStep('validateInventory',
  async ({ input, ctx }) => {
    const stock = await ctx.db.inventory.findUnique({ where: { sku: input.sku } });
    if (!stock || stock.available < input.quantity) {
      throw new InsufficientStock({
        sku: input.sku,
        requested: input.quantity,
        available: stock?.available ?? 0,
      });
    }
    return { ...input, stock };
  }
);

const reserveStock = defineStep('reserveStock',
  async ({ input, ctx }) => {
    await ctx.db.inventory.update({
      where: { sku: input.stock.sku },
      data: { reserved: { increment: input.quantity } },
    });
    return input;
  }
);
```

### External steps

Steps that call external services (payment providers, shipping APIs, third-party services) must be marked explicitly:

```typescript
const chargePayment = defineStep(
  { name: 'chargePayment', external: true },
  async ({ input, ctx }) => {
    const charge = await stripe.charges.create({ amount: input.total });
    return { ...input, chargeId: charge.id };
  }
);
```

`defineStep` accepts `string | StepOptions` as the first argument:
- `defineStep('name', handler)` — standard step (participates in DB transaction).
- `defineStep({ name, external: true }, handler)` — external step (runs outside DB transaction).

One factory function, progressive options.

### Revert actions

```typescript
const refundPayment = defineRevert('refundPayment',
  async ({ input, ctx }) => {
    await stripe.refunds.create({ charge: input.chargeId });
  }
);
```

Attached to steps via `.onRevert()`:

```typescript
chargePayment.onRevert(refundPayment)
```

### Wiring on the procedure

```typescript
fulfillOrder: procedure()
  .input(FulfillOrderSchema)
  .transactional()
  .through(
    validateInventory,                              // DB step — inside transaction
    reserveStock,                                   // DB step — inside transaction
    chargePayment.onRevert(refundPayment),        // external — outside transaction
  )
  .emits(OrderFulfilled)
  .mutation(async ({ input, ctx }) => {
    return ctx.db.order.update({
      where: { id: input.orderId },
      data: { status: 'fulfilled', chargeId: input.chargeId },
    });
  })
```

### Pipeline execution model

1. Steps execute in order. Each step's return becomes the next step's `input`.
2. If a step fails after external steps have succeeded, revert actions run in reverse order for all completed external steps.
3. Revert actions receive the **output of the step being reverted** — this is the accumulated input at that point, which contains the data needed for undo (e.g., `chargeId` for refunds).
4. The `.mutation()` handler receives the accumulated result from all steps.

### Pipeline + transactional interaction

When `.transactional()` and `.through()` are both used, the execution follows a **two-phase model**:

**Phase A — DB transaction:**
1. Open Prisma interactive transaction.
2. Execute all standard steps (non-external) inside the transaction. `ctx.db` is the transactional client.
3. Execute the `.mutation()` handler inside the same transaction.
4. Commit the transaction.

**Phase B — External steps (between Phase A commit and response):**
5. Execute external steps in order, outside any transaction.
6. If an external step fails, run revert actions for all previously completed external steps (reverse order). The DB transaction is already committed — DB rollback is not possible at this point.

**Ordering implication:** Because Prisma interactive transactions hold a connection for the entire callback, external steps cannot be interleaved with DB steps inside one transaction. The pipeline groups all DB steps together (Phase A), then runs external steps (Phase B).

This means the pipeline declaration order may differ from the execution order:

```typescript
// Declaration order (for readability):
.through(
  validateInventory,                    // DB step
  reserveStock,                         // DB step
  chargePayment.onRevert(refundPayment),  // external step
)
.mutation(async ({ input, ctx }) => {   // DB write (inside transaction)
  return ctx.db.order.update({ ... });
})

// Actual execution order:
// 1. BEGIN TRANSACTION
// 2. validateInventory (DB)
// 3. reserveStock (DB)
// 4. mutation handler (DB)
// 5. COMMIT
// 6. chargePayment (external)
// 7. If step 6 fails → refundPayment runs, but DB changes persist
```

**Important:** This means DB steps cannot depend on data from external steps. If `chargePayment` produces a `chargeId` that the `.mutation()` handler needs, the payment must be the `.mutation()` handler itself (not a pipeline step), or the procedure should not use `.transactional()`.

**Step ordering constraint:** When `.transactional()` is used, all external steps must be declared **after** all standard (DB) steps in the `.through()` call. Interleaving external steps between DB steps is a **compile-time error** — TypeScript will reject it because the two-phase execution would silently reorder them, which could lead to logic bugs.

```typescript
// VALID — DB steps first, then external steps
.through(validateInventory, reserveStock, chargePayment.onRevert(refundPayment))

// COMPILE ERROR — external step interleaved with DB steps under .transactional()
.through(validateInventory, chargePayment.onRevert(refundPayment), reserveStock)
//                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Error: external steps must come after all standard steps when .transactional() is used
```

Without `.transactional()`, steps execute in declaration order regardless of type — no ordering constraint.

**Alternative: pipeline without `.transactional()`** — steps execute in declaration order, each DB operation is an independent query. Use this when you need strict ordering between DB and external steps and can handle partial failure manually.

The `{ external: true }` marker makes the phase boundary explicit and visible.

---

## Primitive 5: Policy Integration on the Builder

### Breaking change: `definePolicy` enhanced signature

The existing `definePolicy` has a different signature (`definePolicy<TUser, TResource>(actions)` — no resource name). This design introduces a **breaking change** by adding the resource name as the first argument and changing handler signatures to destructured objects.

**Migration path:** The new `definePolicy('Name', actions)` signature is not backward-compatible. This will be a documented breaking change in the release notes. Existing policies must be updated:

```typescript
// Before (v0.8)
const PostPolicy = definePolicy({
  update: (user, post) => post.authorId === user.id,
});

// After (v0.9)
const PostPolicy = definePolicy('Post', {
  update: ({ user, resource }) => resource.authorId === user.id || user.role === 'admin',
});
```

### Policy definition

```typescript
const PostPolicy = definePolicy('Post', {
  create: ({ user }) => user.role === 'editor' || user.role === 'admin',
  update: ({ user, resource }) => resource.authorId === user.id || user.role === 'admin',
  delete: ({ user, resource }) => user.role === 'admin',
});
```

`definePolicy` returns an object where each action is a first-class reference carrying:
- The policy name (`'Post'`).
- The action name (`'update'`).
- The handler function.

### Usage on the procedure chain

**Action-level (no specific resource):**

```typescript
createPost: procedure()
  .guard(authenticated)
  .policy(PostPolicy.create)
  .mutation(async ({ input, ctx }) => {
    return ctx.db.post.create({ data: input });
  })
```

**Resource-level (checks against a loaded record):**

```typescript
updatePost: procedure()
  .guard(authenticated)
  .use(loadPost)                     // middleware puts post on ctx.post
  .policy(PostPolicy.update)         // checks ctx.user against ctx.post
  .mutation(async ({ input, ctx }) => {
    return ctx.db.post.update({ where: { id: ctx.post.id }, data: input });
  })
```

### How `.policy()` finds the resource

The policy action reference is typed with the resource type from `definePolicy`. The `.policy()` method on the builder uses this type to constrain the context — if the policy expects a resource, the builder enforces that the context has been extended with it:

```typescript
// If PostPolicy.update expects a Post resource, then:
.policy(PostPolicy.update)
// TypeScript will error unless context includes { post: Post }
// which is provided by .use(loadPost)
```

This means:
- Forgetting `.use(loadPost)` before `.policy(PostPolicy.update)` is a **compile-time error**, not a silent runtime failure.
- Action-level policies like `PostPolicy.create` (no resource required) work without prior `.use()`.
- If the policy check fails, throws `ForbiddenError`.
- No hidden DB queries — the resource must be loaded explicitly via `.use()`.

### Single-argument API

```typescript
.policy(PostPolicy.update)    // one arg, fully typed, autocompleted, context-checked
```

Dot access on the policy object is the action selection. No strings, no inference magic.

---

## Primitive 6: Post-Handler Hooks

### Usage

```typescript
updateOrder: procedure()
  .guard(authenticated)
  .policy(OrderPolicy.update)
  .use(loadOrder)
  .mutation(async ({ input, ctx }) => {
    return ctx.db.order.update({ where: { id: input.id }, data: input });
  })
  .useAfter(auditLog)
  .useAfter(invalidateCache)
  .useAfter(trackMetrics)
```

### Naming rationale

`.useAfter()` mirrors `.use()`. Same concept, opposite timing. A developer who knows `.use()` already understands `.useAfter()` without reading docs.

### Builder chain position

Currently, `.mutation()` / `.query()` are terminal methods that return a `CompiledProcedure`. To support `.useAfter()` after the terminal handler, `.mutation()` and `.query()` will return a `PostHandlerBuilder` — a limited builder that only exposes `.useAfter()`. This keeps `.mutation()` / `.query()` as the conceptual terminal handler while allowing post-handler hooks.

```typescript
// .mutation() returns PostHandlerBuilder, not CompiledProcedure directly
// PostHandlerBuilder exposes only .useAfter() and compiles to CompiledProcedure
.mutation(handler)              // returns PostHandlerBuilder
.useAfter(auditLog)            // returns PostHandlerBuilder
.useAfter(invalidateCache)     // returns PostHandlerBuilder
// PostHandlerBuilder auto-compiles to CompiledProcedure when accessed by the procedures() collection
```

### Behavior

- `.useAfter()` runs after the handler returns successfully, before the response is sent.
- Receives `{ input, result, ctx }` — `input` is the pipeline-enriched input (after `.through()` steps), not the raw validated input. This lets hooks see exactly what the handler received.
- Cannot modify the result — for side effects only.
- If `.useAfter()` throws, the response still sends. The error is logged, not swallowed.
- Multiple `.useAfter()` hooks chain in registration order.

### No `.before()` needed

The existing chain already covers pre-handler concerns:

| Chain position | Purpose |
|---|---|
| `.guard()` | Can this user do this? |
| `.policy()` | Can this user do this to this resource? |
| `.use()` | Enrich context, transform input |
| `.through()` | Multi-step pipeline |
| `.mutation()` / `.query()` | The actual work |
| `.useAfter()` | Observe the result, side effects |

---

## Naming Decisions Summary

| Method | Chosen | Rejected | Reason |
|---|---|---|---|
| `.policy()` | `.policy()` | `.authorize()` | Matches `definePolicy()`, names the concept consistently |
| `.through()` | `.through()` | `.pipeline()` | Names the action ("send through"), not the pattern |
| `.useAfter()` | `.useAfter()` | `.after()` | Mirrors `.use()`, immediately understood |
| `.emits()` | `.emits()` | `.fires()`, `.dispatches()` | Declarative, concise, standard terminology |
| `.throws()` | `.throws()` | `.errors()` | Matches Java/TypeScript exception terminology |
| `.transactional()` | `.transactional()` | — | Self-documenting, universally understood |
| `defineStep()` | `defineStep()` | `defineExternalStep()` | One factory with progressive options, avoids proliferation |
| `defineRevert()` | `defineRevert()` | inline in `defineStep` options | Separate concept from steps — revert actions are undo logic, not forward steps |
| `.onRevert()` | `.onRevert()` | `.compensate()`, `.undo()`, `.rollback()` | Event-like hook ("on revert, do this"), reads naturally for any domain — not payment-specific |

---

## Documentation Requirements

These primitives need:

1. **Conceptual guide** — "Business Logic in VeloxTS" explaining the three tiers with progressive examples.
2. **API reference** for each primitive — `DomainError`, `DomainEvent`, `defineStep`, `definePolicy` enhancements.
3. **Pipeline guide** — explicit about ".through() prepares, .mutation() commits" principle.
4. **Migration guide** — how to refactor existing monolithic handlers into pipelines.
5. **New `create-velox-app` template** — a B2B SaaS example demonstrating domain events, pipelines, policies, and domain errors in a realistic scenario (e.g., order management).

---

## Valid Chain Ordering

Methods must appear in this order on the procedure builder. All are optional except the terminal handler.

```
.input()          — optional, at most once
.output()         — optional, at most once
.guard()          — optional, repeatable
.policy()         — optional, at most once
.use()            — optional, repeatable
.throws()         — optional, at most once
.transactional()  — optional, at most once
.through()        — optional, repeatable (steps accumulate)
.emits()          — optional, repeatable
.rest()           — optional, at most once
.query()/.mutation()  — required, exactly once (terminal)
.useAfter()       — optional, repeatable (post-terminal)
```

Invalid orderings (TypeScript enforced via builder generics):
- `.through()` before `.guard()` — guards must run first
- `.policy()` after `.through()` — policy check happens before pipeline
- `.transactional()` after `.through()` — transaction scope must be declared before pipeline
- Multiple `.through()` calls — use one pipeline with all steps

## Open Questions

1. **Event replay / event sourcing** — not in scope for this design, but should we leave extension points (e.g., `correlationId` on `DomainEvent`) for future event sourcing support?
2. **Pipeline step type safety** — full generic inference chain is recommended (e.g., `defineStep<TInput, TOutput>('name', handler)` and `.through(step1, step2, step3)` enforces output-to-input compatibility). Exact implementation approach TBD during Phase 2.
3. **State machine integration** — Phase 3 mentions a guide. Should VeloxTS provide a thin wrapper around XState, or just document patterns?
