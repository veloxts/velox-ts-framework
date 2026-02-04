/**
 * Visibility level definitions and hierarchy
 *
 * Provides the visibility level type and functions for determining
 * which fields are visible to which context tags.
 *
 * @module resource/visibility
 */

import type { ADMIN, AUTHENTICATED, ContextTag } from './tags.js';

// ============================================================================
// Visibility Level Type
// ============================================================================

/**
 * Visibility levels for resource fields
 *
 * Levels form a hierarchy where higher levels include access to lower levels:
 * - `public`: Visible to everyone (anonymous, authenticated, admin)
 * - `authenticated`: Visible to authenticated users and admins
 * - `admin`: Visible only to admins
 */
export type VisibilityLevel = 'public' | 'authenticated' | 'admin';

// ============================================================================
// Type-Level Visibility Checks
// ============================================================================

/**
 * Type-level predicate: Is a field at TLevel visible to TTag?
 *
 * Implements the visibility hierarchy:
 * - ADMIN sees: public, authenticated, admin
 * - AUTHENTICATED sees: public, authenticated
 * - ANONYMOUS sees: public only
 *
 * @example
 * ```typescript
 * type T1 = IsVisibleToTag<'public', typeof ANONYMOUS>; // true
 * type T2 = IsVisibleToTag<'authenticated', typeof ANONYMOUS>; // false
 * type T3 = IsVisibleToTag<'admin', typeof AUTHENTICATED>; // false
 * type T4 = IsVisibleToTag<'admin', typeof ADMIN>; // true
 * ```
 */
export type IsVisibleToTag<
  TLevel extends VisibilityLevel,
  TTag extends ContextTag,
> = TTag extends typeof ADMIN
  ? true // Admin sees everything
  : TTag extends typeof AUTHENTICATED
    ? TLevel extends 'public' | 'authenticated'
      ? true
      : false
    : TLevel extends 'public'
      ? true
      : false;

// ============================================================================
// Runtime Visibility Helpers
// ============================================================================

/**
 * Visibility level hierarchy map (lower number = more permissive)
 *
 * Used for runtime comparisons between visibility levels.
 */
const VISIBILITY_HIERARCHY: Record<VisibilityLevel, number> = {
  public: 0,
  authenticated: 1,
  admin: 2,
};

/**
 * Context tag to visibility level mapping
 *
 * Maps each context tag to the maximum visibility level it can access.
 */
const TAG_TO_LEVEL: Record<string, VisibilityLevel> = {
  anonymous: 'public',
  authenticated: 'authenticated',
  admin: 'admin',
};

/**
 * Runtime check: Is a field at fieldLevel visible to contextLevel?
 *
 * @param fieldLevel - The visibility level of the field
 * @param contextLevel - The visibility level of the current context
 * @returns True if the field should be included in the output
 *
 * @example
 * ```typescript
 * isVisibleAtLevel('public', 'anonymous'); // true
 * isVisibleAtLevel('authenticated', 'anonymous'); // false
 * isVisibleAtLevel('admin', 'authenticated'); // false
 * isVisibleAtLevel('admin', 'admin'); // true
 * ```
 */
export function isVisibleAtLevel(
  fieldLevel: VisibilityLevel,
  contextLevel: VisibilityLevel
): boolean {
  return VISIBILITY_HIERARCHY[contextLevel] >= VISIBILITY_HIERARCHY[fieldLevel];
}

/**
 * Gets the visibility level for a context tag identifier
 *
 * @param tagId - The tag identifier ('anonymous', 'authenticated', 'admin')
 * @returns The corresponding visibility level
 */
export function getVisibilityForTag(
  tagId: 'anonymous' | 'authenticated' | 'admin'
): VisibilityLevel {
  return TAG_TO_LEVEL[tagId];
}

/**
 * Gets all visibility levels that a given level can access
 *
 * @param level - The context's visibility level
 * @returns Array of visibility levels the context can access
 *
 * @example
 * ```typescript
 * getAccessibleLevels('admin'); // ['public', 'authenticated', 'admin']
 * getAccessibleLevels('authenticated'); // ['public', 'authenticated']
 * getAccessibleLevels('public'); // ['public']
 * ```
 */
export function getAccessibleLevels(level: VisibilityLevel): VisibilityLevel[] {
  const levels: VisibilityLevel[] = ['public'];
  if (level === 'authenticated' || level === 'admin') {
    levels.push('authenticated');
  }
  if (level === 'admin') {
    levels.push('admin');
  }
  return levels;
}
