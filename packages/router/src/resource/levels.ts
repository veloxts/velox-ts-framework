/**
 * Access level configuration for custom visibility systems
 *
 * Provides `defineAccessLevels()` for creating custom access level
 * hierarchies with named groups and optional guard functions.
 * The default 3-level system (public/authenticated/admin) is a
 * special case of this.
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
// Guard Types
// ============================================================================

/**
 * Guard function for access level authorization.
 *
 * Pure function that returns true if the caller qualifies for the level.
 * Can optionally carry a `_narrows` phantom type for per-branch
 * context narrowing in Level 3 handler maps.
 *
 * @template TNarrows - Phantom type representing the narrowed context
 */
export interface AccessLevelGuard<TNarrows = unknown> {
  (ctx: unknown): boolean | Promise<boolean>;
  readonly _narrows?: TNarrows;
}

/**
 * Record of guard functions keyed by level name.
 *
 * The first level (typically 'public') should NOT have a guard —
 * it is the implicit fallback.
 */
export type AccessLevelGuards<TLevels extends readonly string[] = readonly string[]> = {
  [K in TLevels[number]]?: AccessLevelGuard;
};

// ============================================================================
// Access Level Config
// ============================================================================

/**
 * Configuration object returned by `defineAccessLevels()`.
 *
 * Holds the defined levels, named groups, guard functions, and a
 * `resolve()` method that expands a group name to the concrete
 * set of levels it covers.
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
  readonly guards: AccessLevelGuards<TLevels>;
  /** Resolves a group name to the concrete set of levels */
  resolve(ref: keyof TGroups & string): ReadonlySet<string>;
  /** Returns the set containing all defined levels */
  allLevels(): ReadonlySet<string>;
}

// ============================================================================
// Options type
// ============================================================================

/**
 * Options for `defineAccessLevels()`.
 *
 * Combines guard functions and named groups in a single options object.
 */
export interface AccessLevelOptions<
  TLevels extends readonly string[],
  TGroups extends Record<string, '*' | readonly string[]> = Record<string, never>,
> {
  guards?: AccessLevelGuards<TLevels>;
  groups?: TGroups;
}

// ============================================================================
// defineAccessLevels()
// ============================================================================

/**
 * Defines custom access levels with optional guard functions and named groups.
 *
 * Guards are pure functions that determine if a caller qualifies for an
 * access level. They are used by Level 3 handler maps for branch selection.
 *
 * @example
 * ```typescript
 * const access = defineAccessLevels(
 *   ['public', 'authenticated', 'admin'],
 *   {
 *     guards: {
 *       authenticated: (ctx) => !!ctx.user,
 *       admin: (ctx) => ctx.user?.role === 'admin',
 *     },
 *     groups: {
 *       staff: ['authenticated', 'admin'],
 *     },
 *   }
 * );
 * ```
 */
export function defineAccessLevels<const TLevels extends readonly [string, ...string[]]>(
  levels: TLevels,
): AccessLevelConfig<TLevels, Record<string, never>>;

export function defineAccessLevels<
  const TLevels extends readonly [string, ...string[]],
  const TGroups extends Record<string, '*' | readonly NoInfer<TLevels[number]>[]>,
>(
  levels: TLevels,
  options: AccessLevelOptions<TLevels, TGroups>,
): AccessLevelConfig<TLevels, TGroups>;

// Legacy overload: groups as direct second arg (backward compat with existing tests)
export function defineAccessLevels<
  const TLevels extends readonly [string, ...string[]],
  const TGroups extends Record<string, '*' | readonly NoInfer<TLevels[number]>[]>,
>(levels: TLevels, groups: TGroups): AccessLevelConfig<TLevels, TGroups>;

export function defineAccessLevels<
  const TLevels extends readonly [string, ...string[]],
  const TGroups extends Record<string, '*' | readonly string[]>,
>(
  levels: TLevels,
  optionsOrGroups?: AccessLevelOptions<TLevels, TGroups> | TGroups,
): AccessLevelConfig<TLevels, TGroups> {
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

  // Detect whether second arg is options ({ guards?, groups? }) or direct groups
  let guards: AccessLevelGuards<TLevels> = {};
  let groups: TGroups | undefined;

  if (optionsOrGroups) {
    if (isAccessLevelOptions(optionsOrGroups)) {
      guards = (optionsOrGroups.guards ?? {}) as AccessLevelGuards<TLevels>;
      groups = optionsOrGroups.groups as TGroups | undefined;
    } else {
      // Legacy: direct groups object
      groups = optionsOrGroups as TGroups;
    }
  }

  // Validate guard keys
  const firstLevel = levels[0];
  for (const guardKey of Object.keys(guards)) {
    if (guardKey === firstLevel) {
      throw new Error(
        `Cannot define a guard for the first level "${firstLevel}". ` +
          'The first level is the implicit fallback and cannot have a guard.',
      );
    }
    if (!levelSet.has(guardKey)) {
      throw new Error(
        `Guard key "${guardKey}" references unknown level. ` +
          `Valid levels: ${levels.join(', ')}`,
      );
    }
  }

  // Process groups
  const resolvedGroups = new Map<string, ReadonlySet<string>>();
  const safeGroups = (groups ?? {}) as TGroups;

  if (groups) {
    for (const [name, ref] of Object.entries(groups)) {
      // Group names must not collide with level names
      if (levelSet.has(name)) {
        throw new Error(
          `Group name "${name}" collides with a level name. ` +
            'Group names and level names must be distinct.',
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
                `Valid levels: ${levels.join(', ')}`,
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
    guards,
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

/**
 * Detects whether the second arg is an options object ({ guards?, groups? })
 * or a legacy direct groups object.
 *
 * Heuristic: if the object has 'guards' or 'groups' as keys, it's options.
 * Direct group objects have keys that are group names (e.g., 'staff', 'everyone')
 * with values that are arrays or '*'.
 */
function isAccessLevelOptions(
  value: unknown,
): value is AccessLevelOptions<readonly string[]> {
  if (typeof value !== 'object' || value === null) return false;
  const keys = Object.keys(value);
  return keys.includes('guards') || keys.includes('groups');
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
