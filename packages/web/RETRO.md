# @veloxts/web Code Review Retrospective

This document tracks code review findings, technical debt, and improvement opportunities identified during development.

---

## Week 4: Server Actions (2024-12)

### Resolved Issues

| Issue | Status | Resolution |
|-------|--------|------------|
| Mock context in production code | DOCUMENTED | Added JSDoc limitation notices to `createAction()` and `createFormAction()`. Will integrate with Vinxi's `getWebRequest()` in Week 5 auth adapter work. |

### Deferred Improvements

#### Priority 2 (Next Iteration)

| Issue | Location | Description | Recommendation |
|-------|----------|-------------|----------------|
| ZodError type assertion | `handler.ts:107` | Uses duck typing `err as { errors: ... }` instead of `instanceof z.ZodError` | Import ZodError from zod and use instanceof check |
| String-based error detection | `handler.ts:140-148` | Detects error types by message string matching (fragile) | Create custom error classes with typed error codes |
| Hardcoded baseUrl | `bridge.ts:269` | Fallback URL `http://localhost:3030` is hardcoded | Add `baseUrl` option to `TrpcBridgeOptions` |
| Unused `_TRouter` generic | `bridge.ts:87,164` | Router type parameter captured but not utilized for type inference | Implement type inference from router or document as placeholder |
| ActionBuilder not implemented | `types.ts:250-270` | Fluent builder interface defined but no implementation | Implement builder pattern or remove interface |

#### Priority 3 (Nice to Have)

| Issue | Location | Description | Recommendation |
|-------|----------|-------------|----------------|
| No retry logic | `bridge.ts` | tRPC bridge `call()` has no retry for transient failures | Add configurable retry with exponential backoff |
| Console.error logging | `handler.ts:152` | Uses `console.error` instead of structured logging | Integrate with VeloxTS logging system when available |
| Global mutable state | `handler.ts:164,406` | `actionIdCounter` and `globalRegistry` are module-level mutable state | Consider dependency injection or factory pattern |
| Missing test coverage | `handler.test.ts` | No tests for concurrent execution, large payloads, malformed cookies | Add edge case tests |

### Security Considerations

| Area | Status | Notes |
|------|--------|-------|
| Input validation | IMPLEMENTED | Zod validation enforced before handler execution |
| Output validation | IMPLEMENTED | Prevents leaking unexpected data |
| Cookie parsing | IMPLEMENTED | Values URL-decoded |
| Authentication | PARTIAL | `requireAuth` option exists but ineffective with mock context |
| CSRF protection | NOT IMPLEMENTED | Forms may need token validation |
| Rate limiting | NOT IMPLEMENTED | Error code exists but no enforcement |

---

## Week 3: File-Based Routing (2024-12)

### Resolved Issues

| Issue | Status | Resolution |
|-------|--------|------------|
| Path traversal vulnerability | FIXED | Added `..` and null byte checks in `normalizePath()` |
| File system exceptions | FIXED | Added try-catch for race conditions in `scanDirectory()` |

### Deferred Improvements

| Issue | Location | Description | Recommendation |
|-------|----------|-------------|----------------|
| Missing `reload()` on LayoutResolver | `layouts.ts` | FileRouter has reload but LayoutResolver does not | Add for HMR parity |
| Catch-all param name lost | `file-router.ts:396-399` | Uses generic `*` instead of original param name | Store and use original name from file |
| No symbolic link handling | `file-router.ts:318` | Could cause infinite loops with symlinks | Check `stat.isSymbolicLink()` |
| Group name validation | `file-router.ts:479` | Accepts any characters in `(group)` | Restrict to valid identifiers |

---

## Week 2: RSC Pipeline (2024-12)

### Resolved Issues

| Issue | Status | Resolution |
|-------|--------|------------|
| searchParams type mismatch | FIXED | Properly handles duplicate keys as arrays |
| Path traversal in importPageComponent | FIXED | Added validation with security tests |
| XSS in Document component | FIXED | `serializeInitialData()` uses safe JSON serialization |

---

## How to Use This Document

1. **Before starting a week's work:** Check if there are deferred improvements that align with planned work
2. **During code reviews:** Add new findings to the appropriate section
3. **When resolving issues:** Move from "Deferred" to "Resolved" with resolution notes
4. **Sprint planning:** Use Priority 2 items as candidates for dedicated cleanup sprints
