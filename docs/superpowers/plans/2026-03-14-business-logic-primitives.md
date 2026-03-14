# Business Logic Primitives — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add domain errors, domain events, transaction middleware, pipelines with revert actions, policy integration, and post-handler hooks to VeloxTS's procedure builder chain.

**Architecture:** Three-phase layered approach extending existing packages (`@veloxts/core`, `@veloxts/events`, `@veloxts/router`, `@veloxts/auth`, `@veloxts/client`). Phase 1 delivers foundations (errors, events, transactions). Phase 2 adds composition (pipelines, policies). Phase 3 adds post-handler hooks. Each phase produces working, testable code.

**Tech Stack:** TypeScript 5+, Vitest, Zod 4, Prisma 7, Fastify 5

**Spec:** `docs/superpowers/specs/2026-03-14-business-logic-primitives-design.md`

---

## Chunk 1: Phase 1A — DomainError Base Class

### Task 1: DomainError class and type guard

**Files:**
- Create: `packages/core/src/errors/domain-error.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/__tests__/domain-error.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/src/__tests__/domain-error.test.ts
import { describe, it, expect } from 'vitest';
import { DomainError, isDomainError, VeloxError } from '../index.js';

class InsufficientStock extends DomainError<{
  sku: string;
  requested: number;
  available: number;
}> {
  readonly code = 'INSUFFICIENT_STOCK' as const;
  readonly status = 422;
  readonly message = 'Not enough inventory';
}

class TierExceeded extends DomainError<{
  currentTier: string;
  requiredTier: string;
}> {
  readonly code = 'TIER_EXCEEDED' as const;
  readonly status = 403;
  readonly message = 'Subscription upgrade required';
}

describe('DomainError', () => {
  it('should extend VeloxError', () => {
    const error = new InsufficientStock({ sku: 'ABC', requested: 10, available: 3 });
    expect(error).toBeInstanceOf(VeloxError);
    expect(error).toBeInstanceOf(DomainError);
  });

  it('should store typed data', () => {
    const error = new InsufficientStock({ sku: 'ABC', requested: 10, available: 3 });
    expect(error.data).toEqual({ sku: 'ABC', requested: 10, available: 3 });
  });

  it('should have code, status, message', () => {
    const error = new InsufficientStock({ sku: 'ABC', requested: 10, available: 3 });
    expect(error.code).toBe('INSUFFICIENT_STOCK');
    expect(error.statusCode).toBe(422);
    expect(error.message).toBe('Not enough inventory');
  });

  it('should serialize to JSON with data field', () => {
    const error = new InsufficientStock({ sku: 'ABC', requested: 10, available: 3 });
    const json = error.toJSON();
    expect(json).toMatchObject({
      error: 'InsufficientStock',
      message: 'Not enough inventory',
      statusCode: 422,
      code: 'INSUFFICIENT_STOCK',
      data: { sku: 'ABC', requested: 10, available: 3 },
    });
  });

  it('should work with isDomainError type guard', () => {
    const error = new InsufficientStock({ sku: 'ABC', requested: 10, available: 3 });
    expect(isDomainError(error)).toBe(true);
    expect(isDomainError(new Error('generic'))).toBe(false);
    expect(isDomainError(new VeloxError('test', 500))).toBe(false);
  });

  it('should support different error subclasses', () => {
    const error = new TierExceeded({ currentTier: 'free', requiredTier: 'pro' });
    expect(error.code).toBe('TIER_EXCEEDED');
    expect(error.statusCode).toBe(403);
    expect(error.data).toEqual({ currentTier: 'free', requiredTier: 'pro' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test src/__tests__/domain-error.test.ts`
Expected: FAIL — DomainError not found

- [ ] **Step 3: Implement DomainError**

```typescript
// packages/core/src/errors/domain-error.ts
import { VeloxError } from '../errors.js';

const DOMAIN_ERROR_BRAND = Symbol.for('velox.domain-error');

/**
 * Base class for user-defined domain errors with typed data payloads.
 * Extends VeloxError for consistent HTTP error handling.
 *
 * @example
 * class InsufficientStock extends DomainError<{ sku: string; available: number }> {
 *   readonly code = 'INSUFFICIENT_STOCK' as const;
 *   readonly status = 422;
 *   readonly message = 'Not enough inventory';
 * }
 *
 * throw new InsufficientStock({ sku: 'ABC-123', available: 3 });
 */
export abstract class DomainError<
  TData extends Record<string, unknown> = Record<string, unknown>,
> extends VeloxError {
  readonly [DOMAIN_ERROR_BRAND] = true;
  abstract readonly code: string;
  abstract readonly status: number;
  readonly data: TData;

  constructor(data: TData) {
    super('', 0); // Will be overridden by subclass readonly properties
    this.data = data;
    // VeloxError sets statusCode in constructor, but we need the subclass's `status` value.
    // Override after super() since `status` is set by the subclass's readonly initializer.
    (this as { statusCode: number }).statusCode = this.status;
    this.name = this.constructor.name;
  }

  override toJSON(): Record<string, unknown> {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      data: this.data,
    };
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return (
    error instanceof DomainError ||
    (typeof error === 'object' &&
      error !== null &&
      DOMAIN_ERROR_BRAND in error &&
      (error as Record<symbol, unknown>)[DOMAIN_ERROR_BRAND] === true)
  );
}
```

**Implementation notes:**
- Read `packages/core/src/errors.ts:270` to verify the `VeloxError` constructor signature before implementing. The `super()` call must match.
- The `message` property requires special handling: abstract readonly `message` shadows `Error.message`. After calling `super()`, explicitly set the Error-level message: `Object.defineProperty(this, 'message', { value: this.message, writable: false, enumerable: true })` so that both `error.message` and `Error.prototype.toString()` work correctly.
- The spec references `VeloxFailure` as the base class, but `VeloxFailure` is a catalog-driven fluent builder — not suitable as a base for user-defined domain errors. `VeloxError` is the correct base class (HTTP-oriented error with `statusCode`, `toJSON()`).
- Since Fastify's default error handler calls `error.toJSON()` if it exists on the error object, `DomainError.toJSON()` should work out of the box for REST serialization — no REST adapter modification needed (Task 2 may be unnecessary; verify by testing).

- [ ] **Step 4: Export from @veloxts/core**

Modify `packages/core/src/index.ts` — add to the error exports section:
```typescript
export { DomainError, isDomainError } from './errors/domain-error.js';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/core && pnpm test src/__tests__/domain-error.test.ts`
Expected: PASS

- [ ] **Step 6: Run full core test suite**

Run: `cd packages/core && pnpm test`
Expected: All existing tests still pass

- [ ] **Step 7: Run type-check**

Run: `pnpm type-check`
Expected: No new errors

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/errors/domain-error.ts packages/core/src/__tests__/domain-error.test.ts packages/core/src/index.ts
git commit -m "feat(core): add DomainError base class with typed data payloads"
```

---

### Task 2: Verify REST adapter DomainError serialization

**Files:**
- Test: `packages/router/src/__tests__/domain-error-rest.test.ts`

The REST adapter at `packages/router/src/rest/adapter.ts` does NOT have its own error handler — it lets errors propagate to Fastify's default error handler. Since `DomainError` extends `VeloxError` which has `toJSON()`, and Fastify's error handler respects `toJSON()`, this should work out of the box.

- [ ] **Step 1: Write verification test**

Test that when a procedure throws a `DomainError`, the Fastify error handler serializes it correctly with `code` and `data` in the response body. Use a Fastify test instance with the REST adapter registered.

- [ ] **Step 2: Run test**

Run: `cd packages/router && pnpm test src/__tests__/domain-error-rest.test.ts`
Expected: PASS (if not, add explicit DomainError handling in `createRouteHandler`'s error path)

- [ ] **Step 3: Commit**

```bash
git add packages/router/src/__tests__/domain-error-rest.test.ts
git commit -m "test(router): verify DomainError serialization through Fastify error handler"
```

---

## Chunk 2: Phase 1B — Domain Events

### Task 3: DomainEvent base class

**Files:**
- Create: `packages/events/src/domain/event.ts`
- Test: `packages/events/src/__tests__/domain-event.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/events/src/__tests__/domain-event.test.ts
import { describe, it, expect } from 'vitest';
import { DomainEvent } from '../domain/event.js';

class OrderCreated extends DomainEvent<{
  orderId: string;
  customerId: string;
  total: number;
}> {}

class OrderFulfilled extends DomainEvent<{
  orderId: string;
  trackingNumber: string;
}> {}

describe('DomainEvent', () => {
  it('should store typed data', () => {
    const event = new OrderCreated({ orderId: '1', customerId: '2', total: 100 });
    expect(event.data).toEqual({ orderId: '1', customerId: '2', total: 100 });
  });

  it('should have a timestamp', () => {
    const before = new Date();
    const event = new OrderCreated({ orderId: '1', customerId: '2', total: 100 });
    expect(event.timestamp).toBeInstanceOf(Date);
    expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('should support correlationId', () => {
    const event = new OrderCreated(
      { orderId: '1', customerId: '2', total: 100 },
      { correlationId: 'req-123' }
    );
    expect(event.correlationId).toBe('req-123');
  });

  it('should derive eventName from class name', () => {
    expect(OrderCreated.eventName).toBe('OrderCreated');
    expect(OrderFulfilled.eventName).toBe('OrderFulfilled');
  });

  it('should default correlationId to undefined', () => {
    const event = new OrderCreated({ orderId: '1', customerId: '2', total: 100 });
    expect(event.correlationId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/events && pnpm test src/__tests__/domain-event.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement DomainEvent**

```typescript
// packages/events/src/domain/event.ts
export abstract class DomainEvent<
  TData extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly data: TData;
  readonly timestamp: Date;
  readonly correlationId?: string;

  constructor(data: TData, options?: { correlationId?: string }) {
    this.data = data;
    this.timestamp = new Date();
    this.correlationId = options?.correlationId;
  }

  static get eventName(): string {
    return this.name;
  }
}

/** Constructor type for concrete DomainEvent subclasses — used as event keys */
export type DomainEventClass<TData extends Record<string, unknown> = Record<string, unknown>> = {
  new (data: TData, options?: { correlationId?: string }): DomainEvent<TData>;
  readonly eventName: string;
};
```

- [ ] **Step 4: Run tests**

Run: `cd packages/events && pnpm test src/__tests__/domain-event.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/events/src/domain/event.ts packages/events/src/__tests__/domain-event.test.ts
git commit -m "feat(events): add DomainEvent base class with typed payloads"
```

---

### Task 4: DomainEventEmitter

**Files:**
- Create: `packages/events/src/domain/emitter.ts`
- Test: `packages/events/src/__tests__/domain-emitter.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/events/src/__tests__/domain-emitter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainEventEmitter } from '../domain/emitter.js';
import { DomainEvent } from '../domain/event.js';

class OrderCreated extends DomainEvent<{ orderId: string }> {}
class OrderFulfilled extends DomainEvent<{ orderId: string }> {}

describe('DomainEventEmitter', () => {
  let emitter: DomainEventEmitter;

  beforeEach(() => {
    emitter = new DomainEventEmitter();
  });

  it('should register and call listener on emit', async () => {
    const handler = vi.fn();
    emitter.on(OrderCreated, handler);

    const event = new OrderCreated({ orderId: '1' });
    await emitter.emit(event);

    expect(handler).toHaveBeenCalledWith(event.data);
  });

  it('should call multiple listeners for same event', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    emitter.on(OrderCreated, handler1);
    emitter.on(OrderCreated, handler2);

    await emitter.emit(new OrderCreated({ orderId: '1' }));

    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  it('should not call listeners for different events', async () => {
    const handler = vi.fn();
    emitter.on(OrderFulfilled, handler);

    await emitter.emit(new OrderCreated({ orderId: '1' }));

    expect(handler).not.toHaveBeenCalled();
  });

  it('should run listeners concurrently by default', async () => {
    const order: string[] = [];
    emitter.on(OrderCreated, async () => {
      await new Promise(r => setTimeout(r, 50));
      order.push('slow');
    });
    emitter.on(OrderCreated, async () => {
      order.push('fast');
    });

    await emitter.emit(new OrderCreated({ orderId: '1' }));

    // Concurrent: fast finishes before slow despite registration order
    expect(order[0]).toBe('fast');
    expect(order[1]).toBe('slow');
  });

  it('should run listeners sequentially when configured', async () => {
    const order: string[] = [];
    emitter.on(OrderCreated, async () => {
      await new Promise(r => setTimeout(r, 10));
      order.push('first');
    }, { sequential: true });
    emitter.on(OrderCreated, async () => {
      order.push('second');
    }, { sequential: true });

    await emitter.emit(new OrderCreated({ orderId: '1' }));

    expect(order).toEqual(['first', 'second']);
  });

  it('should not throw when listener fails', async () => {
    emitter.on(OrderCreated, async () => {
      throw new Error('listener failed');
    });

    // Should not throw
    await expect(
      emitter.emit(new OrderCreated({ orderId: '1' }))
    ).resolves.toBeUndefined();
  });

  it('should support off() to remove listeners', () => {
    const handler = vi.fn();
    emitter.on(OrderCreated, handler);
    emitter.off(OrderCreated, handler);

    emitter.emit(new OrderCreated({ orderId: '1' }));

    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/events && pnpm test src/__tests__/domain-emitter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement DomainEventEmitter**

```typescript
// packages/events/src/domain/emitter.ts
import type { DomainEvent, DomainEventClass } from './event.js';

export interface DomainListenerOptions {
  sequential?: boolean;
  retryable?: boolean;
}

type DomainEventHandler<TData extends Record<string, unknown>> = (
  data: TData
) => void | Promise<void>;

interface RegisteredListener {
  handler: DomainEventHandler<Record<string, unknown>>;
  options: DomainListenerOptions;
}

export class DomainEventEmitter {
  private listeners = new Map<string, RegisteredListener[]>();

  on<TData extends Record<string, unknown>>(
    eventClass: DomainEventClass<TData>,
    handler: DomainEventHandler<TData>,
    options: DomainListenerOptions = {},
  ): void {
    const key = eventClass.eventName;
    const existing = this.listeners.get(key) ?? [];
    existing.push({
      handler: handler as DomainEventHandler<Record<string, unknown>>,
      options,
    });
    this.listeners.set(key, existing);
  }

  off<TData extends Record<string, unknown>>(
    eventClass: DomainEventClass<TData>,
    handler: DomainEventHandler<TData>,
  ): void {
    const key = eventClass.eventName;
    const existing = this.listeners.get(key);
    if (!existing) return;
    this.listeners.set(
      key,
      existing.filter(l => l.handler !== handler),
    );
  }

  async emit<TData extends Record<string, unknown>>(
    event: DomainEvent<TData>,
  ): Promise<void> {
    const key = (event.constructor as DomainEventClass<TData>).eventName;
    const registered = this.listeners.get(key);
    if (!registered || registered.length === 0) return;

    const sequential = registered.filter(l => l.options.sequential);
    const concurrent = registered.filter(l => !l.options.sequential);

    // Run sequential listeners in order
    for (const listener of sequential) {
      try {
        await listener.handler(event.data);
      } catch (error) {
        // Log but don't throw — mutation already succeeded
        console.error(`[velox:events] Listener error for ${key}:`, error);
      }
    }

    // Run concurrent listeners in parallel
    await Promise.allSettled(
      concurrent.map(async (listener) => {
        try {
          await listener.handler(event.data);
        } catch (error) {
          console.error(`[velox:events] Listener error for ${key}:`, error);
        }
      }),
    );
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/events && pnpm test src/__tests__/domain-emitter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/events/src/domain/emitter.ts packages/events/src/__tests__/domain-emitter.test.ts
git commit -m "feat(events): add DomainEventEmitter with typed listeners"
```

---

### Task 5: Extend EventsManager with domain event methods

**Files:**
- Modify: `packages/events/src/manager.ts`
- Modify: `packages/events/src/types.ts`
- Create: `packages/events/src/domain/index.ts`
- Modify: `packages/events/src/index.ts`
- Test: `packages/events/src/__tests__/manager-domain-events.test.ts`

- [ ] **Step 1: Write failing tests**

Test that `EventsManager` now exposes `.emit()` and `.on()` for domain events alongside broadcast methods.

```typescript
// packages/events/src/__tests__/manager-domain-events.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createManagerFromDriver, DomainEvent } from '../index.js';

class OrderCreated extends DomainEvent<{ orderId: string }> {}

// Create a mock driver
const mockDriver = {
  broadcast: vi.fn(),
  getSubscribers: vi.fn().mockReturnValue([]),
  getPresenceMembers: vi.fn().mockReturnValue([]),
  getConnectionCount: vi.fn().mockReturnValue(0),
  getChannels: vi.fn().mockReturnValue([]),
  close: vi.fn(),
};

describe('EventsManager domain events', () => {
  it('should expose emit() for domain events', () => {
    const manager = createManagerFromDriver(mockDriver);
    expect(typeof manager.emit).toBe('function');
  });

  it('should expose on() for domain event listeners', () => {
    const manager = createManagerFromDriver(mockDriver);
    expect(typeof manager.on).toBe('function');
  });

  it('should emit and receive domain events', async () => {
    const manager = createManagerFromDriver(mockDriver);
    const handler = vi.fn();
    manager.on(OrderCreated, handler);

    await manager.emit(new OrderCreated({ orderId: '1' }));

    expect(handler).toHaveBeenCalledWith({ orderId: '1' });
  });

  it('should keep existing broadcast methods working', async () => {
    const manager = createManagerFromDriver(mockDriver);
    await manager.broadcast('channel', 'event', { data: 'test' });
    expect(mockDriver.broadcast).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/events && pnpm test src/__tests__/manager-domain-events.test.ts`
Expected: FAIL — emit/on not found on manager

- [ ] **Step 3: Extend EventsManager**

Modify `packages/events/src/manager.ts`:
- Import `DomainEventEmitter` and `DomainEvent`/`DomainEventClass`
- In `createManagerFromDriver()`, create a `DomainEventEmitter` instance
- Add `emit()` and `on()` and `off()` methods to the returned manager that delegate to the emitter

Update `packages/events/src/types.ts`:
- Add `emit`, `on`, `off` to the `EventsManager` interface

- [ ] **Step 4: Create domain module barrel export**

```typescript
// packages/events/src/domain/index.ts
export { DomainEvent, type DomainEventClass } from './event.js';
export { DomainEventEmitter, type DomainListenerOptions } from './emitter.js';
```

- [ ] **Step 5: Update package exports**

Modify `packages/events/src/index.ts` — add:
```typescript
export { DomainEvent, type DomainEventClass, DomainEventEmitter, type DomainListenerOptions } from './domain/index.js';
```

- [ ] **Step 6: Run tests**

Run: `cd packages/events && pnpm test`
Expected: All tests pass (new + existing)

- [ ] **Step 7: Run type-check**

Run: `pnpm type-check`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add packages/events/src/domain/ packages/events/src/manager.ts packages/events/src/types.ts packages/events/src/index.ts packages/events/src/__tests__/manager-domain-events.test.ts
git commit -m "feat(events): extend EventsManager with domain event emit/on/off"
```

---

## Chunk 3: Phase 1C — Builder Extensions (.throws(), .transactional(), .emits())

### Task 6: Add TErrors generic to CompiledProcedure

**Files:**
- Modify: `packages/router/src/types.ts`
- Modify: `packages/router/src/procedure/types.ts`

- [ ] **Step 1: Add TErrors to CompiledProcedure**

Modify `packages/router/src/types.ts` — add a 5th generic parameter `TErrors = never` to `CompiledProcedure`:

```typescript
export interface CompiledProcedure<
  TInput = unknown,
  TOutput = unknown,
  TContext extends BaseContext = BaseContext,
  TType extends ProcedureType = ProcedureType,
  TErrors = never,  // NEW
> {
  // ... existing fields ...
  readonly errorClasses?: ReadonlyArray<new (data: unknown) => unknown>; // NEW — runtime error class refs
}
```

- [ ] **Step 2: Add InferProcedureErrors type utility**

In `packages/router/src/types.ts`, add alongside existing Infer helpers:

```typescript
export type InferProcedureErrors<T> =
  T extends CompiledProcedure<unknown, unknown, BaseContext, ProcedureType, infer E> ? E : never;
```

- [ ] **Step 3: Update ProcedureBuilder type to track TErrors**

In `packages/router/src/procedure/types.ts`, add `TErrors = never` to the `ProcedureBuilder` interface and the `ProcedureBuilderState`.

- [ ] **Step 4: Run type-check to ensure nothing breaks**

Run: `pnpm type-check`
Expected: No errors (TErrors defaults to `never`, backward compatible)

- [ ] **Step 5: Run router tests**

Run: `cd packages/router && pnpm test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add packages/router/src/types.ts packages/router/src/procedure/types.ts
git commit -m "feat(router): add TErrors generic parameter to CompiledProcedure"
```

---

### Task 7: .throws() on ProcedureBuilder

**Files:**
- Modify: `packages/router/src/procedure/builder.ts`
- Modify: `packages/router/src/procedure/types.ts`
- Test: `packages/router/src/__tests__/throws.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/router/src/__tests__/throws.test.ts
import { describe, it, expect } from 'vitest';
import { procedure } from '../index.js';
import { DomainError } from '@veloxts/core';
import { z } from 'zod';

class InsufficientStock extends DomainError<{ sku: string }> {
  readonly code = 'INSUFFICIENT_STOCK' as const;
  readonly status = 422;
  readonly message = 'Not enough inventory';
}

class TierExceeded extends DomainError<{ tier: string }> {
  readonly code = 'TIER_EXCEEDED' as const;
  readonly status = 403;
  readonly message = 'Upgrade required';
}

describe('.throws()', () => {
  it('should compile a procedure with .throws()', () => {
    const proc = procedure()
      .input(z.object({ id: z.string() }))
      .throws(InsufficientStock, TierExceeded)
      .mutation(async ({ input }) => ({ id: input.id }));

    expect(proc.errorClasses).toHaveLength(2);
    expect(proc.errorClasses).toContain(InsufficientStock);
    expect(proc.errorClasses).toContain(TierExceeded);
  });

  it('should preserve existing builder state', () => {
    const proc = procedure()
      .input(z.object({ id: z.string() }))
      .throws(InsufficientStock)
      .mutation(async ({ input }) => ({ id: input.id }));

    expect(proc.inputSchema).toBeDefined();
    expect(proc.type).toBe('mutation');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/router && pnpm test src/__tests__/throws.test.ts`
Expected: FAIL

- [ ] **Step 3: Add .throws() to builder type**

In `packages/router/src/procedure/types.ts`, add the method signature to the `ProcedureBuilder` interface:

```typescript
throws<TNewErrors extends DomainError<Record<string, unknown>>>(
  ...errorClasses: Array<new (data: unknown) => TNewErrors>
): ProcedureBuilder<TInput, TOutput, TContext, TErrors | TNewErrors>;
```

- [ ] **Step 4: Implement .throws() in builder**

In `packages/router/src/procedure/builder.ts`, add inside `createBuilder()`:

```typescript
throws(...errorClasses) {
  return createBuilder({
    ...state,
    errorClasses: [...(state.errorClasses ?? []), ...errorClasses],
  });
}
```

Add `errorClasses` to `BuilderRuntimeState`. Pass it through in `compileProcedure()` to `CompiledProcedure.errorClasses`.

- [ ] **Step 5: Run tests**

Run: `cd packages/router && pnpm test src/__tests__/throws.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `cd packages/router && pnpm test`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add packages/router/src/procedure/builder.ts packages/router/src/procedure/types.ts packages/router/src/__tests__/throws.test.ts
git commit -m "feat(router): add .throws() to procedure builder for typed domain errors"
```

---

### Task 8: .transactional() on ProcedureBuilder

**Files:**
- Modify: `packages/router/src/procedure/builder.ts`
- Modify: `packages/router/src/procedure/types.ts`
- Test: `packages/router/src/__tests__/transactional.test.ts`

- [ ] **Step 1: Write failing tests**

Test that `.transactional()` stores transaction options on the compiled procedure and that `executeProcedure` wraps the handler in `ctx.db.$transaction()`.

```typescript
// packages/router/src/__tests__/transactional.test.ts
import { describe, it, expect, vi } from 'vitest';
import { procedure, executeProcedure } from '../index.js';
import { z } from 'zod';

describe('.transactional()', () => {
  it('should store transactional flag on compiled procedure', () => {
    const proc = procedure()
      .input(z.object({ id: z.string() }))
      .transactional()
      .mutation(async ({ input }) => ({ id: input.id }));

    expect(proc.transactional).toBe(true);
  });

  it('should store transaction options', () => {
    const proc = procedure()
      .transactional({ isolationLevel: 'Serializable', timeout: 10_000 })
      .mutation(async ({ input }) => ({ id: '1' }));

    expect(proc.transactionalOptions).toEqual({
      isolationLevel: 'Serializable',
      timeout: 10_000,
    });
  });

  it('should wrap handler in ctx.db.$transaction when executed', async () => {
    const mockTx = { user: { create: vi.fn().mockResolvedValue({ id: '1' }) } };
    const mockDb = {
      $transaction: vi.fn(async (fn) => fn(mockTx)),
    };

    const proc = procedure()
      .transactional()
      .mutation(async ({ ctx }) => {
        return ctx.db.user.create({ data: { name: 'test' } });
      });

    const ctx = { request: {}, reply: {}, db: mockDb } as unknown;
    const result = await executeProcedure(proc, {}, ctx);

    expect(mockDb.$transaction).toHaveBeenCalled();
    expect(result).toEqual({ id: '1' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/router && pnpm test src/__tests__/transactional.test.ts`
Expected: FAIL

- [ ] **Step 3: Add .transactional() to builder type**

In `packages/router/src/procedure/types.ts`:

```typescript
transactional(options?: TransactionalOptions): ProcedureBuilder<TInput, TOutput, TContext, TErrors>;
```

Add `TransactionalOptions` type:

```typescript
export interface TransactionalOptions {
  isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable' | 'Snapshot';
  timeout?: number;
}
```

- [ ] **Step 4: Implement .transactional() in builder**

In `packages/router/src/procedure/builder.ts`, add inside `createBuilder()`:

```typescript
transactional(options?: TransactionalOptions) {
  return createBuilder({
    ...state,
    transactional: true,
    transactionalOptions: options,
  });
}
```

Add `transactional` and `transactionalOptions` to `BuilderRuntimeState` and `CompiledProcedure`.

- [ ] **Step 5: Update executeProcedure for transactional wrapping**

In `packages/router/src/procedure/builder.ts`, modify `executeProcedure()`:
- After input validation, before handler execution
- If `procedure.transactional === true` and `ctx.db?.$transaction` exists:
  - Wrap the handler call in `ctx.db.$transaction(async (tx) => { ... }, options)`
  - Replace `ctx.db` with `tx` in the handler's context

- [ ] **Step 6: Run tests**

Run: `cd packages/router && pnpm test src/__tests__/transactional.test.ts`
Expected: PASS

- [ ] **Step 7: Run full test suite**

Run: `cd packages/router && pnpm test`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add packages/router/src/procedure/builder.ts packages/router/src/procedure/types.ts packages/router/src/__tests__/transactional.test.ts
git commit -m "feat(router): add .transactional() to procedure builder"
```

---

### Task 9: .emits() on ProcedureBuilder

**Files:**
- Modify: `packages/router/src/procedure/builder.ts`
- Modify: `packages/router/src/procedure/types.ts`
- Test: `packages/router/src/__tests__/emits.test.ts`

- [ ] **Step 1: Write failing tests**

Test both forms: `.emits(EventClass)` (no mapping) and `.emits(EventClass, mapper)` (with mapping function).

```typescript
// packages/router/src/__tests__/emits.test.ts
import { describe, it, expect, vi } from 'vitest';
import { procedure, executeProcedure } from '../index.js';
import { DomainEvent } from '@veloxts/events';
import { z } from 'zod';

class OrderCreated extends DomainEvent<{ orderId: string; total: number }> {}

describe('.emits()', () => {
  it('should store event class on compiled procedure', () => {
    const proc = procedure()
      .emits(OrderCreated)
      .mutation(async () => ({ orderId: '1', total: 100 }));

    expect(proc.emittedEvents).toHaveLength(1);
    expect(proc.emittedEvents[0].eventClass).toBe(OrderCreated);
    expect(proc.emittedEvents[0].mapper).toBeUndefined();
  });

  it('should store event class with mapping function', () => {
    const mapper = (result: { id: string; amount: number }) => ({
      orderId: result.id,
      total: result.amount,
    });

    const proc = procedure()
      .emits(OrderCreated, mapper)
      .mutation(async () => ({ id: '1', amount: 100 }));

    expect(proc.emittedEvents).toHaveLength(1);
    expect(proc.emittedEvents[0].mapper).toBe(mapper);
  });

  it('should emit event after successful execution', async () => {
    const mockEmit = vi.fn();
    const ctx = {
      request: {},
      reply: {},
      events: { emit: mockEmit },
    } as unknown;

    const proc = procedure()
      .emits(OrderCreated, (r: { id: string }) => ({ orderId: r.id, total: 50 }))
      .mutation(async () => ({ id: 'order-1' }));

    await executeProcedure(proc, {}, ctx);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    const emittedEvent = mockEmit.mock.calls[0][0];
    expect(emittedEvent).toBeInstanceOf(OrderCreated);
    expect(emittedEvent.data).toEqual({ orderId: 'order-1', total: 50 });
  });

  it('should NOT emit event if handler throws', async () => {
    const mockEmit = vi.fn();
    const ctx = {
      request: {},
      reply: {},
      events: { emit: mockEmit },
    } as unknown;

    const proc = procedure()
      .emits(OrderCreated)
      .mutation(async () => { throw new Error('fail'); });

    await expect(executeProcedure(proc, {}, ctx)).rejects.toThrow('fail');
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/router && pnpm test src/__tests__/emits.test.ts`
Expected: FAIL

- [ ] **Step 3: Add .emits() to builder type**

In `packages/router/src/procedure/types.ts`:

```typescript
emits<TEventData extends Record<string, unknown>>(
  eventClass: DomainEventClass<TEventData>,
  mapper?: (result: TOutput) => TEventData,
): ProcedureBuilder<TInput, TOutput, TContext, TErrors>;
```

- [ ] **Step 4: Implement .emits() in builder**

In `packages/router/src/procedure/builder.ts`:

```typescript
emits(eventClass, mapper?) {
  return createBuilder({
    ...state,
    emittedEvents: [...(state.emittedEvents ?? []), { eventClass, mapper }],
  });
}
```

Add `emittedEvents` to `BuilderRuntimeState` and `CompiledProcedure`.

- [ ] **Step 5: Update executeProcedure for event emission**

After the handler returns successfully (and after transaction commit if `.transactional()`):
- Iterate `procedure.emittedEvents`
- For each: apply mapper if present, create event instance, call `ctx.events.emit(event)`
- Wrap in try/catch — emission failure should not fail the request

- [ ] **Step 6: Run tests**

Run: `cd packages/router && pnpm test src/__tests__/emits.test.ts`
Expected: PASS

- [ ] **Step 7: Run full test suite**

Run: `cd packages/router && pnpm test`
Expected: All pass

- [ ] **Step 8: Update router exports**

Ensure `TransactionalOptions` type is exported from `packages/router/src/index.ts`.

- [ ] **Step 9: Commit**

```bash
git add packages/router/src/procedure/builder.ts packages/router/src/procedure/types.ts packages/router/src/__tests__/emits.test.ts packages/router/src/index.ts
git commit -m "feat(router): add .emits() to procedure builder for domain events"
```

---

## Chunk 4: Phase 1D — Client TErrors Threading

### Task 10: VeloxClientError typed domain errors

**Files:**
- Modify: `packages/client/src/errors.ts`
- Modify: `packages/client/src/types.ts`
- Test: `packages/client/src/__tests__/domain-errors.test.ts`

- [ ] **Step 1: Write failing tests**

Test that `VeloxClientError` can carry typed `data` and discriminate on `code`:

```typescript
// packages/client/src/__tests__/domain-errors.test.ts
import { describe, it, expect } from 'vitest';
import { VeloxClientError } from '../errors.js';

describe('VeloxClientError domain error support', () => {
  it('should parse domain error response with code and data', () => {
    const response = {
      error: 'InsufficientStock',
      message: 'Not enough inventory',
      statusCode: 422,
      code: 'INSUFFICIENT_STOCK',
      data: { sku: 'ABC', requested: 10, available: 3 },
    };

    // parseErrorResponse should produce a VeloxClientError with typed data
    const error = new VeloxClientError('Not enough inventory', {
      statusCode: 422,
      code: 'INSUFFICIENT_STOCK',
      data: response.data,
      url: '/api/orders',
      method: 'POST',
    });

    expect(error.code).toBe('INSUFFICIENT_STOCK');
    expect(error.data).toEqual({ sku: 'ABC', requested: 10, available: 3 });
    expect(error.statusCode).toBe(422);
  });
});
```

- [ ] **Step 2: Add data property to VeloxClientError**

Modify `packages/client/src/errors.ts`:
- Add `readonly data?: unknown` to `VeloxClientError` (distinct from existing `body` — `data` is the typed domain error payload extracted from `body.data`)
- Update `parseErrorResponse` to extract `code` and `data` from response body when a `code` field is present in the JSON response
- The existing `body` property stays as-is (full response body); `data` is the convenience accessor for domain error payloads

- [ ] **Step 3: Add InferProcedureErrors type utility**

In `packages/client/src/types.ts`, add structural error inference:

```typescript
export type InferProcedureErrors<T> = T extends {
  readonly errorClasses?: ReadonlyArray<infer E>;
} ? (E extends new (data: infer D) => { code: infer C } ? { code: C; data: D } : never) : never;
```

- [ ] **Step 4: Run tests**

Run: `cd packages/client && pnpm test src/__tests__/domain-errors.test.ts`
Expected: PASS

- [ ] **Step 5: Run full client test suite**

Run: `cd packages/client && pnpm test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/errors.ts packages/client/src/types.ts packages/client/src/__tests__/domain-errors.test.ts
git commit -m "feat(client): add domain error support with typed code and data"
```

---

## Chunk 5: Phase 2A — Pipeline

### Task 11: defineStep and defineRevert factories

**Files:**
- Create: `packages/router/src/procedure/pipeline.ts`
- Test: `packages/router/src/__tests__/pipeline-step.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/router/src/__tests__/pipeline-step.test.ts
import { describe, it, expect, vi } from 'vitest';
import { defineStep, defineRevert } from '../procedure/pipeline.js';

describe('defineStep', () => {
  it('should create a step with string name', () => {
    const step = defineStep('validateInventory', async ({ input }) => input);
    expect(step.name).toBe('validateInventory');
    expect(step.external).toBe(false);
  });

  it('should create an external step with options object', () => {
    const step = defineStep(
      { name: 'chargePayment', external: true },
      async ({ input }) => input,
    );
    expect(step.name).toBe('chargePayment');
    expect(step.external).toBe(true);
  });

  it('should support .onRevert()', () => {
    const step = defineStep('charge', async ({ input }) => input);
    const revert = defineRevert('refund', async ({ input }) => {});
    const withRevert = step.onRevert(revert);

    expect(withRevert.name).toBe('charge');
    expect(withRevert.revertAction).toBe(revert);
  });
});

describe('defineRevert', () => {
  it('should create a revert action', () => {
    const revert = defineRevert('refundPayment', async ({ input }) => {});
    expect(revert.name).toBe('refundPayment');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/router && pnpm test src/__tests__/pipeline-step.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement defineStep and defineRevert**

```typescript
// packages/router/src/procedure/pipeline.ts
import type { BaseContext } from '@veloxts/core';

export interface StepOptions {
  name: string;
  external?: boolean;
}

export interface StepHandler<TInput = unknown, TOutput = unknown, TContext extends BaseContext = BaseContext> {
  (params: { input: TInput; ctx: TContext }): TOutput | Promise<TOutput>;
}

export interface RevertAction<TInput = unknown, TContext extends BaseContext = BaseContext> {
  readonly name: string;
  readonly handler: (params: { input: TInput; ctx: TContext }) => void | Promise<void>;
}

export interface PipelineStep<TInput = unknown, TOutput = unknown, TContext extends BaseContext = BaseContext> {
  readonly name: string;
  readonly external: boolean;
  readonly handler: StepHandler<TInput, TOutput, TContext>;
  readonly revertAction?: RevertAction<TOutput, TContext>;
  onRevert(revert: RevertAction<TOutput, TContext>): PipelineStep<TInput, TOutput, TContext>;
}

export function defineStep<TInput = unknown, TOutput = unknown, TContext extends BaseContext = BaseContext>(
  nameOrOptions: string | StepOptions,
  handler: StepHandler<TInput, TOutput, TContext>,
): PipelineStep<TInput, TOutput, TContext> {
  const options = typeof nameOrOptions === 'string'
    ? { name: nameOrOptions, external: false }
    : { external: false, ...nameOrOptions };

  const step: PipelineStep<TInput, TOutput, TContext> = {
    name: options.name,
    external: options.external ?? false,
    handler,
    revertAction: undefined,
    onRevert(revert) {
      return { ...step, revertAction: revert };
    },
  };

  return step;
}

export function defineRevert<TInput = unknown, TContext extends BaseContext = BaseContext>(
  name: string,
  handler: (params: { input: TInput; ctx: TContext }) => void | Promise<void>,
): RevertAction<TInput, TContext> {
  return { name, handler };
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/router && pnpm test src/__tests__/pipeline-step.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/router/src/procedure/pipeline.ts packages/router/src/__tests__/pipeline-step.test.ts
git commit -m "feat(router): add defineStep and defineRevert factories for pipelines"
```

---

### Task 12: .through() on ProcedureBuilder and pipeline executor

**Files:**
- Modify: `packages/router/src/procedure/builder.ts`
- Modify: `packages/router/src/procedure/types.ts`
- Create: `packages/router/src/procedure/pipeline-executor.ts`
- Test: `packages/router/src/__tests__/through.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/router/src/__tests__/through.test.ts
import { describe, it, expect, vi } from 'vitest';
import { procedure, executeProcedure, defineStep, defineRevert } from '../index.js';
import { z } from 'zod';

const validate = defineStep('validate', async ({ input }: { input: { amount: number } }) => {
  if (input.amount <= 0) throw new Error('Invalid amount');
  return { ...input, validated: true };
});

const enrich = defineStep('enrich', async ({ input }) => {
  return { ...input, enriched: true };
});

const externalCall = defineStep(
  { name: 'externalCall', external: true },
  async ({ input }) => ({ ...input, externalId: 'ext-123' }),
);

const undoExternal = defineRevert('undoExternal', async ({ input }) => {
  // revert logic
});

describe('.through()', () => {
  it('should execute pipeline steps in order', async () => {
    const proc = procedure()
      .input(z.object({ amount: z.number() }))
      .through(validate, enrich)
      .mutation(async ({ input }) => input);

    const ctx = { request: {}, reply: {} } as unknown;
    const result = await executeProcedure(proc, { amount: 50 }, ctx);

    expect(result).toMatchObject({ amount: 50, validated: true, enriched: true });
  });

  it('should pass accumulated result to mutation handler', async () => {
    const proc = procedure()
      .input(z.object({ amount: z.number() }))
      .through(validate)
      .mutation(async ({ input }) => {
        expect(input.validated).toBe(true);
        return { success: true };
      });

    const ctx = { request: {}, reply: {} } as unknown;
    const result = await executeProcedure(proc, { amount: 50 }, ctx);
    expect(result).toEqual({ success: true });
  });

  it('should run revert actions on failure', async () => {
    const revertSpy = vi.fn();
    const failingStep = defineStep(
      { name: 'failingStep', external: true },
      async () => { throw new Error('external failed'); },
    );
    const successStep = defineStep(
      { name: 'successStep', external: true },
      async ({ input }) => ({ ...input, stepDone: true }),
    );
    const revert = defineRevert('revertSuccess', revertSpy);

    const proc = procedure()
      .through(successStep.onRevert(revert), failingStep)
      .mutation(async ({ input }) => input);

    const ctx = { request: {}, reply: {} } as unknown;
    await expect(executeProcedure(proc, {}, ctx)).rejects.toThrow('external failed');
    expect(revertSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/router && pnpm test src/__tests__/through.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement pipeline executor**

Create `packages/router/src/procedure/pipeline-executor.ts`:
- `executePipeline(steps, input, ctx, transactional?)` function
- Implements the two-phase model from the spec:
  - If transactional: group DB steps (Phase A) and external steps (Phase B)
  - Phase A: run DB steps inside `ctx.db.$transaction()`
  - Phase B: run external steps outside transaction
  - On external step failure: run revert actions for completed external steps in reverse order
- If not transactional: run all steps in declaration order

- [ ] **Step 4: Add .through() to builder**

In `packages/router/src/procedure/builder.ts`:

```typescript
through(...steps) {
  return createBuilder({
    ...state,
    pipelineSteps: steps,
  });
}
```

Add `pipelineSteps` to `BuilderRuntimeState` and `CompiledProcedure`.

- [ ] **Step 5: Update executeProcedure to call pipeline executor**

In `executeProcedure()`, after guards and input validation, before handler:
- If `procedure.pipelineSteps` exists and is non-empty:
  - Call `executePipeline(steps, validatedInput, ctx, procedure.transactional)`
  - Pass the pipeline result as `input` to the handler

- [ ] **Step 6: Run tests**

Run: `cd packages/router && pnpm test src/__tests__/through.test.ts`
Expected: PASS

- [ ] **Step 7: Run full router test suite**

Run: `cd packages/router && pnpm test`
Expected: All pass

- [ ] **Step 8: Update exports**

Add to `packages/router/src/index.ts`:
```typescript
export { defineStep, defineRevert, type PipelineStep, type RevertAction, type StepOptions } from './procedure/pipeline.js';
```

- [ ] **Step 9: Commit**

```bash
git add packages/router/src/procedure/pipeline-executor.ts packages/router/src/procedure/builder.ts packages/router/src/procedure/types.ts packages/router/src/__tests__/through.test.ts packages/router/src/index.ts
git commit -m "feat(router): add .through() pipeline with two-phase transactional execution"
```

---

## Chunk 6: Phase 2B — Policy Integration on Builder

### Task 13: Enhanced definePolicy with resource name

**Files:**
- Modify: `packages/auth/src/policies.ts`
- Modify: `packages/auth/src/types.ts`
- Test: `packages/auth/src/__tests__/policies-v2.test.ts`

This is a **breaking change** to `definePolicy`. The existing signature `definePolicy(actions)` becomes `definePolicy('Name', actions)` with destructured handler arguments `({ user, resource })` instead of `(user, resource)`.

- [ ] **Step 1: Write failing tests for enhanced definePolicy**

```typescript
// packages/auth/src/__tests__/policies-v2.test.ts
import { describe, it, expect } from 'vitest';
import { definePolicy } from '../policies.js';

interface User { id: string; role: string; }
interface Post { id: string; authorId: string; }

describe('definePolicy (v2 — with resource name)', () => {
  it('should accept resource name as first argument', () => {
    const PostPolicy = definePolicy<User, Post>('Post', {
      create: ({ user }) => user.role === 'admin',
      update: ({ user, resource }) => resource.authorId === user.id,
    });

    expect(PostPolicy.resourceName).toBe('Post');
  });

  it('should expose actions as first-class references', () => {
    const PostPolicy = definePolicy<User, Post>('Post', {
      create: ({ user }) => user.role === 'admin',
      update: ({ user, resource }) => resource.authorId === user.id,
    });

    expect(PostPolicy.create).toBeDefined();
    expect(PostPolicy.create.actionName).toBe('create');
    expect(PostPolicy.create.resourceName).toBe('Post');
    expect(typeof PostPolicy.create.check).toBe('function');
  });

  it('should execute action checks correctly', async () => {
    const PostPolicy = definePolicy<User, Post>('Post', {
      update: ({ user, resource }) => resource.authorId === user.id,
    });

    const user = { id: '1', role: 'user' };
    const ownPost = { id: 'p1', authorId: '1' };
    const otherPost = { id: 'p2', authorId: '2' };

    expect(await PostPolicy.update.check(user, ownPost)).toBe(true);
    expect(await PostPolicy.update.check(user, otherPost)).toBe(false);
  });

  it('should work without resource (action-level)', async () => {
    const PostPolicy = definePolicy<User, Post>('Post', {
      create: ({ user }) => user.role === 'admin',
    });

    const admin = { id: '1', role: 'admin' };
    const regular = { id: '2', role: 'user' };

    expect(await PostPolicy.create.check(admin)).toBe(true);
    expect(await PostPolicy.create.check(regular)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/auth && pnpm test src/__tests__/policies-v2.test.ts`
Expected: FAIL

- [ ] **Step 3: Define new types**

In `packages/auth/src/types.ts`, add:

```typescript
export interface PolicyActionV2<TUser = User, TResource = unknown> {
  (params: { user: TUser; resource?: TResource }): boolean | Promise<boolean>;
}

export interface PolicyDefinitionV2<TUser = User, TResource = unknown> {
  [action: string]: PolicyActionV2<TUser, TResource>;
}

export interface PolicyActionRef<TUser = User, TResource = unknown> {
  readonly actionName: string;
  readonly resourceName: string;
  readonly check: (user: TUser, resource?: TResource) => boolean | Promise<boolean>;
  readonly requiresResource: boolean;
}

export interface PolicyObject<TUser = User, TResource = unknown> {
  readonly resourceName: string;
  [action: string]: PolicyActionRef<TUser, TResource> | string; // string for resourceName
}
```

- [ ] **Step 4: Implement enhanced definePolicy**

Modify `packages/auth/src/policies.ts`:
- Add overload: `definePolicy<TUser, TResource>(name: string, actions: PolicyDefinitionV2<TUser, TResource>): PolicyObject<TUser, TResource>`
- The function returns an object where each action key is a `PolicyActionRef` with `actionName`, `resourceName`, `check()`, and `requiresResource`

- [ ] **Step 5: Update existing policies.test.ts and dependent functions**

Update the existing 96 tests in `packages/auth/src/__tests__/policies.test.ts` to use the new API signature. This is a breaking change — all tests that use `definePolicy({...})` must become `definePolicy('Resource', {...})` with destructured handlers.

Also update the dependent functions in `packages/auth/src/policies.ts`:
- `can()`, `cannot()`, `authorize()` — update to use the new `({ user, resource })` handler signature when calling policy actions
- `registerPolicy()` — update to accept and work with the new `PolicyObject` return type
- `createPolicyBuilder()` — update `.allow()` and other methods to use destructured handler signature
- `createOwnerOrAdminPolicy()`, `createReadOnlyPolicy()`, `createAdminOnlyPolicy()` — update to use new handler signature

- [ ] **Step 6: Run all auth tests**

Run: `cd packages/auth && pnpm test`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add packages/auth/src/policies.ts packages/auth/src/types.ts packages/auth/src/__tests__/
git commit -m "feat(auth)!: enhance definePolicy with resource name and action references

BREAKING CHANGE: definePolicy now requires resource name as first argument.
Handler signature changes from (user, resource) to ({ user, resource })."
```

---

### Task 14: .policy() on ProcedureBuilder

**Files:**
- Modify: `packages/router/src/procedure/builder.ts`
- Modify: `packages/router/src/procedure/types.ts`
- Test: `packages/router/src/__tests__/policy-builder.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/router/src/__tests__/policy-builder.test.ts
import { describe, it, expect, vi } from 'vitest';
import { procedure, executeProcedure } from '../index.js';
import { definePolicy } from '@veloxts/auth';
import { z } from 'zod';

interface User { id: string; role: string; }
interface Post { id: string; authorId: string; }

const PostPolicy = definePolicy<User, Post>('Post', {
  create: ({ user }) => user.role === 'admin',
  update: ({ user, resource }) => resource.authorId === user.id,
});

describe('.policy()', () => {
  it('should store policy action ref on compiled procedure', () => {
    const proc = procedure()
      .guard({ check: () => true })
      .policy(PostPolicy.create)
      .mutation(async () => ({}));

    expect(proc.policyAction).toBeDefined();
    expect(proc.policyAction.actionName).toBe('create');
    expect(proc.policyAction.resourceName).toBe('Post');
  });

  it('should check action-level policy during execution', async () => {
    const proc = procedure()
      .policy(PostPolicy.create)
      .mutation(async () => ({ created: true }));

    const adminCtx = { request: {}, reply: {}, user: { id: '1', role: 'admin' } } as unknown;
    const result = await executeProcedure(proc, {}, adminCtx);
    expect(result).toEqual({ created: true });

    const userCtx = { request: {}, reply: {}, user: { id: '2', role: 'user' } } as unknown;
    await expect(executeProcedure(proc, {}, userCtx)).rejects.toThrow();
  });

  it('should check resource-level policy with ctx resource', async () => {
    const proc = procedure()
      .policy(PostPolicy.update)
      .mutation(async () => ({ updated: true }));

    const ownerCtx = {
      request: {}, reply: {},
      user: { id: '1', role: 'user' },
      post: { id: 'p1', authorId: '1' },
    } as unknown;
    const result = await executeProcedure(proc, {}, ownerCtx);
    expect(result).toEqual({ updated: true });

    const otherCtx = {
      request: {}, reply: {},
      user: { id: '2', role: 'user' },
      post: { id: 'p1', authorId: '1' },
    } as unknown;
    await expect(executeProcedure(proc, {}, otherCtx)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/router && pnpm test src/__tests__/policy-builder.test.ts`
Expected: FAIL

- [ ] **Step 3: Add .policy() to builder type**

In `packages/router/src/procedure/types.ts`:

```typescript
policy<TActionRef extends PolicyActionRef>(
  action: TActionRef
): ProcedureBuilder<TInput, TOutput, TContext, TErrors>;
```

- [ ] **Step 4: Implement .policy() in builder**

In `packages/router/src/procedure/builder.ts`:

```typescript
policy(action) {
  return createBuilder({
    ...state,
    policyAction: action,
  });
}
```

Add `policyAction` to `BuilderRuntimeState` and `CompiledProcedure`.

- [ ] **Step 5: Update executeProcedure for policy check**

In `executeProcedure()`, after guards, before pipeline/handler:
- If `procedure.policyAction` exists:
  - Get `user` from `ctx.user`
  - Get `resource` from `ctx[policyAction.resourceName.toLowerCase()]`
  - Call `policyAction.check(user, resource)`
  - If false → throw `ForbiddenError`

- [ ] **Step 6: Run tests**

Run: `cd packages/router && pnpm test src/__tests__/policy-builder.test.ts`
Expected: PASS

- [ ] **Step 7: Run full test suites**

Run: `cd packages/router && pnpm test && cd ../auth && pnpm test`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add packages/router/src/procedure/builder.ts packages/router/src/procedure/types.ts packages/router/src/__tests__/policy-builder.test.ts
git commit -m "feat(router): add .policy() to procedure builder for declarative authorization"
```

---

## Chunk 7: Phase 3 — Post-Handler Hooks

### Task 15: PostHandlerBuilder and .useAfter()

**Files:**
- Modify: `packages/router/src/procedure/builder.ts`
- Modify: `packages/router/src/procedure/types.ts`
- Test: `packages/router/src/__tests__/use-after.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/router/src/__tests__/use-after.test.ts
import { describe, it, expect, vi } from 'vitest';
import { procedure, executeProcedure } from '../index.js';
import { z } from 'zod';

describe('.useAfter()', () => {
  it('should run after handler succeeds', async () => {
    const afterHook = vi.fn();

    const proc = procedure()
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => ({ id: input.id, name: 'Test' }))
      .useAfter(async ({ input, result, ctx }) => {
        afterHook({ input, result });
      });

    const ctx = { request: {}, reply: {} } as unknown;
    const result = await executeProcedure(proc, { id: '1' }, ctx);

    expect(result).toEqual({ id: '1', name: 'Test' });
    expect(afterHook).toHaveBeenCalledWith({
      input: { id: '1' },
      result: { id: '1', name: 'Test' },
    });
  });

  it('should chain multiple .useAfter() hooks in order', async () => {
    const order: string[] = [];

    const proc = procedure()
      .mutation(async () => ({ done: true }))
      .useAfter(async () => { order.push('first'); })
      .useAfter(async () => { order.push('second'); })
      .useAfter(async () => { order.push('third'); });

    const ctx = { request: {}, reply: {} } as unknown;
    await executeProcedure(proc, {}, ctx);

    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('should not fail the response if a hook throws', async () => {
    const proc = procedure()
      .mutation(async () => ({ success: true }))
      .useAfter(async () => { throw new Error('hook failed'); });

    const ctx = { request: {}, reply: {} } as unknown;
    const result = await executeProcedure(proc, {}, ctx);

    // Result should still be returned despite hook failure
    expect(result).toEqual({ success: true });
  });

  it('should not run hooks if handler throws', async () => {
    const afterHook = vi.fn();

    const proc = procedure()
      .mutation(async () => { throw new Error('handler failed'); })
      .useAfter(afterHook);

    const ctx = { request: {}, reply: {} } as unknown;
    await expect(executeProcedure(proc, {}, ctx)).rejects.toThrow('handler failed');
    expect(afterHook).not.toHaveBeenCalled();
  });

  it('should not modify the result', async () => {
    const proc = procedure()
      .mutation(async () => ({ original: true }))
      .useAfter(async ({ result }) => {
        // Attempting to return something should have no effect
        return { modified: true };
      });

    const ctx = { request: {}, reply: {} } as unknown;
    const result = await executeProcedure(proc, {}, ctx);
    expect(result).toEqual({ original: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/router && pnpm test src/__tests__/use-after.test.ts`
Expected: FAIL

- [ ] **Step 3: Define PostHandlerBuilder type**

In `packages/router/src/procedure/types.ts`:

```typescript
export type AfterHandler<TInput, TOutput, TContext> = (
  params: { input: TInput; result: TOutput; ctx: TContext }
) => void | Promise<void>;

export interface PostHandlerBuilder<
  TInput = unknown,
  TOutput = unknown,
  TContext extends BaseContext = BaseContext,
  TType extends ProcedureType = ProcedureType,
  TErrors = never,
> extends CompiledProcedure<TInput, TOutput, TContext, TType, TErrors> {
  useAfter(
    handler: AfterHandler<TInput, TOutput, TContext>
  ): PostHandlerBuilder<TInput, TOutput, TContext, TType, TErrors>;
}
```

- [ ] **Step 4: Change .mutation()/.query() return type**

Modify the builder so `.mutation()` and `.query()` return `PostHandlerBuilder` instead of `CompiledProcedure`. `PostHandlerBuilder` extends `CompiledProcedure` so it's backward compatible.

Create a `createPostHandlerBuilder()` factory function that wraps a `CompiledProcedure` and adds the `.useAfter()` method. Each `.useAfter()` call appends to an `afterHandlers` array stored on the compiled procedure.

- [ ] **Step 5: Update executeProcedure for after hooks**

In `executeProcedure()`, after handler returns successfully and events are emitted:
- If `procedure.afterHandlers` exists:
  - Run each handler with `{ input, result, ctx }`
  - Wrap each in try/catch — log errors but don't fail the request
  - Return the original result (ignore handler return values)

- [ ] **Step 6: Run tests**

Run: `cd packages/router && pnpm test src/__tests__/use-after.test.ts`
Expected: PASS

- [ ] **Step 7: Run full test suite + type-check**

Run: `cd packages/router && pnpm test && cd ../.. && pnpm type-check`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add packages/router/src/procedure/builder.ts packages/router/src/procedure/types.ts packages/router/src/__tests__/use-after.test.ts
git commit -m "feat(router): add .useAfter() post-handler hooks via PostHandlerBuilder"
```

---

## Chunk 8: Integration Testing & Final Validation

### Task 16: Cross-package integration test

**Files:**
- Create: `packages/router/src/__tests__/business-logic-integration.test.ts`

- [ ] **Step 1: Write integration test combining all primitives**

Test the full procedure chain from the spec: guards → policy → pipeline → transactional → handler → emits → useAfter:

```typescript
// packages/router/src/__tests__/business-logic-integration.test.ts
import { describe, it, expect, vi } from 'vitest';
import { procedure, procedures, executeProcedure, defineStep, defineRevert } from '../index.js';
import { DomainError } from '@veloxts/core';
import { DomainEvent } from '@veloxts/events';
import { definePolicy } from '@veloxts/auth';
import { z } from 'zod';

// Domain errors
class InsufficientStock extends DomainError<{ sku: string; available: number }> {
  readonly code = 'INSUFFICIENT_STOCK' as const;
  readonly status = 422;
  readonly message = 'Not enough inventory';
}

// Domain events
class OrderCreated extends DomainEvent<{ orderId: string; total: number }> {}

// Policy
const OrderPolicy = definePolicy('Order', {
  create: ({ user }) => !!user,
});

// Pipeline steps
const validateStock = defineStep('validateStock', async ({ input, ctx }) => {
  return { ...input, stockChecked: true };
});

const chargePayment = defineStep(
  { name: 'chargePayment', external: true },
  async ({ input }) => ({ ...input, chargeId: 'ch_123' }),
);

const refundPayment = defineRevert('refundPayment', async ({ input }) => {
  // revert logic
});

describe('Business Logic Primitives — Full Integration', () => {
  it('should execute Tier 3 procedure chain', async () => {
    const auditSpy = vi.fn();
    const mockEmit = vi.fn();

    const orderProcedures = procedures('orders', {
      createOrder: procedure()
        .input(z.object({ sku: z.string(), quantity: z.number() }))
        .policy(OrderPolicy.create)
        .throws(InsufficientStock)
        .through(validateStock, chargePayment.onRevert(refundPayment))
        .emits(OrderCreated, (result) => ({ orderId: result.id, total: result.total }))
        .mutation(async ({ input, ctx }) => {
          return { id: 'order-1', total: input.quantity * 10 };
        })
        .useAfter(async ({ result }) => { auditSpy(result); }),
    });

    const ctx = {
      request: {},
      reply: {},
      user: { id: '1', role: 'user' },
      events: { emit: mockEmit },
    } as unknown;

    const result = await executeProcedure(
      orderProcedures.procedures.createOrder,
      { sku: 'WIDGET', quantity: 5 },
      ctx,
    );

    expect(result).toEqual({ id: 'order-1', total: 50 });
    expect(auditSpy).toHaveBeenCalledWith({ id: 'order-1', total: 50 });
    expect(mockEmit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `cd packages/router && pnpm test src/__tests__/business-logic-integration.test.ts`
Expected: PASS

- [ ] **Step 3: Run full monorepo test suite**

Run: `pnpm test`
Expected: All pass across all packages

- [ ] **Step 4: Run type-check and lint**

Run: `pnpm type-check && pnpm lint`
Expected: Zero errors

- [ ] **Step 5: Commit**

```bash
git add packages/router/src/__tests__/business-logic-integration.test.ts
git commit -m "test(router): add full integration test for business logic primitives"
```

---

### Task 17: Update router exports

**Files:**
- Modify: `packages/router/src/index.ts`

- [ ] **Step 1: Verify all new public APIs are exported**

Check that the following are exported from `@veloxts/router`:
- `defineStep`, `defineRevert`
- `PipelineStep`, `RevertAction`, `StepOptions`
- `TransactionalOptions`
- `AfterHandler`, `PostHandlerBuilder`

- [ ] **Step 2: Run `pnpm build` to verify build passes**

Run: `pnpm build`
Expected: All packages build successfully

- [ ] **Step 3: Commit if any export changes needed**

```bash
git add packages/router/src/index.ts
git commit -m "chore(router): export all business logic primitive types"
```

---

## Deferred Items

The following items from the spec are **not covered in this plan** and should be addressed in follow-up work:

1. **OpenAPI integration for `.throws()`** — `.throws()` declarations should appear as error response schemas in OpenAPI output. Update `packages/router/src/openapi/generator.ts` in a follow-up task.
2. **Compile-time step ordering constraint** — The spec says interleaving external steps between DB steps under `.transactional()` should be a compile-time error. This requires complex tuple-level type enforcement in `.through()`. Defer to a dedicated type engineering task.
3. **Compile-time policy context enforcement** — The spec says forgetting `.use(loadPost)` before `.policy(PostPolicy.update)` should be a compile-time error. This requires threading the resource type through `PolicyActionRef` and constraining the builder's `TContext`. Defer to a dedicated type engineering task.
4. **State machine integration guide** — Phase 3 includes a documentation guide for state machine patterns. Not a code task.
5. **`retryable` listener option** — Defined in `DomainListenerOptions` but not implemented. Requires integration with `@veloxts/queue`. Mark as placeholder with a comment in the code.
6. **New `create-velox-app` template** — A B2B SaaS template demonstrating all primitives. Separate implementation task.
7. **`.emits()` + `.transactional()` timing test** — Need a test verifying events fire after transaction commit, not inside the transaction. Add during implementation when the transactional executor is complete.
