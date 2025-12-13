/**
 * VeloxTS Error System
 *
 * Provides enhanced error handling with:
 * - Numbered error codes (VELOX-XXXX)
 * - Fix suggestions with code examples
 * - Pretty terminal formatting
 * - Documentation links
 *
 * @module errors
 */

// Re-export catalog
export {
  ERROR_CATALOG,
  ERROR_DOMAINS,
  type ErrorCatalogEntry,
  type ErrorDomain,
  getDocsUrl,
  getErrorEntry,
  getErrorsByDomain,
  isKnownErrorCode,
} from './catalog.js';
// Re-export fail() - the elegant error creation API
export {
  type ErrorCode,
  fail,
  type InterpolationVars,
  isVeloxFailure,
  VeloxFailure,
} from './fail.js';
// Re-export formatter
export {
  type ErrorLocation,
  extractErrorLocation,
  type FormatErrorOptions,
  formatError,
  formatErrorForApi,
  formatErrorOneLine,
  logDeprecation,
  logError,
  logWarning,
} from './formatter.js';
