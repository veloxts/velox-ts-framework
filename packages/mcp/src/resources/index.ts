/**
 * MCP Resources
 *
 * Resources expose read-only project context to AI tools.
 */

// Errors resource
export type { ErrorInfo, ErrorsResourceResponse } from './errors.js';
export {
  formatErrorsAsText,
  getErrors,
  getErrorsByPrefix,
  searchErrors,
} from './errors.js';
// Procedures resource
export type { ProcedureInfo, ProceduresResourceResponse } from './procedures.js';
export {
  formatProceduresAsText,
  getProcedures,
  getProceduresByNamespace,
  getProceduresByType,
} from './procedures.js';
// Routes resource
export type { RouteInfo, RoutesResourceResponse } from './routes.js';
export {
  formatRoutesAsText,
  getRoutes,
  getRoutesByMethod,
  getRoutesByNamespace,
} from './routes.js';
// Schemas resource
export type { SchemaInfo, SchemasResourceResponse } from './schemas.js';
export {
  formatSchemasAsText,
  getSchemas,
  searchSchemas,
} from './schemas.js';
