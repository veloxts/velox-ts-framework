/**
 * Built-in Generators
 *
 * Re-exports all built-in generators and provides auto-registration.
 */

import { registerGenerator } from '../registry.js';
import { createModelGenerator } from './model.js';
import { createProcedureGenerator } from './procedure.js';

// ============================================================================
// Generator Exports
// ============================================================================

export { ProcedureGenerator, createProcedureGenerator } from './procedure.js';
export { ModelGenerator, createModelGenerator } from './model.js';

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

  // Future generators will be registered here:
  // registerGenerator(createSchemaGenerator());
  // registerGenerator(createMigrationGenerator());
  // registerGenerator(createTestGenerator());
  // registerGenerator(createResourceGenerator());
}
