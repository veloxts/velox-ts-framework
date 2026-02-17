/**
 * Fire-and-forget utility for non-blocking side effects
 *
 * @module utils/fire-and-forget
 */

import { createLogger } from './logger.js';

const log = createLogger('core');

export interface FireAndForgetOptions {
  /** Label for error logging context */
  label?: string;
  /** Custom error handler (defaults to VeloxTS logger) */
  onError?: (error: unknown) => void;
}

/**
 * Execute a promise without awaiting it, catching and logging any errors.
 *
 * Use this for non-critical side effects (analytics, notifications, audit logs)
 * that shouldn't block the main response.
 *
 * @param promise - The promise to execute in the background
 * @param options - Optional label and error handler
 *
 * @example
 * ```typescript
 * import { fireAndForget } from '@veloxts/core';
 *
 * // In a procedure handler
 * fireAndForget(analytics.track('user.created', { userId }), {
 *   label: 'analytics',
 * });
 *
 * return user; // Returns immediately
 * ```
 */
export function fireAndForget(
  promise: Promise<unknown>,
  options?: FireAndForgetOptions
): void {
  const { label, onError } = options ?? {};

  promise.catch((error: unknown) => {
    if (onError) {
      onError(error);
    } else {
      const prefix = label ? `[${label}] ` : '';
      log.error(`${prefix}Fire-and-forget error:`, error);
    }
  });
}
