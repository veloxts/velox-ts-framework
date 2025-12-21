/**
 * Exception Template
 *
 * Generates custom error class files for VeloxTS applications.
 */

import type { ProjectContext, TemplateContext, TemplateFunction } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface ExceptionOptions {
  /** Generate HTTP exception */
  http: boolean;
  /** Generate validation exception */
  validation: boolean;
  /** Generate domain exception */
  domain: boolean;
  /** Include error code enum */
  codes: boolean;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the path for an exception file
 */
export function getExceptionPath(entityName: string, _project: ProjectContext): string {
  return `src/exceptions/${entityName.toLowerCase()}.ts`;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate HTTP exception
 */
function generateHttpException(ctx: TemplateContext<ExceptionOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} HTTP Exception
 *
 * HTTP-aware exceptions for ${entity.humanReadable} errors.
 */

// ============================================================================
// Base HTTP Exception
// ============================================================================

/**
 * Base HTTP exception with status code and body
 */
export class HttpException extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'HttpException';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to HTTP response body
   */
  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code ?? 'HTTP_ERROR',
        message: this.message,
        statusCode: this.statusCode,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

// ============================================================================
// ${entity.pascal} Exceptions
// ============================================================================

/**
 * ${entity.pascal} not found (404)
 */
export class ${entity.pascal}NotFoundException extends HttpException {
  constructor(id?: string) {
    super(
      404,
      id ? \`${entity.pascal} not found: \${id}\` : '${entity.pascal} not found',
      '${entity.screamingSnake}_NOT_FOUND'
    );
    this.name = '${entity.pascal}NotFoundException';
  }
}

/**
 * ${entity.pascal} already exists (409)
 */
export class ${entity.pascal}ConflictException extends HttpException {
  constructor(field?: string, value?: string) {
    super(
      409,
      field
        ? \`${entity.pascal} with \${field} "\${value}" already exists\`
        : '${entity.pascal} already exists',
      '${entity.screamingSnake}_CONFLICT',
      field ? { field, value } : undefined
    );
    this.name = '${entity.pascal}ConflictException';
  }
}

/**
 * ${entity.pascal} forbidden (403)
 */
export class ${entity.pascal}ForbiddenException extends HttpException {
  constructor(action?: string) {
    super(
      403,
      action
        ? \`You are not allowed to \${action} this ${entity.humanReadable}\`
        : 'Access to ${entity.humanReadable} forbidden',
      '${entity.screamingSnake}_FORBIDDEN',
      action ? { action } : undefined
    );
    this.name = '${entity.pascal}ForbiddenException';
  }
}

/**
 * ${entity.pascal} bad request (400)
 */
export class ${entity.pascal}BadRequestException extends HttpException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, message, '${entity.screamingSnake}_BAD_REQUEST', details);
    this.name = '${entity.pascal}BadRequestException';
  }
}

/**
 * ${entity.pascal} unprocessable (422)
 */
export class ${entity.pascal}UnprocessableException extends HttpException {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      422,
      \`Cannot process ${entity.humanReadable}: \${reason}\`,
      '${entity.screamingSnake}_UNPROCESSABLE',
      details
    );
    this.name = '${entity.pascal}UnprocessableException';
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if error is an HTTP exception
 */
export function isHttpException(error: unknown): error is HttpException {
  return error instanceof HttpException;
}

/**
 * Check if error is a ${entity.pascal} exception
 */
export function is${entity.pascal}Exception(error: unknown): error is HttpException {
  return (
    error instanceof ${entity.pascal}NotFoundException ||
    error instanceof ${entity.pascal}ConflictException ||
    error instanceof ${entity.pascal}ForbiddenException ||
    error instanceof ${entity.pascal}BadRequestException ||
    error instanceof ${entity.pascal}UnprocessableException
  );
}
`;
}

/**
 * Generate validation exception
 */
function generateValidationException(ctx: TemplateContext<ExceptionOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Validation Exception
 *
 * Validation-focused exceptions for ${entity.humanReadable} operations.
 */

// ============================================================================
// Types
// ============================================================================

export interface FieldError {
  field: string;
  message: string;
  code?: string;
  value?: unknown;
}

export interface ValidationIssue {
  path: string[];
  message: string;
  code: string;
}

// ============================================================================
// Validation Exception
// ============================================================================

/**
 * ${entity.pascal} validation exception
 *
 * Collects multiple field errors for form validation feedback.
 */
export class ${entity.pascal}ValidationException extends Error {
  public readonly errors: FieldError[];

  constructor(errors: FieldError[] | string) {
    const errorList = typeof errors === 'string' ? [{ field: '_root', message: errors }] : errors;
    super(\`${entity.pascal} validation failed: \${errorList.map((e) => e.message).join(', ')}\`);
    this.name = '${entity.pascal}ValidationException';
    this.errors = errorList;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create from Zod error
   */
  static fromZodError(zodError: { issues: ValidationIssue[] }): ${entity.pascal}ValidationException {
    const errors: FieldError[] = zodError.issues.map((issue) => ({
      field: issue.path.join('.') || '_root',
      message: issue.message,
      code: issue.code,
    }));
    return new ${entity.pascal}ValidationException(errors);
  }

  /**
   * Get errors for a specific field
   */
  getFieldErrors(field: string): FieldError[] {
    return this.errors.filter((e) => e.field === field);
  }

  /**
   * Check if field has errors
   */
  hasFieldError(field: string): boolean {
    return this.errors.some((e) => e.field === field);
  }

  /**
   * Convert to response format
   */
  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: '${entity.screamingSnake}_VALIDATION_FAILED',
        message: 'Validation failed',
        errors: this.errors,
      },
    };
  }

  /**
   * Convert to field-keyed object for forms
   */
  toFieldErrors(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const error of this.errors) {
      if (!result[error.field]) {
        result[error.field] = [];
      }
      result[error.field].push(error.message);
    }
    return result;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create validation exception for required field
 */
export function ${entity.camel}Required(field: string): ${entity.pascal}ValidationException {
  return new ${entity.pascal}ValidationException([
    { field, message: \`\${field} is required\`, code: 'required' },
  ]);
}

/**
 * Create validation exception for invalid format
 */
export function ${entity.camel}InvalidFormat(
  field: string,
  expected: string
): ${entity.pascal}ValidationException {
  return new ${entity.pascal}ValidationException([
    { field, message: \`\${field} must be a valid \${expected}\`, code: 'invalid_format' },
  ]);
}

/**
 * Create validation exception for value out of range
 */
export function ${entity.camel}OutOfRange(
  field: string,
  min?: number,
  max?: number
): ${entity.pascal}ValidationException {
  let message = \`\${field} is out of range\`;
  if (min !== undefined && max !== undefined) {
    message = \`\${field} must be between \${min} and \${max}\`;
  } else if (min !== undefined) {
    message = \`\${field} must be at least \${min}\`;
  } else if (max !== undefined) {
    message = \`\${field} must be at most \${max}\`;
  }
  return new ${entity.pascal}ValidationException([{ field, message, code: 'out_of_range' }]);
}

// ============================================================================
// Type Guard
// ============================================================================

/**
 * Check if error is a validation exception
 */
export function is${entity.pascal}ValidationException(
  error: unknown
): error is ${entity.pascal}ValidationException {
  return error instanceof ${entity.pascal}ValidationException;
}
`;
}

/**
 * Generate domain exception
 */
function generateDomainException(ctx: TemplateContext<ExceptionOptions>): string {
  const { entity, options } = ctx;

  const errorCodes = options.codes
    ? `
// ============================================================================
// Error Codes
// ============================================================================

/**
 * ${entity.pascal} error codes
 */
export const ${entity.pascal}ErrorCode = {
  NOT_FOUND: '${entity.screamingSnake}_NOT_FOUND',
  ALREADY_EXISTS: '${entity.screamingSnake}_ALREADY_EXISTS',
  INVALID_STATE: '${entity.screamingSnake}_INVALID_STATE',
  LIMIT_EXCEEDED: '${entity.screamingSnake}_LIMIT_EXCEEDED',
  EXPIRED: '${entity.screamingSnake}_EXPIRED',
  LOCKED: '${entity.screamingSnake}_LOCKED',
  DEPENDENCY_FAILED: '${entity.screamingSnake}_DEPENDENCY_FAILED',
} as const;

export type ${entity.pascal}ErrorCodeType = (typeof ${entity.pascal}ErrorCode)[keyof typeof ${entity.pascal}ErrorCode];

`
    : '';

  const codeParam = options.codes ? `${entity.pascal}ErrorCodeType` : 'string';
  const codeDefault = options.codes
    ? `${entity.pascal}ErrorCode.NOT_FOUND`
    : `'${entity.screamingSnake}_ERROR'`;

  return `/**
 * ${entity.pascal} Domain Exception
 *
 * Domain-specific exceptions for ${entity.humanReadable} business logic.
 */
${errorCodes}
// ============================================================================
// Base Domain Exception
// ============================================================================

/**
 * ${entity.pascal} domain exception
 *
 * Base class for all ${entity.humanReadable}-related domain errors.
 */
export class ${entity.pascal}Exception extends Error {
  constructor(
    message: string,
    public readonly code: ${codeParam} = ${codeDefault},
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = '${entity.pascal}Exception';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.metadata && { metadata: this.metadata }),
    };
  }
}

// ============================================================================
// Specific Exceptions
// ============================================================================

/**
 * ${entity.pascal} not found
 */
export class ${entity.pascal}NotFoundException extends ${entity.pascal}Exception {
  constructor(identifier?: string | Record<string, unknown>) {
    const message =
      typeof identifier === 'string'
        ? \`${entity.pascal} not found: \${identifier}\`
        : '${entity.pascal} not found';
    super(
      message,
      ${options.codes ? `${entity.pascal}ErrorCode.NOT_FOUND` : `'${entity.screamingSnake}_NOT_FOUND'`},
      typeof identifier === 'object' ? identifier : identifier ? { id: identifier } : undefined
    );
    this.name = '${entity.pascal}NotFoundException';
  }
}

/**
 * ${entity.pascal} already exists
 */
export class ${entity.pascal}AlreadyExistsException extends ${entity.pascal}Exception {
  constructor(field: string, value: unknown) {
    super(
      \`${entity.pascal} with \${field} "\${value}" already exists\`,
      ${options.codes ? `${entity.pascal}ErrorCode.ALREADY_EXISTS` : `'${entity.screamingSnake}_ALREADY_EXISTS'`},
      { field, value }
    );
    this.name = '${entity.pascal}AlreadyExistsException';
  }
}

/**
 * ${entity.pascal} in invalid state
 */
export class ${entity.pascal}InvalidStateException extends ${entity.pascal}Exception {
  constructor(currentState: string, requiredState: string | string[], action?: string) {
    const required = Array.isArray(requiredState) ? requiredState.join(' or ') : requiredState;
    const actionText = action ? \` to \${action}\` : '';
    super(
      \`${entity.pascal} must be in \${required} state\${actionText}, but is \${currentState}\`,
      ${options.codes ? `${entity.pascal}ErrorCode.INVALID_STATE` : `'${entity.screamingSnake}_INVALID_STATE'`},
      { currentState, requiredState, action }
    );
    this.name = '${entity.pascal}InvalidStateException';
  }
}

/**
 * ${entity.pascal} limit exceeded
 */
export class ${entity.pascal}LimitExceededException extends ${entity.pascal}Exception {
  constructor(limit: number, current: number, resource?: string) {
    const resourceText = resource ? \` for \${resource}\` : '';
    super(
      \`${entity.pascal} limit exceeded\${resourceText}: \${current}/\${limit}\`,
      ${options.codes ? `${entity.pascal}ErrorCode.LIMIT_EXCEEDED` : `'${entity.screamingSnake}_LIMIT_EXCEEDED'`},
      { limit, current, resource }
    );
    this.name = '${entity.pascal}LimitExceededException';
  }
}

/**
 * ${entity.pascal} expired
 */
export class ${entity.pascal}ExpiredException extends ${entity.pascal}Exception {
  constructor(expiredAt?: Date) {
    super(
      expiredAt
        ? \`${entity.pascal} expired at \${expiredAt.toISOString()}\`
        : '${entity.pascal} has expired',
      ${options.codes ? `${entity.pascal}ErrorCode.EXPIRED` : `'${entity.screamingSnake}_EXPIRED'`},
      expiredAt ? { expiredAt: expiredAt.toISOString() } : undefined
    );
    this.name = '${entity.pascal}ExpiredException';
  }
}

// ============================================================================
// Type Guard
// ============================================================================

/**
 * Check if error is a ${entity.pascal} exception
 */
export function is${entity.pascal}Exception(error: unknown): error is ${entity.pascal}Exception {
  return error instanceof ${entity.pascal}Exception;
}

/**
 * Assert condition or throw ${entity.pascal} exception
 */
export function assert${entity.pascal}(
  condition: boolean,
  message: string,
  code?: ${codeParam}
): asserts condition {
  if (!condition) {
    throw new ${entity.pascal}Exception(message, code);
  }
}
`;
}

/**
 * Generate simple exception template
 */
function generateSimpleException(ctx: TemplateContext<ExceptionOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Exception
 *
 * Custom exception for ${entity.humanReadable} errors.
 */

// ============================================================================
// Exception Class
// ============================================================================

/**
 * ${entity.pascal} exception
 *
 * Thrown when ${entity.humanReadable} operations fail.
 *
 * @example
 * throw new ${entity.pascal}Exception('Operation failed', 'OPERATION_FAILED');
 */
export class ${entity.pascal}Exception extends Error {
  constructor(
    message: string,
    public readonly code: string = '${entity.screamingSnake}_ERROR',
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = '${entity.pascal}Exception';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      error: {
        name: this.name,
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }

  /**
   * Create a new exception with additional details
   */
  withDetails(details: Record<string, unknown>): ${entity.pascal}Exception {
    return new ${entity.pascal}Exception(this.message, this.code, {
      ...this.details,
      ...details,
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create ${entity.humanReadable} not found exception
 */
export function ${entity.camel}NotFound(id?: string): ${entity.pascal}Exception {
  return new ${entity.pascal}Exception(
    id ? \`${entity.pascal} not found: \${id}\` : '${entity.pascal} not found',
    '${entity.screamingSnake}_NOT_FOUND',
    id ? { id } : undefined
  );
}

/**
 * Create ${entity.humanReadable} invalid exception
 */
export function ${entity.camel}Invalid(reason: string): ${entity.pascal}Exception {
  return new ${entity.pascal}Exception(
    \`Invalid ${entity.humanReadable}: \${reason}\`,
    '${entity.screamingSnake}_INVALID',
    { reason }
  );
}

/**
 * Create ${entity.humanReadable} unauthorized exception
 */
export function ${entity.camel}Unauthorized(action?: string): ${entity.pascal}Exception {
  return new ${entity.pascal}Exception(
    action
      ? \`Not authorized to \${action} ${entity.humanReadable}\`
      : 'Not authorized to access ${entity.humanReadable}',
    '${entity.screamingSnake}_UNAUTHORIZED',
    action ? { action } : undefined
  );
}

// ============================================================================
// Type Guard
// ============================================================================

/**
 * Check if error is a ${entity.pascal} exception
 */
export function is${entity.pascal}Exception(error: unknown): error is ${entity.pascal}Exception {
  return error instanceof ${entity.pascal}Exception;
}

/**
 * Wrap any error as ${entity.pascal} exception
 */
export function wrap${entity.pascal}Exception(
  error: unknown,
  defaultMessage = '${entity.pascal} operation failed'
): ${entity.pascal}Exception {
  if (is${entity.pascal}Exception(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : defaultMessage;
  return new ${entity.pascal}Exception(message, '${entity.screamingSnake}_ERROR', {
    originalError: error instanceof Error ? error.name : typeof error,
  });
}
`;
}

// ============================================================================
// Main Template
// ============================================================================

/**
 * Exception template function
 */
export const exceptionTemplate: TemplateFunction<ExceptionOptions> = (ctx) => {
  if (ctx.options.http) {
    return generateHttpException(ctx);
  }
  if (ctx.options.validation) {
    return generateValidationException(ctx);
  }
  if (ctx.options.domain) {
    return generateDomainException(ctx);
  }
  return generateSimpleException(ctx);
};

// ============================================================================
// Post-generation Instructions
// ============================================================================

export function getExceptionInstructions(entityName: string, options: ExceptionOptions): string {
  const lines = [`Your ${entityName} exception has been created.`, '', 'Next steps:'];

  lines.push('  1. Import and throw in your services/procedures:');
  lines.push(`     import { ${entityName}Exception } from '@/exceptions/${entityName.toLowerCase()}';`);
  lines.push(`     throw new ${entityName}Exception('Something went wrong');`);

  if (options.http) {
    lines.push('  2. Handle in your error middleware to set HTTP status');
  } else if (options.validation) {
    lines.push('  2. Use with Zod: throw ValidationException.fromZodError(error)');
  } else if (options.domain) {
    lines.push('  2. Add more domain-specific exception subclasses as needed');
  }

  if (options.codes) {
    lines.push('  3. Add more error codes to the ErrorCode enum');
  }

  return lines.join('\n');
}
