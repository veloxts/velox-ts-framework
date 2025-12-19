/**
 * @veloxts/mcp - Model Context Protocol Server for VeloxTS
 *
 * Exposes VeloxTS project context to AI tools via the Model Context Protocol.
 * This enables AI assistants like Claude to introspect procedures, schemas,
 * routes, and error codes programmatically.
 *
 * @example
 * ```typescript
 * import { createVeloxMCPServer, runMCPServer } from '@veloxts/mcp';
 *
 * // Run with stdio transport (for CLI integration)
 * await runMCPServer({ debug: true });
 *
 * // Or create a server instance for custom integration
 * const server = createVeloxMCPServer({
 *   projectRoot: '/path/to/project',
 *   debug: true,
 * });
 * ```
 *
 * @module @veloxts/mcp
 */

// ============================================================================
// Server
// ============================================================================

export type { VeloxMCPServerOptions } from './server.js';
export { createVeloxMCPServer, runMCPServer } from './server.js';

// ============================================================================
// Resources
// ============================================================================

export type {
  ErrorInfo,
  ErrorsResourceResponse,
  ProcedureInfo,
  ProceduresResourceResponse,
  RouteInfo,
  RoutesResourceResponse,
  SchemaInfo,
  SchemasResourceResponse,
} from './resources/index.js';
export {
  formatErrorsAsText,
  formatProceduresAsText,
  formatRoutesAsText,
  formatSchemasAsText,
  getErrors,
  getErrorsByPrefix,
  getProcedures,
  getProceduresByNamespace,
  getProceduresByType,
  getRoutes,
  getRoutesByMethod,
  getRoutesByNamespace,
  getSchemas,
  searchErrors,
  searchSchemas,
} from './resources/index.js';

// ============================================================================
// Tools
// ============================================================================

export type {
  GenerateOptions,
  GenerateResult,
  GeneratorType,
  MigrateAction,
  MigrateOptions,
  MigrateResult,
  MigrationInfo,
} from './tools/index.js';
export {
  formatGenerateResult,
  formatMigrateResult,
  generate,
  generateProcedure,
  generateResource,
  generateSchema,
  migrate,
  migrateFresh,
  migrateReset,
  migrateRollback,
  migrateRun,
  migrateStatus,
} from './tools/index.js';

// ============================================================================
// Prompts
// ============================================================================

export type { PromptArgument, PromptTemplate } from './prompts/index.js';
export {
  ADD_VALIDATION,
  CREATE_PROCEDURE,
  ERROR_HANDLING,
  getPromptTemplate,
  listPromptTemplates,
  PROMPT_TEMPLATES,
  SETUP_AUTH,
} from './prompts/index.js';

// ============================================================================
// Utilities
// ============================================================================

export type { ProjectInfo } from './utils/project.js';
export {
  findProjectRoot,
  getProceduresPath,
  getProjectInfo,
  getSchemasPath,
  isVeloxProject,
} from './utils/project.js';
