/**
 * @veloxts/client - Type-safe API client for frontend applications
 *
 * Provides a fully typed client for consuming VeloxTS APIs from frontend code.
 * Types are inferred directly from backend procedure definitions without code generation.
 *
 * @example
 * ```typescript
 * // Import procedure types from backend
 * import type { userProcedures } from '../server/procedures';
 *
 * // Create client with full type safety
 * const api = createClient<{ users: typeof userProcedures }>({
 *   baseUrl: '/api'
 * });
 *
 * // Fully typed API calls
 * const user = await api.users.getUser({ id: '123' });
 * ```
 *
 * @module @veloxts/client
 */

// ============================================================================
// Core Client
// ============================================================================

export { createClient } from './client.js';

// ============================================================================
// Type Utilities
// ============================================================================

// Re-export procedure types for convenience
export type {
  ClientConfig,
  ClientError,
  ClientFromCollection,
  ClientFromRouter,
  ClientProcedure,
  HttpMethod,
  InferProcedureInput,
  InferProcedureOutput,
  ProcedureCall,
  ProcedureCollection,
  ProcedureRecord,
} from './types.js';

// ============================================================================
// Error Classes
// ============================================================================

export {
  ClientNotFoundError,
  ClientValidationError,
  NetworkError,
  ServerError,
  VeloxClientError,
} from './errors.js';

// ============================================================================
// Type Guards
// ============================================================================

export {
  isClientNotFoundError,
  isClientValidationError,
  isNetworkError,
  isNotFoundErrorResponse,
  isServerError,
  isValidationErrorResponse,
  isVeloxClientError,
} from './errors.js';

// ============================================================================
// Error Response Types
// ============================================================================

export type { ErrorResponse } from './errors.js';

// ============================================================================
// Version
// ============================================================================

import { createRequire } from 'node:module';

// Read version from package.json dynamically
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

/** Client package version */
export const CLIENT_VERSION: string = packageJson.version ?? '0.0.0-unknown';
