/**
 * Display utilities for interactive field prompts
 *
 * Provides table rendering, formatting, and visual feedback functions
 * for the field definition workflow.
 */

import pc from 'picocolors';

import type { FieldDefinition } from './types.js';
import { FIELD_TYPES } from './types.js';

// ============================================================================
// Table Display
// ============================================================================

/**
 * Display fields in a formatted ASCII table with color-coded types
 */
export function displayFieldsTable(fields: FieldDefinition[], resourceName?: string): void {
  // Header with resource name and field count
  const header = resourceName ? `Building ${resourceName} Model` : 'Field Definition';
  const badge =
    fields.length > 0 ? `[${fields.length} field${fields.length === 1 ? '' : 's'}]` : '';

  console.log();
  console.log(pc.bold(header) + (badge ? `  ${pc.dim(badge)}` : ''));
  console.log();

  if (fields.length === 0) {
    console.log(pc.dim('  No fields defined yet.'));
    console.log(pc.dim('  Add fields using the menu below.'));
    console.log();
    return;
  }

  // Calculate column widths
  const nameWidth = Math.max(12, ...fields.map((f) => f.name.length)) + 2;
  const typeWidth = 14;
  const attrWidth = 28;

  // Table header
  console.log(pc.dim('Current Fields:'));
  console.log(makeTableBorder('top', nameWidth, typeWidth, attrWidth));
  console.log(
    makeTableRow('#', 'Field Name', 'Type', 'Attributes', nameWidth, typeWidth, attrWidth, true)
  );
  console.log(makeTableBorder('middle', nameWidth, typeWidth, attrWidth));

  // Table rows
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const typeInfo = FIELD_TYPES.find((t) => t.type === field.type);
    const typeName = typeInfo?.label ?? field.type;
    const attrs = formatAttributesForTable(field);

    console.log(
      makeTableRow(
        String(i + 1),
        pc.cyan(field.name),
        colorType(typeName),
        attrs,
        nameWidth,
        typeWidth,
        attrWidth
      )
    );
  }

  // Table footer
  console.log(makeTableBorder('bottom', nameWidth, typeWidth, attrWidth));
  console.log(pc.dim('  Auto-generated: id, createdAt, updatedAt'));
  console.log();
}

/**
 * Clear screen and display fields table
 */
export function clearAndDisplay(fields: FieldDefinition[], resourceName?: string): void {
  console.clear();
  displayFieldsTable(fields, resourceName);
}

/**
 * Display a field count badge
 */
export function displayFieldCount(count: number): string {
  if (count === 0) return pc.dim('[no fields]');
  return pc.dim(`[${count} field${count === 1 ? '' : 's'}]`);
}

// ============================================================================
// Enum Preview
// ============================================================================

/**
 * Display Prisma enum preview
 */
export function displayEnumPreview(enumName: string, values: string[]): void {
  console.log();
  console.log(pc.dim('Preview of generated Prisma enum:'));
  console.log(pc.dim(`┌${'─'.repeat(50)}┐`));
  console.log(
    pc.dim('│ ') +
      pc.magenta(`enum ${enumName} {`) +
      ' '.repeat(Math.max(0, 48 - enumName.length - 7)) +
      pc.dim(' │')
  );
  for (const value of values) {
    console.log(
      pc.dim('│   ') + pc.yellow(value) + ' '.repeat(Math.max(0, 46 - value.length)) + pc.dim(' │')
    );
  }
  console.log(pc.dim('│ ') + pc.magenta('}') + ' '.repeat(47) + pc.dim(' │'));
  console.log(pc.dim(`└${'─'.repeat(50)}┘`));
  console.log();
}

// ============================================================================
// Field Summary (for final confirmation)
// ============================================================================

/**
 * Display a summary of all fields before generation
 */
export function displayFieldsSummary(fields: FieldDefinition[]): void {
  console.log();
  console.log(pc.bold('Fields to generate:'));
  console.log(pc.dim('─'.repeat(50)));

  for (const field of fields) {
    const typeInfo = FIELD_TYPES.find((t) => t.type === field.type);
    const typeName = typeInfo?.label ?? field.type;
    const attrs = formatAttributesInline(field);
    const enumInfo = field.enumDef
      ? pc.dim(` -> ${field.enumDef.name}(${field.enumDef.values.join(', ')})`)
      : '';

    console.log(`  ${pc.cyan(field.name)}: ${colorType(typeName)}${attrs}${enumInfo}`);
  }

  console.log(pc.dim('─'.repeat(50)));
  console.log(pc.dim('  + id, createdAt, updatedAt (auto-generated)'));
  console.log();
}

// ============================================================================
// Table Helpers
// ============================================================================

type BorderPosition = 'top' | 'middle' | 'bottom';

function makeTableBorder(
  position: BorderPosition,
  nameWidth: number,
  typeWidth: number,
  attrWidth: number
): string {
  const corners: Record<BorderPosition, { left: string; middle: string; right: string }> = {
    top: { left: '┌', middle: '┬', right: '┐' },
    middle: { left: '├', middle: '┼', right: '┤' },
    bottom: { left: '└', middle: '┴', right: '┘' },
  };
  const c = corners[position];

  return pc.dim(
    c.left +
      '─'.repeat(4) +
      c.middle +
      '─'.repeat(nameWidth) +
      c.middle +
      '─'.repeat(typeWidth) +
      c.middle +
      '─'.repeat(attrWidth) +
      c.right
  );
}

function makeTableRow(
  num: string,
  name: string,
  type: string,
  attrs: string,
  nameWidth: number,
  typeWidth: number,
  attrWidth: number,
  isHeader = false
): string {
  const numCol = isHeader ? pc.dim(' # ') : ` ${num.padStart(2, ' ')} `;
  const nameCol = padStringWithAnsi(isHeader ? pc.dim(name) : name, nameWidth - 1);
  const typeCol = padStringWithAnsi(isHeader ? pc.dim(type) : type, typeWidth - 1);
  const attrCol = padStringWithAnsi(isHeader ? pc.dim(attrs) : attrs, attrWidth - 1);

  return (
    pc.dim('│') +
    numCol +
    pc.dim('│ ') +
    nameCol +
    pc.dim('│ ') +
    typeCol +
    pc.dim('│ ') +
    attrCol +
    pc.dim('│')
  );
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format attributes for table display using icons
 */
function formatAttributesForTable(field: FieldDefinition): string {
  const parts: string[] = [];
  const attrs = field.attributes;

  if (attrs.unique) parts.push(pc.yellow('*'));
  if (attrs.optional) parts.push(pc.dim('?'));
  if (attrs.hasDefault && attrs.defaultValue !== undefined) {
    parts.push(pc.green(`=${truncate(attrs.defaultValue, 8)}`));
  }
  if (field.enumDef) {
    parts.push(pc.magenta(`[${field.enumDef.name}]`));
  }

  return parts.join(' ');
}

/**
 * Format attributes inline (for summary view)
 */
function formatAttributesInline(field: FieldDefinition): string {
  const parts: string[] = [];
  const attrs = field.attributes;

  if (attrs.optional) parts.push('optional');
  if (attrs.unique) parts.push('unique');
  if (attrs.hasDefault && attrs.defaultValue !== undefined) {
    parts.push(`default: ${attrs.defaultValue}`);
  }

  return parts.length > 0 ? pc.dim(` [${parts.join(', ')}]`) : '';
}

/**
 * Color-code field type
 */
function colorType(typeName: string): string {
  const lower = typeName.toLowerCase();
  if (lower === 'string' || lower === 'text (long)') return pc.green(typeName);
  if (lower === 'integer' || lower === 'float') return pc.yellow(typeName);
  if (lower === 'datetime') return pc.magenta(typeName);
  if (lower === 'enum' || lower === 'json') return pc.blue(typeName);
  if (lower === 'boolean') return pc.white(typeName);
  return typeName;
}

// ANSI escape sequence pattern for stripping color codes
// biome-ignore lint/suspicious/noControlCharactersInRegex: Required for ANSI escape sequence matching
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

/**
 * Pad string to width, accounting for ANSI color codes
 */
function padStringWithAnsi(str: string, width: number): string {
  // Remove ANSI codes to calculate visible length
  const plainLength = str.replace(ANSI_PATTERN, '').length;
  const padding = Math.max(0, width - plainLength);
  return `${str}${' '.repeat(padding)}`;
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 1)}...`;
}
