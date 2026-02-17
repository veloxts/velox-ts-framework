/**
 * @veloxts/orm - Prisma Error Wrapper Tests
 */

import { ConflictError, NotFoundError, ValidationError } from '@veloxts/core';
import { describe, expect, it } from 'vitest';

import { db, handlePrismaError } from '../prisma-errors.js';

/** Helper to create a fake PrismaClientKnownRequestError */
function createPrismaError(
  code: string,
  meta?: Record<string, unknown>
): Error & { code: string; meta?: Record<string, unknown> } {
  const error = new Error(`Prisma error ${code}`) as Error & {
    code: string;
    meta?: Record<string, unknown>;
  };
  error.name = 'PrismaClientKnownRequestError';
  error.code = code;
  error.meta = meta;
  return error;
}

describe('handlePrismaError', () => {
  it('should convert P2002 to ConflictError with fields', () => {
    const prismaError = createPrismaError('P2002', { target: ['email'] });

    expect(() => handlePrismaError(prismaError)).toThrow(ConflictError);

    try {
      handlePrismaError(prismaError);
    } catch (error) {
      const conflict = error as ConflictError;
      expect(conflict.statusCode).toBe(409);
      expect(conflict.message).toBe('A record with this email already exists');
      expect(conflict.fields).toEqual(['email']);
    }
  });

  it('should convert P2002 with multiple fields', () => {
    const prismaError = createPrismaError('P2002', { target: ['email', 'username'] });

    try {
      handlePrismaError(prismaError);
    } catch (error) {
      const conflict = error as ConflictError;
      expect(conflict.message).toBe('A record with this email, username already exists');
      expect(conflict.fields).toEqual(['email', 'username']);
    }
  });

  it('should convert P2002 without target fields', () => {
    const prismaError = createPrismaError('P2002', {});

    try {
      handlePrismaError(prismaError);
    } catch (error) {
      const conflict = error as ConflictError;
      expect(conflict.message).toBe('A record with this field already exists');
      expect(conflict.fields).toBeUndefined();
    }
  });

  it('should convert P2001 to NotFoundError', () => {
    const prismaError = createPrismaError('P2001', { modelName: 'User' });

    expect(() => handlePrismaError(prismaError)).toThrow(NotFoundError);

    try {
      handlePrismaError(prismaError);
    } catch (error) {
      const notFound = error as NotFoundError;
      expect(notFound.statusCode).toBe(404);
      expect(notFound.resource).toBe('User');
    }
  });

  it('should convert P2018 to NotFoundError', () => {
    const prismaError = createPrismaError('P2018', { modelName: 'Post' });

    expect(() => handlePrismaError(prismaError)).toThrow(NotFoundError);
  });

  it('should convert P2025 to NotFoundError', () => {
    const prismaError = createPrismaError('P2025', { cause: 'Record to update not found.' });

    try {
      handlePrismaError(prismaError);
    } catch (error) {
      const notFound = error as NotFoundError;
      expect(notFound.resource).toBe('Record to update not found.');
    }
  });

  it('should convert P2025 without meta to NotFoundError with default resource', () => {
    const prismaError = createPrismaError('P2025', {});

    try {
      handlePrismaError(prismaError);
    } catch (error) {
      const notFound = error as NotFoundError;
      expect(notFound.resource).toBe('Record');
    }
  });

  it('should convert P2003 to ValidationError', () => {
    const prismaError = createPrismaError('P2003', { field_name: 'authorId' });

    expect(() => handlePrismaError(prismaError)).toThrow(ValidationError);

    try {
      handlePrismaError(prismaError);
    } catch (error) {
      const validation = error as ValidationError;
      expect(validation.statusCode).toBe(400);
      expect(validation.message).toBe('Related record not found for authorId');
      expect(validation.fields).toEqual({ authorId: 'Related record not found' });
    }
  });

  it('should rethrow unknown Prisma error codes', () => {
    const prismaError = createPrismaError('P9999', {});

    expect(() => handlePrismaError(prismaError)).toThrow(prismaError);
  });

  it('should rethrow non-Prisma errors', () => {
    const error = new Error('random failure');

    expect(() => handlePrismaError(error)).toThrow(error);
  });

  it('should rethrow non-Error values', () => {
    expect(() => handlePrismaError('string error')).toThrow('string error');
  });
});

describe('db', () => {
  it('should return result on success', async () => {
    const result = await db(() => Promise.resolve({ id: '1', name: 'Alice' }));

    expect(result).toEqual({ id: '1', name: 'Alice' });
  });

  it('should convert P2002 to ConflictError', async () => {
    const prismaError = createPrismaError('P2002', { target: ['email'] });

    await expect(db(() => Promise.reject(prismaError))).rejects.toThrow(ConflictError);
  });

  it('should convert P2025 to NotFoundError', async () => {
    const prismaError = createPrismaError('P2025', { modelName: 'User' });

    await expect(db(() => Promise.reject(prismaError))).rejects.toThrow(NotFoundError);
  });

  it('should convert P2003 to ValidationError', async () => {
    const prismaError = createPrismaError('P2003', { field_name: 'postId' });

    await expect(db(() => Promise.reject(prismaError))).rejects.toThrow(ValidationError);
  });

  it('should rethrow non-Prisma errors', async () => {
    const error = new Error('connection lost');

    await expect(db(() => Promise.reject(error))).rejects.toThrow('connection lost');
  });
});
