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
 * Deep merge two objects, with overrides taking precedence.
 *
 * - Objects are merged recursively
 * - Arrays are replaced (not concatenated)
 * - Undefined values in overrides are skipped
 * - Null values in overrides replace base values
 */
export function mergeDeep<T extends Record<string, unknown>>(
  base: T,
  overrides?: DeepPartial<T>
): T {
  if (!overrides) return base;

  const result = { ...base };

  for (const key in overrides) {
    if (!Object.hasOwn(overrides, key)) continue;

    // Skip prototype pollution attempts
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    const overrideValue = overrides[key as keyof typeof overrides];

    // Skip undefined (allows partial overrides)
    if (overrideValue === undefined) {
      continue;
    }

    const baseValue = base[key as keyof T];

    // Recursively merge nested objects (but not arrays or null)
    if (
      overrideValue !== null &&
      typeof overrideValue === 'object' &&
      !Array.isArray(overrideValue) &&
      baseValue !== null &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      (result as Record<string, unknown>)[key] = mergeDeep(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>
      );
    } else {
      // Replace primitives, arrays, and null values
      (result as Record<string, unknown>)[key] = overrideValue;
    }
  }

  return result;
}
