/**
 * Security Mapper
 *
 * Maps VeloxTS guards to OpenAPI security schemes.
 *
 * @module @veloxts/router/openapi/security-mapper
 */

import type { GuardLike } from '../types.js';
import type { OpenAPISecurityRequirement, OpenAPISecurityScheme } from './types.js';

// ============================================================================
// Default Mappings
// ============================================================================

/**
 * Default mapping from guard names to security scheme names
 *
 * Maps common @veloxts/auth guard names to their corresponding
 * OpenAPI security scheme identifiers.
 */
export const DEFAULT_GUARD_MAPPINGS: Record<string, string> = {
  // Authentication guards
  authenticated: 'bearerAuth',
  requireAuth: 'bearerAuth',

  // Role-based guards (all map to bearer since they require auth)
  hasRole: 'bearerAuth',
  hasAnyRole: 'bearerAuth',
  hasAllRoles: 'bearerAuth',

  // Permission-based guards
  hasPermission: 'bearerAuth',
  hasAnyPermission: 'bearerAuth',
  hasAllPermissions: 'bearerAuth',

  // API key auth
  apiKey: 'apiKeyAuth',
  apiKeyAuth: 'apiKeyAuth',
};

/**
 * Default security schemes for VeloxTS auth patterns
 *
 * These are commonly used security schemes that can be merged
 * with user-provided schemes.
 */
export const DEFAULT_SECURITY_SCHEMES: Record<string, OpenAPISecurityScheme> = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT authentication token. Obtain via /auth/login endpoint.',
  },
  apiKeyAuth: {
    type: 'apiKey',
    in: 'header',
    name: 'X-API-Key',
    description: 'API key for programmatic access.',
  },
  cookieAuth: {
    type: 'apiKey',
    in: 'cookie',
    name: 'session',
    description: 'Session cookie for browser-based authentication.',
  },
};

// ============================================================================
// Guard Mapping Functions
// ============================================================================

/**
 * Options for mapping guards to security
 */
export interface GuardMappingOptions {
  /**
   * Custom guard name to security scheme mapping
   * Merged with default mappings (custom takes precedence)
   */
  customMappings?: Record<string, string>;

  /**
   * Extract scopes from guard names
   * e.g., 'hasRole:admin' -> scopes: ['admin']
   * @default true
   */
  extractScopes?: boolean;

  /**
   * Scope separator in guard names
   * @default ':'
   */
  scopeSeparator?: string;
}

/**
 * Maps a single guard to an OpenAPI security requirement
 *
 * @param guard - Guard to map
 * @param options - Mapping options
 * @returns Security requirement or undefined if no mapping
 *
 * @example
 * ```typescript
 * mapGuardToSecurity({ name: 'authenticated', check: () => true })
 * // { bearerAuth: [] }
 *
 * mapGuardToSecurity({ name: 'hasRole:admin', check: () => true })
 * // { bearerAuth: ['admin'] }
 * ```
 */
export function mapGuardToSecurity(
  guard: GuardLike<unknown>,
  options: GuardMappingOptions = {}
): OpenAPISecurityRequirement | undefined {
  const { customMappings = {}, extractScopes = true, scopeSeparator = ':' } = options;

  // Merge mappings (custom takes precedence)
  const mappings = { ...DEFAULT_GUARD_MAPPINGS, ...customMappings };

  // Parse guard name and optional scopes
  const parts = guard.name.split(scopeSeparator);
  const baseName = parts[0];
  const scopes = extractScopes && parts.length > 1 ? parts.slice(1) : [];

  // Find matching security scheme
  const schemeName = mappings[guard.name] ?? mappings[baseName];

  if (!schemeName) {
    return undefined;
  }

  return { [schemeName]: scopes };
}

/**
 * Maps multiple guards to OpenAPI security requirements
 *
 * Multiple guards result in multiple security requirements,
 * meaning ALL must be satisfied (AND logic in OpenAPI).
 *
 * @param guards - Guards to map
 * @param options - Mapping options
 * @returns Array of security requirements
 *
 * @example
 * ```typescript
 * guardsToSecurity([
 *   { name: 'authenticated', check: () => true },
 *   { name: 'hasRole:admin', check: () => true }
 * ])
 * // [{ bearerAuth: [] }, { bearerAuth: ['admin'] }]
 * ```
 */
export function guardsToSecurity(
  guards: ReadonlyArray<GuardLike<unknown>>,
  options: GuardMappingOptions = {}
): OpenAPISecurityRequirement[] {
  if (guards.length === 0) {
    return [];
  }

  const requirements: OpenAPISecurityRequirement[] = [];
  const seen = new Set<string>(); // Deduplicate identical requirements

  for (const guard of guards) {
    const requirement = mapGuardToSecurity(guard, options);
    if (requirement) {
      const key = JSON.stringify(requirement);
      if (!seen.has(key)) {
        seen.add(key);
        requirements.push(requirement);
      }
    }
  }

  return requirements;
}

// ============================================================================
// Security Scheme Utilities
// ============================================================================

/**
 * Merges security schemes, with custom schemes taking precedence
 *
 * @param customSchemes - Custom security schemes
 * @param includeDefaults - Whether to include default schemes
 * @returns Merged security schemes
 */
export function mergeSecuritySchemes(
  customSchemes?: Record<string, OpenAPISecurityScheme>,
  includeDefaults = true
): Record<string, OpenAPISecurityScheme> {
  if (!includeDefaults) {
    return customSchemes ?? {};
  }

  return {
    ...DEFAULT_SECURITY_SCHEMES,
    ...customSchemes,
  };
}

/**
 * Extracts unique security scheme names from guards
 *
 * Useful for determining which schemes to include in the spec.
 *
 * @param guards - Guards to analyze
 * @param options - Mapping options
 * @returns Set of security scheme names used
 */
export function extractUsedSecuritySchemes(
  guards: ReadonlyArray<GuardLike<unknown>>,
  options: GuardMappingOptions = {}
): Set<string> {
  const schemeNames = new Set<string>();

  for (const guard of guards) {
    const requirement = mapGuardToSecurity(guard, options);
    if (requirement) {
      for (const schemeName of Object.keys(requirement)) {
        schemeNames.add(schemeName);
      }
    }
  }

  return schemeNames;
}

/**
 * Filters security schemes to only include those that are used
 *
 * @param allSchemes - All available security schemes
 * @param usedNames - Names of schemes that are actually used
 * @returns Filtered security schemes
 */
export function filterUsedSecuritySchemes(
  allSchemes: Record<string, OpenAPISecurityScheme>,
  usedNames: Set<string>
): Record<string, OpenAPISecurityScheme> {
  const filtered: Record<string, OpenAPISecurityScheme> = {};

  for (const name of usedNames) {
    if (allSchemes[name]) {
      filtered[name] = allSchemes[name];
    }
  }

  return filtered;
}

// ============================================================================
// Guard Analysis
// ============================================================================

/**
 * Checks if guards require authentication
 *
 * @param guards - Guards to check
 * @param options - Mapping options
 * @returns True if any guard maps to a security scheme
 */
export function guardsRequireAuth(
  guards: ReadonlyArray<GuardLike<unknown>>,
  options: GuardMappingOptions = {}
): boolean {
  return guardsToSecurity(guards, options).length > 0;
}

/**
 * Extracts all scopes from guards
 *
 * @param guards - Guards to analyze
 * @param options - Mapping options
 * @returns Array of unique scopes
 */
export function extractGuardScopes(
  guards: ReadonlyArray<GuardLike<unknown>>,
  options: GuardMappingOptions = {}
): string[] {
  const scopes = new Set<string>();

  for (const guard of guards) {
    const requirement = mapGuardToSecurity(guard, options);
    if (requirement) {
      for (const scopeList of Object.values(requirement)) {
        for (const scope of scopeList) {
          scopes.add(scope);
        }
      }
    }
  }

  return [...scopes];
}

/**
 * Creates a security requirement from scheme name and optional scopes
 *
 * @param schemeName - Name of the security scheme
 * @param scopes - Optional scopes
 * @returns Security requirement object
 */
export function createSecurityRequirement(
  schemeName: string,
  scopes: string[] = []
): OpenAPISecurityRequirement {
  return { [schemeName]: scopes };
}
