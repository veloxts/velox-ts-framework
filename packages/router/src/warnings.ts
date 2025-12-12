/**
 * Naming Convention Warning System
 *
 * Provides development-time warnings for procedure naming issues.
 * Zero runtime cost in production.
 *
 * @module warnings
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Warning types for naming convention analysis
 */
export type NamingWarningType =
  | 'no-convention'
  | 'type-mismatch'
  | 'case-mismatch'
  | 'similar-name';

/**
 * A naming convention warning with actionable suggestion
 */
export interface NamingWarning {
  /** The procedure name that triggered the warning */
  procedureName: string;
  /** The namespace containing the procedure */
  namespace: string;
  /** Type of naming issue detected */
  type: NamingWarningType;
  /** Human-readable warning message */
  message: string;
  /** Actionable suggestion for fixing the issue */
  suggestion: string;
  /** Suggested corrected name (if applicable) */
  suggestedName?: string;
}

/**
 * Configuration for naming convention warnings
 *
 * @example
 * ```typescript
 * // Disable warnings for specific procedures
 * defineProcedures('custom', procs, {
 *   warnings: { except: ['customAction'] }
 * });
 *
 * // Enable strict mode (warnings become errors)
 * defineProcedures('api', procs, {
 *   warnings: { strict: true }
 * });
 *
 * // Disable all warnings
 * defineProcedures('legacy', procs, {
 *   warnings: { disabled: true }
 * });
 * ```
 */
export interface WarningConfig {
  /** Disable all naming warnings (default: false) */
  disabled?: boolean;
  /** Treat warnings as errors - throw instead of warn (default: false) */
  strict?: boolean;
  /** Specific procedure names to exclude from warnings */
  except?: string[];
}

/**
 * Warning configuration option with shorthand support
 *
 * Supports three forms:
 * - `false` - Disable all warnings
 * - `'strict'` - Treat warnings as errors (fail fast)
 * - `{ ... }` - Full configuration object
 *
 * @example
 * ```typescript
 * // Shorthand: disable warnings
 * defineProcedures('legacy', procs, { warnings: false });
 *
 * // Shorthand: strict mode (CI/CD)
 * defineProcedures('api', procs, { warnings: 'strict' });
 *
 * // Full config
 * defineProcedures('custom', procs, {
 *   warnings: { strict: true, except: ['customAction'] }
 * });
 * ```
 */
export type WarningOption = WarningConfig | 'strict' | false;

/**
 * Normalizes a warning option to a full config object
 * @internal
 */
export function normalizeWarningOption(option: WarningOption | undefined): WarningConfig {
  if (option === undefined) {
    return {};
  }
  if (option === false) {
    return { disabled: true };
  }
  if (option === 'strict') {
    return { strict: true };
  }
  return option;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Known prefixes with their expected types and path patterns
 */
const CONVENTION_PREFIXES = [
  { prefix: 'get', type: 'query' as const, hasId: true },
  { prefix: 'list', type: 'query' as const, hasId: false },
  { prefix: 'find', type: 'query' as const, hasId: false },
  { prefix: 'create', type: 'mutation' as const, hasId: false },
  { prefix: 'add', type: 'mutation' as const, hasId: false },
  { prefix: 'update', type: 'mutation' as const, hasId: true },
  { prefix: 'edit', type: 'mutation' as const, hasId: true },
  { prefix: 'patch', type: 'mutation' as const, hasId: true },
  { prefix: 'delete', type: 'mutation' as const, hasId: true },
  { prefix: 'remove', type: 'mutation' as const, hasId: true },
] as const;

/**
 * Map of common alternative prefixes to their standard equivalents
 */
const SIMILAR_PATTERNS: Record<string, string> = {
  fetch: 'get or list',
  retrieve: 'get',
  obtain: 'get',
  load: 'get or list',
  read: 'get',
  query: 'get, list, or find',
  search: 'find',
  new: 'create',
  insert: 'create',
  make: 'create',
  modify: 'update or patch',
  change: 'update or patch',
  set: 'update',
  destroy: 'delete',
  drop: 'delete',
  erase: 'delete',
  trash: 'delete',
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Capitalize the first letter of a string
 */
function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Analyzes a procedure name for naming convention issues
 *
 * Checks for:
 * 1. Names matching a convention but with wrong procedure type
 * 2. Names matching a convention but with wrong casing
 * 3. Names similar to conventions (common alternatives)
 * 4. Names that don't match any convention
 *
 * @param name - The procedure name to analyze
 * @param type - The procedure type ('query' or 'mutation')
 * @param namespace - The namespace containing the procedure
 * @returns Warning if issue detected, undefined if name follows conventions
 */
export function analyzeNamingConvention(
  name: string,
  type: 'query' | 'mutation',
  namespace: string
): NamingWarning | undefined {
  // Check each known prefix
  for (const conv of CONVENTION_PREFIXES) {
    // Check if name starts with this prefix (case-insensitive check first)
    if (!name.toLowerCase().startsWith(conv.prefix.toLowerCase())) {
      continue;
    }

    const afterPrefix = name.slice(conv.prefix.length);

    // Build the strict pattern that the router uses
    const correctPattern = new RegExp(`^${conv.prefix}[A-Z][a-zA-Z]*$`);

    // Check if name matches the correct pattern
    if (correctPattern.test(name)) {
      // Name format is correct - check if type matches
      if (conv.type !== type) {
        return {
          procedureName: name,
          namespace,
          type: 'type-mismatch',
          message: `"${name}" uses "${conv.prefix}" prefix but is defined as ${type} (expected ${conv.type})`,
          suggestion: `Change to .${conv.type}() or rename to match a ${type} pattern`,
        };
      }
      // Everything is correct - no warning needed
      return undefined;
    }

    // Name starts with prefix but doesn't match pattern - check why

    // Case issue: prefix is correct but first letter after prefix is lowercase
    if (afterPrefix.length > 0 && afterPrefix[0] === afterPrefix[0].toLowerCase()) {
      const correctedName = conv.prefix + capitalize(afterPrefix);
      return {
        procedureName: name,
        namespace,
        type: 'case-mismatch',
        message: `"${name}" looks like "${conv.prefix}" pattern but has wrong casing`,
        suggestion: `Rename to "${correctedName}" for REST route generation`,
        suggestedName: correctedName,
      };
    }

    // Prefix itself has wrong case (e.g., "Get" instead of "get")
    if (name.startsWith(conv.prefix.charAt(0).toUpperCase())) {
      const correctedName = conv.prefix + afterPrefix;
      return {
        procedureName: name,
        namespace,
        type: 'case-mismatch',
        message: `"${name}" has incorrect prefix casing`,
        suggestion: `Rename to "${correctedName}" (prefix should be lowercase)`,
        suggestedName: correctedName,
      };
    }
  }

  // Name doesn't start with any known prefix - check for similar patterns
  const lowerName = name.toLowerCase();
  for (const [pattern, suggestion] of Object.entries(SIMILAR_PATTERNS)) {
    if (lowerName.startsWith(pattern)) {
      const afterPattern = name.slice(pattern.length);
      const primarySuggestion = suggestion.split(' or ')[0].split(', ')[0];
      const suggestedName = primarySuggestion + capitalize(afterPattern);

      return {
        procedureName: name,
        namespace,
        type: 'similar-name',
        message: `"${name}" won't generate a REST route`,
        suggestion: `Consider using "${suggestion}" prefix instead (e.g., "${suggestedName}")`,
        suggestedName,
      };
    }
  }

  // Name doesn't match any pattern - generic warning
  return {
    procedureName: name,
    namespace,
    type: 'no-convention',
    message: `"${name}" doesn't match any naming convention`,
    suggestion:
      'Use a standard prefix (get, list, find, create, update, patch, delete) or add .rest() override',
  };
}
