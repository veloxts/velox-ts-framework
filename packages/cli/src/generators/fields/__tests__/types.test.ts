/**
 * Field Types Module Tests
 *
 * Tests for validation functions and type utilities.
 */

import { describe, expect, it } from 'vitest';

import {
  FIELD_TYPES,
  getFieldTypeInfo,
  isReservedFieldName,
  parseEnumValues,
  RESERVED_FIELD_NAMES,
  validateEnumName,
  validateEnumValues,
  validateFieldName,
} from '../types.js';

// ============================================================================
// validateFieldName Tests
// ============================================================================

describe('validateFieldName', () => {
  describe('valid names', () => {
    it('accepts simple camelCase names', () => {
      expect(validateFieldName('title')).toBeUndefined();
      expect(validateFieldName('name')).toBeUndefined();
      expect(validateFieldName('email')).toBeUndefined();
    });

    it('accepts camelCase with multiple words', () => {
      expect(validateFieldName('firstName')).toBeUndefined();
      expect(validateFieldName('lastName')).toBeUndefined();
      expect(validateFieldName('phoneNumber')).toBeUndefined();
    });

    it('accepts names with numbers', () => {
      expect(validateFieldName('field1')).toBeUndefined();
      expect(validateFieldName('address2')).toBeUndefined();
      expect(validateFieldName('line1Address')).toBeUndefined();
    });

    it('accepts single letter names', () => {
      expect(validateFieldName('x')).toBeUndefined();
      expect(validateFieldName('a')).toBeUndefined();
    });

    it('trims whitespace from names', () => {
      expect(validateFieldName('  title  ')).toBeUndefined();
      expect(validateFieldName('\ttitle\n')).toBeUndefined();
    });
  });

  describe('invalid names', () => {
    it('rejects empty names', () => {
      expect(validateFieldName('')).toBe('Field name is required');
      expect(validateFieldName('   ')).toBe('Field name is required');
    });

    it('rejects names starting with uppercase', () => {
      expect(validateFieldName('Title')).toContain('camelCase');
      expect(validateFieldName('FirstName')).toContain('camelCase');
    });

    it('rejects names starting with numbers', () => {
      expect(validateFieldName('1field')).toContain('camelCase');
      expect(validateFieldName('123')).toContain('camelCase');
    });

    it('rejects names with special characters', () => {
      expect(validateFieldName('field-name')).toContain('camelCase');
      expect(validateFieldName('field_name')).toContain('camelCase');
      expect(validateFieldName('field.name')).toContain('camelCase');
      expect(validateFieldName('field@name')).toContain('camelCase');
    });

    it('rejects names with spaces', () => {
      expect(validateFieldName('field name')).toContain('camelCase');
      expect(validateFieldName('first name')).toContain('camelCase');
    });
  });

  describe('reserved names', () => {
    it('rejects "id"', () => {
      expect(validateFieldName('id')).toContain('reserved');
    });

    it('rejects "createdAt"', () => {
      expect(validateFieldName('createdAt')).toContain('reserved');
    });

    it('rejects "updatedAt"', () => {
      expect(validateFieldName('updatedAt')).toContain('reserved');
    });

    it('rejects "deletedAt"', () => {
      expect(validateFieldName('deletedAt')).toContain('reserved');
    });
  });
});

// ============================================================================
// validateEnumName Tests
// ============================================================================

describe('validateEnumName', () => {
  describe('valid names', () => {
    it('accepts PascalCase names', () => {
      expect(validateEnumName('Status')).toBeUndefined();
      expect(validateEnumName('UserRole')).toBeUndefined();
      expect(validateEnumName('OrderStatus')).toBeUndefined();
    });

    it('accepts single word PascalCase', () => {
      expect(validateEnumName('Type')).toBeUndefined();
      expect(validateEnumName('State')).toBeUndefined();
    });

    it('accepts names with numbers', () => {
      expect(validateEnumName('Status2')).toBeUndefined();
      expect(validateEnumName('V1Status')).toBeUndefined();
    });
  });

  describe('invalid names', () => {
    it('rejects empty names', () => {
      expect(validateEnumName('')).toBe('Enum name is required');
      expect(validateEnumName('   ')).toBe('Enum name is required');
    });

    it('rejects camelCase names', () => {
      expect(validateEnumName('status')).toContain('PascalCase');
      expect(validateEnumName('userRole')).toContain('PascalCase');
    });

    it('rejects names starting with numbers', () => {
      expect(validateEnumName('1Status')).toContain('PascalCase');
    });

    it('rejects names with special characters', () => {
      expect(validateEnumName('User-Role')).toContain('PascalCase');
      expect(validateEnumName('User_Role')).toContain('PascalCase');
    });
  });
});

// ============================================================================
// validateEnumValues Tests
// ============================================================================

describe('validateEnumValues', () => {
  describe('valid values', () => {
    it('accepts UPPER_CASE values', () => {
      expect(validateEnumValues(['ACTIVE', 'INACTIVE'])).toBeUndefined();
      expect(validateEnumValues(['DRAFT', 'PUBLISHED', 'ARCHIVED'])).toBeUndefined();
    });

    it('accepts single values', () => {
      expect(validateEnumValues(['ACTIVE'])).toBeUndefined();
    });

    it('accepts values with numbers', () => {
      expect(validateEnumValues(['STATUS1', 'STATUS2'])).toBeUndefined();
      expect(validateEnumValues(['V1', 'V2', 'V3'])).toBeUndefined();
    });

    it('accepts values with underscores', () => {
      expect(validateEnumValues(['IN_PROGRESS', 'NOT_STARTED'])).toBeUndefined();
      expect(validateEnumValues(['PENDING_REVIEW', 'UNDER_REVIEW'])).toBeUndefined();
    });
  });

  describe('invalid values', () => {
    it('rejects empty array', () => {
      expect(validateEnumValues([])).toBe('At least one enum value is required');
    });

    it('rejects lowercase values', () => {
      expect(validateEnumValues(['active'])).toContain('UPPER_CASE');
      expect(validateEnumValues(['ACTIVE', 'inactive'])).toContain('UPPER_CASE');
    });

    it('rejects camelCase values', () => {
      expect(validateEnumValues(['inProgress'])).toContain('UPPER_CASE');
    });

    it('rejects values with hyphens', () => {
      expect(validateEnumValues(['IN-PROGRESS'])).toContain('UPPER_CASE');
    });

    it('rejects values starting with numbers', () => {
      expect(validateEnumValues(['1ACTIVE'])).toContain('UPPER_CASE');
    });
  });
});

// ============================================================================
// parseEnumValues Tests
// ============================================================================

describe('parseEnumValues', () => {
  describe('basic parsing', () => {
    it('parses comma-separated values', () => {
      expect(parseEnumValues('ACTIVE,INACTIVE')).toEqual(['ACTIVE', 'INACTIVE']);
      expect(parseEnumValues('DRAFT,PUBLISHED,ARCHIVED')).toEqual([
        'DRAFT',
        'PUBLISHED',
        'ARCHIVED',
      ]);
    });

    it('trims whitespace around values', () => {
      expect(parseEnumValues('ACTIVE , INACTIVE')).toEqual(['ACTIVE', 'INACTIVE']);
      expect(parseEnumValues('  DRAFT  ,  PUBLISHED  ')).toEqual(['DRAFT', 'PUBLISHED']);
    });

    it('handles single value', () => {
      expect(parseEnumValues('ACTIVE')).toEqual(['ACTIVE']);
    });
  });

  describe('case conversion', () => {
    it('converts lowercase to UPPER_CASE', () => {
      expect(parseEnumValues('active,inactive')).toEqual(['ACTIVE', 'INACTIVE']);
    });

    it('converts camelCase to UPPER_CASE', () => {
      expect(parseEnumValues('inProgress,notStarted')).toEqual(['INPROGRESS', 'NOTSTARTED']);
    });

    it('converts mixed case to UPPER_CASE', () => {
      expect(parseEnumValues('Active,INACTIVE,pending')).toEqual(['ACTIVE', 'INACTIVE', 'PENDING']);
    });
  });

  describe('space handling', () => {
    it('converts spaces to underscores', () => {
      expect(parseEnumValues('in progress,not started')).toEqual(['IN_PROGRESS', 'NOT_STARTED']);
    });

    it('handles multiple spaces', () => {
      expect(parseEnumValues('in   progress')).toEqual(['IN_PROGRESS']);
    });
  });

  describe('filtering', () => {
    it('filters out empty values', () => {
      expect(parseEnumValues('ACTIVE,,INACTIVE')).toEqual(['ACTIVE', 'INACTIVE']);
      expect(parseEnumValues(',ACTIVE,')).toEqual(['ACTIVE']);
    });

    it('returns empty array for empty input', () => {
      expect(parseEnumValues('')).toEqual([]);
      expect(parseEnumValues('   ')).toEqual([]);
    });

    it('returns empty array for only commas', () => {
      expect(parseEnumValues(',,')).toEqual([]);
    });
  });
});

// ============================================================================
// isReservedFieldName Tests
// ============================================================================

describe('isReservedFieldName', () => {
  it('returns true for reserved names', () => {
    expect(isReservedFieldName('id')).toBe(true);
    expect(isReservedFieldName('createdAt')).toBe(true);
    expect(isReservedFieldName('updatedAt')).toBe(true);
    expect(isReservedFieldName('deletedAt')).toBe(true);
  });

  it('returns false for non-reserved names', () => {
    expect(isReservedFieldName('title')).toBe(false);
    expect(isReservedFieldName('name')).toBe(false);
    expect(isReservedFieldName('email')).toBe(false);
    expect(isReservedFieldName('userId')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(isReservedFieldName('ID')).toBe(false);
    expect(isReservedFieldName('Id')).toBe(false);
    expect(isReservedFieldName('CREATEDAT')).toBe(false);
  });
});

// ============================================================================
// RESERVED_FIELD_NAMES Tests
// ============================================================================

describe('RESERVED_FIELD_NAMES', () => {
  it('contains expected reserved names', () => {
    expect(RESERVED_FIELD_NAMES).toContain('id');
    expect(RESERVED_FIELD_NAMES).toContain('createdAt');
    expect(RESERVED_FIELD_NAMES).toContain('updatedAt');
    expect(RESERVED_FIELD_NAMES).toContain('deletedAt');
  });

  it('has exactly 4 reserved names', () => {
    expect(RESERVED_FIELD_NAMES).toHaveLength(4);
  });
});

// ============================================================================
// getFieldTypeInfo Tests
// ============================================================================

describe('getFieldTypeInfo', () => {
  it('returns info for string type', () => {
    const info = getFieldTypeInfo('string');
    expect(info).toBeDefined();
    expect(info?.prismaType).toBe('String');
    expect(info?.zodSchema).toContain('z.string()');
  });

  it('returns info for text type', () => {
    const info = getFieldTypeInfo('text');
    expect(info).toBeDefined();
    expect(info?.prismaType).toBe('String');
    expect(info?.supportsLongText).toBe(true);
  });

  it('returns info for int type', () => {
    const info = getFieldTypeInfo('int');
    expect(info).toBeDefined();
    expect(info?.prismaType).toBe('Int');
    expect(info?.zodSchema).toContain('z.number().int()');
  });

  it('returns info for float type', () => {
    const info = getFieldTypeInfo('float');
    expect(info).toBeDefined();
    expect(info?.prismaType).toBe('Float');
    expect(info?.zodSchema).toContain('z.number()');
  });

  it('returns info for boolean type', () => {
    const info = getFieldTypeInfo('boolean');
    expect(info).toBeDefined();
    expect(info?.prismaType).toBe('Boolean');
    expect(info?.zodSchema).toContain('z.boolean()');
  });

  it('returns info for datetime type', () => {
    const info = getFieldTypeInfo('datetime');
    expect(info).toBeDefined();
    expect(info?.prismaType).toBe('DateTime');
    expect(info?.zodSchema).toContain('z.date()');
  });

  it('returns info for json type', () => {
    const info = getFieldTypeInfo('json');
    expect(info).toBeDefined();
    expect(info?.prismaType).toBe('Json');
  });

  it('returns info for enum type', () => {
    const info = getFieldTypeInfo('enum');
    expect(info).toBeDefined();
    expect(info?.prismaType).toBe(''); // Dynamic
    expect(info?.zodSchema).toBe(''); // Dynamic
  });

  it('returns undefined for invalid type', () => {
    // @ts-expect-error Testing invalid type
    const info = getFieldTypeInfo('invalid');
    expect(info).toBeUndefined();
  });
});

// ============================================================================
// FIELD_TYPES Tests
// ============================================================================

describe('FIELD_TYPES', () => {
  it('contains all 8 field types', () => {
    expect(FIELD_TYPES).toHaveLength(8);
  });

  it('has unique type identifiers', () => {
    const types = FIELD_TYPES.map((t) => t.type);
    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBe(types.length);
  });

  it('all types have required properties', () => {
    for (const fieldType of FIELD_TYPES) {
      expect(fieldType.type).toBeDefined();
      expect(fieldType.label).toBeDefined();
      expect(fieldType.description).toBeDefined();
      expect(typeof fieldType.prismaType).toBe('string');
      expect(typeof fieldType.zodSchema).toBe('string');
    }
  });

  it('contains expected types', () => {
    const types = FIELD_TYPES.map((t) => t.type);
    expect(types).toContain('string');
    expect(types).toContain('text');
    expect(types).toContain('int');
    expect(types).toContain('float');
    expect(types).toContain('boolean');
    expect(types).toContain('datetime');
    expect(types).toContain('json');
    expect(types).toContain('enum');
  });
});
