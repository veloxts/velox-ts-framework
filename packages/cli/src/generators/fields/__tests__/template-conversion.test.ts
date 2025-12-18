/**
 * Template Conversion Tests
 *
 * Tests for field-to-Prisma and field-to-Zod conversion functions.
 */

import { describe, expect, it } from 'vitest';

import {
  fieldToPrisma,
  fieldToZod,
  formatPrismaDefault,
  generatePrismaEnums,
} from '../../templates/resource.js';
import {
  allFieldTypes,
  booleanWithDefault,
  createEnumField,
  createFieldWithAttributes,
  createTestField,
  floatField,
  integerField,
  jsonField,
  optionalTextField,
  simpleStringField,
  statusEnumField,
  uniqueStringField,
} from './helpers.js';

// ============================================================================
// fieldToPrisma Tests
// ============================================================================

describe('fieldToPrisma', () => {
  describe('basic types', () => {
    it('converts string field', () => {
      const result = fieldToPrisma(simpleStringField);
      expect(result).toBe('  title String');
    });

    it('converts text field to String without @db.Text for SQLite (default)', () => {
      const field = createTestField({ name: 'content', type: 'text' });
      const result = fieldToPrisma(field);
      expect(result).toBe('  content String');
    });

    it('converts text field with @db.Text for PostgreSQL', () => {
      const field = createTestField({ name: 'content', type: 'text' });
      const result = fieldToPrisma(field, 'postgresql');
      expect(result).toBe('  content String @db.Text');
    });

    it('converts text field with @db.Text for MySQL', () => {
      const field = createTestField({ name: 'content', type: 'text' });
      const result = fieldToPrisma(field, 'mysql');
      expect(result).toBe('  content String @db.Text');
    });

    it('converts int field', () => {
      const result = fieldToPrisma(integerField);
      expect(result).toBe('  count Int');
    });

    it('converts float field', () => {
      const result = fieldToPrisma(floatField);
      expect(result).toBe('  price Float');
    });

    it('converts boolean field', () => {
      const field = createTestField({ name: 'isActive', type: 'boolean' });
      const result = fieldToPrisma(field);
      expect(result).toBe('  isActive Boolean');
    });

    it('converts datetime field', () => {
      const field = createTestField({ name: 'publishedAt', type: 'datetime' });
      const result = fieldToPrisma(field);
      expect(result).toBe('  publishedAt DateTime');
    });

    it('converts json field', () => {
      const result = fieldToPrisma(jsonField);
      expect(result).toBe('  metadata Json');
    });

    it('converts enum field', () => {
      const result = fieldToPrisma(statusEnumField);
      expect(result).toBe('  status Status');
    });
  });

  describe('optional modifier', () => {
    it('adds ? for optional fields', () => {
      const result = fieldToPrisma(optionalTextField);
      expect(result).toContain('String?');
    });

    it('optional string field', () => {
      const field = createFieldWithAttributes('nickname', 'string', { optional: true });
      const result = fieldToPrisma(field);
      expect(result).toBe('  nickname String?');
    });

    it('optional int field', () => {
      const field = createFieldWithAttributes('age', 'int', { optional: true });
      const result = fieldToPrisma(field);
      expect(result).toBe('  age Int?');
    });

    it('optional enum field', () => {
      const field = createEnumField('status', 'Status', ['ACTIVE'], { optional: true });
      const result = fieldToPrisma(field);
      expect(result).toBe('  status Status?');
    });
  });

  describe('unique modifier', () => {
    it('adds @unique for unique fields', () => {
      const result = fieldToPrisma(uniqueStringField);
      expect(result).toBe('  email String @unique');
    });

    it('unique optional field', () => {
      const field = createFieldWithAttributes('email', 'string', { optional: true, unique: true });
      const result = fieldToPrisma(field);
      expect(result).toBe('  email String? @unique');
    });
  });

  describe('default modifier', () => {
    it('adds @default for boolean with default', () => {
      const result = fieldToPrisma(booleanWithDefault);
      expect(result).toBe('  isActive Boolean @default(true)');
    });

    it('adds @default for string with default', () => {
      const field = createFieldWithAttributes('role', 'string', {
        hasDefault: true,
        defaultValue: 'user',
      });
      const result = fieldToPrisma(field);
      expect(result).toBe('  role String @default("user")');
    });

    it('adds @default for int with default', () => {
      const field = createFieldWithAttributes('count', 'int', {
        hasDefault: true,
        defaultValue: '0',
      });
      const result = fieldToPrisma(field);
      expect(result).toBe('  count Int @default(0)');
    });

    it('adds @default for float with default', () => {
      const field = createFieldWithAttributes('rating', 'float', {
        hasDefault: true,
        defaultValue: '0.0',
      });
      const result = fieldToPrisma(field);
      expect(result).toBe('  rating Float @default(0.0)');
    });
  });

  describe('combined modifiers', () => {
    it('combines optional and unique', () => {
      const field = createFieldWithAttributes('email', 'string', { optional: true, unique: true });
      const result = fieldToPrisma(field);
      expect(result).toContain('String?');
      expect(result).toContain('@unique');
    });

    it('combines unique and default', () => {
      const field = createFieldWithAttributes('slug', 'string', {
        unique: true,
        hasDefault: true,
        defaultValue: 'untitled',
      });
      const result = fieldToPrisma(field);
      expect(result).toContain('@unique');
      expect(result).toContain('@default("untitled")');
    });

    it('text field with optional (no @db.Text for SQLite)', () => {
      const field = createFieldWithAttributes('bio', 'text', { optional: true });
      const result = fieldToPrisma(field);
      expect(result).toBe('  bio String?');
    });

    it('text field with optional and @db.Text for PostgreSQL', () => {
      const field = createFieldWithAttributes('bio', 'text', { optional: true });
      const result = fieldToPrisma(field, 'postgresql');
      expect(result).toBe('  bio String? @db.Text');
    });
  });
});

// ============================================================================
// fieldToZod Tests
// ============================================================================

describe('fieldToZod', () => {
  describe('basic types', () => {
    it('converts string field', () => {
      const result = fieldToZod(simpleStringField);
      expect(result).toBe('  title: z.string().min(1).max(255),');
    });

    it('converts text field', () => {
      const field = createTestField({ name: 'content', type: 'text' });
      const result = fieldToZod(field);
      expect(result).toBe('  content: z.string(),');
    });

    it('converts int field', () => {
      const result = fieldToZod(integerField);
      expect(result).toBe('  count: z.number().int(),');
    });

    it('converts float field', () => {
      const result = fieldToZod(floatField);
      expect(result).toBe('  price: z.number(),');
    });

    it('converts boolean field', () => {
      const field = createTestField({ name: 'isActive', type: 'boolean' });
      const result = fieldToZod(field);
      expect(result).toBe('  isActive: z.boolean(),');
    });

    it('converts datetime field', () => {
      const field = createTestField({ name: 'publishedAt', type: 'datetime' });
      const result = fieldToZod(field);
      expect(result).toBe('  publishedAt: z.date(),');
    });

    it('converts json field', () => {
      const result = fieldToZod(jsonField);
      expect(result).toBe('  metadata: z.record(z.unknown()),');
    });

    it('converts enum field', () => {
      const result = fieldToZod(statusEnumField);
      expect(result).toBe("  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),");
    });
  });

  describe('optional modifier', () => {
    it('adds .nullable() for optional fields', () => {
      const result = fieldToZod(optionalTextField);
      expect(result).toContain('.nullable()');
    });

    it('optional string field', () => {
      const field = createFieldWithAttributes('nickname', 'string', { optional: true });
      const result = fieldToZod(field);
      expect(result).toBe('  nickname: z.string().min(1).max(255).nullable(),');
    });

    it('optional int field', () => {
      const field = createFieldWithAttributes('age', 'int', { optional: true });
      const result = fieldToZod(field);
      expect(result).toBe('  age: z.number().int().nullable(),');
    });

    it('optional enum field', () => {
      const field = createEnumField('status', 'Status', ['ACTIVE', 'INACTIVE'], { optional: true });
      const result = fieldToZod(field);
      expect(result).toContain('.nullable()');
      expect(result).toContain("z.enum(['ACTIVE', 'INACTIVE'])");
    });
  });

  describe('enum with multiple values', () => {
    it('generates correct enum schema', () => {
      const field = createEnumField('priority', 'Priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
      const result = fieldToZod(field);
      expect(result).toBe("  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),");
    });

    it('generates correct enum schema for single value', () => {
      const field = createEnumField('type', 'Type', ['DEFAULT']);
      const result = fieldToZod(field);
      expect(result).toBe("  type: z.enum(['DEFAULT']),");
    });
  });
});

// ============================================================================
// formatPrismaDefault Tests
// ============================================================================

describe('formatPrismaDefault', () => {
  describe('string types', () => {
    it('wraps string values in quotes', () => {
      expect(formatPrismaDefault('string', 'hello')).toBe('"hello"');
      expect(formatPrismaDefault('string', 'default value')).toBe('"default value"');
    });

    it('wraps text values in quotes', () => {
      expect(formatPrismaDefault('text', 'long text')).toBe('"long text"');
    });
  });

  describe('boolean type', () => {
    it('returns raw boolean values', () => {
      expect(formatPrismaDefault('boolean', 'true')).toBe('true');
      expect(formatPrismaDefault('boolean', 'false')).toBe('false');
    });
  });

  describe('numeric types', () => {
    it('returns raw int values', () => {
      expect(formatPrismaDefault('int', '0')).toBe('0');
      expect(formatPrismaDefault('int', '42')).toBe('42');
      expect(formatPrismaDefault('int', '-10')).toBe('-10');
    });

    it('returns raw float values', () => {
      expect(formatPrismaDefault('float', '0.0')).toBe('0.0');
      expect(formatPrismaDefault('float', '3.14')).toBe('3.14');
      expect(formatPrismaDefault('float', '-2.5')).toBe('-2.5');
    });
  });

  describe('enum type', () => {
    it('returns raw enum values (unquoted)', () => {
      expect(formatPrismaDefault('enum', 'DRAFT')).toBe('DRAFT');
      expect(formatPrismaDefault('enum', 'ACTIVE')).toBe('ACTIVE');
      expect(formatPrismaDefault('enum', 'PENDING')).toBe('PENDING');
    });
  });

  describe('datetime type', () => {
    it('returns now() function for now values', () => {
      expect(formatPrismaDefault('datetime', 'now()')).toBe('now()');
      expect(formatPrismaDefault('datetime', 'now')).toBe('now()');
    });

    it('wraps other datetime values in quotes', () => {
      expect(formatPrismaDefault('datetime', '2024-01-01')).toBe('"2024-01-01"');
    });
  });

  describe('json type', () => {
    it('returns raw JSON value (user must format correctly)', () => {
      expect(formatPrismaDefault('json', '{}')).toBe('{}');
      expect(formatPrismaDefault('json', '[]')).toBe('[]');
    });
  });

  describe('unknown types', () => {
    // @ts-expect-error - testing unknown type behavior
    it('defaults to quoted string for unknown types', () => {
      // @ts-expect-error - testing unknown type
      expect(formatPrismaDefault('unknown', 'value')).toBe('"value"');
    });
  });
});

// ============================================================================
// generatePrismaEnums Tests
// ============================================================================

describe('generatePrismaEnums', () => {
  describe('no enums', () => {
    it('returns empty string when no fields', () => {
      const result = generatePrismaEnums([]);
      expect(result).toBe('');
    });

    it('returns empty string when no enum fields', () => {
      const fields = [simpleStringField, integerField, booleanWithDefault];
      const result = generatePrismaEnums(fields);
      expect(result).toBe('');
    });
  });

  describe('single enum', () => {
    it('generates single enum definition', () => {
      const fields = [statusEnumField];
      const result = generatePrismaEnums(fields);
      expect(result).toContain('enum Status {');
      expect(result).toContain('DRAFT');
      expect(result).toContain('PUBLISHED');
      expect(result).toContain('ARCHIVED');
    });

    it('formats enum with proper indentation', () => {
      const fields = [createEnumField('role', 'Role', ['ADMIN', 'USER'])];
      const result = generatePrismaEnums(fields);
      expect(result).toContain('enum Role {\n  ADMIN\n  USER\n}');
    });
  });

  describe('multiple enums', () => {
    it('generates multiple enum definitions', () => {
      const fields = [statusEnumField, createEnumField('role', 'Role', ['ADMIN', 'USER', 'GUEST'])];
      const result = generatePrismaEnums(fields);
      expect(result).toContain('enum Status {');
      expect(result).toContain('enum Role {');
    });

    it('separates enums with blank lines', () => {
      const fields = [
        createEnumField('status', 'Status', ['ACTIVE']),
        createEnumField('role', 'Role', ['USER']),
      ];
      const result = generatePrismaEnums(fields);
      expect(result).toContain('}\n\nenum');
    });
  });

  describe('mixed field types', () => {
    it('only generates enums for enum fields', () => {
      const result = generatePrismaEnums(allFieldTypes);
      expect(result).toContain('enum Status {');
      // Should not contain other field names as enums
      expect(result).not.toContain('enum title');
      expect(result).not.toContain('enum count');
    });
  });

  describe('edge cases', () => {
    it('handles enum field without enumDef', () => {
      const field = createTestField({ name: 'status', type: 'enum' });
      // No enumDef property
      const result = generatePrismaEnums([field]);
      expect(result).toBe('');
    });
  });
});

// ============================================================================
// Integration Tests - Full Field Conversion
// ============================================================================

describe('field conversion integration', () => {
  it('converts all field types to Prisma', () => {
    for (const field of allFieldTypes) {
      const result = fieldToPrisma(field);
      expect(result).toBeDefined();
      expect(result.startsWith('  ')).toBe(true); // Proper indentation
      expect(result).toContain(field.name);
    }
  });

  it('converts all field types to Zod', () => {
    for (const field of allFieldTypes) {
      const result = fieldToZod(field);
      expect(result).toBeDefined();
      expect(result.startsWith('  ')).toBe(true); // Proper indentation
      expect(result).toContain(field.name);
      expect(result).toContain('z.');
      expect(result.endsWith(',')).toBe(true); // Trailing comma
    }
  });

  it('maintains field order in output', () => {
    const fields = [
      createTestField({ name: 'aField', type: 'string' }),
      createTestField({ name: 'bField', type: 'int' }),
      createTestField({ name: 'cField', type: 'boolean' }),
    ];

    const prismaResults = fields.map(fieldToPrisma);
    expect(prismaResults[0]).toContain('aField');
    expect(prismaResults[1]).toContain('bField');
    expect(prismaResults[2]).toContain('cField');
  });
});
