/**
 * Naming Utilities
 *
 * Functions for converting entity names between different cases
 * and handling pluralization for English words.
 */

import pluralizeLib from 'pluralize';

import type { EntityNames } from '../types.js';

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
  // Handle single word (no separators)
  if (!/[-_\s]/.test(str)) {
    // Check if all uppercase - convert to lowercase
    if (str === str.toUpperCase()) {
      return str.toLowerCase();
    }
    // Mixed case or PascalCase - just lowercase first char
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
  // Has separators - convert through PascalCase
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
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
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
  return pluralizeLib(word);
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
  return pluralizeLib.singular(word);
}

/**
 * Check if a word is likely plural
 */
export function isPlural(word: string): boolean {
  return pluralizeLib.isPlural(word);
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
