/**
 * Field Types Module
 *
 * Defines the types and mappings for interactive field collection
 * in the resource generator.
 */

// ============================================================================
// Field Type Definitions
// ============================================================================

/**
 * Supported field types for interactive prompts
 */
export type FieldType =
  | 'string'
  | 'text'
  | 'int'
  | 'float'
  | 'boolean'
  | 'datetime'
  | 'json'
  | 'enum';

/**
 * Field attribute options
 */
export interface FieldAttributes {
  /** Field is nullable (optional) */
  optional: boolean;
  /** Field has unique constraint */
  unique: boolean;
  /** Field has a default value */
  hasDefault: boolean;
  /** The default value (if hasDefault is true) */
  defaultValue?: string;
}

/**
 * Enum definition for enum fields
 */
export interface EnumDefinition {
  /** Enum type name (PascalCase) */
  name: string;
  /** Enum values (UPPER_CASE) */
  values: string[];
}

/**
 * A single field definition collected from user
 */
export interface FieldDefinition {
  /** Field name (camelCase) */
  name: string;
  /** Field type */
  type: FieldType;
  /** Field attributes */
  attributes: FieldAttributes;
  /** Enum definition (only for enum type) */
  enumDef?: EnumDefinition;
}

// ============================================================================
// Field Type Display Information
// ============================================================================

/**
 * Display information for field types in prompts
 */
export interface FieldTypeInfo {
  /** Type identifier */
  type: FieldType;
  /** Display label in prompt */
  label: string;
  /** Short description */
  description: string;
  /** Prisma type mapping */
  prismaType: string;
  /** Zod schema factory (without field name) */
  zodSchema: string;
  /** Whether this is a long text type (for UI hints, not Prisma modifiers) */
  isLongText?: boolean;
}

/**
 * All available field types with their display info
 */
export const FIELD_TYPES: readonly FieldTypeInfo[] = [
  {
    type: 'string',
    label: 'String',
    description: 'Short text (up to 255 chars)',
    prismaType: 'String',
    zodSchema: 'z.string().min(1).max(255)',
  },
  {
    type: 'text',
    label: 'Text (long)',
    description: 'Long text content',
    prismaType: 'String',
    zodSchema: 'z.string()',
    isLongText: true,
  },
  {
    type: 'int',
    label: 'Integer',
    description: 'Whole numbers',
    prismaType: 'Int',
    zodSchema: 'z.number().int()',
  },
  {
    type: 'float',
    label: 'Float',
    description: 'Decimal numbers',
    prismaType: 'Float',
    zodSchema: 'z.number()',
  },
  {
    type: 'boolean',
    label: 'Boolean',
    description: 'True/false values',
    prismaType: 'Boolean',
    zodSchema: 'z.boolean()',
  },
  {
    type: 'datetime',
    label: 'DateTime',
    description: 'Date and time',
    prismaType: 'DateTime',
    zodSchema: 'z.date()',
  },
  {
    type: 'json',
    label: 'JSON',
    description: 'JSON data',
    prismaType: 'Json',
    zodSchema: 'z.record(z.unknown())',
  },
  {
    type: 'enum',
    label: 'Enum',
    description: 'Predefined values',
    prismaType: '', // Dynamic based on enum name
    zodSchema: '', // Dynamic based on enum values
  },
] as const;

/**
 * Get field type info by type
 */
export function getFieldTypeInfo(type: FieldType): FieldTypeInfo | undefined {
  return FIELD_TYPES.find((t) => t.type === type);
}

// ============================================================================
// Reserved Field Names
// ============================================================================

/**
 * Field names that are reserved and cannot be used
 */
export const RESERVED_FIELD_NAMES: readonly string[] = [
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
] as const;

/**
 * Check if a field name is reserved
 */
export function isReservedFieldName(name: string): boolean {
  return RESERVED_FIELD_NAMES.includes(name);
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate field name format (camelCase)
 */
export function validateFieldName(name: string): string | undefined {
  if (!name || name.trim().length === 0) {
    return 'Field name is required';
  }

  const trimmed = name.trim();

  // Check for valid identifier
  if (!/^[a-z][a-zA-Z0-9]*$/.test(trimmed)) {
    return 'Field name must be camelCase (start with lowercase letter, no special characters)';
  }

  // Check for reserved names
  if (isReservedFieldName(trimmed)) {
    return `"${trimmed}" is a reserved field name`;
  }

  return undefined;
}

/**
 * Validate enum name format (PascalCase)
 */
export function validateEnumName(name: string): string | undefined {
  if (!name || name.trim().length === 0) {
    return 'Enum name is required';
  }

  const trimmed = name.trim();

  if (!/^[A-Z][a-zA-Z0-9]*$/.test(trimmed)) {
    return 'Enum name must be PascalCase (start with uppercase letter)';
  }

  return undefined;
}

/**
 * Validate enum values format (UPPER_CASE)
 */
export function validateEnumValues(values: string[]): string | undefined {
  if (values.length === 0) {
    return 'At least one enum value is required';
  }

  for (const value of values) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(value)) {
      return `Enum value "${value}" must be UPPER_CASE`;
    }
  }

  return undefined;
}

/**
 * Parse comma-separated enum values
 */
export function parseEnumValues(input: string): string[] {
  return input
    .split(',')
    .map((v) => v.trim().toUpperCase().replace(/\s+/g, '_'))
    .filter((v) => v.length > 0);
}
