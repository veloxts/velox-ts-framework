# Business Logic Primitives Documentation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update published documentation to cover all business logic primitives (DomainError, .throws(), .transactional(), .emits(), .through(), .policy(), .useAfter(), InferProcedureErrors).

**Architecture:** One new page (`endpoints/business-logic.mdx`) as the centerpiece. Eight existing pages get targeted updates — chain reference table, new sections, or content replacement. All files are `.mdx` under `apps/docs/src/content/docs/`.

**Tech Stack:** Astro Starlight, MDX, TypeScript code examples

**Key references:**
- Documentation design spec: `docs/superpowers/specs/2026-03-14-business-logic-docs-design.md`
- Implementation spec (for API details): `docs/superpowers/specs/2026-03-14-business-logic-primitives-design.md`

**Tone rules:**
- Problem-first: 1-2 sentences naming the problem, then code. No lecturing.
- Direct and minimal. No academic framing, no big reveals.
- Code-heavy. Prose connects code blocks, doesn't replace them.
- Developers know these problems — just show the tool.

---

## Chunk 1: Foundation Pages

### Task 1: Add "Domain Errors" section to `core/error-handling.mdx`

**Files:**
- Modify: `apps/docs/src/content/docs/core/error-handling.mdx`

- [ ] **Step 1: Add "Domain Errors" section after "Custom Errors" (line 46)**

Insert after the Custom Errors section (after line 46), before "Error Response Format":

```mdx
## Domain Errors

Built-in errors like `NotFoundError` and `ConflictError` cover standard HTTP situations. When your business logic needs structured error data that clients can act on — "not enough stock, 3 available" — use `DomainError`:

```typescript
import { DomainError } from '@veloxts/core';

export class InsufficientStock extends DomainError<{
  sku: string;
  requested: number;
  available: number;
}> {
  readonly code = 'INSUFFICIENT_STOCK';
  readonly status = 422;
  readonly message = 'Not enough inventory';
}
```

Throw it like any error:

```typescript
throw new InsufficientStock({
  sku: 'ABC-123',
  requested: 10,
  available: 3,
});
```

The framework serializes it as:

```json
{
  "error": "InsufficientStock",
  "message": "Not enough inventory",
  "statusCode": 422,
  "code": "INSUFFICIENT_STOCK",
  "data": { "sku": "ABC-123", "requested": 10, "available": 3 }
}
```

Use `isDomainError()` to detect domain errors across packages:

```typescript
import { isDomainError } from '@veloxts/core';

if (isDomainError(error)) {
  console.log(error.code, error.data);
}
```

Declare domain errors on the procedure builder with `.throws()` to enable client-side type narrowing. See [Business Logic](/docs/endpoints/business-logic/) for details.
```

- [ ] **Step 2: Update "Related Content" section**

Add a link to business logic page:

```mdx
## Related Content

- [Business Logic](/docs/endpoints/business-logic/) - Domain errors, transactions, events, pipelines
- [Validation](/docs/validation/error-handling/) - Validation errors
- [Reference](/docs/reference/error-codes/) - Error code catalog
```

- [ ] **Step 3: Verify the page renders**

Run: `cd apps/docs && pnpm dev`
Open: `http://localhost:4321/docs/core/error-handling/`
Expected: Domain Errors section appears between Custom Errors and Error Response Format.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/src/content/docs/core/error-handling.mdx
git commit -m "docs(core): add DomainError section to error handling page"
```

---

### Task 2: Create `endpoints/business-logic.mdx` — Domain Errors + Transactions

**Files:**
- Create: `apps/docs/src/content/docs/endpoints/business-logic.mdx`

- [ ] **Step 1: Create the file with frontmatter and sections 1-2**

```mdx
---
title: Business Logic
description: Transactions, domain errors, events, and pipelines on the procedure builder.
---

import { Aside } from '@astrojs/starlight/components';

Your procedure validates input and runs a handler. But real mutations charge cards, update inventory, emit events, and need to roll back on failure. The procedure builder has first-class support for all of this.

## Domain Errors

Your handler throws `new Error('Not enough stock')`. The client gets a generic 500 with no structured data to act on.

Define a `DomainError` subclass with a typed `code` and `data` payload:

```typescript
import { DomainError } from '@veloxts/core';

export class InsufficientStock extends DomainError<{
  sku: string;
  requested: number;
  available: number;
}> {
  readonly code = 'INSUFFICIENT_STOCK';
  readonly status = 422;
  readonly message = 'Not enough inventory';
}

export class PaymentFailed extends DomainError<{
  reason: string;
  chargeId?: string;
}> {
  readonly code = 'PAYMENT_FAILED';
  readonly status = 422;
  readonly message = 'Payment could not be processed';
}
```

Throw it in your handler — the framework serializes `code` and `data` in the response automatically:

```typescript
throw new InsufficientStock({
  sku: input.sku,
  requested: input.quantity,
  available: stock.available,
});
// → { statusCode: 422, code: "INSUFFICIENT_STOCK", data: { sku, requested, available } }
```

Declare which errors a procedure can throw with `.throws()`:

```typescript
createOrder: procedure()
  .input(CreateOrderSchema)
  .throws(InsufficientStock, PaymentFailed)
  .mutation(async ({ input, ctx }) => {
    // handler may throw InsufficientStock or PaymentFailed
    return ctx.db.order.create({ data: input });
  })
```

`.throws()` does two things:
1. Documents the procedure's error contract (appears in OpenAPI output).
2. Enables typed error narrowing on the client — see [Client Error Narrowing](#client-error-narrowing).

<Aside type="tip">
Undeclared `DomainError` subclasses still work at runtime — they just don't get client-side type narrowing.
</Aside>

## Transactions

Your mutation creates an order and updates inventory. If the inventory update fails, the order record is orphaned.

Add `.transactional()` to wrap the handler in a database transaction:

```typescript
createOrder: procedure()
  .input(CreateOrderSchema)
  .transactional()
  .mutation(async ({ input, ctx }) => {
    const order = await ctx.db.order.create({ data: input });
    await ctx.db.inventory.update({
      where: { sku: input.sku },
      data: { stock: { decrement: input.quantity } },
    });
    // If inventory update fails, order is rolled back
    return order;
  })
```

`ctx.db` becomes the transactional client inside the handler. On throw: automatic rollback. On return: automatic commit.

Pass options for isolation level or timeout:

```typescript
.transactional({ isolationLevel: 'Serializable', timeout: 10_000 })
```

<Aside type="note">
`.transactional()` gracefully degrades — if `ctx.db.$transaction` is missing, the handler runs without a transaction wrapper.
</Aside>
```

- [ ] **Step 2: Verify the page renders**

Run: `cd apps/docs && pnpm dev`
Open: `http://localhost:4321/docs/endpoints/business-logic/`
Expected: Page renders with Domain Errors and Transactions sections.

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/content/docs/endpoints/business-logic.mdx
git commit -m "docs(endpoints): create business-logic page with domain errors and transactions"
```

---

### Task 3: Add Domain Events section to `business-logic.mdx`

**Files:**
- Modify: `apps/docs/src/content/docs/endpoints/business-logic.mdx`

- [ ] **Step 1: Append Section 3 (Domain Events) to the file**

Add after the Transactions section:

```mdx
## Domain Events

Order is created. Email service and analytics need to know, but importing those services into your handler creates tight coupling.

<Aside type="note">
Domain events are server-side internal events for decoupling business logic. They are separate from [broadcast events](/docs/ecosystem/events/) (WebSocket/SSE for real-time client updates).
</Aside>

### Defining events

```typescript
import { DomainEvent } from '@veloxts/events';

export class OrderCreated extends DomainEvent<{
  orderId: string;
  customerId: string;
  total: number;
}> {}
```

`DomainEvent` carries typed `data`, a `timestamp`, and an optional `correlationId` for tracing event chains.

### Declarative emission with `.emits()`

Add `.emits()` to fire an event after the handler succeeds:

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

The mapper function transforms the handler result into the event payload. When `.transactional()` is used, events fire after commit.

Emission errors are caught and logged — they never fail the request. The mutation already succeeded.

### Imperative emission

For conditional or multiple events, emit directly inside the handler:

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

### Listening for events

Register listeners at app level — typically in your module setup or plugin:

```typescript
// In your app setup or domain module
ctx.events.on(OrderCreated, async (event) => {
  await sendConfirmationEmail(event.data.customerId);
});

ctx.events.on(OrderCreated, async (event) => {
  await allocateInventory(event.data.orderId);
});
```

Listeners run concurrently by default. For sequential execution:

```typescript
ctx.events.on(OrderCreated, handler, { sequential: true });
```

Listener errors are logged but never propagate — each listener is isolated.
```

- [ ] **Step 2: Verify renders**

Open: `http://localhost:4321/docs/endpoints/business-logic/`
Expected: Domain Events section with three subsections appears.

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/content/docs/endpoints/business-logic.mdx
git commit -m "docs(endpoints): add domain events section to business-logic page"
```

---

### Task 4: Add Pipelines section to `business-logic.mdx`

**Files:**
- Modify: `apps/docs/src/content/docs/endpoints/business-logic.mdx`

- [ ] **Step 1: Append Section 4 (Pipelines) to the file**

Add after the Domain Events section:

```mdx
## Pipelines

Before creating the order, you need to validate stock, reserve it, and charge the card. If the charge fails, unreserve the stock.

### Defining steps

```typescript
import { defineStep, defineRevert } from '@veloxts/router';

const validateStock = defineStep('validateStock',
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

Steps run in order. Each step's return becomes the next step's `input`.

### External steps and reverts

Steps that call external services run outside the database transaction. Mark them with `{ external: true }`:

```typescript
const chargePayment = defineStep(
  { name: 'chargePayment', external: true },
  async ({ input, ctx }) => {
    const charge = await stripe.charges.create({ amount: input.total });
    return { ...input, chargeId: charge.id };
  }
);

const refundPayment = defineRevert('refundPayment',
  async ({ input, ctx }) => {
    await stripe.refunds.create({ charge: input.chargeId });
  }
);
```

Attach a revert to a step with `.onRevert()` — returns a new step (immutable):

```typescript
chargePayment.onRevert(refundPayment)
```

### Wiring on the procedure

```typescript
createOrder: procedure()
  .input(CreateOrderSchema)
  .transactional()
  .through(validateStock, reserveStock, chargePayment.onRevert(refundPayment))
  .emits(OrderCreated)
  .mutation(async ({ input, ctx }) => {
    return ctx.db.order.create({ data: input });
  })
```

`.through()` prepares, `.mutation()` commits. The pipeline doesn't replace the handler — it transforms the input before it.

### Failure and compensation

If a step fails after other steps have completed:
1. Revert actions run in reverse order for completed steps.
2. Each revert receives the output of the step being reverted (e.g., `chargeId` for refunds).
3. The original error propagates to the client.

### Two-phase execution with `.transactional()`

When `.transactional()` and `.through()` are combined:

- **Phase A:** DB steps + handler run inside the transaction. `ctx.db` is the transactional client.
- **Phase B:** External steps run after commit, outside any transaction.

```
.through(
  validateStock,                          // Phase A (DB, in transaction)
  reserveStock,                           // Phase A (DB, in transaction)
  chargePayment.onRevert(refundPayment),  // Phase B (external, after commit)
)
.mutation(handler)                        // Phase A (DB, in transaction)
```

<Aside type="caution">
Under `.transactional()`, DB steps must come before external steps. The handler cannot depend on data from external steps since they run after commit.
</Aside>

Without `.transactional()`, all steps execute in declaration order regardless of type.
```

- [ ] **Step 2: Verify renders**

Open: `http://localhost:4321/docs/endpoints/business-logic/`
Expected: Pipelines section appears with subsections for steps, reverts, wiring, failure, and two-phase.

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/content/docs/endpoints/business-logic.mdx
git commit -m "docs(endpoints): add pipelines section to business-logic page"
```

---

### Task 5: Add Post-Handler Hooks, Client Error Narrowing, Full Chain, and Related Content to `business-logic.mdx`

**Files:**
- Modify: `apps/docs/src/content/docs/endpoints/business-logic.mdx`

- [ ] **Step 1: Append Sections 5-7 and Related Content to the file**

Add after the Pipelines section:

```mdx
## Post-Handler Hooks

After the order is created, log an audit entry and invalidate a cache.

```typescript
createOrder: procedure()
  .mutation(async ({ input, ctx }) => {
    return ctx.db.order.create({ data: input });
  })
  .useAfter(({ input, result, ctx }) => {
    auditLog('order.created', { orderId: result.id, userId: ctx.user.id });
  })
  .useAfter(({ result }) => {
    cache.invalidate(`orders:${result.id}`);
  })
```

`.useAfter()` hooks run after the handler succeeds (and after events are emitted). Multiple hooks chain in registration order. Errors are caught and logged — they never fail the response. Hooks cannot modify the result.

<Aside type="tip">
`.useAfter()` receives the pipeline-enriched input (after `.through()` transforms), not the raw validated input.
</Aside>

## Client Error Narrowing

On the frontend, you catch an error but `error.code` is `string | undefined` — you can't narrow on it.

Use `InferProcedureErrors` to extract the declared error types from a procedure:

```typescript
import type { InferProcedureErrors } from '@veloxts/client';
import { isVeloxClientError } from '@veloxts/client';

type OrderErrors = InferProcedureErrors<typeof client.orders.createOrder>;
// → { code: 'INSUFFICIENT_STOCK'; data: { sku: string; requested: number; available: number } }
//   | { code: 'PAYMENT_FAILED'; data: { reason: string; chargeId?: string } }
```

Use it in your catch block:

```typescript
try {
  const order = await client.orders.createOrder(data);
} catch (error) {
  if (isVeloxClientError(error)) {
    switch (error.code) {
      case 'INSUFFICIENT_STOCK':
        showStockWarning(error.data.available);
        break;
      case 'PAYMENT_FAILED':
        showPaymentError(error.data.reason);
        break;
    }
  }
}
```

Error types flow automatically from `.throws()` on the server through `ClientFromCollection` to the client callable. No code generation or manual type definitions needed.

## Full Chain

Putting it all together — a single procedure declaration that validates, authorizes, orchestrates, and reports:

```typescript
import { procedure } from '@veloxts/velox';
import { authenticated } from '@veloxts/auth';

const createOrder = procedure()
  .input(CreateOrderSchema)                           // validate
  .guard(authenticated)                               // authorize
  .policy(OrderPolicy.create)                         // policy check
  .throws(InsufficientStock, PaymentFailed)           // declare errors
  .transactional()                                    // DB atomicity
  .through(                                           // prepare
    validateStock,
    reserveStock,
    chargePayment.onRevert(refundPayment),
  )
  .emits(OrderCreated)                                // side effects
  .mutation(async ({ input, ctx }) => {               // commit
    return ctx.db.order.create({ data: input });
  })
  .useAfter(auditLog)                                 // post-handler
```

Each line is one concern. The builder chain reads top-to-bottom as a declaration of intent.

## Related Content

- [Procedures](/docs/endpoints/procedures/) — Builder chain reference
- [Error Handling](/docs/core/error-handling/) — VeloxError hierarchy and DomainError
- [Policies](/docs/authentication/policies/) — Resource authorization with `.policy()`
- [Middleware](/docs/router/middleware/) — `.use()` and `.useAfter()`
- [Events](/docs/ecosystem/events/) — Broadcast events (WebSocket/SSE)
- [Client Package](/docs/client/overview/) — Error handling on the frontend
```

- [ ] **Step 2: Verify renders**

Open: `http://localhost:4321/docs/endpoints/business-logic/`
Expected: Complete page with all 7 sections renders correctly. Verify anchor links work: `#domain-events`, `#client-error-narrowing`.

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/content/docs/endpoints/business-logic.mdx
git commit -m "docs(endpoints): complete business-logic page with hooks, client narrowing, and full chain"
```

---

## Chunk 2: Existing Page Updates

### Task 6: Update `endpoints/procedures.mdx` — Replace chain order Aside with Chain Overview table

**Files:**
- Modify: `apps/docs/src/content/docs/endpoints/procedures.mdx`

- [ ] **Step 1: Replace the "Method Chain Order" section (lines 134-154)**

Replace the entire section from `## Method Chain Order` through the closing `</Aside>` tag with:

```mdx
## Chain Overview

Every builder method in declaration order:

| Method | Purpose | Guide |
|--------|---------|-------|
| `.input(schema)` | Input validation | [above](#inputschema) |
| `.output(schema)` | Output schema or resource view | [above](#outputschema-with-resource-schemas), [Resource API](/docs/endpoints/resource-api/) |
| `.guard(guard)` | Request-level authorization | [Guards](/docs/authentication/guards/) |
| `.policy(action)` | Resource-level authorization | [Policies](/docs/authentication/policies/) |
| `.use(middleware)` | Pre-handler middleware | [Middleware](/docs/router/middleware/) |
| `.throws(...errors)` | Declare domain errors | [Business Logic](/docs/endpoints/business-logic/) |
| `.transactional(opts?)` | Wrap handler in DB transaction | [Business Logic](/docs/endpoints/business-logic/) |
| `.through(...steps)` | Pre-handler pipeline | [Business Logic](/docs/endpoints/business-logic/) |
| `.emits(Event, mapper?)` | Emit domain event on success | [Business Logic](/docs/endpoints/business-logic/) |
| `.rest(config)` | Override REST route | [REST Overrides](/docs/router/rest-overrides/) |
| `.query(handler)` / `.mutation(handler)` | Terminal handler | [above](#queryhandler--mutationhandler) |
| `.useAfter(hook)` | Post-handler hook | [Middleware](/docs/router/middleware/) |
```

- [ ] **Step 2: Add Business Logic link to Related Content (line 231)**

Add to the existing Related Content list:

```mdx
- [Business Logic](/docs/endpoints/business-logic/) - Transactions, domain errors, events, pipelines
```

- [ ] **Step 3: Verify renders**

Open: `http://localhost:4321/docs/endpoints/procedures/`
Expected: Chain Overview table appears. Old "Method Chain Order Matters" caution Aside is gone.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/src/content/docs/endpoints/procedures.mdx
git commit -m "docs(endpoints): replace chain order aside with complete builder chain table"
```

---

### Task 7: Rewrite `authentication/policies.mdx` with canonical API

**Files:**
- Modify: `apps/docs/src/content/docs/authentication/policies.mdx`

- [ ] **Step 1: Replace the entire file content**

```mdx
---
title: Policies
description: Resource-level authorization with policies.
---

import { Aside } from '@astrojs/starlight/components';

Guards check *who* the user is; policies check *what* they can do with a specific resource. A policy defines rules like "users can edit their own posts" or "only admins can delete comments," keeping authorization logic centralized rather than scattered across handlers.

## Defining Policies

```typescript
import { definePolicy } from '@veloxts/auth';

const PostPolicy = definePolicy('Post', {
  create: ({ user }) => user.role === 'editor' || user.role === 'admin',
  update: ({ user, resource }) => resource.authorId === user.id,
  delete: ({ user, resource }) => resource.authorId === user.id || user.role === 'admin',
});
```

Each action is a `PolicyActionRef` with `.actionName`, `.resourceName`, and `.check()`:

```typescript
PostPolicy.update.actionName   // 'update'
PostPolicy.update.resourceName // 'Post'
PostPolicy.update.check(user, post) // boolean | Promise<boolean>
```

## Using `.policy()` on the Builder

The recommended way to enforce policies — checked automatically before the handler runs:

```typescript
import { procedure } from '@veloxts/velox';
import { authenticated } from '@veloxts/auth';

updatePost: procedure()
  .input(z.object({ id: z.string(), data: UpdatePostSchema }))
  .guard(authenticated)
  .use(loadPost)             // adds { post: Post } to context
  .policy(PostPolicy.update) // checked before handler — throws ForbiddenError on failure
  .mutation(async ({ input, ctx }) => {
    return ctx.db.post.update({
      where: { id: input.id },
      data: input.data,
    });
  }),
```

The policy looks up the resource from context by name — `PostPolicy` looks for `ctx.post`. Forgetting `.use(loadPost)` before `.policy()` produces a TypeScript error when the resource name is a string literal.

<Aside type="tip">
For action-level policies that don't need a resource (like `PostPolicy.create`), the resource lookup is skipped — only `ctx.user` is checked.
</Aside>

## Manual Helpers

For complex conditional logic inside handlers, use `can()` and `cannot()`:

```typescript
import { can, cannot } from '@veloxts/auth';

if (await can(ctx.user, 'update', 'Post', post)) {
  // User can update
}

if (await cannot(ctx.user, 'delete', 'Post', post)) {
  // User cannot delete
}
```

## Policies vs Guards

| Feature | Guards | Policies (`.policy()`) | Policies (`can()`/`cannot()`) |
|---------|--------|----------------------|-------------------------------|
| Scope | Request-level | Resource-level | Resource-level |
| Example | "Is user admin?" | "Can user edit THIS post?" | "Can user edit THIS post?" |
| Runs | Before handler | Before handler | Inside handler |
| Style | Declarative | Declarative | Imperative |

## Related Content

- [Guards](/docs/authentication/guards/) — Request authorization
- [Business Logic](/docs/endpoints/business-logic/) — Transactions, events, pipelines
- [JWT](/docs/authentication/jwt/) — Authentication
```

- [ ] **Step 2: Verify renders**

Open: `http://localhost:4321/docs/authentication/policies/`
Expected: Rewritten page with `definePolicy('Post', ...)` signature, `.policy()` on builder, and updated comparison table.

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/content/docs/authentication/policies.mdx
git commit -m "docs(auth): rewrite policies page with canonical definePolicy and .policy() builder API"
```

---

### Task 8: Add "Post-Handler Hooks" section to `router/middleware.mdx`

**Files:**
- Modify: `apps/docs/src/content/docs/router/middleware.mdx`

- [ ] **Step 1: Add section before "Related Content" (before line 138)**

Insert before `## Related Content`:

```mdx
## Post-Handler Hooks

`.useAfter()` is the counterpart to `.use()` — it runs after the handler succeeds:

```typescript
procedure()
  .mutation(async ({ input, ctx }) => {
    return ctx.db.order.create({ data: input });
  })
  .useAfter(({ input, result, ctx }) => {
    console.log(`Order ${result.id} created by ${ctx.user.id}`);
  })
```

Hooks run after events are emitted (if any). Errors are caught and logged — they never fail the response. The return value is ignored: hooks cannot modify the result. Multiple `.useAfter()` calls chain in registration order.

See [Business Logic](/docs/endpoints/business-logic/) for the full picture including pipelines and events.
```

- [ ] **Step 2: Add Business Logic link to Related Content**

```mdx
## Related Content

- [Business Logic](/docs/endpoints/business-logic/) - Post-handler hooks, pipelines, events
- [Guards](/docs/authentication/guards/) - Authorization
- [Procedures](/docs/endpoints/procedures/) - Procedure API
```

- [ ] **Step 3: Verify renders**

Open: `http://localhost:4321/docs/router/middleware/`
Expected: Post-Handler Hooks section appears at the end.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/src/content/docs/router/middleware.mdx
git commit -m "docs(router): add .useAfter() post-handler hooks section to middleware page"
```

---

### Task 9: Add domain events signpost to `ecosystem/events.mdx`

**Files:**
- Modify: `apps/docs/src/content/docs/ecosystem/events.mdx`

- [ ] **Step 1: Add Aside after the existing caution Aside (after line 74)**

Insert after the "Production requires Redis" Aside (after line 74):

```mdx
<Aside type="note" title="Server-Side Events">
This page covers **broadcast events** — real-time WebSocket/SSE for client applications. For internal server-side events that decouple business logic between modules (e.g., emitting `OrderCreated` after a mutation), see [Domain Events](/docs/endpoints/business-logic/#domain-events).
</Aside>
```

- [ ] **Step 2: Verify renders**

Open: `http://localhost:4321/docs/ecosystem/events/`
Expected: Note aside appears after the caution aside, before Environment Variables.

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/content/docs/ecosystem/events.mdx
git commit -m "docs(ecosystem): add domain events signpost to broadcast events page"
```

---

### Task 10: Simplify `endpoints/services.mdx` — remove transaction/orchestration sections

**Files:**
- Modify: `apps/docs/src/content/docs/endpoints/services.mdx`

- [ ] **Step 1: Remove "Multi-Step Mutations" section (lines 170-238)**

Remove the entire section from `## Multi-Step Mutations` through the `</Aside>` after "Prefer `select` over `include`" (line 238).

- [ ] **Step 2: Remove "Coordinating External Services" section (lines 240-288)**

Remove from `### Coordinating External Services` through the thin procedures code block (line 288).

- [ ] **Step 3: Add redirect note where removed sections were**

In place of the removed content (after line 169 — the `defineContextPlugin` section), add:

```mdx
<Aside type="tip" title="Transactions & Orchestration">
For database transactions, multi-step pipelines with compensation, and domain event emission, use the procedure builder's declarative primitives: `.transactional()`, `.through()`, `.emits()`. See [Business Logic](/docs/endpoints/business-logic/).
</Aside>
```

- [ ] **Step 4: Update the Summary table (lines 539-554)**

Remove these two rows from the Summary table:
- `| Multi-step writes | Prisma `$transaction` for atomicity |`
- `| External + DB coordination | Two-phase: DB first, external second, handle failure |`

Add:
- `| Transactions & orchestration | `.transactional()`, `.through()`, `.emits()` — see [Business Logic](/docs/endpoints/business-logic/) |`

- [ ] **Step 5: Add Business Logic link to Related Content**

Add to existing list:

```mdx
- [Business Logic](/docs/endpoints/business-logic/) - Transactions, pipelines, domain events
```

- [ ] **Step 6: Verify renders**

Open: `http://localhost:4321/docs/endpoints/services/`
Expected: Transaction and coordination sections are gone. Aside with link to business-logic page appears instead.

- [ ] **Step 7: Commit**

```bash
git add apps/docs/src/content/docs/endpoints/services.mdx
git commit -m "docs(endpoints): simplify services page, move transaction/orchestration to business-logic"
```

---

### Task 11: Add "Declarative Business Logic" section to `endpoints/domain-modules.mdx`

**Files:**
- Modify: `apps/docs/src/content/docs/endpoints/domain-modules.mdx`

- [ ] **Step 1: Add section before `defineModule()` API (before line 317)**

Insert before `## \`defineModule()\` API`:

```mdx
## Declarative Business Logic

Modules organize code into features. The procedure builder handles orchestration.

A billing procedure that manually orchestrates a charge:

```typescript
// Before — manual orchestration in the handler
createCharge: billingProcedure
  .input(ChargeSchema)
  .mutation(async ({ input, ctx }) => {
    return ctx.db.$transaction(async (tx) => {
      const charge = await ctx.stripe.createCharge(input);
      const record = await tx.payment.create({
        data: { ...input, chargeId: charge.id },
      });
      await ctx.events.emit(new ChargeCompleted({
        paymentId: record.id,
        amount: input.amount,
      }));
      return record;
    });
  }),
```

The same procedure with builder primitives:

```typescript
// After — builder declares the orchestration
createCharge: billingProcedure
  .input(ChargeSchema)
  .transactional()
  .through(chargePayment.onRevert(refundPayment))
  .emits(ChargeCompleted, (result) => ({
    paymentId: result.id,
    amount: result.amount,
  }))
  .mutation(async ({ input, ctx }) => {
    return ctx.db.payment.create({
      data: { ...input, chargeId: input.chargeId },
    });
  }),
```

The service still handles Stripe — `chargePayment` is a `defineStep` that calls `stripe.charges.create()`. The difference: transaction wrapping, event emission, and compensation are declared on the chain instead of hand-wired in the handler.

See [Business Logic](/docs/endpoints/business-logic/) for the full guide on `.transactional()`, `.through()`, `.emits()`, and `.useAfter()`.
```

- [ ] **Step 2: Verify renders**

Open: `http://localhost:4321/docs/endpoints/domain-modules/`
Expected: "Declarative Business Logic" section appears between the manual module pattern and `defineModule()`.

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/content/docs/endpoints/domain-modules.mdx
git commit -m "docs(endpoints): add declarative business logic before/after to domain modules page"
```

---

### Task 12: Add "Error Handling" section to `client/overview.mdx`

**Files:**
- Modify: `apps/docs/src/content/docs/client/overview.mdx`

- [ ] **Step 1: Find the end of the usage sections**

The client page has sections for React Hooks, then more usage patterns. Add the new section before "Related Content" if it exists, or at the end of the file.

Add:

```mdx
## Error Handling

Catch domain errors from the server with typed `code` and `data`:

```typescript
import { isVeloxClientError } from '@veloxts/client';

try {
  const order = await client.orders.createOrder(data);
} catch (error) {
  if (isVeloxClientError(error)) {
    console.log(error.statusCode); // 422
    console.log(error.code);       // 'INSUFFICIENT_STOCK'
    console.log(error.data);       // { sku: 'ABC-123', available: 3 }
  }
}
```

### Type-Safe Error Narrowing

When the server declares errors with `.throws()`, extract the error union for compile-time narrowing:

```typescript
import type { InferProcedureErrors } from '@veloxts/client';

type OrderErrors = InferProcedureErrors<typeof client.orders.createOrder>;
// → { code: 'INSUFFICIENT_STOCK'; data: { sku: string; ... } }
//   | { code: 'PAYMENT_FAILED'; data: { reason: string; ... } }
```

```typescript
if (isVeloxClientError(error)) {
  switch (error.code) {
    case 'INSUFFICIENT_STOCK':
      showStockWarning(error.data.available);
      break;
    case 'PAYMENT_FAILED':
      showPaymentError(error.data.reason);
      break;
  }
}
```

See [Business Logic](/docs/endpoints/business-logic/#domain-errors) for defining domain errors on the server.
```

- [ ] **Step 2: Verify renders**

Open: `http://localhost:4321/docs/client/overview/`
Expected: Error Handling section with code examples appears.

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/content/docs/client/overview.mdx
git commit -m "docs(client): add error handling section with InferProcedureErrors"
```

---

## Deferred Items

- OpenAPI documentation of domain errors (requires OpenAPI generator updates)
- `reference/error-codes.mdx` updates for new domain error codes
- Sidebar ordering configuration (if auto-ordering places business-logic.mdx incorrectly)
