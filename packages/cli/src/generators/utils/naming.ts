/**
 * Naming Utilities
 *
 * Functions for converting entity names between different cases
 * and handling pluralization for English words.
 */

import type { EntityNames } from '../types.js';

// ============================================================================
// Irregular Plurals
// ============================================================================

/**
 * Irregular plural forms for common English words
 */
const IRREGULAR_PLURALS: ReadonlyMap<string, string> = new Map([
  ['person', 'people'],
  ['child', 'children'],
  ['man', 'men'],
  ['woman', 'women'],
  ['mouse', 'mice'],
  ['goose', 'geese'],
  ['tooth', 'teeth'],
  ['foot', 'feet'],
  ['datum', 'data'],
  ['criterion', 'criteria'],
  ['phenomenon', 'phenomena'],
  ['analysis', 'analyses'],
  ['crisis', 'crises'],
  ['thesis', 'theses'],
  ['hypothesis', 'hypotheses'],
  ['axis', 'axes'],
  ['index', 'indices'],
  ['appendix', 'appendices'],
  ['matrix', 'matrices'],
  ['vertex', 'vertices'],
  ['ox', 'oxen'],
  ['quiz', 'quizzes'],
  ['status', 'statuses'],
  ['alias', 'aliases'],
  ['bus', 'buses'],
  ['virus', 'viruses'],
  ['campus', 'campuses'],
  ['stimulus', 'stimuli'],
  ['syllabus', 'syllabi'],
  ['focus', 'foci'],
  ['fungus', 'fungi'],
  ['cactus', 'cacti'],
  ['radius', 'radii'],
  ['nucleus', 'nuclei'],
  ['octopus', 'octopi'],
  ['medium', 'media'],
  ['curriculum', 'curricula'],
  ['memorandum', 'memoranda'],
  ['bacterium', 'bacteria'],
]);

/**
 * Reverse map for singularization
 */
const IRREGULAR_SINGULARS: ReadonlyMap<string, string> = new Map(
  Array.from(IRREGULAR_PLURALS.entries()).map(([singular, plural]) => [plural, singular])
);

// ============================================================================
// Case Conversion
// ============================================================================

/**
 * Convert string to PascalCase
 *
 * @example
 * toPascalCase('user') // 'User'
 * toPascalCase('blog-post') // 'BlogPost'
 * toPascalCase('user_profile') // 'UserProfile'
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''))
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Convert string to camelCase
 *
 * @example
 * toCamelCase('User') // 'user'
 * toCamelCase('blog-post') // 'blogPost'
 * toCamelCase('UserProfile') // 'userProfile'
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Convert string to kebab-case
 *
 * @example
 * toKebabCase('User') // 'user'
 * toKebabCase('BlogPost') // 'blog-post'
 * toKebabCase('user_profile') // 'user-profile'
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert string to snake_case
 *
 * @example
 * toSnakeCase('User') // 'user'
 * toSnakeCase('BlogPost') // 'blog_post'
 * toSnakeCase('user-profile') // 'user_profile'
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * Convert string to SCREAMING_SNAKE_CASE
 *
 * @example
 * toScreamingSnakeCase('User') // 'USER'
 * toScreamingSnakeCase('BlogPost') // 'BLOG_POST'
 */
export function toScreamingSnakeCase(str: string): string {
  return toSnakeCase(str).toUpperCase();
}

/**
 * Convert camelCase/PascalCase to human readable format
 *
 * @example
 * toHumanReadable('BlogPost') // 'Blog Post'
 * toHumanReadable('userProfile') // 'User Profile'
 */
export function toHumanReadable(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

// ============================================================================
// Pluralization
// ============================================================================

/**
 * Pluralize an English word
 *
 * @example
 * pluralize('user') // 'users'
 * pluralize('person') // 'people'
 * pluralize('category') // 'categories'
 * pluralize('bus') // 'buses'
 */
export function pluralize(word: string): string {
  const lower = word.toLowerCase();

  // Check irregular plurals
  if (IRREGULAR_PLURALS.has(lower)) {
    const plural = IRREGULAR_PLURALS.get(lower)!;
    // Preserve original casing pattern
    if (word[0] === word[0].toUpperCase()) {
      return plural.charAt(0).toUpperCase() + plural.slice(1);
    }
    return plural;
  }

  // Words ending in consonant + y → ies
  if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) {
    return word.slice(0, -1) + 'ies';
  }

  // Words ending in s, x, z, ch, sh → es
  if (
    lower.endsWith('s') ||
    lower.endsWith('x') ||
    lower.endsWith('z') ||
    lower.endsWith('ch') ||
    lower.endsWith('sh')
  ) {
    return word + 'es';
  }

  // Words ending in f or fe → ves
  if (lower.endsWith('f')) {
    return word.slice(0, -1) + 'ves';
  }
  if (lower.endsWith('fe')) {
    return word.slice(0, -2) + 'ves';
  }

  // Default: add s
  return word + 's';
}

/**
 * Singularize an English word (reverse pluralization)
 *
 * @example
 * singularize('users') // 'user'
 * singularize('people') // 'person'
 * singularize('categories') // 'category'
 */
export function singularize(word: string): string {
  const lower = word.toLowerCase();

  // Check irregular singulars
  if (IRREGULAR_SINGULARS.has(lower)) {
    const singular = IRREGULAR_SINGULARS.get(lower)!;
    // Preserve original casing pattern
    if (word[0] === word[0].toUpperCase()) {
      return singular.charAt(0).toUpperCase() + singular.slice(1);
    }
    return singular;
  }

  // Words ending in ies → y
  if (lower.endsWith('ies') && lower.length > 3) {
    return word.slice(0, -3) + 'y';
  }

  // Words ending in ves → f or fe
  if (lower.endsWith('ves')) {
    // Could be 'leaves' -> 'leaf' or 'wives' -> 'wife'
    // Simple heuristic: try both and pick the more common
    return word.slice(0, -3) + 'f';
  }

  // Words ending in ses, xes, zes, ches, shes → remove es
  if (
    lower.endsWith('ses') ||
    lower.endsWith('xes') ||
    lower.endsWith('zes') ||
    lower.endsWith('ches') ||
    lower.endsWith('shes')
  ) {
    return word.slice(0, -2);
  }

  // Words ending in s (but not ss) → remove s
  if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 1) {
    return word.slice(0, -1);
  }

  // Already singular
  return word;
}

/**
 * Check if a word is likely plural
 */
export function isPlural(word: string): boolean {
  const lower = word.toLowerCase();

  // Check if it's a known plural
  if (IRREGULAR_SINGULARS.has(lower)) {
    return true;
  }

  // Common plural endings
  return (
    lower.endsWith('s') ||
    lower.endsWith('ies') ||
    lower.endsWith('ves')
  );
}

// ============================================================================
// Entity Name Derivation
// ============================================================================

/**
 * Derive all naming variations from an input string.
 *
 * The input is normalized to PascalCase singular form, then all
 * variations are derived from that.
 *
 * @example
 * deriveEntityNames('User')
 * // {
 * //   raw: 'User',
 * //   pascal: 'User',
 * //   camel: 'user',
 * //   kebab: 'user',
 * //   snake: 'user',
 * //   screamingSnake: 'USER',
 * //   singular: 'user',
 * //   plural: 'users',
 * //   pascalPlural: 'Users',
 * //   humanReadable: 'User',
 * //   humanReadablePlural: 'Users',
 * // }
 *
 * @example
 * deriveEntityNames('blog-posts')
 * // {
 * //   raw: 'blog-posts',
 * //   pascal: 'BlogPost',
 * //   camel: 'blogPost',
 * //   kebab: 'blog-post',
 * //   snake: 'blog_post',
 * //   screamingSnake: 'BLOG_POST',
 * //   singular: 'blogPost',
 * //   plural: 'blogPosts',
 * //   pascalPlural: 'BlogPosts',
 * //   humanReadable: 'Blog Post',
 * //   humanReadablePlural: 'Blog Posts',
 * // }
 */
export function deriveEntityNames(input: string): EntityNames {
  // Normalize input: convert to PascalCase, then singularize
  const pascalInput = toPascalCase(input);
  const pascal = toPascalCase(singularize(pascalInput));

  const camel = toCamelCase(pascal);
  const kebab = toKebabCase(pascal);
  const snake = toSnakeCase(pascal);
  const screamingSnake = toScreamingSnakeCase(pascal);

  const pluralPascal = pluralize(pascal);
  const pluralCamel = pluralize(camel);

  const humanReadable = toHumanReadable(pascal);
  const humanReadablePlural = toHumanReadable(pluralPascal);

  return {
    raw: input,
    pascal,
    camel,
    kebab,
    snake,
    screamingSnake,
    singular: camel,
    plural: pluralCamel,
    pascalPlural: pluralPascal,
    humanReadable,
    humanReadablePlural,
  };
}
