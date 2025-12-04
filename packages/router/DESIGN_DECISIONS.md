# Design Decisions: @veloxts/router Type System

This document explains key design decisions in the `@veloxts/router` type system, particularly around type safety trade-offs that may appear to violate the project's strict "no `any`" policy.

## Table of Contents

1. [Variance Compatibility in ProcedureDefinitions](#variance-compatibility-in-proceduredefinitions)
2. [Middleware Context Extension Pattern](#middleware-context-extension-pattern)
3. [Type Inference Strategy](#type-inference-strategy)

---

## Variance Compatibility in ProcedureDefinitions

### The Problem

The `ProcedureDefinitions` and `ProcedureRecord` types use `any` for the type parameters of `CompiledProcedure`:

```typescript
// In procedure/types.ts
export type ProcedureDefinitions = Record<string, CompiledProcedure<any, any, any>>;

// In types.ts
export type ProcedureRecord = Record<string, CompiledProcedure<any, any, any>>;
```

This appears to violate the project's strict TypeScript guidelines. However, this is an intentional and necessary design decision.

### Why This Is Required

TypeScript's type system has a concept called **variance** that determines how generic types relate to each other:

- **Covariant**: If `Dog extends Animal`, then `Container<Dog>` is assignable to `Container<Animal>`
- **Contravariant**: If `Dog extends Animal`, then `Container<Animal>` is assignable to `Container<Dog>`
- **Invariant**: No assignability relationship exists

The `CompiledProcedure<TInput, TOutput, TContext>` type has **mixed variance**:

1. `TInput` is **contravariant** (appears in handler parameter position)
2. `TOutput` is **covariant** (appears in handler return position)
3. `TContext` is **invariant** (appears in both parameter and return positions)

When you try to assign a concrete procedure to a collection typed with `unknown`:

```typescript
// This DOES NOT work:
type ProcedureDefinitions = Record<string, CompiledProcedure<unknown, unknown, BaseContext>>;

const procedures: ProcedureDefinitions = {
  // Error: Type 'CompiledProcedure<{ id: string }, User, BaseContext>' is not
  // assignable to type 'CompiledProcedure<unknown, unknown, BaseContext>'.
  getUser: procedure()
    .input(z.object({ id: z.string() }))
    .query(async () => user),
};
```

The error occurs because:
- `{ id: string }` is narrower than `unknown` (contravariance violation)
- The handler expects `{ id: string }` but the type says it should accept `unknown`

### Why `unknown` Does Not Work

Using `unknown` for the type parameters creates an impossible constraint:

```typescript
// With unknown, TypeScript interprets this as:
// "A procedure that accepts ANY input and returns SOMETHING"
type WideProc = CompiledProcedure<unknown, unknown, BaseContext>;

// But our concrete procedure is:
// "A procedure that accepts ONLY { id: string } and returns User"
type NarrowProc = CompiledProcedure<{ id: string }, User, BaseContext>;

// NarrowProc cannot fulfill WideProc's contract because:
// - WideProc says "I can handle any input"
// - NarrowProc says "I can only handle { id: string }"
```

This is a fundamental type theory issue, not a TypeScript limitation.

### How Type Safety Is Preserved

The `any` usage is **intentionally scoped** and does not propagate:

1. **At definition time**: `defineProcedures` captures the exact types through inference:

   ```typescript
   export function defineProcedures<TProcedures extends ProcedureDefinitions>(
     namespace: string,
     procedures: TProcedures
   ): ProcedureCollection<InferProcedures<TProcedures>> {
     // TProcedures captures the EXACT types of each procedure
     return { namespace, procedures: procedures as InferProcedures<TProcedures> };
   }
   ```

2. **At usage time**: The concrete types are preserved and accessible:

   ```typescript
   const collection = defineProcedures('users', {
     getUser: procedure()
       .input(z.object({ id: z.string() }))
       .output(UserSchema)
       .query(async ({ input }) => { /* ... */ }),
   });

   // Full type information is preserved:
   type InputType = InferProcedureInput<typeof collection.procedures.getUser>;
   // InputType = { id: string }  (NOT unknown, NOT any)
   ```

3. **The `any` never leaks**: It exists only at the constraint level to allow assignment. The actual types flow through `InferProcedures<T>` which preserves the concrete types.

### Alternative Approaches Considered

1. **Existential types**: TypeScript does not support existential types (`exists T. CompiledProcedure<T, ?, ?>`) which would solve this elegantly.

2. **Mapped types with inference**: We could use a mapped type, but it would require explicit type parameters at every call site, destroying the DX.

3. **Type erasure pattern**: Using a base interface without generics:
   ```typescript
   interface BaseProcedure {
     type: ProcedureType;
     handler: unknown;
   }
   ```
   This loses all type information and requires unsafe casts everywhere.

4. **Runtime type registry**: Storing types in a separate registry structure. This adds complexity without benefit since TypeScript's inference already captures types.

### The Trade-off

| Aspect | With `any` constraint | Alternative approaches |
|--------|----------------------|------------------------|
| Type safety at definition | Full (via inference) | Varies |
| Type safety at usage | Full (via InferProcedures) | Varies |
| Developer experience | Excellent | Poor to moderate |
| Code complexity | Low | High |
| `any` propagation risk | None (scoped) | N/A |

The `any` constraint is a pragmatic solution that:
- Allows TypeScript's inference to work naturally
- Preserves full type information where it matters
- Does not leak `any` into user code
- Follows patterns used by tRPC, Zod, and other major TypeScript libraries

### Biome Lint Justification

The `biome-ignore lint/suspicious/noExplicitAny` comment is required and includes a justification:

```typescript
// biome-ignore lint/suspicious/noExplicitAny: Required for variance compatibility in Record type
export type ProcedureDefinitions = Record<string, CompiledProcedure<any, any, any>>;
```

This is the only acceptable use of `any` in the router package.

---

## Middleware Context Extension Pattern

### The Pattern

Middleware in `@veloxts/router` can extend the request context:

```typescript
procedure()
  .use<AuthContext>(async ({ next }) => {
    return next({ ctx: { userId: 'user-123' } });
  })
  .query(async ({ ctx }) => {
    // ctx now has userId property
    return { userId: ctx.userId };
  });
```

### Implementation Approach

The middleware executor uses `Object.assign` to merge context extensions:

```typescript
// In createPrecompiledMiddlewareExecutor
next = async (): Promise<{ output: TOutput }> => {
  return middleware({
    input,
    ctx: mutableCtx,
    next: async (opts) => {
      if (opts?.ctx) {
        Object.assign(mutableCtx, opts.ctx);
      }
      return currentNext();
    },
  });
};
```

### Why Object.assign Over Spread

We considered several approaches for context extension:

1. **Immutable spread (rejected)**:
   ```typescript
   const newCtx = { ...ctx, ...opts.ctx };
   ```
   Problem: Creates new object references on every middleware call. In a chain of N middlewares, this creates N unnecessary object allocations.

2. **Object.create with prototype chain (rejected)**:
   ```typescript
   const newCtx = Object.create(ctx, descriptorsFor(opts.ctx));
   ```
   Problem: Prototype chains have performance implications and complicate debugging.

3. **Proxy-based extension (rejected)**:
   ```typescript
   const newCtx = new Proxy(ctx, { get: /* merge logic */ });
   ```
   Problem: Proxies have overhead and can cause unexpected behavior with some operations.

4. **Object.assign mutation (chosen)**:
   ```typescript
   Object.assign(mutableCtx, opts.ctx);
   ```
   Benefits:
   - Single object allocation for entire middleware chain
   - Native V8 optimization for Object.assign
   - Simple mental model for developers
   - Context properties are directly accessible (no prototype chain)

### Type Safety of Context Extension

The context type is tracked through the builder chain via generics:

```typescript
// In procedure/types.ts
use<TNewContext extends BaseContext = TContext>(
  middleware: MiddlewareFunction<TInput, TContext, TNewContext, TOutput>
): ProcedureBuilder<TInput, TOutput, TNewContext>;
```

Key points:

1. **Generic accumulation**: Each `.use()` call returns a new builder with `TNewContext` as the context type
2. **Constraint enforcement**: `TNewContext extends BaseContext` ensures extensions are valid contexts
3. **Handler receives final type**: The `.query()` or `.mutation()` handler sees the accumulated context type

### ContextExtensions Utility Type

To improve type safety of the `next()` function, we provide the `ContextExtensions` utility type:

```typescript
// In types.ts
export type ContextExtensions<
  TContext extends BaseContext,
  TNewContext extends BaseContext,
> = Omit<TNewContext, keyof TContext>;
```

This type computes the properties that middleware adds to the context:

```typescript
interface AuthContext extends BaseContext {
  userId: string;
  permissions: string[];
}

type Extensions = ContextExtensions<BaseContext, AuthContext>;
// Result: { userId: string; permissions: string[] }
```

The `MiddlewareNext` type uses this to accept either:
- The exact extension properties (type-safe)
- A partial of the new context (for flexibility)

```typescript
export type MiddlewareNext<
  TContext extends BaseContext = BaseContext,
  TNewContext extends BaseContext = TContext,
  TOutput = unknown,
> = (opts?: {
  ctx?: ContextExtensions<TContext, TNewContext> | Partial<TNewContext>;
}) => Promise<MiddlewareResult<TOutput>>;
```

This design:
- Allows type-safe context extension when the extension type is known
- Maintains backward compatibility with partial context objects
- Enables IDE autocompletion for required extension properties

### Mutation Trade-off

While mutation is generally discouraged in functional programming, the trade-off is acceptable here:

| Factor | Analysis |
|--------|----------|
| Scope | Mutation is contained within single request lifecycle |
| Visibility | Context starts fresh per request, no shared state |
| Performance | Significant reduction in allocations for middleware chains |
| Type safety | Types flow correctly regardless of runtime mutation |
| Predictability | Middleware order is explicit and deterministic |

The context object is:
- Created fresh for each request
- Never shared between requests
- Only modified by middleware in a defined order
- Garbage collected after request completes

### Alternative: Functional Context Threading

A purely functional approach would thread context through the chain:

```typescript
// Hypothetical functional approach
type Middleware<In, Out, CtxIn, CtxOut> = (
  args: { input: In; ctx: CtxIn }
) => Promise<{ output: Out; ctx: CtxOut }>;
```

This was rejected because:
1. It requires every middleware to explicitly pass context forward
2. It complicates the API for users who do not need to modify context
3. It creates more allocations
4. The type complexity increases significantly

---

## Type Inference Strategy

### Core Philosophy

The procedure builder uses **inference-first** design:

1. **No explicit type annotations required** from users
2. **Types flow automatically** through the builder chain
3. **Compile-time safety** without runtime overhead

### How Inference Flows

```typescript
// User writes this (no type annotations):
const getUser = procedure()
  .input(z.object({ id: z.string() }))
  .output(UserSchema)
  .query(async ({ input, ctx }) => {
    // TypeScript INFERS:
    // - input: { id: string }
    // - ctx: BaseContext
    // - return type must match z.infer<typeof UserSchema>
    return db.user.findUnique({ where: { id: input.id } });
  });
```

The inference chain:

1. `.input(schema)` returns `ProcedureBuilder<InferSchemaOutput<typeof schema>, TOutput, TContext>`
2. `.output(schema)` returns `ProcedureBuilder<TInput, InferSchemaOutput<typeof schema>, TContext>`
3. `.query(handler)` enforces handler signature and returns `CompiledProcedure<TInput, TOutput, TContext>`

### InferSchemaOutput Utility

```typescript
export type InferSchemaOutput<T> = T extends ZodType<infer O, ZodTypeDef, unknown> ? O : never;
```

This extracts the **output type** from a Zod schema, which is important for transforms:

```typescript
const schema = z.string().transform(s => parseInt(s, 10));
// Input: string
// Output: number

type Result = InferSchemaOutput<typeof schema>; // number (correct)
```

Using the output type ensures the handler receives the **transformed** value type.

### Why Not Use z.infer Directly

We use `InferSchemaOutput` instead of `z.infer` for several reasons:

1. **Consistency**: All schema type extraction uses the same utility
2. **Future flexibility**: We can adjust inference behavior without changing user code
3. **Explicit intent**: The name communicates that we want the output (not input) type

However, `InferSchemaOutput` is functionally equivalent to `z.infer` for most cases.

---

## Summary

The type system design in `@veloxts/router` makes deliberate trade-offs:

1. **Limited `any` usage** in constraint positions enables ergonomic APIs while preserving type safety through inference capture
2. **Mutable context extension** provides performance benefits within a contained scope
3. **Inference-first design** eliminates boilerplate while maintaining compile-time safety

These decisions follow patterns established by major TypeScript libraries (tRPC, Zod, Prisma) and are validated by comprehensive type-level tests in `src/__tests__/types.test.ts`.
