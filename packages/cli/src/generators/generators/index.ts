/**
 * Built-in Generators
 *
 * Re-exports all built-in generators and provides auto-registration.
 */

import { registerGenerator } from '../registry.js';
import { createActionGenerator } from './action.js';
import { createFactoryGenerator } from './factory.js';
import { createLayoutGenerator } from './layout.js';
import { createMigrationGenerator } from './migration.js';
import { createModelGenerator } from './model.js';
import { createPageGenerator } from './page.js';
import { createProcedureGenerator } from './procedure.js';
import { createResourceGenerator } from './resource.js';
import { createSchemaGenerator } from './schema.js';
import { createSeederGenerator } from './seeder.js';
import { createTestGenerator } from './test.js';

// ============================================================================
// Generator Exports
// ============================================================================

export { ActionGenerator, createActionGenerator } from './action.js';
export { createFactoryGenerator, FactoryGenerator } from './factory.js';
export { createLayoutGenerator, LayoutGenerator } from './layout.js';
export { createMigrationGenerator, MigrationGenerator } from './migration.js';
export { createModelGenerator, ModelGenerator } from './model.js';
export { createPageGenerator, PageGenerator } from './page.js';
export { createProcedureGenerator, ProcedureGenerator } from './procedure.js';
export { createResourceGenerator, ResourceGenerator } from './resource.js';
export { createSchemaGenerator, SchemaGenerator } from './schema.js';
export { createSeederGenerator, SeederGenerator } from './seeder.js';
export { createTestGenerator, TestGenerator } from './test.js';

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

  // Register test generator
  registerGenerator(createTestGenerator());

  // Register resource generator (full stack)
  registerGenerator(createResourceGenerator());

  // Register seeder generator
  registerGenerator(createSeederGenerator());

  // Register factory generator
  registerGenerator(createFactoryGenerator());

  // Register RSC generators (for full-stack projects)
  registerGenerator(createPageGenerator());
  registerGenerator(createLayoutGenerator());
  registerGenerator(createActionGenerator());
}
