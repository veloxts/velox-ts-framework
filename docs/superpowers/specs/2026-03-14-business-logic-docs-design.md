# Business Logic Primitives — Documentation Design

## Goal

Update the published documentation at `apps/docs/src/content/` to cover all business logic primitives shipped in the `feat/business-logic-primitives` branch. One new page, eight existing pages updated.

## Tone & Principles

- **Problem-first, not lecture-first.** Name the problem in 1-2 sentences, then show the tool. Developers have lived these problems — don't explain why separation of concerns matters.
- **Direct and minimal.** No big reveals, no academic framing. The same tone as `services.mdx`: "Most documentation shows simple CRUD. Real applications are different."
- **Code-heavy.** Every concept gets a copy-paste example. Prose exists to connect code blocks, not replace them.
- **Progressive disclosure.** Simple features early, complex features later. Each section stands alone — a developer can stop reading when their problem is solved.

## Primitives to Document

| Primitive | Package | Builder Method |
|-----------|---------|---------------|
| `DomainError<TData>` | `@veloxts/core` | `.throws()` |
| `.transactional()` | `@veloxts/router` | `.transactional()` |
| `DomainEvent<TData>` | `@veloxts/events` | `.emits()` |
| `DomainEventEmitter` | `@veloxts/events` | — (listener registration) |
| `defineStep` / `defineRevert` | `@veloxts/router` | `.through()` |
| `.onRevert()` | `@veloxts/router` | chained on step |
| `.policy()` on builder | `@veloxts/router` | `.policy()` |
| `.useAfter()` | `@veloxts/router` | `.useAfter()` |
| `InferProcedureErrors<T>` | `@veloxts/client` | — (type utility) |
| `ClientCallable` with `_errors` | `@veloxts/client` | — (type threading) |

---

## Page 1: `endpoints/business-logic.mdx` (NEW)

**Frontmatter:**
```yaml
title: Business Logic
description: Transactions, domain errors, events, and pipelines on the procedure builder.
```

**Structure** — a single evolving example (order system). Each section adds one primitive to solve a new problem.

### Section 1: Domain Errors (~40 lines)

**Problem (1-2 sentences):** Your handler throws `new Error('Not enough stock')`. The client gets a generic 500 with no structured data to act on.

**Content:**
- Define a `DomainError` subclass with `code`, `status`, `data`
- Show throwing it in a handler
- Show the JSON response shape: `{ error, message, statusCode, code, data }`
- Show `.throws(InsufficientStock)` on the builder for documentation and client narrowing
- Note: errors are caught by the framework and serialized automatically

**Example classes:** `InsufficientStock`, `PaymentFailed`

### Section 2: Transactions (~30 lines)

**Problem (1-2 sentences):** Your mutation creates an order and updates inventory. If inventory update fails, the order record is orphaned.

**Content:**
- `.transactional()` on the builder — one-liner
- `ctx.db` becomes the transactional client inside the handler
- Auto-rollback on throw, auto-commit on return
- Optional: `{ isolationLevel, timeout }`
- Note: gracefully degrades if `ctx.db.$transaction` is missing

### Section 3: Domain Events (~60 lines)

**Heading must be exactly "Domain Events"** (cross-referenced by anchor from `ecosystem/events.mdx`).

**Problem (1-2 sentences):** Order is created. Email service and analytics need to know, but you don't want to import them into your handler.

**Content:**
- `.emits(OrderCreated)` on the builder — declarative, fires after success
- With mapper: `.emits(OrderCreated, (result) => ({ orderId: result.id }))`
- Events fire after handler success (after commit when transactional)
- Emission errors are caught and logged — never fail the request
- Optional `correlationId` for tracing event chains across handlers
- Distinguish from broadcast events: domain events are server-side internal, broadcast events are client-facing WebSocket/SSE
- Show `DomainEvent` subclass definition
- **Listening for events:** show `ctx.events.on(OrderCreated, async (event) => { ... })` at app level (via `EventsManager`, which extends the events plugin with domain event methods). Sequential vs concurrent listeners
- **Imperative emission:** show `ctx.events.emit(new OrderFulfilled({ ... }))` for conditional or multiple events inside a handler — runs immediately, not deferred like `.emits()`

### Section 4: Pipelines (~60 lines)

**Problem (1-2 sentences):** Before creating the order, you need to validate stock, reserve it, and charge the card. If charge fails, unreserve the stock.

**Content:**
- `defineStep('name', handler)` — basic step
- `defineStep({ name: 'charge', external: true }, handler)` — external step (runs outside transaction)
- `defineRevert('refund', handler)` — revert action
- `step.onRevert(revert)` — attach revert to step (immutable, returns new step)
- `.through(validateStock, reserveStock, chargePayment.onRevert(refund))` on builder
- Steps run in order, each output becomes next input
- On failure: reverts run in reverse for completed steps
- Two-phase execution under `.transactional()`: DB steps in tx, external steps after commit
- Note: `.through()` prepares, `.mutation()` commits — pipeline doesn't replace the handler

### Section 5: Post-Handler Hooks (~20 lines)

**Problem (1 sentence):** After the order is created, log an audit entry and invalidate a cache.

**Content:**
- `.useAfter(({ input, result, ctx }) => { ... })` — runs after handler success
- Multiple hooks chain in registration order
- Errors caught and logged — never fail the response
- Cannot modify the result
- Receives pipeline-enriched input, not raw input

### Section 6: Client Error Narrowing (~35 lines)

**Problem (1 sentence):** On the frontend, you catch an error but `error.code` is `string | undefined` — no type narrowing.

**Content:**
- `InferProcedureErrors<typeof client.orders.createOrder>` extracts the error union
- Show `isDomainErrorResponse()` type guard for the catch block
- Show the `switch (error.code)` pattern with narrowed `data` types
- Errors flow from `.throws()` on the server through `ClientFromCollection` to the client callable
- Note: `ClientCallable` carries a `_errors` phantom type — this is an internal mechanism, no action needed from the developer

### Section 7: Full Chain (~20 lines)

No problem statement. Just the complete procedure from sections 1-6 assembled:

```typescript
const createOrder = procedure()
  .input(CreateOrderSchema)
  .guard(authenticated)
  .policy(OrderPolicy.create)
  .throws(InsufficientStock, PaymentFailed)
  .transactional()
  .through(validateStock, reserveStock, chargePayment.onRevert(refund))
  .emits(OrderCreated)
  .mutation(async ({ input, ctx }) => {
    return ctx.db.order.create({ data: input });
  })
  .useAfter(auditLog);
```

Brief annotation: each line maps to a section above.

### Related Content links
- [Procedures](/docs/endpoints/procedures/) — Builder chain reference
- [Error Handling](/docs/core/error-handling/) — VeloxError hierarchy
- [Policies](/docs/authentication/policies/) — Resource authorization
- [Middleware](/docs/router/middleware/) — `.use()` and `.useAfter()`
- [Events](/docs/ecosystem/events/) — Broadcast events (WebSocket/SSE)

**Estimated length:** ~250-300 lines

---

## Page 2: `endpoints/procedures.mdx` (UPDATE)

### Change: Replace "Method Chain Order" Aside with Builder Chain Reference table

The existing "Method Chain Order" Aside (which states `.query()/.mutation()` "MUST be last") must be **removed or replaced** by the new Chain Overview table, since `.useAfter()` now follows the terminal handler. Leaving both creates a contradiction.

**Location:** Replace the existing chain order Aside; place the new table after the "Builder Methods" section.

**New section: "Chain Overview"**

A table showing every builder method in declaration order:

| Method | Purpose | Guide |
|--------|---------|-------|
| `.input(schema)` | Input validation | This page |
| `.output(schema)` | Output schema or resource view | This page, [Resource API](/docs/endpoints/resource-api/) |
| `.guard(guard)` | Request-level authorization | [Guards](/docs/authentication/guards/) |
| `.policy(action)` | Resource-level authorization | [Policies](/docs/authentication/policies/) |
| `.use(middleware)` | Pre-handler middleware | [Middleware](/docs/router/middleware/) |
| `.throws(...errors)` | Declare domain errors | [Business Logic](/docs/endpoints/business-logic/) |
| `.transactional(opts?)` | Wrap handler in DB transaction | [Business Logic](/docs/endpoints/business-logic/) |
| `.through(...steps)` | Pre-handler pipeline | [Business Logic](/docs/endpoints/business-logic/) |
| `.emits(Event, mapper?)` | Emit domain event on success | [Business Logic](/docs/endpoints/business-logic/) |
| `.rest(config)` | Override REST route | [REST Overrides](/docs/router/rest-overrides/) |
| `.query(handler)` / `.mutation(handler)` | Terminal handler | This page |
| `.useAfter(hook)` | Post-handler hook (after terminal) | [Middleware](/docs/router/middleware/) |

No new examples — just the map.

**Estimated delta:** +25 lines (net, after removing old Aside)

---

## Page 3: `core/error-handling.mdx` (UPDATE)

### Change: Add "Domain Errors" section

**Location:** After "Custom Errors" section.

**Content:**
- Brief guidance: use built-in error classes (`NotFoundError`, `ConflictError`) for standard HTTP errors. Use `DomainError` subclasses for business-specific errors with typed data that clients need to act on.
- `DomainError<TData>` — abstract base for typed business errors
- Requires `code` (string literal), `status` (HTTP status), and typed `data`
- Example: `InsufficientStock extends DomainError<{ sku: string; available: number }>`
- JSON response shape: `{ error, message, statusCode, code, data }`
- `isDomainError()` type guard for cross-package detection
- Link: "Use `.throws()` on the procedure builder to declare which domain errors a procedure may throw. See [Business Logic](/docs/endpoints/business-logic/)."

**Estimated delta:** +40 lines

---

## Page 4: `authentication/policies.mdx` (UPDATE — rewrite)

### Change: Rewrite with canonical API

**What's changing from the current page:**
- Handler signature: `(user, post) => ...` becomes `({ user, resource }) => ...` (destructured object)
- Resource name: `'posts'` (plural) becomes `'Post'` (PascalCase resource name, matches the context key `ctx.post`)
- Primary usage: `authorize()` inside handler becomes `.policy(PostPolicy.update)` on the builder chain
- New: `PolicyActionRef` introspection and compile-time context enforcement

**Content (full replacement):**

Opening stays similar (guards check who, policies check what).

- `definePolicy('Post', { update: ({ user, resource }) => ... })` — canonical signature
- `PostPolicy.update` — each action is a `PolicyActionRef` with `.actionName`, `.resourceName`, `.check()`
- `.policy(PostPolicy.update)` on the builder chain — checked before the handler, not inside it
- Show the pattern: `.use(loadPost)` → `.policy(PostPolicy.update)` → `.mutation(handler)`
- Compile-time safety: forgetting `.use(loadPost)` before `.policy()` produces a TypeScript error when the resource name is a literal
- Keep `can()` / `cannot()` as manual helpers for complex conditional logic inside handlers
- Update Guards vs Policies table: add row showing `.policy()` runs before handler (declarative), `authorize()` runs inside handler (imperative)

**Estimated delta:** ~same length, full content replacement

---

## Page 5: `router/middleware.mdx` (UPDATE)

### Change: Add "Post-Handler Hooks" section

**Location:** At the end, before any "Related Content" section.

**Content:**
- `.useAfter()` as the counterpart to `.use()` — runs after handler success
- Quick example: audit logging with `({ input, result, ctx }) => { ... }`
- Errors caught and logged — never fail the response
- Cannot modify the result
- Multiple hooks chain in order
- Link: "See [Business Logic](/docs/endpoints/business-logic/) for the full picture including pipelines and events."

**Estimated delta:** +25 lines

---

## Page 6: `ecosystem/events.mdx` (UPDATE)

### Change: Add "Domain Events" signpost

**Location:** After the Quick Start section, as an `Aside` component.

**Content (Aside):**

> **Looking for server-side events?** This page covers broadcast events — real-time WebSocket/SSE for client applications. For internal server-side events (decoupling business logic between modules), see [Domain Events](/docs/endpoints/business-logic/#domain-events).

**Estimated delta:** +5 lines

---

## Page 7: `endpoints/services.mdx` (UPDATE)

### Change: Simplify to service layer organization

**Remove:**
- "Multi-Step Mutations" section (manual `$transaction` wrapping)
- "Coordinating External Services" section (manual two-phase pattern)
- Summary table rows that reference removed patterns ("External + DB coordination", "Multi-step writes")

**Keep:**
- The Service Layer concept, directory structure, and "thin procedures" pattern
- Configuring External Clients (`src/lib/stripe.ts`, etc.)
- Writing Services (business logic in plain classes)
- Calling External APIs and subsections
- Error Handling section (covers `VeloxError` subclasses like `ConflictError` — distinct from `DomainError`)
- Handling Prisma Errors subsection
- Retry Logic subsection
- Composing Multiple Services
- Webhook Handlers
- Testing Services

**Add (where removed sections were):**

> For transactions, pipelines, and multi-step orchestration on the procedure builder, see [Business Logic](/docs/endpoints/business-logic/).

**Estimated delta:** -60 lines (net reduction)

---

## Page 8: `endpoints/domain-modules.mdx` (UPDATE)

### Change: Add "Declarative Business Logic" section

**Location:** After the existing manual module pattern, before `defineModule()`.

**Content:**
- Brief intro: modules organize code into features; the builder chain handles orchestration
- Before/after comparison using a billing module procedure:
  - **Before:** procedure calls `billingService.createCharge()` which manually wraps in `$transaction`, calls Stripe, emits event, handles rollback
  - **After:** same procedure with `.transactional()`, `.through(chargePayment.onRevert(refund))`, `.emits(ChargeCompleted)` — service still exists but does less plumbing
- The point: services focus on domain logic, the builder handles coordination

**Estimated delta:** +40 lines

---

## Page 9: `client/overview.mdx` (UPDATE)

### Change: Add "Error Handling" section

**Location:** After the existing usage sections.

**Content:**
- Catching `VeloxClientError` — `error.code`, `error.data`, `error.statusCode`
- `isDomainErrorResponse()` type guard
- `InferProcedureErrors<typeof client.orders.createOrder>` — compile-time error type extraction
- `switch (error.code)` pattern with narrowed `data` per case
- Link back: "See [Business Logic](/docs/endpoints/business-logic/#domain-errors) for defining domain errors on the server."

**Estimated delta:** +35 lines

---

## Page Dependency Order

No circular dependencies. Recommended implementation order:

1. `core/error-handling.mdx` — DomainError (foundation, referenced by everything)
2. `endpoints/business-logic.mdx` — new page (the centerpiece)
3. `endpoints/procedures.mdx` — chain reference table (links to business-logic)
4. `authentication/policies.mdx` — rewrite (links to business-logic)
5. `router/middleware.mdx` — useAfter section (links to business-logic)
6. `ecosystem/events.mdx` — domain events signpost (links to business-logic)
7. `endpoints/services.mdx` — simplify (links to business-logic)
8. `endpoints/domain-modules.mdx` — before/after section (links to business-logic)
9. `client/overview.mdx` — error narrowing (links to business-logic)

---

## Out of Scope

- Sidebar navigation configuration (Starlight auto-generates from file structure)
- OpenAPI documentation of domain errors (future — requires OpenAPI generator updates)
- Migration guide from old `definePolicy` signature (user decision: present canonical only)
- `reference/error-codes.mdx` updates (existing error code catalog — separate task)
