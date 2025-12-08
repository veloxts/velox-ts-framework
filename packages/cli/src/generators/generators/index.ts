/**
 * Built-in Generators
 *
 * Re-exports all built-in generators and provides auto-registration.
 */

import { registerGenerator } from '../registry.js';
import { createMigrationGenerator } from './migration.js';
import { createModelGenerator } from './model.js';
import { createProcedureGenerator } from './procedure.js';
import { createSchemaGenerator } from './schema.js';

// ============================================================================
// Generator Exports
// ============================================================================

export { ProcedureGenerator, createProcedureGenerator } from './procedure.js';
export { ModelGenerator, createModelGenerator } from './model.js';
export { MigrationGenerator, createMigrationGenerator } from './migration.js';
export { SchemaGenerator, createSchemaGenerator } from './schema.js';

// ============================================================================
// Auto-Registration
// ============================================================================

/**
 * Register all built-in generators with the global registry.
 * Call this once during CLI initialization.
 */
export function registerBuiltinGenerators(): void {
  // Register procedure generator
  registerGenerator(createProcedureGenerator());

  // Register model generator
  registerGenerator(createModelGenerator());

  // Register migration generator
  registerGenerator(createMigrationGenerator());

  // Register schema generator
  registerGenerator(createSchemaGenerator());

  // Future generators will be registered here:
  // registerGenerator(createTestGenerator());
  // registerGenerator(createResourceGenerator());
}
