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
  getDocsUrl,
  getErrorEntry,
  getErrorsByDomain,
  isKnownErrorCode,
  type ErrorCatalogEntry,
  type ErrorDomain,
} from './catalog.js';

// Re-export formatter
export {
  extractErrorLocation,
  formatError,
  formatErrorForApi,
  formatErrorOneLine,
  logDeprecation,
  logError,
  logWarning,
  type ErrorLocation,
  type FormatErrorOptions,
} from './formatter.js';
