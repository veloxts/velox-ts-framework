/**
 * Pluralization utilities for REST naming conventions
 *
 * Provides functions to convert between singular and plural forms
 * for resource names. Used primarily by the procedure builder to
 * derive parent parameter names from namespaces.
 *
 * @module utils/pluralization
 */

// ============================================================================
// Irregular Plurals
// ============================================================================

/**
 * Common irregular English plurals
 *
 * Maps plural forms to their singular equivalents.
 * Used for accurate parameter name derivation.
 */
const IRREGULAR_PLURALS: Readonly<Record<string, string>> = {
  people: 'person',
  children: 'child',
  men: 'man',
  women: 'woman',
  mice: 'mouse',
  geese: 'goose',
  teeth: 'tooth',
  feet: 'foot',
  data: 'datum',
  criteria: 'criterion',
  phenomena: 'phenomenon',
};

// ============================================================================
// Singularization
// ============================================================================

/**
 * Converts a plural word to its singular form
 *
 * Uses heuristics for common English pluralization patterns:
 * - Irregular plurals (people -> person, children -> child)
 * - -ies endings (categories -> category)
 * - -es endings (boxes -> box, classes -> class)
 * - Simple -s endings (users -> user)
 *
 * @param word - The plural word to singularize
 * @returns The singular form of the word
 *
 * @example
 * ```typescript
 * singularize('users')      // 'user'
 * singularize('categories') // 'category'
 * singularize('boxes')      // 'box'
 * singularize('people')     // 'person'
 * singularize('data')       // 'datum'
 * ```
 */
export function singularize(word: string): string {
  // Check irregular plurals first
  const lower = word.toLowerCase();
  if (IRREGULAR_PLURALS[lower]) {
    // Preserve original casing for first letter
    const singular = IRREGULAR_PLURALS[lower];
    if (word[0] === word[0].toUpperCase()) {
      return singular.charAt(0).toUpperCase() + singular.slice(1);
    }
    return singular;
  }

  // Handle common English pluralization patterns
  if (word.endsWith('ies') && word.length > 3) {
    // categories -> category
    return `${word.slice(0, -3)}y`;
  }

  if (word.endsWith('es') && word.length > 2) {
    // Check for -shes, -ches, -xes, -zes, -sses patterns
    const beforeEs = word.slice(-4, -2);
    if (['sh', 'ch'].includes(beforeEs) || ['x', 'z', 's'].includes(word.slice(-3, -2))) {
      return word.slice(0, -2);
    }
    // Default: remove just the 's' (e.g., "types" -> "type")
    return word.slice(0, -1);
  }

  if (word.endsWith('s') && word.length > 1 && !word.endsWith('ss')) {
    // Simple plural: users -> user, posts -> post
    return word.slice(0, -1);
  }

  // Word doesn't appear to be plural, return as-is
  return word;
}

// ============================================================================
// Parameter Name Derivation
// ============================================================================

/**
 * Derives a parameter name from a resource namespace
 *
 * Converts a plural namespace to a singular form and appends 'Id'.
 * This is used to derive parent parameter names for nested routes.
 *
 * @param namespace - The parent resource namespace (e.g., 'posts', 'users')
 * @returns The parameter name (e.g., 'postId', 'userId')
 *
 * @example
 * ```typescript
 * deriveParentParamName('posts')      // 'postId'
 * deriveParentParamName('users')      // 'userId'
 * deriveParentParamName('categories') // 'categoryId'
 * deriveParentParamName('people')     // 'personId'
 * deriveParentParamName('data')       // 'datumId'
 * ```
 */
export function deriveParentParamName(namespace: string): string {
  return `${singularize(namespace)}Id`;
}
