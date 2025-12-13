/**
 * Elegant Error Creation API
 *
 * Laravel-inspired `fail()` function for throwing catalog-driven errors
 * with minimal ceremony and maximum helpfulness.
 *
 * @module errors/fail
 *
 * @example
 * ```typescript
 * // Zero ceremony - catalog provides everything
 * throw fail('VELOX-2006');
 *
 * // With interpolation variables
 * throw fail('VELOX-3005', { length: 12, required: 32 });
 *
 * // Override message with context
 * throw fail('VELOX-3005').because('Secret has weak entropy');
 *
 * // Full fluent customization
 * throw fail('VELOX-3005')
 *   .because('Your secret has only ${unique} unique characters')
 *   .with({ unique: 8 })
 *   .suggest('Use: openssl rand -base64 32');
 * ```
 */

import { ERROR_CATALOG, type ErrorCatalogEntry } from './catalog.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Valid error codes from the catalog
 */
export type ErrorCode = keyof typeof ERROR_CATALOG;

/**
 * Variables for template interpolation
 */
export type InterpolationVars = Record<string, string | number | boolean | undefined>;

// ============================================================================
// VeloxFailure Class
// ============================================================================

/**
 * Fluent error builder that provides catalog-driven errors
 * with optional customization.
 *
 * This class is not typically instantiated directly.
 * Use the `fail()` function instead.
 */
export class VeloxFailure extends Error {
  /** The catalog error code */
  readonly code: string;

  /** HTTP status code */
  readonly statusCode: number;

  /** The full catalog entry */
  readonly entry: ErrorCatalogEntry;

  /** Custom message override */
  private _customMessage?: string;

  /** Interpolation variables */
  private _vars: InterpolationVars = {};

  /** Custom suggestion override */
  private _customSuggestion?: string;

  constructor(code: string, entry: ErrorCatalogEntry) {
    super(entry.title);
    this.name = 'VeloxError';
    this.code = code;
    this.statusCode = entry.statusCode;
    this.entry = entry;

    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VeloxFailure);
    }
  }

  /**
   * Override the catalog message with context-specific details
   *
   * @param message - Custom message (supports ${var} interpolation)
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * throw fail('VELOX-3005').because('Secret "${name}" is too weak');
   * ```
   */
  because(message: string): this {
    this._customMessage = message;
    this.updateMessage();
    return this;
  }

  /**
   * Provide variables for template interpolation
   *
   * @param vars - Object with values to interpolate into the message
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * throw fail('VELOX-3005', { length: 12 });
   * // Or chained
   * throw fail('VELOX-3005').with({ length: 12, required: 32 });
   * ```
   */
  with(vars: InterpolationVars): this {
    this._vars = { ...this._vars, ...vars };
    this.updateMessage();
    return this;
  }

  /**
   * Override the catalog fix suggestion
   *
   * @param suggestion - Custom suggestion for fixing the error
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * throw fail('VELOX-3005').suggest('Use environment variable SESSION_SECRET');
   * ```
   */
  suggest(suggestion: string): this {
    this._customSuggestion = suggestion;
    return this;
  }

  /**
   * Get the fix suggestion (custom or from catalog)
   */
  get suggestion(): string | undefined {
    return this._customSuggestion ?? this.entry.fix?.suggestion;
  }

  /**
   * Get the code example from catalog
   */
  get example(): string | undefined {
    return this.entry.fix?.example;
  }

  /**
   * Get the documentation URL
   */
  get docsUrl(): string | undefined {
    return this.entry.docsUrl;
  }

  /**
   * Get related error codes
   */
  get seeAlso(): string[] | undefined {
    return this.entry.seeAlso;
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): {
    error: string;
    message: string;
    statusCode: number;
    code: string;
    fix?: string;
    docs?: string;
  } {
    const json: {
      error: string;
      message: string;
      statusCode: number;
      code: string;
      fix?: string;
      docs?: string;
    } = {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
    };

    // Include fix in development
    if (process.env.NODE_ENV !== 'production' && this.suggestion) {
      json.fix = this.suggestion;
    }

    // Always include docs URL
    if (this.docsUrl) {
      json.docs = this.docsUrl;
    }

    return json;
  }

  /**
   * Interpolate variables into a template string
   */
  private interpolate(template: string): string {
    return template.replace(/\$\{(\w+)\}/g, (_, key) => {
      const value = this._vars[key];
      return value !== undefined ? String(value) : `\${${key}}`;
    });
  }

  /**
   * Update the error message with interpolation
   */
  private updateMessage(): void {
    const template = this._customMessage ?? this.entry.description;
    this.message = this.interpolate(template);
  }
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Create and throw a catalog-driven error with zero ceremony
 *
 * This is the recommended way to throw errors in VeloxTS.
 * The catalog provides the message, suggestion, and documentation.
 *
 * @param code - Error code from the catalog (e.g., 'VELOX-2006')
 * @param vars - Optional interpolation variables
 * @returns VeloxFailure instance (throw it!)
 *
 * @example
 * ```typescript
 * // Simplest usage - one line, zero boilerplate
 * throw fail('VELOX-2006');
 *
 * // With template variables
 * throw fail('VELOX-3005', { length: 12, required: 32 });
 *
 * // Fluent customization when needed
 * throw fail('VELOX-3005')
 *   .because('Secret "${name}" has insufficient entropy')
 *   .with({ name: 'SESSION_SECRET' })
 *   .suggest('Generate with: openssl rand -base64 32');
 * ```
 */
export function fail(code: string, vars?: InterpolationVars): VeloxFailure {
  const entry = ERROR_CATALOG[code];

  if (!entry) {
    // Unknown code - create a helpful error about the unknown code
    throw new Error(
      `Unknown error code: ${code}. ` +
        'Check ERROR_CATALOG in @veloxts/core for valid codes, ' +
        'or add a new entry for this error.'
    );
  }

  const error = new VeloxFailure(code, entry);

  if (vars) {
    error.with(vars);
  }

  return error;
}

// ============================================================================
// Type Guard
// ============================================================================

/**
 * Check if an error is a VeloxFailure from fail()
 *
 * @param error - Error to check
 * @returns true if error is a VeloxFailure
 */
export function isVeloxFailure(error: unknown): error is VeloxFailure {
  return error instanceof VeloxFailure;
}
