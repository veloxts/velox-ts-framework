/**
 * Built-in Generators
 *
 * Re-exports all built-in generators and provides auto-registration.
 */

import { registerGenerator } from '../registry.js';
import { createProcedureGenerator } from './procedure.js';

// ============================================================================
// Generator Exports
// ============================================================================

export { ProcedureGenerator, createProcedureGenerator } from './procedure.js';

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

  // Future generators will be registered here:
  // registerGenerator(createSchemaGenerator());
  // registerGenerator(createModelGenerator());
  // registerGenerator(createMigrationGenerator());
  // registerGenerator(createTestGenerator());
  // registerGenerator(createResourceGenerator());
}
