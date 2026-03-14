/**
 * Domain error base class for business logic errors
 *
 * Provides a typed, abstract error class that user-land code extends to define
 * domain-specific error types with structured data payloads. Extends VeloxError
 * so Fastify's error handler can serialize them automatically.
 *
 * @example
 * ```typescript
 * class InsufficientStock extends DomainError<{ sku: string; requested: number; available: number }> {
 *   readonly code = 'INSUFFICIENT_STOCK' as const;
 *   readonly status = 422;
 *   readonly message = 'Not enough inventory';
 * }
 *
 * throw new InsufficientStock({ sku: 'ABC-123', requested: 10, available: 3 });
 * ```
 *
 * @module errors/domain-error
 */

import { VeloxError } from '../errors.js';

/**
 * Branded symbol for cross-package type guard checks.
 * Uses `Symbol.for` so the same symbol is shared across package boundaries.
 */
const DOMAIN_ERROR_BRAND = Symbol.for('velox.domain-error');

/**
 * JSON representation of a domain error for API responses.
 */
export interface DomainErrorJSON {
  /** Error class name (e.g. "InsufficientStock") */
  error: string;
  /** Human-readable error message */
  message: string;
  /** HTTP status code */
  statusCode: number;
  /** Machine-readable error code (e.g. "INSUFFICIENT_STOCK") */
  code: string;
  /** Structured error data payload */
  data: Record<string, unknown>;
}

/**
 * Abstract base class for domain-specific business logic errors.
 *
 * Subclasses declare `code`, `status`, and `message` as readonly class fields.
 * The constructor accepts only the typed `data` payload.
 *
 * @template TData - Shape of the structured data payload
 */
export abstract class DomainError<TData extends Record<string, unknown>> extends VeloxError {
  /**
   * Machine-readable error code (e.g. "INSUFFICIENT_STOCK").
   * Defined by each concrete subclass.
   */
  abstract override readonly code: string;

  /**
   * HTTP status code for this domain error.
   * Defined by each concrete subclass (e.g. 422, 403).
   */
  abstract readonly status: number;

  /**
   * Human-readable error message.
   * Defined by each concrete subclass as a readonly class field.
   */
  abstract override readonly message: string;

  /**
   * Structured data payload describing the error context.
   */
  readonly data: TData;

  /**
   * Brand marker for cross-package `isDomainError()` checks.
   * @internal
   */
  readonly [DOMAIN_ERROR_BRAND] = true as const;

  /**
   * Creates a new DomainError instance.
   *
   * @param data - Typed data payload for the error
   */
  constructor(data: TData) {
    // Pass placeholder values; subclass field initializers override them after super returns.
    super('', 0);
    this.data = data;

    // Defer property synchronisation to a microtask-free post-init trick:
    // We redefine `statusCode` as a getter so it always reflects the subclass's
    // `status` field, which is set by the subclass's field initializers AFTER
    // this constructor returns.
    Object.defineProperty(this, 'statusCode', {
      get(this: DomainError<TData>) {
        return this.status;
      },
      enumerable: true,
      configurable: true,
    });

    // `name` should reflect the concrete subclass for stack traces and toJSON().
    // Subclass field initializers haven't run yet, so we read from the constructor.
    this.name = this.constructor.name;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Converts domain error to JSON format for API responses.
   * Includes `code` and `data` alongside the standard VeloxError fields.
   */
  override toJSON(): DomainErrorJSON {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      data: this.data,
    };
  }
}

/**
 * Type guard to check whether an unknown value is a DomainError.
 *
 * Uses a branded symbol (`Symbol.for('velox.domain-error')`) so the check
 * works across package boundaries even when multiple copies of `@veloxts/core`
 * are installed.
 *
 * @param value - Value to check
 * @returns `true` if `value` is a DomainError instance
 */
export function isDomainError(value: unknown): value is DomainError<Record<string, unknown>> {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  return (value as Record<symbol, unknown>)[DOMAIN_ERROR_BRAND] === true;
}
