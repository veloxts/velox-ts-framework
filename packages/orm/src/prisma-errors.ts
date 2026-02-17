/**
 * Prisma Error Wrapper
 *
 * Converts Prisma-specific errors to VeloxTS error classes,
 * providing consistent, domain-specific error messages.
 *
 * @module prisma-errors
 */

import { ConflictError, NotFoundError, ValidationError } from '@veloxts/core';

/**
 * Shape of a Prisma known request error (without importing Prisma types)
 */
interface PrismaKnownRequestError {
  name: string;
  code: string;
  meta?: {
    target?: string[];
    modelName?: string;
    cause?: string;
    field_name?: string;
  };
  message: string;
}

function isPrismaKnownRequestError(error: unknown): error is PrismaKnownRequestError {
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    'code' in error &&
    typeof (error as PrismaKnownRequestError).code === 'string'
  );
}

/**
 * Convert a Prisma error to a VeloxTS error.
 *
 * Handles:
 * - P2002 (Unique constraint) → ConflictError
 * - P2001 / P2018 / P2025 (Record not found) → NotFoundError
 * - P2003 (Foreign key constraint) → ValidationError
 *
 * Throws the original error if it is not a known Prisma error code.
 *
 * @param error - The caught error
 * @throws A VeloxTS error or the original error if not a Prisma error
 */
export function handlePrismaError(error: unknown): never {
  if (!isPrismaKnownRequestError(error)) {
    throw error;
  }

  switch (error.code) {
    case 'P2002': {
      const fields = error.meta?.target ?? [];
      const fieldNames = fields.length > 0 ? fields.join(', ') : 'field';
      throw new ConflictError(
        `A record with this ${fieldNames} already exists`,
        fields.length > 0 ? fields : undefined
      );
    }

    case 'P2001':
    case 'P2018':
    case 'P2025': {
      const model = error.meta?.modelName ?? error.meta?.cause ?? 'Record';
      throw new NotFoundError(model);
    }

    case 'P2003': {
      const field = error.meta?.field_name ?? 'field';
      throw new ValidationError(`Related record not found for ${field}`, {
        [field]: 'Related record not found',
      });
    }

    default:
      throw error;
  }
}

/**
 * Wraps a Prisma operation, converting known errors to VeloxTS errors.
 *
 * @param operation - An async function performing a Prisma query
 * @returns The result of the operation
 * @throws ConflictError, NotFoundError, ValidationError, or the original error
 *
 * @example
 * ```typescript
 * import { db } from '@veloxts/orm';
 *
 * // Instead of manual try/catch for P2002, P2025, etc.:
 * const user = await db(() => prisma.user.create({ data: input }));
 * // P2002 → ConflictError("A record with this email already exists", ["email"])
 * // P2025 → NotFoundError("User")
 * ```
 */
export async function db<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    handlePrismaError(error);
  }
}
