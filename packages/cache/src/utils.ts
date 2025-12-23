/**
 * Cache Utilities
 *
 * Helper functions for cache operations.
 */

import { randomUUID } from 'node:crypto';

import type { DurationString, TTL } from './types.js';

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
 * Parse a TTL value to seconds.
 *
 * @param ttl - TTL as seconds (number) or duration string (e.g., '1h', '30m')
 * @returns TTL in seconds
 *
 * @example
 * ```typescript
 * parseTtl(3600)      // 3600
 * parseTtl('1h')      // 3600
 * parseTtl('30m')     // 1800
 * parseTtl('1d')      // 86400
 * ```
 */
export function parseTtl(ttl: TTL): number {
  if (typeof ttl === 'number') {
    return ttl;
  }

  const match = ttl.match(/^(\d+)([smhdw])$/);
  if (!match) {
    throw new Error(
      `Invalid TTL format: ${ttl}. Expected format: <number><unit> (e.g., '1h', '30m')`
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multiplier = DURATION_UNITS[unit];

  if (multiplier === undefined) {
    throw new Error(`Unknown duration unit: ${unit}`);
  }

  return value * multiplier;
}

/**
 * Parse a TTL value to milliseconds.
 */
export function parseTtlMs(ttl: TTL): number {
  return parseTtl(ttl) * 1000;
}

/**
 * Format a TTL in seconds to a human-readable string.
 */
export function formatTtl(seconds: number): string {
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
 * Calculate expiration timestamp from TTL.
 */
export function calculateExpiration(ttl: TTL): number {
  const ttlMs = parseTtlMs(ttl);
  return Date.now() + ttlMs;
}

/**
 * Check if a timestamp has expired.
 */
export function isExpired(expiresAt: number | null): boolean {
  if (expiresAt === null) return false;
  return Date.now() >= expiresAt;
}

/**
 * Generate a cache key with prefix.
 */
export function prefixKey(key: string, prefix: string): string {
  return `${prefix}${key}`;
}

/**
 * Generate a tag key for tag-based invalidation.
 */
export function tagKey(tag: string, prefix: string): string {
  return `${prefix}tag:${tag}`;
}

/**
 * Generate a unique lock token using cryptographically secure random values.
 */
export function generateLockToken(): string {
  return randomUUID();
}
