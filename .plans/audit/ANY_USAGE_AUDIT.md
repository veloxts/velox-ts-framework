# `as any` / Explicit `any` Usage Audit

**Audit date:** February 2026
**Scope:** All `packages/*/src/**/*.ts` source files (excluding tests, `dist/`, and `node_modules/`)

## Summary

The codebase contains **5 justified `any` type annotations** across 3 files. All occurrences have
`biome-ignore lint/suspicious/noExplicitAny` annotations with explanatory justifications. There are
zero unannotated `any` usages and zero `as any` type assertions in source code.

## Findings

| # | File | Line | Usage | Justification |
|---|------|------|-------|---------------|
| 1 | `packages/client/src/types.ts` | 41 | `ctx: any` in handler signature | Required for contravariant type compatibility with router's TContext |
| 2 | `packages/router/src/trpc/adapter.ts` | 207 | `let builder: any` | tRPC procedure builder has complex types that vary by chain state |
| 3 | `packages/router/src/types.ts` | 121 | `request: any` in GuardCheckFunction | Interoperability — allows guards typed with specific FastifyRequest/FastifyReply to work with generic guards without contravariance issues |
| 4 | `packages/router/src/types.ts` | 123 | `reply: any` in GuardCheckFunction | Same as above (paired parameter) |
| 5 | `packages/router/src/types.ts` | 420 | `_resourceSchema?: any` | ResourceSchema type would create circular dependency |

### Additional notes

- `packages/cli/src/generators/templates/test.ts:603` contains `// let mockDb: any;` but this is
  inside a commented-out line within a generated test template string, not executable code.
- Test files use `any` in type-level assertions (e.g., `expectTypeOf<...>().toEqualTypeOf<{ flexible: any }>()`)
  which is appropriate for type testing and does not affect runtime safety.

## Biome Configuration

The project's `biome.json` at the repository root enables `"recommended": true` for all linter
rules. Biome's recommended ruleset includes `suspicious/noExplicitAny` as an **error** by default.
This means:

- Any new `any` usage without a `biome-ignore` annotation will fail the lint check
- CI enforces `pnpm lint` as a required check, preventing unannotated `any` from being merged
- Each existing usage is individually annotated with a specific justification

## Conclusion

No code changes are needed. All 5 `any` usages are intentional, justified, and properly annotated.
The Biome `noExplicitAny` rule provides an automated guardrail that prevents new unannotated `any`
types from entering the codebase.
