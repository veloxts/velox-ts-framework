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
export {
  type ErrorCode,
  fail,
  type InterpolationVars,
  isVeloxFailure,
  VeloxFailure,
} from './fail.js';
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
