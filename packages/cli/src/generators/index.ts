/**
 * VeloxTS Code Generators
 *
 * Central module for code generation infrastructure.
 * Re-exports all public generator APIs.
 */

// Base infrastructure
export {
  applyCliFlags,
  BaseGenerator,
  createDefaultConfig,
  detectProjectContext,
  ensureVeloxProject,
  validateEntityNameDefault,
} from './base.js';
// Built-in generators
export {
  createMigrationGenerator,
  createModelGenerator,
  createProcedureGenerator,
  createResourceGenerator,
  createSchemaGenerator,
  createTestGenerator,
  MigrationGenerator,
  ModelGenerator,
  ProcedureGenerator,
  ResourceGenerator,
  registerBuiltinGenerators,
  SchemaGenerator,
  TestGenerator,
} from './generators/index.js';
// Registry
export type { RegisteredGenerator } from './registry.js';
export {
  findSimilarGenerators,
  formatGeneratorList,
  getAllGenerators,
  getGenerator,
  getGeneratorsByCategory,
  registerGenerator,
  registry,
} from './registry.js';
// Types
export type {
  AnyGenerator,
  ConflictStrategy,
  EntityNames,
  GeneratedFile,
  Generator,
  GeneratorCategory,
  GeneratorConfig,
  GeneratorMetadata,
  GeneratorOption,
  GeneratorOptionType,
  GeneratorOutput,
  ProjectContext,
  TemplateContext,
  TemplateFunction,
} from './types.js';
export { GeneratorError, GeneratorErrorCode } from './types.js';
export type { WriteOptions, WriteResult } from './utils/filesystem.js';
export {
  dirExists,
  ensureDir,
  fileExists,
  formatWriteResults,
  formatWriteResultsJson,
  readFileSafe,
  writeFile,
  writeFiles,
} from './utils/filesystem.js';
// Utilities
export {
  deriveEntityNames,
  isPlural,
  pluralize,
  singularize,
  toCamelCase,
  toHumanReadable,
  toKebabCase,
  toPascalCase,
  toScreamingSnakeCase,
  toSnakeCase,
} from './utils/naming.js';
