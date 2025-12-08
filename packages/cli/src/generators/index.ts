/**
 * VeloxTS Code Generators
 *
 * Central module for code generation infrastructure.
 * Re-exports all public generator APIs.
 */

// Types
export type {
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

// Base infrastructure
export {
  BaseGenerator,
  applyCliFlags,
  createDefaultConfig,
  detectProjectContext,
  ensureVeloxProject,
  validateEntityNameDefault,
} from './base.js';

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
