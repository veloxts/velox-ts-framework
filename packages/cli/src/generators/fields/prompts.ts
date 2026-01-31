/**
 * Field Prompts Module
 *
 * Interactive prompts for collecting field definitions using @clack/prompts.
 * Features an interactive menu-driven workflow with add/edit/remove capabilities.
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';

import {
  confirmCancel,
  confirmFieldsComplete,
  confirmRemoveField,
  handleTemplateConflicts,
  type MainMenuAction,
  promptMainMenu,
  selectAndApplyTemplate,
  selectField,
  showFieldAdded,
  showFieldRemoved,
  showFieldUpdated,
  showTemplateApplied,
} from './actions.js';
import { clearAndDisplay, displayEnumPreview } from './display.js';
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
 * Uses a menu-driven workflow with add/edit/remove capabilities
 */
export async function collectFields(options: CollectFieldsOptions): Promise<CollectFieldsResult> {
  const { resourceName } = options;
  const fields: FieldDefinition[] = [];
  const existingNames = new Set<string>();

  // Main interactive loop
  while (true) {
    // Display current state
    clearAndDisplay(fields, resourceName);

    // Prompt for action
    const action = await promptMainMenu(fields.length);

    if (p.isCancel(action)) {
      const shouldCancel = await confirmCancel();
      if (shouldCancel) {
        p.cancel('Field definition cancelled.');
        return { fields: [], cancelled: true };
      }
      continue;
    }

    // Handle action
    switch (action as MainMenuAction) {
      case 'add': {
        const result = await collectSingleField(existingNames, fields.length + 1);
        if (result.cancelled) continue;
        if (result.field) {
          fields.push(result.field);
          existingNames.add(result.field.name);
          showFieldAdded(result.field);
          await pause(600);
        }
        break;
      }

      case 'edit': {
        const fieldIndex = await selectField(fields, 'edit');
        if (fieldIndex === null) continue;

        const field = fields[fieldIndex];
        const edited = await editField(field, existingNames);
        if (edited) {
          existingNames.delete(field.name);
          fields[fieldIndex] = edited;
          existingNames.add(edited.name);
          showFieldUpdated(edited);
          await pause(600);
        }
        break;
      }

      case 'remove': {
        const fieldIndex = await selectField(fields, 'remove');
        if (fieldIndex === null) continue;

        const field = fields[fieldIndex];
        const confirmed = await confirmRemoveField(field);
        if (confirmed) {
          fields.splice(fieldIndex, 1);
          existingNames.delete(field.name);
          showFieldRemoved(field.name);
          await pause(600);
        }
        break;
      }

      case 'template': {
        const templateFields = await selectAndApplyTemplate();
        if (!templateFields) continue;

        // Handle conflicts
        const fieldsToAdd = await handleTemplateConflicts(templateFields, existingNames);
        if (!fieldsToAdd || fieldsToAdd.length === 0) continue;

        // Add non-conflicting fields
        for (const field of fieldsToAdd) {
          fields.push(field);
          existingNames.add(field.name);
        }
        showTemplateApplied(fieldsToAdd.length, 'Template');
        await pause(800);
        break;
      }

      case 'skip': {
        const confirmed = await p.confirm({
          message: 'Generate skeleton without custom fields?',
          initialValue: true,
        });
        if (p.isCancel(confirmed) || !confirmed) continue;
        p.outro(pc.dim('Generating skeleton...'));
        return { fields: [], cancelled: false };
      }

      case 'done': {
        clearAndDisplay(fields, resourceName);
        const confirmed = await confirmFieldsComplete(fields);
        if (confirmed) {
          p.outro(pc.green('Fields confirmed!'));
          return { fields, cancelled: false };
        }
        break;
      }
    }
  }
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
  fieldNumber: number,
  prefill?: FieldDefinition
): Promise<SingleFieldResult> {
  console.log();
  console.log(pc.bold(pc.cyan(prefill ? `Edit Field: ${prefill.name}` : `Field #${fieldNumber}`)));

  // 1. Get field name
  const nameResult = await p.text({
    message: 'Field name (camelCase)',
    placeholder: 'e.g., title, authorId, isPublished',
    initialValue: prefill?.name ?? '',
    validate: (value) => {
      if (!value) return 'Field name is required';
      const trimmed = value.trim();
      const error = validateFieldName(trimmed);
      if (error) return error;
      // Allow same name if editing, otherwise check for duplicates
      if (prefill?.name !== trimmed && existingNames.has(trimmed)) {
        return `Field "${trimmed}" already exists`;
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
    initialValue: prefill?.type,
  });

  if (p.isCancel(typeResult)) {
    return { field: null, cancelled: true };
  }

  const fieldType = typeResult as FieldType;

  // 3. Get field attributes
  const attributesResult = await collectFieldAttributes(fieldType, prefill?.attributes);

  if (attributesResult.cancelled) {
    return { field: null, cancelled: true };
  }

  // 4. Get enum definition if needed
  let enumDef: FieldDefinition['enumDef'];
  if (fieldType === 'enum') {
    const enumResult = await collectEnumDefinition(fieldName, prefill?.enumDef);
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

/**
 * Edit an existing field
 */
async function editField(
  field: FieldDefinition,
  existingNames: Set<string>
): Promise<FieldDefinition | null> {
  const result = await collectSingleField(existingNames, 0, field);
  if (result.cancelled || !result.field) {
    return null;
  }
  return result.field;
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
async function collectFieldAttributes(
  fieldType: FieldType,
  prefill?: FieldAttributes
): Promise<AttributesResult> {
  // Build options based on field type
  const options: Array<{ value: string; label: string; hint?: string }> = [
    { value: 'optional', label: 'Optional', hint: 'Field can be null' },
    { value: 'unique', label: 'Unique', hint: 'Values must be unique' },
  ];

  // Only show default option for certain types
  if (['string', 'text', 'int', 'float', 'boolean'].includes(fieldType)) {
    options.push({ value: 'hasDefault', label: 'Has default value' });
  }

  // Determine initial values from prefill
  const initialValues: string[] = [];
  if (prefill?.optional) initialValues.push('optional');
  if (prefill?.unique) initialValues.push('unique');
  if (prefill?.hasDefault) initialValues.push('hasDefault');

  const selectedResult = await p.multiselect({
    message: 'Field attributes (space to toggle, enter to confirm)',
    options,
    required: false,
    initialValues: initialValues.length > 0 ? initialValues : undefined,
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
    const defaultResult = await collectDefaultValue(fieldType, prefill?.defaultValue);
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
async function collectDefaultValue(
  fieldType: FieldType,
  prefill?: string
): Promise<DefaultValueResult> {
  if (fieldType === 'boolean') {
    const result = await p.select({
      message: 'Default value',
      options: [
        { value: 'true', label: 'true' },
        { value: 'false', label: 'false' },
      ],
      initialValue: prefill ?? 'false',
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
    initialValue: prefill ?? '',
    validate: (value) => {
      if (!value || !value.trim()) return 'Default value is required';
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
 * Collect enum type name and values with preview
 */
async function collectEnumDefinition(
  fieldName: string,
  prefill?: { name: string; values: string[] }
): Promise<EnumDefinitionResult> {
  // Suggest enum name based on field name
  const suggestedName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

  const nameResult = await p.text({
    message: 'Enum type name (PascalCase)',
    placeholder: suggestedName,
    initialValue: prefill?.name ?? suggestedName,
    validate: (value) => (value ? validateEnumName(value) : 'Enum name is required'),
  });

  if (p.isCancel(nameResult)) {
    return { enumDef: undefined, cancelled: true };
  }

  const enumName = nameResult.trim();

  const valuesResult = await p.text({
    message: 'Enum values (comma-separated, will be converted to UPPER_CASE)',
    placeholder: 'e.g., draft, published, archived',
    initialValue: prefill?.values?.join(', ') ?? '',
    validate: (value) => {
      if (!value) return 'At least one enum value is required';
      const parsed = parseEnumValues(value);
      return validateEnumValues(parsed);
    },
  });

  if (p.isCancel(valuesResult)) {
    return { enumDef: undefined, cancelled: true };
  }

  const enumValues = parseEnumValues(valuesResult);

  // Show preview
  displayEnumPreview(enumName, enumValues);

  // Confirm enum
  const confirmResult = await p.confirm({
    message: 'Looks good?',
    initialValue: true,
  });

  if (p.isCancel(confirmResult) || !confirmResult) {
    // Allow re-entry
    return collectEnumDefinition(fieldName, { name: enumName, values: enumValues });
  }

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
 * Brief pause for user feedback
 */
async function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
