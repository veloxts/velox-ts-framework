/**
 * Deep merge utility for preset configurations.
 */

/**
 * Recursive partial type that makes all nested properties optional.
 */
export type DeepPartial<T> = T extends object
  ? T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : { [K in keyof T]?: DeepPartial<T[K]> | null }
  : T;

/**
 * Check if a value is a plain object (not null, not array).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep merge two objects, with overrides taking precedence.
 *
 * - Objects are merged recursively
 * - Arrays are replaced (not concatenated)
 * - Undefined values in overrides are skipped
 * - Null values in overrides replace base values
 *
 * @typeParam T - The type of the objects being merged (must be an object type)
 * @param base - The base object to merge into
 * @param overrides - Optional partial overrides to apply
 * @returns The merged object with the same type as base
 *
 * @example
 * ```typescript
 * interface Config { port: number; host: string; nested: { debug: boolean } }
 *
 * const base: Config = { port: 3000, host: 'localhost', nested: { debug: false } };
 * const result = mergeDeep(base, { port: 4000, nested: { debug: true } });
 * // result: { port: 4000, host: 'localhost', nested: { debug: true } }
 * ```
 */
export function mergeDeep<T extends object>(base: T, overrides?: DeepPartial<T>): T {
  if (!overrides) return base;

  // Work with a mutable copy internally
  // We spread the base object and cast to Record for internal manipulation
  // This is type-safe because we only modify keys that exist on T
  const result = { ...base } as Record<string, unknown>;

  for (const key in overrides) {
    if (!Object.hasOwn(overrides, key)) continue;

    // Skip prototype pollution attempts
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    const overrideValue = (overrides as Record<string, unknown>)[key];

    // Skip undefined (allows partial overrides)
    if (overrideValue === undefined) {
      continue;
    }

    const baseValue = (base as Record<string, unknown>)[key];

    // Recursively merge nested objects (but not arrays or null)
    if (isPlainObject(overrideValue) && isPlainObject(baseValue)) {
      result[key] = mergeDeep(baseValue, overrideValue);
    } else {
      // Replace primitives, arrays, and null values
      result[key] = overrideValue;
    }
  }

  // The result has the same shape as T since we spread base and only
  // modify keys that exist in overrides (which is DeepPartial<T>)
  return result as T;
}
