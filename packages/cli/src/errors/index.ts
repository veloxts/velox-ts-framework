/**
 * VeloxTS Error System
 *
 * Central error handling for the CLI with structured error codes,
 * fix suggestions, and JSON serialization for AI tooling.
 *
 * @example
 * ```typescript
 * import { VeloxError, ERROR_CATALOG } from './errors/index.js';
 *
 * // Throw a structured error
 * throw new VeloxError('E2001');
 *
 * // Use factory methods
 * throw VeloxError.notFound('User', '123');
 *
 * // Format for display
 * console.error(error.format());
 *
 * // Serialize for --json output
 * console.log(JSON.stringify({ error: error.toJSON() }));
 * ```
 */

// Error catalog and definitions
export {
  ERROR_CATALOG,
  getErrorDefinition,
  getErrorsByCategory,
  isValidErrorCode,
  type ErrorDefinition,
} from './catalog.js';

// Base error class
export { VeloxError, type ErrorLocation, type VeloxErrorOptions } from './velox-error.js';
