/**
 * Action Type Definitions (Browser-Safe)
 *
 * These types are safe to import in both client and server contexts.
 * They contain no server-only imports or dependencies.
 *
 * @module @veloxts/web/types/actions
 */

/**
 * Result of a successful action.
 * @public
 */
export interface ActionSuccess<T> {
  success: true;
  data: T;
}

/**
 * Standard action error codes.
 * @public
 */
export type ActionErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST'
  | 'RATE_LIMITED';

/**
 * Result of a failed action.
 * @public
 */
export interface ActionError {
  success: false;
  error: {
    code: ActionErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Union type for action results.
 * Use discriminated union pattern: `if (result.success) { ... }`.
 * @public
 */
export type ActionResult<T> = ActionSuccess<T> | ActionError;
