/**
 * @veloxts/validation - Schema Tests
 * Tests common schemas, pagination utilities, and schema composition helpers
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  baseEntitySchema,
  booleanStringSchema,
  createIdSchema,
  datetimeSchema,
  emailSchema,
  idParamSchema,
  integerStringSchema,
  makePartial,
  nonEmptyStringSchema,
  numberStringSchema,
  omitFields,
  partialExcept,
  pickFields,
  timestampFieldsSchema,
  urlSchema,
  uuidSchema,
} from '../schemas/common.js';
import {
  calculateOffset,
  calculatePaginationMeta,
  createCursorPaginatedResponseSchema,
  createPaginatedResponse,
  createPaginatedResponseSchema,
  createPaginationSchema,
  cursorPaginationSchema,
  PAGINATION_DEFAULTS,
  paginationInputSchema,
} from '../schemas/pagination.js';

describe('Common String Schemas', () => {
  describe('uuidSchema', () => {
    it('should accept valid UUIDs', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '00000000-0000-0000-0000-000000000000',
      ];

      validUUIDs.forEach((uuid) => {
        expect(uuidSchema.parse(uuid)).toBe(uuid);
      });
    });

    it('should reject invalid UUIDs', () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '123e4567-e89b-12d3-a456', // too short
        '123e4567-e89b-12d3-a456-426614174000-extra', // too long
        '123e4567e89b12d3a456426614174000', // missing hyphens
      ];

      invalidUUIDs.forEach((uuid) => {
        expect(() => uuidSchema.parse(uuid)).toThrow();
      });
    });
  });

  describe('emailSchema', () => {
    it('should accept valid emails', () => {
      const validEmails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'name@sub.domain.com',
      ];

      validEmails.forEach((email) => {
        expect(emailSchema.parse(email)).toBe(email);
      });
    });

    it('should reject invalid emails', () => {
      const invalidEmails = ['not-an-email', '@example.com', 'user@', 'user @example.com'];

      invalidEmails.forEach((email) => {
        expect(() => emailSchema.parse(email)).toThrow();
      });
    });
  });

  describe('nonEmptyStringSchema', () => {
    it('should accept non-empty strings', () => {
      expect(nonEmptyStringSchema.parse('hello')).toBe('hello');
      expect(nonEmptyStringSchema.parse(' ')).toBe(' ');
    });

    it('should reject empty strings', () => {
      expect(() => nonEmptyStringSchema.parse('')).toThrow();
    });
  });

  describe('urlSchema', () => {
    it('should accept valid URLs', () => {
      const validURLs = [
        'https://example.com',
        'http://localhost:3210',
        'https://sub.domain.com/path?query=value',
      ];

      validURLs.forEach((url) => {
        expect(urlSchema.parse(url)).toBe(url);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidURLs = ['not-a-url', 'example.com', '/relative/path'];

      invalidURLs.forEach((url) => {
        expect(() => urlSchema.parse(url)).toThrow();
      });
    });
  });

  describe('datetimeSchema', () => {
    it('should accept valid ISO 8601 datetime strings', () => {
      // Zod datetime() only accepts UTC format with Z suffix by default
      const validDates = ['2024-01-15T10:30:00Z', '2024-01-15T10:30:00.123Z'];

      validDates.forEach((date) => {
        expect(datetimeSchema.parse(date)).toBe(date);
      });
    });

    it('should reject invalid datetime strings', () => {
      const invalidDates = ['2024-01-15', '2024/01/15 10:30:00', 'not-a-date'];

      invalidDates.forEach((date) => {
        expect(() => datetimeSchema.parse(date)).toThrow();
      });
    });
  });
});

describe('Common ID Schemas', () => {
  describe('idParamSchema', () => {
    it('should parse valid UUID id parameter', () => {
      const input = { id: '123e4567-e89b-12d3-a456-426614174000' };
      const result = idParamSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('should reject invalid id parameter', () => {
      expect(() => idParamSchema.parse({ id: 'not-a-uuid' })).toThrow();
      expect(() => idParamSchema.parse({})).toThrow();
    });
  });

  describe('createIdSchema', () => {
    it('should create UUID schema', () => {
      const schema = createIdSchema('uuid');
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';

      expect(schema.parse(validUUID)).toBe(validUUID);
      expect(() => schema.parse('not-a-uuid')).toThrow();
    });

    it('should create integer schema with coercion', () => {
      const schema = createIdSchema('integer');

      expect(schema.parse('42')).toBe(42);
      expect(schema.parse('123')).toBe(123);
      expect(() => schema.parse('not-a-number')).toThrow();
      expect(() => schema.parse('-5')).toThrow(); // negative not allowed
      // Note: parseInt('3.14') returns 3, so it passes as valid integer
      expect(schema.parse('3.14')).toBe(3);
    });

    it('should create string schema', () => {
      const schema = createIdSchema('string');

      expect(schema.parse('any-string')).toBe('any-string');
      expect(schema.parse('123')).toBe('123');
      expect(() => schema.parse('')).toThrow(); // min length 1
    });
  });
});

describe('Common Object Schemas', () => {
  describe('timestampFieldsSchema', () => {
    it('should parse valid timestamp fields', () => {
      const input = {
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T11:00:00Z',
      };

      const result = timestampFieldsSchema.parse(input);

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should coerce Date objects', () => {
      const now = new Date();
      const input = { createdAt: now, updatedAt: now };

      const result = timestampFieldsSchema.parse(input);

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('baseEntitySchema', () => {
    it('should parse valid base entity', () => {
      const input = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T11:00:00Z',
      };

      const result = baseEntitySchema.parse(input);

      expect(result.id).toBe(input.id);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should reject invalid base entity', () => {
      expect(() => baseEntitySchema.parse({ id: 'not-a-uuid' })).toThrow();
      expect(() =>
        baseEntitySchema.parse({ id: '123e4567-e89b-12d3-a456-426614174000' })
      ).toThrow(); // missing timestamps
    });
  });
});

describe('Schema Composition Utilities', () => {
  const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    age: z.number(),
  });

  describe('makePartial', () => {
    it('should make all fields optional', () => {
      const PartialUserSchema = makePartial(UserSchema);

      expect(PartialUserSchema.parse({})).toEqual({});
      expect(PartialUserSchema.parse({ name: 'John' })).toEqual({ name: 'John' });
      expect(PartialUserSchema.parse({ name: 'John', age: 30 })).toEqual({ name: 'John', age: 30 });
    });
  });

  describe('partialExcept', () => {
    it('should make specific fields required', () => {
      const UpdateUserSchema = partialExcept(UserSchema, ['id'] as const);

      // id is required
      expect(() => UpdateUserSchema.parse({ name: 'John' })).toThrow();

      // id present, others optional
      expect(UpdateUserSchema.parse({ id: '123' })).toEqual({ id: '123' });
      expect(UpdateUserSchema.parse({ id: '123', name: 'John' })).toEqual({
        id: '123',
        name: 'John',
      });
    });

    it('should handle multiple required fields', () => {
      const schema = partialExcept(UserSchema, ['id', 'email'] as const);

      // Both required fields must be present
      expect(() => schema.parse({ id: '123' })).toThrow();
      expect(() => schema.parse({ email: 'test@example.com' })).toThrow();

      // Valid when both present
      const result = schema.parse({ id: '123', email: 'test@example.com' });
      expect(result).toEqual({ id: '123', email: 'test@example.com' });
    });
  });

  describe('omitFields', () => {
    it('should omit specified fields', () => {
      const UserWithoutPassword = omitFields(
        z.object({
          id: z.string(),
          name: z.string(),
          password: z.string(),
        }),
        ['password'] as const
      );

      const result = UserWithoutPassword.parse({ id: '123', name: 'John' });
      expect(result).toEqual({ id: '123', name: 'John' });

      // Password should not be accepted
      const resultWithExtra = UserWithoutPassword.parse({
        id: '123',
        name: 'John',
        password: 'secret',
      });
      expect(resultWithExtra).toEqual({ id: '123', name: 'John' });
    });

    it('should handle multiple omitted fields', () => {
      const PublicUserSchema = omitFields(UserSchema, ['email', 'age'] as const);

      const result = PublicUserSchema.parse({ id: '123', name: 'John' });
      expect(result).toEqual({ id: '123', name: 'John' });
    });
  });

  describe('pickFields', () => {
    it('should pick specified fields', () => {
      const UserIdAndName = pickFields(UserSchema, ['id', 'name'] as const);

      const result = UserIdAndName.parse({ id: '123', name: 'John' });
      expect(result).toEqual({ id: '123', name: 'John' });

      // Other fields should not be required
      expect(() => UserIdAndName.parse({ id: '123' })).toThrow();
    });

    it('should handle single field pick', () => {
      const UserIdOnly = pickFields(UserSchema, ['id'] as const);

      const result = UserIdOnly.parse({ id: '123' });
      expect(result).toEqual({ id: '123' });
    });
  });
});

describe('Coercion Utilities', () => {
  describe('booleanStringSchema', () => {
    it('should coerce truthy strings to true', () => {
      expect(booleanStringSchema.parse('true')).toBe(true);
      expect(booleanStringSchema.parse('TRUE')).toBe(true);
      expect(booleanStringSchema.parse('1')).toBe(true);
      expect(booleanStringSchema.parse('yes')).toBe(true);
      expect(booleanStringSchema.parse('YES')).toBe(true);
    });

    it('should coerce falsy strings to false', () => {
      expect(booleanStringSchema.parse('false')).toBe(false);
      expect(booleanStringSchema.parse('FALSE')).toBe(false);
      expect(booleanStringSchema.parse('0')).toBe(false);
      expect(booleanStringSchema.parse('no')).toBe(false);
      expect(booleanStringSchema.parse('NO')).toBe(false);
    });

    it('should reject invalid strings', () => {
      expect(() => booleanStringSchema.parse('maybe')).toThrow();
      expect(() => booleanStringSchema.parse('2')).toThrow();
    });
  });

  describe('numberStringSchema', () => {
    it('should coerce number strings to numbers', () => {
      expect(numberStringSchema.parse('42')).toBe(42);
      expect(numberStringSchema.parse('3.14')).toBe(3.14);
      expect(numberStringSchema.parse('-5')).toBe(-5);
    });

    it('should reject non-numeric strings', () => {
      expect(() => numberStringSchema.parse('not-a-number')).toThrow();
    });
  });

  describe('integerStringSchema', () => {
    it('should coerce integer strings to integers', () => {
      expect(integerStringSchema.parse('42')).toBe(42);
      expect(integerStringSchema.parse('-5')).toBe(-5);
      expect(integerStringSchema.parse('0')).toBe(0);
    });

    it('should truncate decimal numbers to integers', () => {
      // parseInt truncates decimals, so '3.14' becomes 3
      expect(integerStringSchema.parse('3.14')).toBe(3);
      expect(integerStringSchema.parse('5.9')).toBe(5);
    });
  });
});

describe('Pagination Schemas', () => {
  describe('paginationInputSchema', () => {
    it('should parse with defaults', () => {
      const result = paginationInputSchema.parse({});

      expect(result.page).toBe(PAGINATION_DEFAULTS.page);
      expect(result.limit).toBe(PAGINATION_DEFAULTS.limit);
    });

    it('should parse custom values', () => {
      const result = paginationInputSchema.parse({ page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it('should coerce string numbers', () => {
      const result = paginationInputSchema.parse({ page: '3', limit: '25' });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
    });

    it('should enforce max limit', () => {
      expect(() => paginationInputSchema.parse({ limit: 200 })).toThrow();
    });

    it('should reject negative page numbers', () => {
      expect(() => paginationInputSchema.parse({ page: -1 })).toThrow();
      expect(() => paginationInputSchema.parse({ page: 0 })).toThrow();
    });

    it('should reject negative limits', () => {
      expect(() => paginationInputSchema.parse({ limit: -10 })).toThrow();
      expect(() => paginationInputSchema.parse({ limit: 0 })).toThrow();
    });
  });

  describe('createPaginationSchema', () => {
    it('should create schema with custom defaults', () => {
      const customSchema = createPaginationSchema({
        defaultPage: 1,
        defaultLimit: 10,
        maxLimit: 50,
      });

      const result = customSchema.parse({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should enforce custom max limit', () => {
      const customSchema = createPaginationSchema({ maxLimit: 25 });

      expect(() => customSchema.parse({ limit: 30 })).toThrow();
      expect(customSchema.parse({ limit: 20 }).limit).toBe(20);
    });
  });

  describe('cursorPaginationSchema', () => {
    it('should parse with defaults', () => {
      const result = cursorPaginationSchema.parse({});

      expect(result.cursor).toBeUndefined();
      expect(result.limit).toBe(20);
      expect(result.direction).toBe('forward');
    });

    it('should parse with cursor', () => {
      const result = cursorPaginationSchema.parse({
        cursor: 'abc123',
        limit: 10,
        direction: 'backward',
      });

      expect(result.cursor).toBe('abc123');
      expect(result.limit).toBe(10);
      expect(result.direction).toBe('backward');
    });
  });

  describe('createPaginatedResponseSchema', () => {
    it('should create paginated response schema', () => {
      const ItemSchema = z.object({ id: z.string(), name: z.string() });
      const PaginatedSchema = createPaginatedResponseSchema(ItemSchema);

      const result = PaginatedSchema.parse({
        data: [{ id: '1', name: 'Item 1' }],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('createCursorPaginatedResponseSchema', () => {
    it('should create cursor paginated response schema', () => {
      const ItemSchema = z.object({ id: z.string() });
      const PaginatedSchema = createCursorPaginatedResponseSchema(ItemSchema);

      const result = PaginatedSchema.parse({
        data: [{ id: '1' }],
        meta: {
          nextCursor: 'next',
          prevCursor: null,
          hasMore: true,
        },
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.nextCursor).toBe('next');
      expect(result.meta.hasMore).toBe(true);
    });
  });
});

describe('Pagination Utilities', () => {
  describe('calculatePaginationMeta', () => {
    it('should calculate meta for first page', () => {
      const meta = calculatePaginationMeta({
        page: 1,
        limit: 20,
        total: 55,
      });

      expect(meta.page).toBe(1);
      expect(meta.limit).toBe(20);
      expect(meta.total).toBe(55);
      expect(meta.totalPages).toBe(3);
      expect(meta.hasMore).toBe(true);
    });

    it('should calculate meta for middle page', () => {
      const meta = calculatePaginationMeta({
        page: 2,
        limit: 20,
        total: 55,
      });

      expect(meta.page).toBe(2);
      expect(meta.hasMore).toBe(true);
    });

    it('should calculate meta for last page', () => {
      const meta = calculatePaginationMeta({
        page: 3,
        limit: 20,
        total: 55,
      });

      expect(meta.page).toBe(3);
      expect(meta.hasMore).toBe(false);
    });

    it('should handle exact division', () => {
      const meta = calculatePaginationMeta({
        page: 2,
        limit: 20,
        total: 40,
      });

      expect(meta.totalPages).toBe(2);
      expect(meta.hasMore).toBe(false);
    });

    it('should handle empty results', () => {
      const meta = calculatePaginationMeta({
        page: 1,
        limit: 20,
        total: 0,
      });

      expect(meta.totalPages).toBe(0);
      expect(meta.hasMore).toBe(false);
    });
  });

  describe('calculateOffset', () => {
    it('should calculate offset for first page', () => {
      expect(calculateOffset(1, 20)).toBe(0);
    });

    it('should calculate offset for subsequent pages', () => {
      expect(calculateOffset(2, 20)).toBe(20);
      expect(calculateOffset(3, 20)).toBe(40);
      expect(calculateOffset(5, 10)).toBe(40);
    });
  });

  describe('createPaginatedResponse', () => {
    it('should create paginated response', () => {
      const items = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ];

      const response = createPaginatedResponse(items, { page: 1, limit: 20 }, 2);

      expect(response.data).toEqual(items);
      expect(response.meta.page).toBe(1);
      expect(response.meta.limit).toBe(20);
      expect(response.meta.total).toBe(2);
      expect(response.meta.totalPages).toBe(1);
      expect(response.meta.hasMore).toBe(false);
    });

    it('should handle empty results', () => {
      const response = createPaginatedResponse([], { page: 1, limit: 20 }, 0);

      expect(response.data).toEqual([]);
      expect(response.meta.total).toBe(0);
      expect(response.meta.totalPages).toBe(0);
    });
  });
});
