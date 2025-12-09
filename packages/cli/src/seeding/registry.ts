/**
 * Seeder Registry
 *
 * Manages seeder registration and dependency resolution with topological sorting.
 */

import { circularDependency, dependencyNotFound, seederNotFound } from './errors.js';
import type { Environment, Seeder } from './types.js';

// ============================================================================
// Seeder Registry
// ============================================================================

/**
 * Registry for managing seeders with dependency resolution.
 *
 * Handles seeder registration, retrieval, and ordering based on dependencies
 * using topological sorting.
 *
 * @example
 * ```typescript
 * const registry = new SeederRegistry();
 *
 * registry.register(UserSeeder);
 * registry.register(PostSeeder);  // depends on UserSeeder
 *
 * // Get seeders in correct execution order
 * const ordered = registry.getInOrder();
 * ```
 */
export class SeederRegistry {
  private seeders: Map<string, Seeder> = new Map();

  /**
   * Register a seeder in the registry.
   *
   * @param seeder - Seeder to register
   * @throws Error if seeder with same name already exists
   */
  register(seeder: Seeder): void {
    if (this.seeders.has(seeder.name)) {
      throw new Error(`Seeder '${seeder.name}' is already registered`);
    }
    this.seeders.set(seeder.name, seeder);
  }

  /**
   * Register multiple seeders.
   *
   * @param seeders - Seeders to register
   */
  registerMany(seeders: Seeder[]): void {
    for (const seeder of seeders) {
      this.register(seeder);
    }
  }

  /**
   * Get a seeder by name.
   *
   * @param name - Seeder name
   * @returns Seeder if found, undefined otherwise
   */
  get(name: string): Seeder | undefined {
    return this.seeders.get(name);
  }

  /**
   * Get a seeder by name, throwing if not found.
   *
   * @param name - Seeder name
   * @returns Seeder
   * @throws SeederError if not found
   */
  getOrThrow(name: string): Seeder {
    const seeder = this.seeders.get(name);
    if (!seeder) {
      throw seederNotFound(name);
    }
    return seeder;
  }

  /**
   * Check if a seeder exists.
   *
   * @param name - Seeder name
   */
  has(name: string): boolean {
    return this.seeders.has(name);
  }

  /**
   * Get all registered seeder names.
   */
  getNames(): string[] {
    return Array.from(this.seeders.keys());
  }

  /**
   * Get all registered seeders.
   */
  getAll(): Seeder[] {
    return Array.from(this.seeders.values());
  }

  /**
   * Get seeder count.
   */
  get size(): number {
    return this.seeders.size;
  }

  /**
   * Clear all registered seeders.
   */
  clear(): void {
    this.seeders.clear();
  }

  // ==========================================================================
  // Dependency Resolution
  // ==========================================================================

  /**
   * Validate all seeder dependencies exist and there are no circular dependencies.
   *
   * @throws SeederError if dependencies are invalid
   */
  validateDependencies(): void {
    // Check all dependencies exist
    for (const seeder of this.seeders.values()) {
      for (const depName of seeder.dependencies ?? []) {
        if (!this.seeders.has(depName)) {
          throw dependencyNotFound(seeder.name, depName);
        }
      }
    }

    // Check for circular dependencies
    this.detectCircularDependencies();
  }

  /**
   * Get all seeders in dependency order (topological sort).
   *
   * Seeders with no dependencies come first, then seeders that depend on them, etc.
   *
   * @param environment - Optional environment filter
   * @returns Seeders in execution order
   * @throws SeederError if circular dependency detected
   */
  getInOrder(environment?: Environment): Seeder[] {
    this.validateDependencies();

    // Filter by environment if specified
    const seeders = environment
      ? Array.from(this.seeders.values()).filter((s) => this.shouldRunInEnvironment(s, environment))
      : Array.from(this.seeders.values());

    // Build adjacency list and in-degree count
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const seeder of seeders) {
      inDegree.set(seeder.name, 0);
      adjacency.set(seeder.name, []);
    }

    // Count dependencies (in-degree) and build reverse adjacency
    for (const seeder of seeders) {
      for (const depName of seeder.dependencies ?? []) {
        // Only count if dependency is in our filtered set
        if (inDegree.has(depName)) {
          inDegree.set(seeder.name, (inDegree.get(seeder.name) ?? 0) + 1);
          adjacency.get(depName)?.push(seeder.name);
        }
      }
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    const result: Seeder[] = [];

    // Start with seeders that have no dependencies
    for (const [name, degree] of inDegree) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    while (queue.length > 0) {
      const name = queue.shift();
      if (!name) continue;
      const seeder = this.seeders.get(name);
      if (!seeder) continue;
      result.push(seeder);

      // Reduce in-degree of dependents
      for (const dependent of adjacency.get(name) ?? []) {
        const newDegree = (inDegree.get(dependent) ?? 0) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    // If result doesn't contain all seeders, there's a cycle
    if (result.length !== seeders.length) {
      // Find the cycle for error message
      const remaining = seeders.filter((s) => !result.includes(s));
      const cycle = this.findCycle(remaining[0].name);
      throw circularDependency(cycle);
    }

    return result;
  }

  /**
   * Get seeders filtered by names in dependency order.
   *
   * @param names - Seeder names to include (and their dependencies)
   * @param environment - Optional environment filter
   */
  getByNames(names: string[], environment?: Environment): Seeder[] {
    // Collect requested seeders and all their transitive dependencies
    const needed = new Set<string>();
    const stack = [...names];

    while (stack.length > 0) {
      const name = stack.pop();
      if (!name || needed.has(name)) continue;

      const seeder = this.getOrThrow(name);

      // Skip if not for this environment
      if (environment && !this.shouldRunInEnvironment(seeder, environment)) {
        continue;
      }

      needed.add(name);

      // Add dependencies to stack
      for (const dep of seeder.dependencies ?? []) {
        stack.push(dep);
      }
    }

    // Get all in order, then filter to only needed
    return this.getInOrder(environment).filter((s) => needed.has(s.name));
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Check if seeder should run in given environment.
   */
  private shouldRunInEnvironment(seeder: Seeder, environment: Environment): boolean {
    // If no environments specified, run in all
    if (!seeder.environments || seeder.environments.length === 0) {
      return true;
    }
    return seeder.environments.includes(environment);
  }

  /**
   * Detect circular dependencies using DFS.
   */
  private detectCircularDependencies(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const seeder of this.seeders.values()) {
      if (!visited.has(seeder.name)) {
        this.detectCycleDFS(seeder.name, visited, recursionStack);
      }
    }
  }

  /**
   * DFS helper for cycle detection.
   */
  private detectCycleDFS(name: string, visited: Set<string>, stack: Set<string>): void {
    visited.add(name);
    stack.add(name);

    const seeder = this.seeders.get(name);
    if (!seeder) return;

    for (const depName of seeder.dependencies ?? []) {
      if (!visited.has(depName)) {
        this.detectCycleDFS(depName, visited, stack);
      } else if (stack.has(depName)) {
        // Found cycle - build the cycle path for error message
        const cycle = this.findCycle(depName);
        throw circularDependency(cycle);
      }
    }

    stack.delete(name);
  }

  /**
   * Find and return a cycle starting from the given node.
   */
  private findCycle(startName: string): string[] {
    const path: string[] = [];
    const visited = new Set<string>();

    const dfs = (name: string): boolean => {
      if (path.includes(name)) {
        // Found cycle - close it by adding the start again
        path.push(name);
        return true;
      }

      if (visited.has(name)) return false;

      visited.add(name);
      path.push(name);

      const seeder = this.seeders.get(name);
      for (const depName of seeder?.dependencies ?? []) {
        if (dfs(depName)) return true;
      }

      path.pop();
      return false;
    };

    dfs(startName);

    // Extract just the cycle portion (from first occurrence of last element)
    const lastElement = path[path.length - 1];
    const firstOccurrence = path.indexOf(lastElement);
    return path.slice(firstOccurrence);
  }
}
