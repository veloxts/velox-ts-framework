/**
 * Generator Registry
 *
 * Central registry for managing and discovering code generators.
 * Handles registration, lookup by name/alias, and categorization.
 */

import type { AnyGenerator, GeneratorCategory } from './types.js';

// ============================================================================
// Registry Types
// ============================================================================

/**
 * Registered generator entry with metadata
 */
export interface RegisteredGenerator {
  /** The generator instance */
  readonly generator: AnyGenerator;
  /** Primary name (e.g., 'procedure') */
  readonly name: string;
  /** All names that can be used to invoke this generator */
  readonly allNames: ReadonlyArray<string>;
}

// ============================================================================
// Generator Registry
// ============================================================================

/**
 * Registry for managing code generators
 */
class GeneratorRegistry {
  private readonly generators = new Map<string, AnyGenerator>();
  private readonly aliasMap = new Map<string, string>();

  /**
   * Normalize name for case-insensitive lookups
   */
  private normalizeName(name: string): string {
    return name.toLowerCase();
  }

  /**
   * Register a generator
   *
   * @param generator - The generator to register
   * @throws Error if generator name or alias conflicts
   */
  register(generator: AnyGenerator): void {
    const { name, aliases } = generator.metadata;
    const normalizedName = this.normalizeName(name);

    // Check for name conflicts
    if (this.generators.has(normalizedName)) {
      throw new Error(`Generator "${name}" is already registered. Generator names must be unique.`);
    }

    // Check for alias conflicts
    if (this.aliasMap.has(normalizedName)) {
      throw new Error(
        `"${name}" is already registered as an alias for "${this.aliasMap.get(normalizedName)}".`
      );
    }

    // Check each alias
    if (aliases) {
      for (const alias of aliases) {
        const normalizedAlias = this.normalizeName(alias);
        if (this.generators.has(normalizedAlias)) {
          throw new Error(`Alias "${alias}" conflicts with existing generator "${alias}".`);
        }
        if (this.aliasMap.has(normalizedAlias)) {
          throw new Error(
            `Alias "${alias}" is already registered for generator "${this.aliasMap.get(normalizedAlias)}".`
          );
        }
      }
    }

    // Register the generator
    this.generators.set(normalizedName, generator);

    // Register aliases
    if (aliases) {
      for (const alias of aliases) {
        this.aliasMap.set(this.normalizeName(alias), normalizedName);
      }
    }
  }

  /**
   * Get a generator by name or alias (case-insensitive)
   *
   * @param nameOrAlias - Generator name or alias
   * @returns The generator if found, undefined otherwise
   */
  get(nameOrAlias: string): AnyGenerator | undefined {
    const normalized = this.normalizeName(nameOrAlias);

    // Direct lookup
    if (this.generators.has(normalized)) {
      return this.generators.get(normalized);
    }

    // Alias lookup
    const resolvedName = this.aliasMap.get(normalized);
    if (resolvedName) {
      return this.generators.get(resolvedName);
    }

    return undefined;
  }

  /**
   * Check if a generator exists by name or alias (case-insensitive)
   */
  has(nameOrAlias: string): boolean {
    const normalized = this.normalizeName(nameOrAlias);
    return this.generators.has(normalized) || this.aliasMap.has(normalized);
  }

  /**
   * Get all registered generators
   */
  getAll(): ReadonlyArray<RegisteredGenerator> {
    return Array.from(this.generators.entries()).map(([name, generator]) => {
      const aliases = generator.metadata.aliases ?? [];
      return {
        generator,
        name,
        allNames: [name, ...aliases],
      };
    });
  }

  /**
   * Get generators by category
   */
  getByCategory(category: GeneratorCategory): ReadonlyArray<RegisteredGenerator> {
    return this.getAll().filter((entry) => entry.generator.metadata.category === category);
  }

  /**
   * Get all generator names and aliases
   */
  getAllNames(): ReadonlyArray<string> {
    const names: string[] = [];
    for (const name of this.generators.keys()) {
      names.push(name);
    }
    for (const alias of this.aliasMap.keys()) {
      names.push(alias);
    }
    return names.sort();
  }

  /**
   * Resolve an alias to its primary name (case-insensitive)
   */
  resolveName(nameOrAlias: string): string | undefined {
    const normalized = this.normalizeName(nameOrAlias);
    if (this.generators.has(normalized)) {
      return normalized;
    }
    return this.aliasMap.get(normalized);
  }

  /**
   * Clear all registered generators (useful for testing)
   */
  clear(): void {
    this.generators.clear();
    this.aliasMap.clear();
  }
}

// ============================================================================
// Global Registry Instance
// ============================================================================

/**
 * Global generator registry instance
 */
export const registry = new GeneratorRegistry();

// ============================================================================
// Registration Helpers
// ============================================================================

/**
 * Register a generator with the global registry
 */
export function registerGenerator(generator: AnyGenerator): void {
  registry.register(generator);
}

/**
 * Get a generator from the global registry
 */
export function getGenerator(nameOrAlias: string): AnyGenerator | undefined {
  return registry.get(nameOrAlias);
}

/**
 * Get all registered generators
 */
export function getAllGenerators(): ReadonlyArray<RegisteredGenerator> {
  return registry.getAll();
}

/**
 * Get generators by category
 */
export function getGeneratorsByCategory(
  category: GeneratorCategory
): ReadonlyArray<RegisteredGenerator> {
  return registry.getByCategory(category);
}

// ============================================================================
// Help Formatting
// ============================================================================

/**
 * Format generator list for help output
 */
export function formatGeneratorList(): string {
  const categories: GeneratorCategory[] = [
    'resource',
    'database',
    'test',
    'infrastructure',
    'auth',
    'composite',
  ];
  const categoryLabels: Record<GeneratorCategory, string> = {
    resource: 'Resource Generators',
    database: 'Database Generators',
    test: 'Test Generators',
    infrastructure: 'Infrastructure Generators',
    auth: 'Auth Generators',
    composite: 'Composite Generators',
  };

  const lines: string[] = [];

  for (const category of categories) {
    const generators = registry.getByCategory(category);
    if (generators.length === 0) continue;

    lines.push(`\n${categoryLabels[category]}:`);

    for (const { generator, name } of generators) {
      const { description, aliases } = generator.metadata;
      const aliasStr = aliases?.length ? ` (${aliases.join(', ')})` : '';
      lines.push(`  ${name}${aliasStr} - ${description}`);
    }
  }

  if (lines.length === 0) {
    return 'No generators registered.';
  }

  return lines.join('\n');
}

/**
 * Find similar generator names for suggestions
 */
export function findSimilarGenerators(input: string): ReadonlyArray<string> {
  const allNames = registry.getAllNames();
  const inputLower = input.toLowerCase();

  // Find generators that start with the input or contain it
  const matches = allNames.filter((name) => {
    const nameLower = name.toLowerCase();
    return nameLower.startsWith(inputLower) || nameLower.includes(inputLower);
  });

  // Also find by Levenshtein distance for typo correction
  if (matches.length === 0) {
    const similar = allNames
      .map((name) => ({
        name,
        distance: levenshteinDistance(inputLower, name.toLowerCase()),
      }))
      .filter(({ distance }) => distance <= 3)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map(({ name }) => name);

    return similar;
  }

  return matches.slice(0, 5);
}

/**
 * Simple Levenshtein distance implementation for typo detection
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
