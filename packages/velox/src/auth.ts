/**
 * @veloxts/velox/auth - Auth package re-export
 *
 * Authentication and authorization features (coming in v1.1+)
 *
 * Use this subpath for better tree-shaking:
 * @example
 * ```typescript
 * import { createAuth, guard } from '@veloxts/velox/auth';
 * ```
 *
 * NOTE: Internal testing utilities (_resetGuardCounter) are available via
 * '@veloxts/auth/testing'. They are not re-exported from the velox meta-package.
 */
export * from '@veloxts/auth';
