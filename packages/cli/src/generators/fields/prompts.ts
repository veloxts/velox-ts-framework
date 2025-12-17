/**
 * Field Prompts Module
 *
 * Interactive prompts for collecting field definitions using @clack/prompts.
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';

import {
  FIELD_TYPES,
  type FieldAttributes,
  type FieldDefinition,
  type FieldType,
  parseEnumValues,
  validateEnumName,
  validateEnumValues,
  validateFieldName,
} from './types.js';

// ============================================================================
// Field Collection
// ============================================================================

/**
 * Options for field collection
 */
export interface CollectFieldsOptions {
  /** Resource name for context in prompts */
  resourceName: string;
  /** Minimum number of fields required (default: 0) */
  minFields?: number;
}

/**
 * Result of field collection
 */
export interface CollectFieldsResult {
  /** Collected field definitions */
  fields: FieldDefinition[];
  /** Whether user cancelled the prompts */
  cancelled: boolean;
}

/**
 * Collect field definitions interactively from the user
 */
export async function collectFields(options: CollectFieldsOptions): Promise<CollectFieldsResult> {
  const { resourceName, minFields = 0 } = options;
  const fields: FieldDefinition[] = [];
  const existingNames = new Set<string>();

  p.note(
    `Define the fields for your ${pc.cyan(resourceName)} model.\n` +
      `${pc.dim('Fields id, createdAt, updatedAt are added automatically.')}\n` +
      `${pc.dim('Press Ctrl+C to cancel at any time.')}`,
    'Field Definition'
  );

  let addMore = true;

  while (addMore) {
    const fieldResult = await collectSingleField(existingNames, fields.length + 1);

    if (fieldResult.cancelled) {
      return { fields, cancelled: true };
    }

    if (fieldResult.field) {
      const field = fieldResult.field;
      fields.push(field);
      existingNames.add(field.name);

      // Show what was added
      const typeInfo = FIELD_TYPES.find((t) => t.type === field.type);
      const attrs = formatAttributes(field.attributes);
      console.log(
        pc.green('  ✓') +
          ` Added: ${pc.bold(field.name)} (${typeInfo?.label ?? field.type})${attrs}`
      );
    }

    // Ask if they want to add more fields
    if (fields.length >= minFields) {
      const continueResult = await p.confirm({
        message: 'Add another field?',
        initialValue: true,
      });

      if (p.isCancel(continueResult)) {
        return { fields, cancelled: true };
      }

      addMore = continueResult;
    }
  }

  return { fields, cancelled: false };
}

// ============================================================================
// Single Field Collection
// ============================================================================

interface SingleFieldResult {
  field: FieldDefinition | null;
  cancelled: boolean;
}

/**
 * Collect a single field definition
 */
async function collectSingleField(
  existingNames: Set<string>,
  fieldNumber: number
): Promise<SingleFieldResult> {
  console.log();
  console.log(pc.bold(pc.cyan(`Field #${fieldNumber}`)));

  // 1. Get field name
  const nameResult = await p.text({
    message: 'Field name (camelCase)',
    placeholder: 'e.g., title, authorId, isPublished',
    validate: (value) => {
      const error = validateFieldName(value);
      if (error) return error;
      if (existingNames.has(value.trim())) {
        return `Field "${value.trim()}" already exists`;
      }
      return undefined;
    },
  });

  if (p.isCancel(nameResult)) {
    return { field: null, cancelled: true };
  }

  const fieldName = nameResult.trim();

  // 2. Get field type
  const typeOptions = FIELD_TYPES.map((t) => ({
    value: t.type,
    label: t.label,
    hint: t.description,
  }));

  const typeResult = await p.select({
    message: 'Field type',
    options: typeOptions,
  });

  if (p.isCancel(typeResult)) {
    return { field: null, cancelled: true };
  }

  const fieldType = typeResult as FieldType;

  // 3. Get field attributes
  const attributesResult = await collectFieldAttributes(fieldType);

  if (attributesResult.cancelled) {
    return { field: null, cancelled: true };
  }

  // 4. Get enum definition if needed
  let enumDef: FieldDefinition['enumDef'];
  if (fieldType === 'enum') {
    const enumResult = await collectEnumDefinition(fieldName);
    if (enumResult.cancelled) {
      return { field: null, cancelled: true };
    }
    enumDef = enumResult.enumDef;
  }

  return {
    field: {
      name: fieldName,
      type: fieldType,
      attributes: attributesResult.attributes,
      enumDef,
    },
    cancelled: false,
  };
}

// ============================================================================
// Field Attributes Collection
// ============================================================================

interface AttributesResult {
  attributes: FieldAttributes;
  cancelled: boolean;
}

/**
 * Collect field attributes (optional, unique, default)
 */
async function collectFieldAttributes(fieldType: FieldType): Promise<AttributesResult> {
  // Build options based on field type
  const options: Array<{ value: string; label: string; hint?: string }> = [
    { value: 'optional', label: 'Optional', hint: 'Field can be null' },
    { value: 'unique', label: 'Unique', hint: 'Values must be unique' },
  ];

  // Only show default option for certain types
  if (['string', 'text', 'int', 'float', 'boolean'].includes(fieldType)) {
    options.push({ value: 'hasDefault', label: 'Has default value' });
  }

  const selectedResult = await p.multiselect({
    message: 'Field attributes (space to toggle, enter to confirm)',
    options,
    required: false,
  });

  if (p.isCancel(selectedResult)) {
    return {
      attributes: { optional: false, unique: false, hasDefault: false },
      cancelled: true,
    };
  }

  const selected = selectedResult as string[];
  const attributes: FieldAttributes = {
    optional: selected.includes('optional'),
    unique: selected.includes('unique'),
    hasDefault: selected.includes('hasDefault'),
  };

  // If has default, ask for the value
  if (attributes.hasDefault) {
    const defaultResult = await collectDefaultValue(fieldType);
    if (defaultResult.cancelled) {
      return { attributes, cancelled: true };
    }
    attributes.defaultValue = defaultResult.value;
  }

  return { attributes, cancelled: false };
}

// ============================================================================
// Default Value Collection
// ============================================================================

interface DefaultValueResult {
  value: string;
  cancelled: boolean;
}

/**
 * Collect default value based on field type
 */
async function collectDefaultValue(fieldType: FieldType): Promise<DefaultValueResult> {
  if (fieldType === 'boolean') {
    const result = await p.select({
      message: 'Default value',
      options: [
        { value: 'true', label: 'true' },
        { value: 'false', label: 'false' },
      ],
    });

    if (p.isCancel(result)) {
      return { value: '', cancelled: true };
    }

    return { value: result as string, cancelled: false };
  }

  const placeholder = getDefaultPlaceholder(fieldType);
  const result = await p.text({
    message: 'Default value',
    placeholder,
    validate: (value) => {
      if (!value.trim()) return 'Default value is required';
      return validateDefaultValue(fieldType, value.trim());
    },
  });

  if (p.isCancel(result)) {
    return { value: '', cancelled: true };
  }

  return { value: result.trim(), cancelled: false };
}

/**
 * Get placeholder text for default value input
 */
function getDefaultPlaceholder(fieldType: FieldType): string {
  switch (fieldType) {
    case 'string':
    case 'text':
      return 'e.g., "default text"';
    case 'int':
      return 'e.g., 0';
    case 'float':
      return 'e.g., 0.0';
    default:
      return '';
  }
}

/**
 * Validate default value based on field type
 */
function validateDefaultValue(fieldType: FieldType, value: string): string | undefined {
  switch (fieldType) {
    case 'int':
      if (!/^-?\d+$/.test(value)) {
        return 'Must be a valid integer';
      }
      break;
    case 'float':
      if (!/^-?\d+(\.\d+)?$/.test(value)) {
        return 'Must be a valid number';
      }
      break;
  }
  return undefined;
}

// ============================================================================
// Enum Definition Collection
// ============================================================================

interface EnumDefinitionResult {
  enumDef: FieldDefinition['enumDef'];
  cancelled: boolean;
}

/**
 * Collect enum type name and values
 */
async function collectEnumDefinition(fieldName: string): Promise<EnumDefinitionResult> {
  // Suggest enum name based on field name
  const suggestedName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

  const nameResult = await p.text({
    message: 'Enum type name (PascalCase)',
    placeholder: suggestedName,
    initialValue: suggestedName,
    validate: validateEnumName,
  });

  if (p.isCancel(nameResult)) {
    return { enumDef: undefined, cancelled: true };
  }

  const enumName = nameResult.trim();

  const valuesResult = await p.text({
    message: 'Enum values (comma-separated, will be converted to UPPER_CASE)',
    placeholder: 'e.g., draft, published, archived',
    validate: (value) => {
      const parsed = parseEnumValues(value);
      return validateEnumValues(parsed);
    },
  });

  if (p.isCancel(valuesResult)) {
    return { enumDef: undefined, cancelled: true };
  }

  const enumValues = parseEnumValues(valuesResult);

  return {
    enumDef: {
      name: enumName,
      values: enumValues,
    },
    cancelled: false,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format attributes for display
 */
function formatAttributes(attrs: FieldAttributes): string {
  const parts: string[] = [];
  if (attrs.optional) parts.push('optional');
  if (attrs.unique) parts.push('unique');
  if (attrs.hasDefault) parts.push(`default: ${attrs.defaultValue}`);

  return parts.length > 0 ? pc.dim(` [${parts.join(', ')}]`) : '';
}

/**
 * Display a summary of collected fields
 */
export function displayFieldsSummary(fields: FieldDefinition[]): void {
  if (fields.length === 0) {
    console.log(pc.dim('  No custom fields defined.'));
    return;
  }

  console.log();
  console.log(pc.bold('Fields to generate:'));
  console.log(pc.dim('─'.repeat(40)));

  for (const field of fields) {
    const typeInfo = FIELD_TYPES.find((t) => t.type === field.type);
    const attrs = formatAttributes(field.attributes);
    const enumInfo = field.enumDef
      ? pc.dim(` → ${field.enumDef.name}(${field.enumDef.values.join(', ')})`)
      : '';

    console.log(`  ${pc.cyan(field.name)}: ${typeInfo?.label ?? field.type}${attrs}${enumInfo}`);
  }

  console.log(pc.dim('─'.repeat(40)));
  console.log(pc.dim(`  + id, createdAt, updatedAt (auto-generated)`));
  console.log();
}
