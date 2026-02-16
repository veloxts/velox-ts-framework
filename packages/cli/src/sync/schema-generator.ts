/**
 * Sync Schema Generator
 *
 * Generates complete TypeScript source for Zod schema files from a
 * `SchemaFilePlan`. Supports two output strategies:
 *
 * - `output`: Plain `z.object()` schemas with optional `WithRelationsSchema`
 * - `resource`: `resourceSchema()` builder with visibility tiers
 *
 * Both strategies generate Create, Update, and List input schemas.
 */

import { deriveEntityNames } from '../generators/utils/naming.js';
import type { SchemaFilePlan, SyncFieldInfo, SyncRelationInfo } from './types.js';

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a complete TypeScript source string for a Zod schema file.
 *
 * The output is a syntactically valid TypeScript module containing:
 * - Imports (zod, optionally resourceSchema from @veloxts/router)
 * - Base/resource schema for all non-sensitive fields
 * - WithRelationsSchema (output strategy only, when relations exist)
 * - CreateSchema (excludes auto-managed, sensitive, and user FK fields)
 * - UpdateSchema (same fields as Create, all optional)
 * - ListSchema (page + perPage with defaults)
 */
export function generateSchemaFile(plan: SchemaFilePlan): string {
	const names = deriveEntityNames(plan.model.name);
	const lines: string[] = [];

	// ── Imports ──────────────────────────────────────────
	lines.push(generateImports(plan));
	lines.push('');

	// ── Base / Resource Schema ──────────────────────────
	if (plan.outputStrategy === 'resource') {
		lines.push(generateResourceSchema(plan, names.pascal));
	} else {
		lines.push(generateBaseSchema(plan, names.pascal));
	}

	// ── WithRelationsSchema (output strategy only) ──────
	if (plan.outputStrategy === 'output' && plan.relations.length > 0) {
		lines.push('');
		lines.push(generateWithRelationsSchema(plan.relations, names.pascal));
	}

	// ── Input Schemas ───────────────────────────────────
	lines.push('');
	lines.push(generateInputSchemas(plan, names.pascal, names.pascalPlural));

	// Ensure trailing newline
	return lines.join('\n') + '\n';
}

// ============================================================================
// Import Generation
// ============================================================================

function generateImports(plan: SchemaFilePlan): string {
	const imports: string[] = ["import { z } from 'zod';"];

	if (plan.outputStrategy === 'resource') {
		imports.push("import { resourceSchema } from '@veloxts/router';");
	}

	return imports.join('\n');
}

// ============================================================================
// Base Schema (output strategy)
// ============================================================================

function generateBaseSchema(plan: SchemaFilePlan, pascal: string): string {
	const nonSensitiveFields = plan.allFields.filter((f) => !f.isSensitive);
	const fieldEntries = nonSensitiveFields.map((f) => `  ${f.name}: ${fieldToZod(f)},`);

	const lines: string[] = [];
	lines.push(`// ${SECTION_CHAR} Base Schema ${SECTION_PAD}`);
	lines.push(`export const ${pascal}Schema = z.object({`);
	lines.push(...fieldEntries);
	lines.push('});');

	return lines.join('\n');
}

// ============================================================================
// Resource Schema (resource strategy)
// ============================================================================

function generateResourceSchema(plan: SchemaFilePlan, pascal: string): string {
	const nonSensitiveFields = plan.allFields.filter((f) => !f.isSensitive);
	const lines: string[] = [];

	lines.push(`// ${SECTION_CHAR} Resource Schema ${SECTION_PAD}`);
	lines.push(`export const ${pascal}Schema = resourceSchema()`);

	for (const field of nonSensitiveFields) {
		const level = getVisibilityLevel(field.name, plan.fieldVisibility);
		lines.push(`  .${level}('${field.name}', ${fieldToZod(field)})`);
	}

	lines.push('  .build();');

	return lines.join('\n');
}

// ============================================================================
// WithRelationsSchema
// ============================================================================

function generateWithRelationsSchema(
	relations: readonly SyncRelationInfo[],
	pascal: string,
): string {
	const relEntries = relations.map((r) => {
		if (r.kind === 'hasMany') {
			return `  ${r.name}: z.array(z.object({ id: z.string() })),`;
		}
		return `  ${r.name}: z.object({ id: z.string() }),`;
	});

	const lines: string[] = [];
	lines.push(`// ${SECTION_CHAR} With Relations Schema ${SECTION_PAD}`);
	lines.push(`export const ${pascal}WithRelationsSchema = ${pascal}Schema.extend({`);
	lines.push(...relEntries);
	lines.push('});');

	return lines.join('\n');
}

// ============================================================================
// Input Schemas (Create, Update, List)
// ============================================================================

function generateInputSchemas(
	plan: SchemaFilePlan,
	pascal: string,
	pascalPlural: string,
): string {
	const inputFields = plan.fields.filter((f) => !f.isUserForeignKey);

	const lines: string[] = [];
	lines.push(`// ${SECTION_CHAR} Input Schemas ${SECTION_PAD}`);

	// ── CreateSchema ──
	const createEntries = inputFields.map((f) => `  ${f.name}: ${fieldToCreateZod(f)},`);
	lines.push(`export const Create${pascal}Schema = z.object({`);
	lines.push(...createEntries);
	lines.push('});');
	lines.push('');

	// ── UpdateSchema ──
	const updateEntries = inputFields.map((f) => `  ${f.name}: ${fieldToUpdateZod(f)},`);
	lines.push(`export const Update${pascal}Schema = z.object({`);
	lines.push(...updateEntries);
	lines.push('});');
	lines.push('');

	// ── ListSchema ──
	lines.push(`export const List${pascalPlural}Schema = z.object({`);
	lines.push('  page: z.number().int().positive().optional().default(1),');
	lines.push('  perPage: z.number().int().min(1).max(100).optional().default(20),');
	lines.push('});');

	return lines.join('\n');
}

// ============================================================================
// Prisma-to-Zod Type Mapping
// ============================================================================

/** Map a field to its base Zod schema string (for output/resource schemas). */
function fieldToZod(field: SyncFieldInfo): string {
	let zod = prismaTypeToZod(field);

	if (field.isOptional) {
		zod += '.nullable()';
	}

	return zod;
}

/** Map a field to its Create input Zod schema string. */
function fieldToCreateZod(field: SyncFieldInfo): string {
	let zod = prismaTypeToZod(field);

	if (!field.isOptional && field.type === 'String' && !field.isId && !isEmailField(field)) {
		zod += '.min(1)';
	}

	if (field.isOptional) {
		zod += '.nullable().optional()';
	}

	return zod;
}

/** Map a field to its Update input Zod schema string. */
function fieldToUpdateZod(field: SyncFieldInfo): string {
	let zod = prismaTypeToZod(field);

	if (!field.isOptional && field.type === 'String' && !field.isId && !isEmailField(field)) {
		zod += '.min(1)';
	}

	if (field.isOptional) {
		zod += '.nullable().optional()';
	} else {
		zod += '.optional()';
	}

	return zod;
}

/** Convert a Prisma type to the base Zod schema call. */
function prismaTypeToZod(field: SyncFieldInfo): string {
	switch (field.type) {
		case 'String': {
			if (field.isId && field.defaultValue === 'uuid()') {
				return 'z.string().uuid()';
			}
			if (isEmailField(field)) {
				return 'z.string().email()';
			}
			return 'z.string()';
		}
		case 'Int':
			return 'z.number().int()';
		case 'Float':
		case 'Decimal':
		case 'BigInt':
			return 'z.number()';
		case 'Boolean':
			return 'z.boolean()';
		case 'DateTime':
			return 'z.date()';
		case 'Json':
			return 'z.record(z.string(), z.unknown())';
		default:
			return 'z.string()';
	}
}

/** Check if a field should use `.email()` validation. */
function isEmailField(field: SyncFieldInfo): boolean {
	return field.name.toLowerCase().includes('email') && field.isUnique;
}

// ============================================================================
// Visibility Helpers
// ============================================================================

function getVisibilityLevel(
	fieldName: string,
	visibility: ReadonlyMap<string, 'public' | 'authenticated' | 'admin'> | undefined,
): 'public' | 'authenticated' | 'admin' {
	if (!visibility) {
		return 'public';
	}
	return visibility.get(fieldName) ?? 'public';
}

// ============================================================================
// Section Comment Constants
// ============================================================================

const SECTION_CHAR = '\u2500\u2500';
const SECTION_PAD = '\u2500'.repeat(40);
