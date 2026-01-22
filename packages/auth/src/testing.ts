/**
 * @veloxts/auth/testing - Internal testing utilities
 *
 * This module exports utilities intended for testing purposes only.
 * These are NOT part of the public API and may change without notice.
 *
 * @example
 * ```typescript
 * import { _resetGuardCounter } from '@veloxts/auth/testing';
 *
 * beforeEach(() => {
 *   _resetGuardCounter();
 * });
 * ```
 *
 * @packageDocumentation
 * @module @veloxts/auth/testing
 */

// Guard testing utilities
export { _resetGuardCounter } from './guards.js';

// Rate limit store clearing (for test isolation)
export { clearRateLimitStore } from './middleware.js';
export { clearAuthRateLimitStore, stopAuthRateLimitCleanup } from './rate-limit.js';

// Policy registry clearing (for test isolation)
export { clearPolicies } from './policies.js';
