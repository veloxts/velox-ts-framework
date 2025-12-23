/**
 * Queue Utilities
 *
 * Helper functions for queue operations.
 */

import type { Delay, DurationString } from './types.js';

/**
 * Duration units in seconds.
 */
const DURATION_UNITS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
};

/**
 * Check if a value is a duration string.
 */
export function isDurationString(value: unknown): value is DurationString {
  if (typeof value !== 'string') return false;
  return /^\d+[smhdw]$/.test(value);
}

/**
 * Parse a delay value to milliseconds.
 *
 * @param delay - Delay as seconds (number) or duration string (e.g., '1h', '30m')
 * @returns Delay in milliseconds
 *
 * @example
 * ```typescript
 * parseDelay(3600)      // 3600000
 * parseDelay('1h')      // 3600000
 * parseDelay('30m')     // 1800000
 * parseDelay('1d')      // 86400000
 * ```
 */
export function parseDelay(delay: Delay): number {
  if (typeof delay === 'number') {
    return delay * 1000; // Convert seconds to milliseconds
  }

  const match = delay.match(/^(\d+)([smhdw])$/);
  if (!match) {
    throw new Error(
      `Invalid delay format: ${delay}. Expected format: <number><unit> (e.g., '1h', '30m')`
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multiplier = DURATION_UNITS[unit];

  if (multiplier === undefined) {
    throw new Error(`Unknown duration unit: ${unit}`);
  }

  return value * multiplier * 1000; // Convert to milliseconds
}

/**
 * Format milliseconds to a human-readable duration.
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);

  if (seconds >= 604800 && seconds % 604800 === 0) {
    return `${seconds / 604800}w`;
  }
  if (seconds >= 86400 && seconds % 86400 === 0) {
    return `${seconds / 86400}d`;
  }
  if (seconds >= 3600 && seconds % 3600 === 0) {
    return `${seconds / 3600}h`;
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }
  return `${seconds}s`;
}

/**
 * Generate a unique job ID.
 */
export function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Validate job name format.
 * Job names should be dot-separated identifiers (e.g., 'email.welcome').
 */
export function validateJobName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new Error('Job name must be a non-empty string');
  }

  if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/i.test(name)) {
    throw new Error(
      `Invalid job name: ${name}. Use dot-separated identifiers (e.g., 'email.welcome')`
    );
  }
}

/**
 * Sleep for a specified duration.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    attempts: number;
    backoff: { type: 'fixed' | 'exponential'; delay: number };
  }
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < options.attempts) {
        const delay =
          options.backoff.type === 'exponential'
            ? options.backoff.delay * 2 ** (attempt - 1)
            : options.backoff.delay;
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
