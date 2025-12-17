/**
 * Interactive Menu Actions for Field Definition
 *
 * Handles the main menu and action selection for the interactive
 * field definition workflow.
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';

import { displayFieldsSummary } from './display.js';
import { cloneTemplateFields, getTemplate, getTemplateOptions } from './templates.js';
import type { FieldDefinition } from './types.js';
import { FIELD_TYPES } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Available actions from the main menu
 */
export type MainMenuAction = 'add' | 'edit' | 'remove' | 'template' | 'done' | 'skip';

// ============================================================================
// Main Menu
// ============================================================================

/**
 * Prompt for main menu action
 */
export async function promptMainMenu(fieldCount: number): Promise<MainMenuAction | symbol> {
  const options: Array<{ value: MainMenuAction; label: string; hint?: string }> = [];

  if (fieldCount === 0) {
    options.push(
      { value: 'add', label: 'Add your first field', hint: 'Define a custom field' },
      { value: 'template', label: 'Use a field template', hint: 'Quick add common patterns' },
      { value: 'skip', label: 'Skip fields', hint: 'Generate skeleton only' }
    );
  } else {
    options.push(
      { value: 'add', label: 'Add another field', hint: 'Define a new field' },
      { value: 'edit', label: 'Edit a field', hint: 'Modify existing field' },
      { value: 'remove', label: 'Remove a field', hint: 'Delete a field' },
      { value: 'template', label: 'Use a field template', hint: 'Quick add multiple fields' },
      { value: 'done', label: "I'm done", hint: 'Generate the code' }
    );
  }

  const result = await p.select({
    message: 'What would you like to do?',
    options,
    initialValue: fieldCount === 0 ? 'add' : 'done',
  });

  if (p.isCancel(result)) {
    return result;
  }

  return result as MainMenuAction;
}

// ============================================================================
// Field Selection
// ============================================================================

/**
 * Select a field for editing or removal
 */
export async function selectField(
  fields: FieldDefinition[],
  purpose: 'edit' | 'remove'
): Promise<number | null> {
  if (fields.length === 0) {
    p.log.warning('No fields to select.');
    return null;
  }

  const options = fields.map((field, index) => {
    const typeInfo = FIELD_TYPES.find((t) => t.type === field.type);
    const typeName = typeInfo?.label ?? field.type;
    return {
      value: index,
      label: `${index + 1}. ${field.name}`,
      hint: typeName,
    };
  });

  options.push({
    value: -1,
    label: 'Cancel',
    hint: 'Go back to main menu',
  });

  const message = purpose === 'edit' ? 'Select field to edit:' : 'Select field to remove:';

  const result = await p.select({
    message,
    options,
  });

  if (p.isCancel(result) || result === -1) {
    return null;
  }

  return result as number;
}

// ============================================================================
// Template Selection
// ============================================================================

/**
 * Select and apply a field template
 * Returns the fields to add, or null if cancelled
 */
export async function selectAndApplyTemplate(): Promise<FieldDefinition[] | null> {
  const templateOptions = getTemplateOptions();

  templateOptions.push({
    value: 'cancel',
    label: 'Cancel',
    hint: 'Go back to main menu',
  });

  const result = await p.select({
    message: 'Choose a template to add pre-configured fields:',
    options: templateOptions,
  });

  if (p.isCancel(result) || result === 'cancel') {
    return null;
  }

  const template = getTemplate(result as string);
  if (!template) {
    p.log.error('Template not found.');
    return null;
  }

  // Show preview of template fields
  console.log();
  console.log(pc.bold(`Template: ${template.name}`));
  console.log(pc.dim('Fields that will be added:'));
  for (const field of template.fields) {
    const typeInfo = FIELD_TYPES.find((t) => t.type === field.type);
    const typeName = typeInfo?.label ?? field.type;
    const attrs: string[] = [];
    if (field.attributes.optional) attrs.push('optional');
    if (field.attributes.unique) attrs.push('unique');
    if (field.attributes.hasDefault) attrs.push(`default: ${field.attributes.defaultValue}`);
    if (field.enumDef) attrs.push(field.enumDef.name);
    const attrStr = attrs.length > 0 ? pc.dim(` [${attrs.join(', ')}]`) : '';
    console.log(`  ${pc.cyan(field.name)}: ${typeName}${attrStr}`);
  }
  console.log();

  const confirm = await p.confirm({
    message: `Apply template "${template.name}" (${template.fields.length} fields)?`,
    initialValue: true,
  });

  if (p.isCancel(confirm) || !confirm) {
    return null;
  }

  return cloneTemplateFields(template);
}

// ============================================================================
// Confirmation
// ============================================================================

/**
 * Confirm before finalizing fields
 */
export async function confirmFieldsComplete(fields: FieldDefinition[]): Promise<boolean> {
  if (fields.length === 0) {
    const confirm = await p.confirm({
      message: 'Generate resource without custom fields (skeleton only)?',
      initialValue: false,
    });
    return !p.isCancel(confirm) && confirm;
  }

  displayFieldsSummary(fields);

  const confirm = await p.confirm({
    message: `Generate resource with ${fields.length} field${fields.length === 1 ? '' : 's'}?`,
    initialValue: true,
  });

  return !p.isCancel(confirm) && confirm;
}

/**
 * Confirm before removing a field
 */
export async function confirmRemoveField(field: FieldDefinition): Promise<boolean> {
  const typeInfo = FIELD_TYPES.find((t) => t.type === field.type);
  const typeName = typeInfo?.label ?? field.type;

  const confirm = await p.confirm({
    message: `Remove field "${field.name}" (${typeName})?`,
    initialValue: false,
  });

  return !p.isCancel(confirm) && confirm;
}

/**
 * Confirm cancellation
 */
export async function confirmCancel(): Promise<boolean> {
  const confirm = await p.confirm({
    message: 'Are you sure you want to cancel? All fields will be lost.',
    initialValue: false,
  });

  return !p.isCancel(confirm) && confirm;
}

// ============================================================================
// Template Conflict Handling
// ============================================================================

/**
 * Check for and handle template field conflicts
 * Returns the fields that can be added (non-conflicting)
 */
export async function handleTemplateConflicts(
  templateFields: FieldDefinition[],
  existingNames: Set<string>
): Promise<FieldDefinition[] | null> {
  const conflicts = templateFields.filter((f) => existingNames.has(f.name));
  const nonConflicting = templateFields.filter((f) => !existingNames.has(f.name));

  if (conflicts.length === 0) {
    return templateFields;
  }

  if (nonConflicting.length === 0) {
    p.log.warning(`All template fields conflict with existing fields.`);
    p.log.info(`Conflicting: ${conflicts.map((f) => f.name).join(', ')}`);
    return null;
  }

  p.log.warning(`Some template fields conflict with existing fields.`);
  p.log.info(`Conflicting: ${conflicts.map((f) => f.name).join(', ')}`);
  p.log.info(`Will add: ${nonConflicting.map((f) => f.name).join(', ')}`);

  const confirm = await p.confirm({
    message: `Add ${nonConflicting.length} non-conflicting fields? (skip ${conflicts.length} conflicting)`,
    initialValue: true,
  });

  if (p.isCancel(confirm) || !confirm) {
    return null;
  }

  return nonConflicting;
}

// ============================================================================
// Success Messages
// ============================================================================

/**
 * Show success message for added field
 */
export function showFieldAdded(field: FieldDefinition): void {
  const typeInfo = FIELD_TYPES.find((t) => t.type === field.type);
  const typeName = typeInfo?.label ?? field.type;
  p.log.success(`Added: ${pc.cyan(field.name)} (${typeName})`);
}

/**
 * Show success message for updated field
 */
export function showFieldUpdated(field: FieldDefinition): void {
  const typeInfo = FIELD_TYPES.find((t) => t.type === field.type);
  const typeName = typeInfo?.label ?? field.type;
  p.log.success(`Updated: ${pc.cyan(field.name)} (${typeName})`);
}

/**
 * Show success message for removed field
 */
export function showFieldRemoved(fieldName: string): void {
  p.log.success(`Removed: ${pc.cyan(fieldName)}`);
}

/**
 * Show success message for applied template
 */
export function showTemplateApplied(count: number, templateName: string): void {
  p.log.success(
    `Applied template: ${templateName} (${count} field${count === 1 ? '' : 's'} added)`
  );
}
