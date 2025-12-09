/**
 * @veloxts/cli - Database Seeding Module
 *
 * Laravel-inspired database seeding system with factories and seeders.
 *
 * @example
 * ```typescript
 * // In a seeder file (src/database/seeders/UserSeeder.ts)
 * import type { Seeder, SeederContext } from '@veloxts/cli';
 * import { UserFactory } from '../factories/UserFactory.js';
 *
 * export const UserSeeder: Seeder = {
 *   name: 'UserSeeder',
 *   dependencies: [],
 *
 *   async run({ db, factory, log }) {
 *     await factory.get(UserFactory).createMany(10);
 *     log.success('Created 10 users');
 *   },
 * };
 * ```
 *
 * @module @veloxts/cli/seeding
 */

// ============================================================================
// Types
// ============================================================================

export type {
  BatchSeederResult,
  // Environment
  Environment,
  // Factory types
  Factory,
  FactoryConstructor,
  FactoryRegistry,
  // Loader types
  LoadedSeeder,
  // Re-exports
  PrismaClientLike,
  // Command options
  SeedCommandOptions,
  // Seeder types
  Seeder,
  SeederContext,
  SeederLoadResult,
  // Logger
  SeederLogger,
  SeederResult,
  SeederRunOptions,
  StateModifier,
} from './types.js';

// ============================================================================
// Errors
// ============================================================================

export {
  circularDependency,
  dependencyNotFound,
  executionFailed,
  FactoryError,
  factoryCreateFailed,
  factoryNotFound,
  filesystemError,
  invalidExport,
  noSeedersFound,
  SeederError,
  SeederErrorCode,
  seederDatabaseError,
  // Error factory functions
  seederNotFound,
  stateNotFound,
  truncationFailed,
} from './errors.js';

// ============================================================================
// Factory System
// ============================================================================

export { BaseFactory, createFactoryRegistry } from './factory.js';

// ============================================================================
// Seeder Infrastructure
// ============================================================================

export { loadSeeders, seedersDirectoryExists } from './loader.js';
export { SeederRegistry } from './registry.js';
export { SeederRunner } from './runner.js';
