/**
 * Deep merge utility for preset configurations.
 */

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
  overrides?: Partial<T>
): T {
  if (!overrides) return base;

  const result = { ...base };

  for (const key in overrides) {
    if (!Object.prototype.hasOwnProperty.call(overrides, key)) continue;

    // Skip prototype pollution attempts
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    const overrideValue = overrides[key];

    // Skip undefined (allows partial overrides)
    if (overrideValue === undefined) {
      continue;
    }

    const baseValue = base[key];

    // Recursively merge nested objects (but not arrays or null)
    if (
      overrideValue !== null &&
      typeof overrideValue === 'object' &&
      !Array.isArray(overrideValue) &&
      baseValue !== null &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      result[key] = mergeDeep(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else {
      // Replace primitives, arrays, and null values
      result[key] = overrideValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}
