/**
 * Retry utility with exponential backoff
 *
 * @module utils/retry
 */

export interface RetryOptions {
  /** Maximum number of attempts (default: 3, minimum: 1) */
  attempts?: number;
  /** Base delay in milliseconds (default: 500) */
  delayMs?: number;
  /** Use exponential backoff (default: true) */
  exponential?: boolean;
  /** Only retry if this predicate returns true */
  retryIf?: (error: unknown) => boolean;
  /**
   * Called after each failed attempt with the error and the 1-based
   * attempt number that just failed. Called on every failure including
   * the final one.
   */
  onRetry?: (error: unknown, attempt: number) => void;
}

/**
 * Retry an async operation with configurable backoff.
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration
 * @returns The result of the first successful invocation
 * @throws The last error if all attempts are exhausted
 *
 * @example
 * ```typescript
 * import { withRetry } from '@veloxts/core';
 *
 * const result = await withRetry(() => fetch('https://api.example.com/data'), {
 *   attempts: 3,
 *   retryIf: (err) => err instanceof Error && err.message.includes('ECONNRESET'),
 *   onRetry: (err, attempt) => console.log(`Attempt ${attempt} failed:`, err),
 * });
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const { attempts = 3, delayMs = 500, exponential = true, retryIf, onRetry } = options ?? {};

  if (attempts < 1) {
    throw new Error('withRetry: attempts must be at least 1');
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (retryIf && !retryIf(error)) {
        throw error;
      }

      onRetry?.(error, attempt);

      if (attempt < attempts) {
        const delay = exponential ? delayMs * 2 ** (attempt - 1) : delayMs;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
