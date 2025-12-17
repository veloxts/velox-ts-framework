/**
 * Test Helpers for Field Generation Tests
 *
 * Factory functions and utilities for creating test data.
 */

import type { EnumDefinition, FieldAttributes, FieldDefinition, FieldType } from '../types.js';

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_ATTRIBUTES: FieldAttributes = {
  optional: false,
  unique: false,
  hasDefault: false,
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a test field definition with sensible defaults
 */
export function createTestField(
  overrides: Partial<FieldDefinition> & { name: string; type: FieldType }
): FieldDefinition {
  return {
    name: overrides.name,
    type: overrides.type,
    attributes: overrides.attributes ?? { ...DEFAULT_ATTRIBUTES },
    enumDef: overrides.enumDef,
  };
}

/**
 * Create a test field with specific attributes
 */
export function createFieldWithAttributes(
  name: string,
  type: FieldType,
  attributes: Partial<FieldAttributes>
): FieldDefinition {
  return {
    name,
    type,
    attributes: {
      ...DEFAULT_ATTRIBUTES,
      ...attributes,
    },
  };
}

/**
 * Create an enum field definition
 */
export function createEnumField(
  name: string,
  enumName: string,
  values: string[],
  attributes?: Partial<FieldAttributes>
): FieldDefinition {
  return {
    name,
    type: 'enum',
    attributes: {
      ...DEFAULT_ATTRIBUTES,
      ...attributes,
    },
    enumDef: {
      name: enumName,
      values,
    },
  };
}

/**
 * Create a test enum definition
 */
export function createTestEnum(name: string, values: string[]): EnumDefinition {
  return { name, values };
}

// ============================================================================
// Common Test Fields
// ============================================================================

/**
 * A simple string field
 */
export const simpleStringField = createTestField({
  name: 'title',
  type: 'string',
});

/**
 * An optional text field
 */
export const optionalTextField = createFieldWithAttributes('description', 'text', {
  optional: true,
});

/**
 * A unique string field
 */
export const uniqueStringField = createFieldWithAttributes('email', 'string', {
  unique: true,
});

/**
 * A boolean field with default
 */
export const booleanWithDefault = createFieldWithAttributes('isActive', 'boolean', {
  hasDefault: true,
  defaultValue: 'true',
});

/**
 * An integer field
 */
export const integerField = createTestField({
  name: 'count',
  type: 'int',
});

/**
 * A float field
 */
export const floatField = createTestField({
  name: 'price',
  type: 'float',
});

/**
 * A datetime field
 */
export const datetimeField = createTestField({
  name: 'publishedAt',
  type: 'datetime',
});

/**
 * A JSON field
 */
export const jsonField = createTestField({
  name: 'metadata',
  type: 'json',
});

/**
 * An enum field
 */
export const statusEnumField = createEnumField('status', 'Status', [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
]);

/**
 * A comprehensive set of all field types
 */
export const allFieldTypes: FieldDefinition[] = [
  simpleStringField,
  optionalTextField,
  integerField,
  floatField,
  createTestField({ name: 'isPublished', type: 'boolean' }),
  datetimeField,
  jsonField,
  statusEnumField,
];
