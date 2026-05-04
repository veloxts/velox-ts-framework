---
'@veloxts/router': minor
---

Add `.check()` post-middleware authorization primitive on the procedure builder.

`.check()` runs **after** input validation, `.through()` pipeline transforms, and all `.use()` middleware have populated the context — immediately before the handler. Use it for authorization that depends on input fields and/or context values populated by middleware:

```typescript
procedure()
  .input(z.object({ sessionId: z.string() }))
  .guard(authenticated)              // pre-input, ctx-only (unchanged)
  .use(loadParticipant)              // middleware extends ctx
  .check(({ input, ctx }) =>         // sees input + middleware-extended ctx
    ctx.participant.sessionId === input.sessionId
  )
  .query(handler);
```

**When to use which:**
- `.guard(authenticated)` — pre-input, ctx-only authentication (fast-fail).
- `.policy(PostPolicy.update)` — declarative resource-policy authorization.
- `.check(({ input, ctx }) => ...)` — ad-hoc authorization that needs both `input` and middleware-extended `ctx`.

Returning `false` throws `ForbiddenError` (403). Throwing inside the function propagates as-is, so callers can throw custom domain errors with finer-grained status codes. Multiple `.check()` calls AND-compose with short-circuit on first failure.

Closes the gap exposed by the `ara/apps/api` audit where `requireParticipant((i) => i.id)` had to be implemented as `.use()` middleware because `.guard()` couldn't see middleware-extended ctx.
