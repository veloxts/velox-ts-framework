/**
 * Access level configuration for custom visibility systems
 *
 * Provides `defineAccessLevels()` for creating custom access level
 * hierarchies with named groups. The default 3-level system
 * (public/authenticated/admin) is a special case of this.
 *
 * @module resource/levels
 */

// ============================================================================
// Default Levels
// ============================================================================

/**
 * The built-in 3-level hierarchy used when `resourceSchema()` is called
 * without arguments.
 */
export const DEFAULT_LEVELS = ['public', 'authenticated', 'admin'] as const;

export type DefaultLevels = typeof DEFAULT_LEVELS;

// ============================================================================
// Access Level Config
// ============================================================================

/**
 * Configuration object returned by `defineAccessLevels()`.
 *
 * Holds the defined levels, named groups, and a `resolve()` method
 * that expands a group name to the concrete set of levels it covers.
 *
 * @template TLevels - Tuple of level name literals
 * @template TGroups - Record mapping group names to `'*'` or level arrays
 */
export interface AccessLevelConfig<
  TLevels extends readonly string[] = readonly string[],
  TGroups extends Record<string, '*' | readonly string[]> = Record<string, never>,
> {
  readonly levels: TLevels;
  readonly groups: TGroups;
  /** Resolves a group name to the concrete set of levels */
  resolve(ref: keyof TGroups & string): ReadonlySet<string>;
  /** Returns the set containing all defined levels */
  allLevels(): ReadonlySet<string>;
}

// ============================================================================
// defineAccessLevels()
// ============================================================================

/**
 * Defines custom access levels and optional named groups.
 *
 * Groups become fluent builder methods on `resourceSchema(config)`.
 * The `'*'` wildcard resolves to all defined levels.
 *
 * @example
 * ```typescript
 * const access = defineAccessLevels(
 *   ['public', 'reviewer', 'authenticated', 'moderator', 'admin'],
 *   {
 *     everyone: '*',
 *     internal: ['reviewer', 'moderator', 'admin'],
 *     staff: ['moderator', 'admin'],
 *   }
 * );
 * ```
 */
export function defineAccessLevels<const TLevels extends readonly [string, ...string[]]>(
  levels: TLevels
): AccessLevelConfig<TLevels, Record<string, never>>;

export function defineAccessLevels<
  const TLevels extends readonly [string, ...string[]],
  const TGroups extends Record<string, '*' | readonly NoInfer<TLevels[number]>[]>,
>(levels: TLevels, groups: TGroups): AccessLevelConfig<TLevels, TGroups>;

export function defineAccessLevels<
  const TLevels extends readonly [string, ...string[]],
  const TGroups extends Record<string, '*' | readonly string[]>,
>(levels: TLevels, groups?: TGroups): AccessLevelConfig<TLevels, TGroups> {
  // Validation: at least 2 levels
  if (levels.length < 2) {
    throw new Error('defineAccessLevels requires at least 2 levels');
  }

  // Validation: no duplicate levels
  const seen = new Set<string>();
  for (const level of levels) {
    if (seen.has(level)) {
      throw new Error(`Duplicate level: "${level}"`);
    }
    seen.add(level);
  }

  const levelSet: ReadonlySet<string> = new Set(levels);
  const resolvedGroups = new Map<string, ReadonlySet<string>>();
  const safeGroups = (groups ?? {}) as TGroups;

  if (groups) {
    for (const [name, ref] of Object.entries(groups)) {
      // Group names must not collide with level names
      if (levelSet.has(name)) {
        throw new Error(
          `Group name "${name}" collides with a level name. ` +
            'Group names and level names must be distinct.'
        );
      }

      if (ref === '*') {
        resolvedGroups.set(name, levelSet);
      } else if (Array.isArray(ref)) {
        // Validate that all referenced levels exist
        for (const member of ref) {
          if (!levelSet.has(member)) {
            throw new Error(
              `Group "${name}" references unknown level "${member}". ` +
                `Valid levels: ${levels.join(', ')}`
            );
          }
        }
        if (ref.length === 0) {
          throw new Error(`Group "${name}" must contain at least one level`);
        }
        resolvedGroups.set(name, new Set(ref));
      }
    }
  }

  return {
    levels,
    groups: safeGroups,
    resolve(ref: keyof TGroups & string): ReadonlySet<string> {
      const resolved = resolvedGroups.get(ref);
      if (!resolved) {
        throw new Error(`Unknown group: "${ref}"`);
      }
      return resolved;
    },
    allLevels(): ReadonlySet<string> {
      return levelSet;
    },
  };
}

// ============================================================================
// Default Config
// ============================================================================

/**
 * Pre-built config for the default 3-level system.
 *
 * Used internally by the default `resourceSchema()` builder.
 * The default levels use a hierarchical model where higher levels
 * include all fields visible to lower levels.
 */
export const DEFAULT_ACCESS_LEVELS: AccessLevelConfig<
  DefaultLevels,
  Record<string, never>
> = defineAccessLevels(DEFAULT_LEVELS);

// ============================================================================
// Runtime Helpers
// ============================================================================

/**
 * Converts a default hierarchical level to the set of levels that can see
 * a field at that visibility.
 *
 * - `'public'` → `Set(['public', 'authenticated', 'admin'])`
 * - `'authenticated'` → `Set(['authenticated', 'admin'])`
 * - `'admin'` → `Set(['admin'])`
 *
 * @internal
 */
export function defaultLevelToSet(level: string): ReadonlySet<string> {
  switch (level) {
    case 'public':
      return new Set(['public', 'authenticated', 'admin']);
    case 'authenticated':
      return new Set(['authenticated', 'admin']);
    case 'admin':
      return new Set(['admin']);
    default:
      return new Set([level]);
  }
}
