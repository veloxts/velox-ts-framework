/**
 * @veloxts/validation - Serialization Tests
 *
 * Tests date serialization utilities for API responses.
 * Covers edge cases for Date → string transformation.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  dateToISOString,
  dateToISOStringNullable,
  dateToISOStringOptional,
  timestamps,
  timestampsWithSoftDelete,
  withTimestamps,
} from '../schemas/serialization.js';

// ============================================================================
// dateToISOString Tests
// ============================================================================

describe('dateToISOString', () => {
  it('should transform Date object to ISO string', () => {
    const schema = dateToISOString();
    const date = new Date('2024-01-15T10:30:00.000Z');

    const result = schema.parse(date);

    expect(result).toBe('2024-01-15T10:30:00.000Z');
    expect(typeof result).toBe('string');
  });

  it('should coerce ISO string to Date then transform back to string', () => {
    const schema = dateToISOString();
    const isoString = '2024-06-20T15:45:30.123Z';

    const result = schema.parse(isoString);

    expect(result).toBe('2024-06-20T15:45:30.123Z');
  });

  it('should coerce numeric timestamp to Date then transform to string', () => {
    const schema = dateToISOString();
    // Use a known timestamp and verify the conversion works
    const date = new Date('2024-01-15T10:30:00.000Z');
    const timestamp = date.getTime();

    const result = schema.parse(timestamp);

    expect(result).toBe(date.toISOString());
  });

  it('should preserve milliseconds precision', () => {
    const schema = dateToISOString();
    const date = new Date('2024-01-15T10:30:00.999Z');

    const result = schema.parse(date);

    expect(result).toBe('2024-01-15T10:30:00.999Z');
  });

  it('should reject invalid date strings', () => {
    const schema = dateToISOString();

    expect(() => schema.parse('not-a-date')).toThrow();
    expect(() => schema.parse('invalid')).toThrow();
  });

  it('should coerce null to epoch date (z.coerce.date behavior)', () => {
    const schema = dateToISOString();

    // z.coerce.date() coerces null to Date(0) - epoch
    // This is expected Zod behavior for coercion
    const result = schema.parse(null);

    expect(result).toBe('1970-01-01T00:00:00.000Z');
  });

  it('should reject undefined values', () => {
    const schema = dateToISOString();

    expect(() => schema.parse(undefined)).toThrow();
  });
});

// ============================================================================
// dateToISOStringNullable Tests
// ============================================================================

describe('dateToISOStringNullable', () => {
  it('should transform Date object to ISO string', () => {
    const schema = dateToISOStringNullable();
    const date = new Date('2024-01-15T10:30:00.000Z');

    const result = schema.parse(date);

    expect(result).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should transform null to null', () => {
    const schema = dateToISOStringNullable();

    const result = schema.parse(null);

    expect(result).toBeNull();
  });

  it('should coerce ISO string to Date then transform to string', () => {
    const schema = dateToISOStringNullable();

    const result = schema.parse('2024-06-20T15:45:30.000Z');

    expect(result).toBe('2024-06-20T15:45:30.000Z');
  });

  it('should reject undefined values', () => {
    const schema = dateToISOStringNullable();

    expect(() => schema.parse(undefined)).toThrow();
  });

  it('should reject invalid date strings', () => {
    const schema = dateToISOStringNullable();

    expect(() => schema.parse('invalid')).toThrow();
  });
});

// ============================================================================
// dateToISOStringOptional Tests
// ============================================================================

describe('dateToISOStringOptional', () => {
  it('should transform Date object to ISO string', () => {
    const schema = dateToISOStringOptional();
    const date = new Date('2024-01-15T10:30:00.000Z');

    const result = schema.parse(date);

    expect(result).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should transform undefined to undefined', () => {
    const schema = dateToISOStringOptional();

    const result = schema.parse(undefined);

    expect(result).toBeUndefined();
  });

  it('should coerce ISO string to Date then transform to string', () => {
    const schema = dateToISOStringOptional();

    const result = schema.parse('2024-06-20T15:45:30.000Z');

    expect(result).toBe('2024-06-20T15:45:30.000Z');
  });

  it('should coerce null to epoch date (use nullable for null → null)', () => {
    const schema = dateToISOStringOptional();

    // z.coerce.date().optional() still coerces null to Date(0)
    // Use dateToISOStringNullable() if you want null → null behavior
    const result = schema.parse(null);

    expect(result).toBe('1970-01-01T00:00:00.000Z');
  });
});

// ============================================================================
// timestamps Preset Tests
// ============================================================================

describe('timestamps preset', () => {
  it('should parse Date objects to ISO strings', () => {
    const now = new Date();
    const input = {
      createdAt: now,
      updatedAt: now,
    };

    const result = timestamps.parse(input);

    expect(typeof result.createdAt).toBe('string');
    expect(typeof result.updatedAt).toBe('string');
    expect(result.createdAt).toBe(now.toISOString());
    expect(result.updatedAt).toBe(now.toISOString());
  });

  it('should parse ISO string inputs', () => {
    const input = {
      createdAt: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-16T12:00:00.000Z',
    };

    const result = timestamps.parse(input);

    expect(result.createdAt).toBe('2024-01-15T10:30:00.000Z');
    expect(result.updatedAt).toBe('2024-01-16T12:00:00.000Z');
  });

  it('should reject missing fields', () => {
    expect(() => timestamps.parse({ createdAt: new Date() })).toThrow();
    expect(() => timestamps.parse({ updatedAt: new Date() })).toThrow();
    expect(() => timestamps.parse({})).toThrow();
  });
});

// ============================================================================
// timestampsWithSoftDelete Preset Tests
// ============================================================================

describe('timestampsWithSoftDelete preset', () => {
  it('should parse all timestamp fields', () => {
    const now = new Date();
    const deleted = new Date('2024-12-01T00:00:00.000Z');
    const input = {
      createdAt: now,
      updatedAt: now,
      deletedAt: deleted,
    };

    const result = timestampsWithSoftDelete.parse(input);

    expect(result.createdAt).toBe(now.toISOString());
    expect(result.updatedAt).toBe(now.toISOString());
    expect(result.deletedAt).toBe(deleted.toISOString());
  });

  it('should accept null for deletedAt (soft delete not triggered)', () => {
    const now = new Date();
    const input = {
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const result = timestampsWithSoftDelete.parse(input);

    expect(result.createdAt).toBe(now.toISOString());
    expect(result.updatedAt).toBe(now.toISOString());
    expect(result.deletedAt).toBeNull();
  });

  it('should reject missing deletedAt field', () => {
    const now = new Date();

    expect(() =>
      timestampsWithSoftDelete.parse({
        createdAt: now,
        updatedAt: now,
      })
    ).toThrow();
  });
});

// ============================================================================
// withTimestamps Tests
// ============================================================================

describe('withTimestamps', () => {
  describe('default configuration', () => {
    it('should add createdAt and updatedAt to schema', () => {
      const UserFields = z.object({
        id: z.string().uuid(),
        name: z.string(),
      });

      const UserSchema = withTimestamps(UserFields);

      const now = new Date();
      const result = UserSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        createdAt: now,
        updatedAt: now,
      });

      expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.name).toBe('John Doe');
      expect(typeof result.createdAt).toBe('string');
      expect(typeof result.updatedAt).toBe('string');
    });

    it('should work with Prisma-like objects (Date instances)', () => {
      const ProductFields = z.object({
        id: z.string(),
        title: z.string(),
        price: z.number(),
      });

      const ProductSchema = withTimestamps(ProductFields);

      // Simulate Prisma response
      const prismaProduct = {
        id: 'prod-123',
        title: 'Widget',
        price: 29.99,
        createdAt: new Date('2024-01-15T10:30:00.000Z'),
        updatedAt: new Date('2024-01-16T14:45:00.000Z'),
      };

      const result = ProductSchema.parse(prismaProduct);

      expect(result.id).toBe('prod-123');
      expect(result.title).toBe('Widget');
      expect(result.price).toBe(29.99);
      expect(result.createdAt).toBe('2024-01-15T10:30:00.000Z');
      expect(result.updatedAt).toBe('2024-01-16T14:45:00.000Z');
    });

    it('should reject objects missing timestamps', () => {
      const Schema = withTimestamps(z.object({ id: z.string() }));

      expect(() => Schema.parse({ id: '123' })).toThrow();
      expect(() => Schema.parse({ id: '123', createdAt: new Date() })).toThrow();
      expect(() => Schema.parse({ id: '123', updatedAt: new Date() })).toThrow();
    });
  });

  describe('with deletedAt configuration', () => {
    it('should add deletedAt when configured', () => {
      const Schema = withTimestamps(z.object({ id: z.string() }), { deletedAt: true });

      const now = new Date();
      const result = Schema.parse({
        id: '123',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      expect(result.deletedAt).toBeNull();
    });

    it('should serialize deletedAt when present', () => {
      const Schema = withTimestamps(z.object({ id: z.string() }), { deletedAt: true });

      const deleted = new Date('2024-12-01T00:00:00.000Z');
      const result = Schema.parse({
        id: '123',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: deleted,
      });

      expect(result.deletedAt).toBe('2024-12-01T00:00:00.000Z');
    });
  });

  describe('with custom timestamp configuration', () => {
    it('should omit createdAt when configured', () => {
      const Schema = withTimestamps(z.object({ id: z.string() }), { createdAt: false });

      const result = Schema.parse({
        id: '123',
        updatedAt: new Date(),
      });

      expect(result.id).toBe('123');
      expect(typeof result.updatedAt).toBe('string');
      expect('createdAt' in result).toBe(false);
    });

    it('should omit updatedAt when configured', () => {
      const Schema = withTimestamps(z.object({ id: z.string() }), { updatedAt: false });

      const result = Schema.parse({
        id: '123',
        createdAt: new Date(),
      });

      expect(result.id).toBe('123');
      expect(typeof result.createdAt).toBe('string');
      expect('updatedAt' in result).toBe(false);
    });

    it('should handle all timestamps disabled (edge case)', () => {
      const Schema = withTimestamps(z.object({ id: z.string() }), {
        createdAt: false,
        updatedAt: false,
      });

      const result = Schema.parse({ id: '123' });

      expect(result).toEqual({ id: '123' });
    });
  });
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

describe('Serialization Edge Cases', () => {
  describe('nested objects with dates', () => {
    it('should serialize dates in nested schema composition', () => {
      const AddressSchema = z.object({
        street: z.string(),
        city: z.string(),
      });

      const UserSchema = withTimestamps(
        z.object({
          id: z.string(),
          name: z.string(),
          address: AddressSchema,
        })
      );

      const now = new Date();
      const result = UserSchema.parse({
        id: '123',
        name: 'John',
        address: { street: '123 Main St', city: 'NYC' },
        createdAt: now,
        updatedAt: now,
      });

      expect(result.address.street).toBe('123 Main St');
      expect(typeof result.createdAt).toBe('string');
    });
  });

  describe('arrays of entities with dates', () => {
    it('should serialize dates in array items', () => {
      const ItemSchema = withTimestamps(
        z.object({
          id: z.string(),
          name: z.string(),
        })
      );

      const ListSchema = z.array(ItemSchema);

      const now = new Date();
      const items = [
        { id: '1', name: 'Item 1', createdAt: now, updatedAt: now },
        { id: '2', name: 'Item 2', createdAt: now, updatedAt: now },
      ];

      const result = ListSchema.parse(items);

      expect(result).toHaveLength(2);
      expect(typeof result[0].createdAt).toBe('string');
      expect(typeof result[1].createdAt).toBe('string');
    });
  });

  describe('paginated response with dates', () => {
    it('should serialize dates in paginated data array', () => {
      const UserSchema = withTimestamps(
        z.object({
          id: z.string(),
          email: z.string().email(),
        })
      );

      const PaginatedUsersSchema = z.object({
        data: z.array(UserSchema),
        meta: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
        }),
      });

      const now = new Date();
      const response = {
        data: [
          { id: '1', email: 'user1@test.com', createdAt: now, updatedAt: now },
          { id: '2', email: 'user2@test.com', createdAt: now, updatedAt: now },
        ],
        meta: { page: 1, limit: 10, total: 2 },
      };

      const result = PaginatedUsersSchema.parse(response);

      expect(result.data).toHaveLength(2);
      expect(typeof result.data[0].createdAt).toBe('string');
      expect(typeof result.data[1].createdAt).toBe('string');
      expect(result.meta.total).toBe(2);
    });
  });

  describe('date boundary values', () => {
    it('should handle epoch date (1970-01-01)', () => {
      const schema = dateToISOString();
      const epoch = new Date(0);

      const result = schema.parse(epoch);

      expect(result).toBe('1970-01-01T00:00:00.000Z');
    });

    it('should handle far future dates', () => {
      const schema = dateToISOString();
      const future = new Date('2099-12-31T23:59:59.999Z');

      const result = schema.parse(future);

      expect(result).toBe('2099-12-31T23:59:59.999Z');
    });

    it('should handle dates with timezone offset in input string', () => {
      const schema = dateToISOString();
      // Input with timezone offset - will be converted to UTC
      const input = '2024-01-15T10:30:00+05:00';

      const result = schema.parse(input);

      // Should be converted to UTC (5 hours earlier)
      expect(result).toBe('2024-01-15T05:30:00.000Z');
    });
  });

  describe('schema merge with timestamps', () => {
    it('should work with z.merge for combining schemas', () => {
      const BaseSchema = z.object({ id: z.string() });
      const ExtendedFields = z.object({ email: z.string().email() });

      const MergedSchema = withTimestamps(BaseSchema.merge(ExtendedFields));

      const now = new Date();
      const result = MergedSchema.parse({
        id: '123',
        email: 'test@example.com',
        createdAt: now,
        updatedAt: now,
      });

      expect(result.id).toBe('123');
      expect(result.email).toBe('test@example.com');
      expect(typeof result.createdAt).toBe('string');
    });

    it('should work with z.extend for extending schemas', () => {
      const BaseSchema = z.object({ id: z.string() });

      const ExtendedSchema = withTimestamps(
        BaseSchema.extend({
          role: z.enum(['admin', 'user']),
        })
      );

      const now = new Date();
      const result = ExtendedSchema.parse({
        id: '123',
        role: 'admin',
        createdAt: now,
        updatedAt: now,
      });

      expect(result.role).toBe('admin');
      expect(typeof result.createdAt).toBe('string');
    });
  });

  describe('type inference verification', () => {
    it('should correctly infer output type with string dates', () => {
      const Schema = withTimestamps(z.object({ id: z.string() }));

      type SchemaOutput = z.infer<typeof Schema>;

      // This is a compile-time check - if types are wrong, this would fail to compile
      const value: SchemaOutput = {
        id: '123',
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      };

      expect(value.createdAt).toBe('2024-01-15T10:30:00.000Z');
    });
  });
});
